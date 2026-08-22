import { createClient } from '@supabase/supabase-js'
import { sendTextMessage, sendTemplateMessage } from './meta-api'
import { normalizePhone } from './phone-utils'
import { decrypt } from './encryption'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface MaskedSession {
  id: string
  accountId: string
  agentPhone: string
  agentName: string
  customerPhone: string
  customerName: string
  templateName?: string
  status: 'active' | 'closed' | 'expired'
  expiresAt: string
  createdAt: string
  lastActivityAt: string
}

export interface InitiateSessionArgs {
  accountId: string
  agentPhone: string
  agentName?: string
  customerPhone: string
  customerName?: string
  templateName?: string
  templateParams?: string[]
}

/**
 * Initiate a 2-way WhatsApp Masked Proxy Relay Session between a Field Agent
 * (Side A) and a Customer (Side B).
 */
export async function initiateMaskedSession(
  args: InitiateSessionArgs
): Promise<MaskedSession> {
  const supabase = getAdminClient()
  const cleanAgentPhone = normalizePhone(args.agentPhone)
  const cleanCustomerPhone = normalizePhone(args.customerPhone)

  if (!cleanAgentPhone || cleanAgentPhone.length < 10) {
    throw new Error('Invalid agent phone number')
  }
  if (!cleanCustomerPhone || cleanCustomerPhone.length < 10) {
    throw new Error('Invalid customer phone number')
  }

  // 1. Fetch WABA credentials for this account
  const { data: config, error: configErr } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()

  if (configErr || !config) {
    throw new Error('WhatsApp Business API is not configured for this account.')
  }

  const accessToken = decrypt(config.access_token)
  const phoneNumberId = config.phone_number_id

  // 2. Find or create customer contact
  let { data: customerContact } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', args.accountId)
    .eq('phone', cleanCustomerPhone)
    .maybeSingle()

  if (!customerContact) {
    const { data: newContact, error: createErr } = await supabase
      .from('contacts')
      .insert({
        account_id: args.accountId,
        phone: cleanCustomerPhone,
        name: args.customerName || `Customer (${cleanCustomerPhone.slice(-4)})`,
      })
      .select()
      .single()

    if (createErr || !newContact) {
      throw new Error('Failed to create customer contact: ' + (createErr?.message || ''))
    }
    customerContact = newContact
  }

  if (!customerContact) {
    throw new Error('Customer contact could not be resolved.')
  }

  const contactId: string = customerContact.id
  const customerName: string = customerContact.name || args.customerName || 'Customer'
  const agentName: string = args.agentName || `Agent (${cleanAgentPhone.slice(-4)})`

  // 3. Store session metadata in custom_fields / contact_custom_values
  const relayFields = [
    { name: '__relay_agent_phone', label: 'Relay Agent Phone' },
    { name: '__relay_agent_name', label: 'Relay Agent Name' },
    { name: '__relay_status', label: 'Relay Status' },
    { name: '__relay_expires_at', label: 'Relay Expires At' },
    { name: '__relay_template', label: 'Relay Template' },
  ]

  const fieldIdMap: Record<string, string> = {}
  for (const f of relayFields) {
    let { data: field } = await supabase
      .from('custom_fields')
      .select('id')
      .eq('account_id', args.accountId)
      .eq('name', f.name)
      .maybeSingle()

    if (!field) {
      const { data: newField } = await supabase
        .from('custom_fields')
        .insert({
          account_id: args.accountId,
          name: f.name,
          label: f.label,
          field_type: 'text',
        })
        .select()
        .single()
      field = newField
    }
    if (field) fieldIdMap[f.name] = field.id
  }

  // 4. Save session custom values for customer contact
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const nowStr = new Date().toISOString()

  const customValuesToUpsert = [
    { contact_id: contactId, custom_field_id: fieldIdMap['__relay_agent_phone'], value: cleanAgentPhone },
    { contact_id: contactId, custom_field_id: fieldIdMap['__relay_agent_name'], value: agentName },
    { contact_id: contactId, custom_field_id: fieldIdMap['__relay_status'], value: 'active' },
    { contact_id: contactId, custom_field_id: fieldIdMap['__relay_expires_at'], value: expiresAt },
    { contact_id: contactId, custom_field_id: fieldIdMap['__relay_template'], value: args.templateName || '' },
  ]

  for (const item of customValuesToUpsert) {
    if (item.custom_field_id) {
      await supabase.from('contact_custom_values').upsert(item, { onConflict: 'contact_id,custom_field_id' })
    }
  }

  // 5. Send approved Meta WhatsApp Template to Customer
  const templateToUse = args.templateName || 'property_sale_doon_divine'
  try {
    await sendTemplateMessage({
      phoneNumberId,
      accessToken,
      to: cleanCustomerPhone,
      templateName: templateToUse,
      language: 'en_US',
      params: [customerName],
    })
  } catch (err) {
    console.error('[masked-relay] Error sending template to customer:', err)
  }

  // 6. Send confirmation WhatsApp message to Field Agent
  const agentNotice = `🔒 *WhatsApp Masked Relay Activated!*\n\nYou are now connected with *${customerName}* (+${cleanCustomerPhone}).\n\n💬 *Instructions:*\n- Type your messages in this chat to reply to the customer.\n- All your messages will be sent from our official Business Number.\n- Neither you nor the customer will see each other's personal phone number.\n\nType *STOP* to end the session.`

  try {
    await sendTextMessage({
      phoneNumberId,
      accessToken,
      to: cleanAgentPhone,
      text: agentNotice,
    })
  } catch (err) {
    console.error('[masked-relay] Error notifying agent:', err)
  }

  return {
    id: contactId,
    accountId: args.accountId,
    agentPhone: cleanAgentPhone,
    agentName,
    customerPhone: cleanCustomerPhone,
    customerName,
    templateName: templateToUse,
    status: 'active',
    expiresAt,
    createdAt: nowStr,
    lastActivityAt: nowStr,
  }
}

