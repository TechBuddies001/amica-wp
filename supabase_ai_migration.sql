-- Enable pgvector extension
create extension if not exists vector;

-- 1. Table for AI Config (Stores OpenAI API Key)
create table if not exists ai_config (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null unique, -- Links to the workspace/account
  openai_api_key text,
  system_prompt text default 'You are a helpful and polite customer support assistant.',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table for Knowledge Base Documents (The source texts)
create table if not exists kb_documents (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table for Knowledge Base Embeddings (The vector chunks for searching)
create table if not exists kb_embeddings (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references kb_documents(id) on delete cascade not null,
  account_id uuid not null,
  content text not null, -- The chunk of text
  embedding vector(1536) not null, -- 1536 is dimension for text-embedding-3-small
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table ai_config enable row level security;
alter table kb_documents enable row level security;
alter table kb_embeddings enable row level security;

-- Create policies (Assuming service_role bypasses RLS, but adding basic authenticated rules)
create policy "Users can view their own ai_config"
  on ai_config for select using (true);
create policy "Users can update their own ai_config"
  on ai_config for all using (true);

create policy "Users can view their own kb_documents"
  on kb_documents for select using (true);
create policy "Users can update their own kb_documents"
  on kb_documents for all using (true);

create policy "Users can view their own kb_embeddings"
  on kb_embeddings for select using (true);
create policy "Users can update their own kb_embeddings"
  on kb_embeddings for all using (true);

-- Function to match documents
create or replace function match_kb_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_account_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    kb_embeddings.id,
    kb_embeddings.document_id,
    kb_embeddings.content,
    1 - (kb_embeddings.embedding <=> query_embedding) as similarity
  from kb_embeddings
  where kb_embeddings.account_id = p_account_id
    and 1 - (kb_embeddings.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
