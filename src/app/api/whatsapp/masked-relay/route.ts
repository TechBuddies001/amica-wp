import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  initiateMaskedSession,
  fetchMaskedSessions,
  closeMaskedSession,
} from '@/lib/whatsapp/masked-relay'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account linked' }, { status: 400 })
    }

    const sessions = await fetchMaskedSessions(profile.account_id)
    return NextResponse.json({ sessions })
  } catch (error: any) {
    console.error('Error in masked-relay GET:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch masked sessions' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account linked' }, { status: 400 })
    }

    const body = await req.json()
    const { agentPhone, agentName, customerPhone, customerName, templateName } = body

    if (!agentPhone || !customerPhone) {
      return NextResponse.json(
        { error: 'agentPhone and customerPhone are required' },
        { status: 400 }
      )
    }

    const newSession = await initiateMaskedSession({
      accountId: profile.account_id,
      agentPhone,
      agentName,
      customerPhone,
      customerName,
      templateName,
    })

    return NextResponse.json({ success: true, session: newSession })
  } catch (error: any) {
    console.error('Error in masked-relay POST:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to initiate masked session' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', session.user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'No account linked' }, { status: 400 })
    }

    const body = await req.json()
    const { contactId, action } = body

    if (!contactId || action !== 'close') {
      return NextResponse.json(
        { error: 'contactId and action=close required' },
        { status: 400 }
      )
    }

    await closeMaskedSession(profile.account_id, contactId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in masked-relay PATCH:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to close masked session' },
      { status: 500 }
    )
  }
}