/**
 * Handle incoming WhatsApp messages and relay them if part of an active Masked Session.
 */
export async function routeMaskedRelayMessage(payload: {
  accountId: string
  senderPhone: string
  contentText: string | null
  mediaUrl: string | null
  mediaType: string | null
}): Promise<{ handled: boolean; direction?: 'agent_to_customer' | 'customer_to_agent' }> {
  const supabase = getAdminClient()
  const cleanSender = normalizePhone(payload.senderPhone)
  if (!cleanSender) return { handled: false }

  // 1. Fetch WABA credentials
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', payload.accountId)
    .maybeSingle()

  if (!config) return { handled: false }

  const accessToken = decrypt(config.access_token)
  const phoneNumberId = config.phone_number_id

  // 2. Check if sender is an AGENT in an active relay session
  const { data: agentCustomValues } = await supabase
    .from('contact_custom_values')
    .select('contact_id, value, custom_field:custom_fields(name)')
    .eq('value', cleanSender)

  // Find active customer contact linked to this agent
  let activeCustomerContactId: string | null = null
  for (const cv of agentCustomValues || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((cv.custom_field as any)?.name === '__relay_agent_phone') {
      const { data: statusRow } = await supabase
        .from('contact_custom_values')
        .select('value, custom_field:custom_fields(name)')
        .eq('contact_id', cv.contact_id)

      const statusVal = statusRow?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r) => (r.custom_field as any)?.name === '__relay_status'
      )?.value

      if (statusVal === 'active') {
        activeCustomerContactId = cv.contact_id
        break
      }
    }
  }

  // CASE A: Sender is FIELD AGENT -> Forward to CUSTOMER
  if (activeCustomerContactId) {
    const { data: customerContact } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', activeCustomerContactId)
      .single()

    if (customerContact?.phone) {
      const cleanText = (payload.contentText || '').trim().toUpperCase()
      if (cleanText === 'STOP' || cleanText === 'END' || cleanText === 'CLOSE') {
        await closeMaskedSession(payload.accountId, activeCustomerContactId)
        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: cleanSender,
          text: '🔒 *Masked Relay Session Closed.* Messages will no longer be relayed.',
        })
        return { handled: true, direction: 'agent_to_customer' }
      }

      if (payload.contentText) {
        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: customerContact.phone,
          text: payload.contentText,
        })
      }

      let { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('account_id', payload.accountId)
        .eq('contact_id', activeCustomerContactId)
        .maybeSingle()

      if (!conv) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({
            account_id: payload.accountId,
            contact_id: activeCustomerContactId,
            status: 'open',
            last_message_text: payload.contentText || '[Relay Message]',
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()
        conv = created
      }

      if (conv) {
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_type: 'agent',
          content_type: 'text',
          content_text: `[Field Agent]: ${payload.contentText || ''}`,
          media_url: payload.mediaUrl,
          status: 'sent',
          created_at: new Date().toISOString(),
        })
      }

      return { handled: true, direction: 'agent_to_customer' }
    }
  }

  // CASE B: Sender is CUSTOMER -> Check if customer has an active relay session with an Agent
  const { data: customerContact } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('account_id', payload.accountId)
    .eq('phone', cleanSender)
    .maybeSingle()

  if (customerContact) {
    const { data: cvs } = await supabase
      .from('contact_custom_values')
      .select('value, custom_field:custom_fields(name)')
      .eq('contact_id', customerContact.id)

    let agentPhone: string | null = null
    let relayStatus: string | null = null

    for (const cv of cvs || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (cv.custom_field as any)?.name
      if (name === '__relay_agent_phone') agentPhone = cv.value
      if (name === '__relay_status') relayStatus = cv.value
    }

    if (agentPhone && relayStatus === 'active') {
      const customerName = customerContact.name || `Customer (${cleanSender.slice(-4)})`
      const relayedText = `💬 *[Customer - ${customerName}]*:\n${payload.contentText || '[Media attachment]'}`

      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: agentPhone,
        text: relayedText,
      })

      return { handled: true, direction: 'customer_to_agent' }
    }
  }

  return { handled: false }
}

