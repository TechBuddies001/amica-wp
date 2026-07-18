import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/whatsapp/encryption';

interface RAGConfig {
  apiKey: string;
  systemPrompt: string;
}

export async function getAiConfig(accountId: string): Promise<RAGConfig | null> {
  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from('ai_config')
    .select('openai_api_key, system_prompt')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !config || !config.openai_api_key) {
    return null;
  }

  try {
    const apiKey = decrypt(config.openai_api_key);
    return {
      apiKey,
      systemPrompt: config.system_prompt || 'You are a helpful customer support assistant.',
    };
  } catch (err) {
    console.error('Failed to decrypt OpenAI API Key', err);
    return null;
  }
}

/**
 * Splits text into chunks of approximately maxTokens length.
 * Extremely naive chunking for this prototype.
 */
function chunkText(text: string, maxTokens = 500): string[] {
  // A rough approximation: 1 token ~ 4 characters
  const chunkSize = maxTokens * 4;
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i + chunkSize;
    if (end < text.length) {
      // Try to break at a newline or space
      const nextNewline = text.lastIndexOf('\n', end);
      const nextSpace = text.lastIndexOf(' ', end);
      
      if (nextNewline > i && nextNewline > end - 200) {
        end = nextNewline;
      } else if (nextSpace > i) {
        end = nextSpace;
      }
    }
    chunks.push(text.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(c => c.length > 0);
}

/**
 * Generate embeddings using OpenAI's API directly.
 */
async function generateEmbeddings(textInputs: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: textInputs,
      model: 'text-embedding-ada-002',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Embeddings API failed: ${errText}`);
  }

  const data = await response.json();
  // Return the embedding vectors
  return data.data.map((d: any) => d.embedding);
}

/**
 * Indexes a document into the Knowledge Base
 */
export async function indexDocument(accountId: string, title: string, content: string) {
  const config = await getAiConfig(accountId);
  if (!config) throw new Error('AI not configured');

  const supabase = await createClient();
  
  // 1. Create the document record
  const { data: doc, error: docError } = await supabase
    .from('kb_documents')
    .insert({ account_id: accountId, title, content })
    .select('id')
    .single();

  if (docError || !doc) {
    throw new Error('Failed to create kb_documents record');
  }

  // 2. Chunk the content
  const chunks = chunkText(content);
  
  if (chunks.length === 0) return doc;

  // 3. Generate embeddings
  const embeddings = await generateEmbeddings(chunks, config.apiKey);

  // 4. Save embeddings
  const embeddingsToInsert = chunks.map((chunk, i) => ({
    document_id: doc.id,
    account_id: accountId,
    content: chunk,
    embedding: embeddings[i],
  }));

  const { error: embedError } = await supabase
    .from('kb_embeddings')
    .insert(embeddingsToInsert);

  if (embedError) {
    console.error('Failed to insert embeddings', embedError);
    // Might want to clean up the document here or leave it orphaned
  }

  return doc;
}

/**
 * Search the knowledge base
 */
export async function searchKnowledgeBase(accountId: string, query: string, apiKey: string, limit = 3) {
  // 1. Embed the user's query
  const embeddings = await generateEmbeddings([query], apiKey);
  const queryEmbedding = embeddings[0];

  // 2. Search using Supabase RPC `match_kb_documents`
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('match_kb_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.75, // Adjust similarity threshold
    match_count: limit,
    p_account_id: accountId,
  });

  if (error) {
    console.error('Vector search error', error);
    return [];
  }

  return data as Array<{ id: string; document_id: string; content: string; similarity: number }>;
}

/**
 * Generate a reply using RAG
 */
export async function generateRAGReply(accountId: string, userMessage: string): Promise<string | null> {
  const config = await getAiConfig(accountId);
  if (!config) return null;

  // Find relevant context
  const matches = await searchKnowledgeBase(accountId, userMessage, config.apiKey);
  
  let contextText = '';
  if (matches && matches.length > 0) {
    contextText = 'Use the following knowledge base context to answer the user query if applicable:\n\n' + 
      matches.map(m => m.content).join('\n---\n');
  }

  const messages = [
    { role: 'system', content: config.systemPrompt },
    { role: 'system', content: contextText },
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3, // Lower temperature for more factual responses
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    console.error('OpenAI Chat API failed:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || null;
}
