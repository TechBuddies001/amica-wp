import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

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

    const { data: config, error: configError } = await supabase
      .from('ai_config')
      .select('openai_api_key, system_prompt')
      .eq('account_id', accountId)
      .maybeSingle();

    if (configError) {
      return NextResponse.json({ error: 'Failed to fetch AI configuration' }, { status: 500 });
    }

    let hasApiKey = false;
    let systemPrompt = 'You are a helpful and polite customer support assistant.';

    if (config) {
      if (config.openai_api_key) {
        // Just checking if we can decrypt it, we don't return the raw key
        try {
          decrypt(config.openai_api_key);
          hasApiKey = true;
        } catch (err) {
          console.error('[settings/ai GET] Token decryption failed:', err);
          return NextResponse.json(
            { error: 'Token corrupted. Please re-enter your API key.' },
            { status: 500 }
          );
        }
      }
      if (config.system_prompt) {
        systemPrompt = config.system_prompt;
      }
    }

    return NextResponse.json({ hasApiKey, systemPrompt });
  } catch (error) {
    console.error('Error in AI settings GET:', error);
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
    const { openai_api_key, system_prompt } = body;

    const { data: existing } = await supabase
      .from('ai_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    let encryptedKey: string | undefined;

    if (openai_api_key) {
      // Validate with OpenAI API
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${openai_api_key}`,
          },
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Invalid OpenAI API Key' }, { status: 400 });
        }
      } catch (err) {
        return NextResponse.json({ error: 'Failed to validate API Key with OpenAI' }, { status: 400 });
      }

      try {
        encryptedKey = encrypt(openai_api_key);
      } catch (err) {
        return NextResponse.json(
          { error: 'Failed to encrypt token.' },
          { status: 500 }
        );
      }
    }

    const payload: any = {
      account_id: accountId,
      updated_at: new Date().toISOString(),
    };

    if (encryptedKey) {
      payload.openai_api_key = encryptedKey;
    }
    if (system_prompt !== undefined) {
      payload.system_prompt = system_prompt;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('ai_config')
        .update(payload)
        .eq('account_id', accountId);
      if (updateError) {
        console.error('Error updating ai_config:', updateError);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase
        .from('ai_config')
        .insert(payload);
      if (insertError) {
        console.error('Error inserting ai_config:', insertError);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in AI settings POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