/**
 * Close an active Masked Relay Session
 */
export async function closeMaskedSession(
  accountId: string,
  contactId: string
): Promise<void> {
  const supabase = getAdminClient()
  const { data: statusField } = await supabase
    .from('custom_fields')
    .select('id')
    .eq('account_id', accountId)
    .eq('name', '__relay_status')
    .maybeSingle()

  if (statusField) {
    await supabase.from('contact_custom_values').upsert({
      contact_id: contactId,
      custom_field_id: statusField.id,
      value: 'closed',
    }, { onConflict: 'contact_id,custom_field_id' })
  }
}

/**
 * Fetch all active & recent masked sessions for the Dashboard UI
 */
export async function fetchMaskedSessions(
  accountId: string
): Promise<MaskedSession[]> {
  const supabase = getAdminClient()
  const { data: statusFields } = await supabase
    .from('custom_fields')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', [
      '__relay_agent_phone',
      '__relay_agent_name',
      '__relay_status',
      '__relay_expires_at',
      '__relay_template',
    ])

  if (!statusFields || statusFields.length === 0) return []

  const fieldIdMap: Record<string, string> = {}
  statusFields.forEach((f) => {
    fieldIdMap[f.name] = f.id
  })

  const statusFieldId = fieldIdMap['__relay_status']
  if (!statusFieldId) return []

  const { data: cvRows } = await supabase
    .from('contact_custom_values')
    .select('contact_id, value, updated_at, contact:contacts(*)')
    .eq('custom_field_id', statusFieldId)
    .order('updated_at', { ascending: false })

  const sessions: MaskedSession[] = []

  for (const row of cvRows || []) {
    if (!row.contact) continue

    const { data: allCvs } = await supabase
      .from('contact_custom_values')
      .select('value, custom_field_id')
      .eq('contact_id', row.contact_id)

    const valuesByFieldId: Record<string, string> = {}
    allCvs?.forEach((cv) => {
      valuesByFieldId[cv.custom_field_id] = cv.value || ''
    })

    const agentPhone = valuesByFieldId[fieldIdMap['__relay_agent_phone']] || ''
    const agentName = valuesByFieldId[fieldIdMap['__relay_agent_name']] || 'Agent'
    const statusVal = (valuesByFieldId[fieldIdMap['__relay_status']] || 'closed') as MaskedSession['status']
    const expiresAt = valuesByFieldId[fieldIdMap['__relay_expires_at']] || new Date().toISOString()
    const templateName = valuesByFieldId[fieldIdMap['__relay_template']] || ''

    if (agentPhone) {
      sessions.push({
        id: row.contact_id,
        accountId,
        agentPhone,
        agentName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerPhone: (row.contact as any).phone || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customerName: (row.contact as any).name || 'Customer',
        templateName,
        status: statusVal,
        expiresAt,
        createdAt: row.updated_at,
        lastActivityAt: row.updated_at,
      })
    }
  }

  return sessions
}
