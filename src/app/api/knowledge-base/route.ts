import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { indexDocument } from '@/lib/ai/rag';

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.account_id) return null;
  return data.account_id as string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = await resolveAccountId(supabase, user.id);
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 });
    }

    const { data: documents, error } = await supabase
      .from('kb_documents')
      .select('id, title, content, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge base documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error in Knowledge Base GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = await resolveAccountId(supabase, user.id);
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    try {
      // indexDocument will save to kb_documents, generate embeddings, and save to kb_embeddings
      const doc = await indexDocument(accountId, title, content);
      return NextResponse.json({ success: true, document: doc });
    } catch (err: any) {
      if (err.message === 'AI not configured') {
        return NextResponse.json({ error: 'OpenAI API key is not configured in AI Settings.' }, { status: 400 });
      }
      console.error('Error indexing document:', err);
      return NextResponse.json({ error: 'Failed to index document: ' + err.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in Knowledge Base POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
