// ============================================================
// POST /api/v1/messages — send a WhatsApp message via API key.
//
// Accepts:
//   text message:
//     { "to": "+919876543210", "type": "text", "text": "Hello!" }
//
//   template message:
//     {
//       "to": "+919876543210",
//       "type": "template",
//       "template": {
//         "name": "invoice_sent",
//         "language": "en",           // optional, defaults to "en"
//         "params": ["John", "Amica", "INV-1001", "$100", "2024-12-01", "https://..."]
//       }
//     }
//
// Requires scope: messages:send
// ============================================================

import { requireApiKey } from '@/lib/auth/api-context'
import {
  ok,
  badRequest,
  toApiErrorResponse,
} from '@/lib/api/v1/respond'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import {
  sendTextMessage,
  sendTemplateMessage,
} from '@/lib/whatsapp/meta-api'
import {
  sanitizePhoneForMeta,
  isValidE164,
} from '@/lib/whatsapp/phone-utils'

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'messages:send')
    const { supabase, accountId } = ctx

    // ── Parse body ───────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      throw badRequest('Invalid JSON body')
    }

    const { to, type, text, template } = body as {
      to?: string
      type?: string
      text?: string
      template?: {
        name?: string
        language?: string
        params?: string[]
      }
    }

    if (!to || typeof to !== 'string') {
      throw badRequest('"to" (phone number in E.164 format, e.g. +919876543210) is required')
    }

    const phone = sanitizePhoneForMeta(to)
    if (!isValidE164(phone)) {
      throw badRequest(
        `"to" must be a valid E.164 phone number (e.g. +919876543210). Got: ${to}`,
      )
    }

    if (!type || (type !== 'text' && type !== 'template')) {
      throw badRequest('"type" must be "text" or "template"')
    }

    if (type === 'text') {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw badRequest('"text" is required for type "text"')
      }
    }

    if (type === 'template') {
      if (!template || typeof template !== 'object') {
        throw badRequest('"template" object is required for type "template"')
      }
      if (!template.name || typeof template.name !== 'string') {
        throw badRequest('"template.name" is required')
      }
    }

    // ── Fetch WhatsApp config for this account ────────────────────
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, user_id')
      .eq('account_id', accountId)
      .single()

    if (configError || !config) {
      throw badRequest(
        'WhatsApp is not configured for this account. Please set up your WhatsApp integration in Settings first.',
      )
    }

    const accessToken = decrypt(config.access_token)

    // Self-heal legacy CBC tokens (fire-and-forget)
    if (isLegacyFormat(config.access_token)) {
      void supabase
        .from('whatsapp_config')
        .update({ access_token: encrypt(accessToken) })
        .eq('account_id', accountId)
        .then(({ error }) => {
          if (error) {
            console.warn('[api/v1/messages] token GCM upgrade failed:', error.message)
          }
        })
    }

    const phoneNumberId = config.phone_number_id

    // ── Send message ──────────────────────────────────────────────
    let messageId: string

    try {
      if (type === 'text') {
        const result = await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: phone,
          text: text as string,
        })
        messageId = result.messageId
      } else {
        // template
        const tpl = template as { name: string; language?: string; params?: string[] }
        const result = await sendTemplateMessage({
          phoneNumberId,
          accessToken,
          to: phone,
          templateName: tpl.name,
          language: tpl.language ?? 'en',
          params: tpl.params,
        })
        messageId = result.messageId
      }
    } catch (sendError) {
      // Catch Meta API errors (like invalid template params) and surface them as 400 Bad Request
      throw badRequest(sendError instanceof Error ? sendError.message : String(sendError))
    }

    // ── Log message to database ──────────────────────────────────────
    try {
      // 1. Find or create contact
      let contactId: string | null = null
      const existingContact = await findExistingContact(supabase, accountId, phone)
      if (existingContact) {
        contactId = existingContact.id
      } else {
        const { data: newContact, error: createError } = await supabase
          .from('contacts')
          .insert({
            account_id: accountId,
            user_id: config.user_id,
            phone,
            name: phone,
          })
          .select('id')
          .single()

        if (createError && isUniqueViolation(createError)) {
          const raced = await findExistingContact(supabase, accountId, phone)
          if (raced) contactId = raced.id
        } else if (newContact) {
          contactId = newContact.id
        }
      }

      if (contactId) {
        // 2. Find or create conversation
        let conversationId: string | null = null
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('account_id', accountId)
          .eq('contact_id', contactId)
          .maybeSingle()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              account_id: accountId,
              user_id: config.user_id,
              contact_id: contactId,
            })
            .select('id')
            .single()
          if (newConv) conversationId = newConv.id
        }

        // 3. Insert into messages
        if (conversationId) {
          let contentText = type === 'text' ? (text as string) : null
          const templateName = type === 'template' ? (template as { name: string }).name : null
          let lastMessageText = type === 'text' ? (text as string) : `[Template: ${templateName}]`

          if (type === 'template' && templateName) {
             const { data: tplRows } = await supabase
               .from('message_templates')
               .select('body_text')
               .eq('account_id', accountId)
               .eq('name', templateName)
               .limit(1)
             
             if (tplRows && tplRows.length > 0 && tplRows[0].body_text) {
               const params = (template as { params?: string[] }).params || []
               contentText = tplRows[0].body_text.replace(/\{\{(\d+)\}\}/g, (_: string, raw: string) => {
                 const idx = Number(raw) - 1;
                 return params[idx] ?? `{{${raw}}}`;
               });
               lastMessageText = contentText as string
             }
          }

          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_type: 'agent',
            content_type: type,
            content_text: contentText,
            template_name: templateName,
            message_id: messageId,
            status: 'sent',
          })

          // 4. Update conversation
          await supabase
            .from('conversations')
            .update({
              last_message_text: lastMessageText,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId)
        }
      }
    } catch (dbErr) {
      console.error('[api/v1/messages] Failed to log message to DB:', dbErr)
    }

    return ok({ message_id: messageId, to: phone, type }, 200)
  } catch (err) {
    return toApiErrorResponse(err)
  }
}
