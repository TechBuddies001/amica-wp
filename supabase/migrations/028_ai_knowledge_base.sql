-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table for OpenAI API Key and System Prompts
create table if not exists ai_config (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade unique,
  openai_api_key text,
  system_prompt text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security for ai_config
alter table ai_config enable row level security;
create policy "Users can view their own account ai_config"
  on ai_config for select
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );
create policy "Users can insert their own account ai_config"
  on ai_config for insert
  with check ( account_id in (select account_id from account_members where user_id = auth.uid()) );
create policy "Users can update their own account ai_config"
  on ai_config for update
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );

-- Table for Knowledge Base Documents
create table if not exists kb_documents (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security for kb_documents
alter table kb_documents enable row level security;
create policy "Users can view their own account kb_documents"
  on kb_documents for select
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );
create policy "Users can modify their own account kb_documents"
  on kb_documents for all
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );

-- Table for Knowledge Base Embeddings (Chunks)
create table if not exists kb_embeddings (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references kb_documents(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- 1536 is for text-embedding-ada-002
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security for kb_embeddings
alter table kb_embeddings enable row level security;
create policy "Users can view their own account kb_embeddings"
  on kb_embeddings for select
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );
create policy "Users can modify their own account kb_embeddings"
  on kb_embeddings for all
  using ( account_id in (select account_id from account_members where user_id = auth.uid()) );

-- Create an index for faster similarity searches (IVFFlat)
create index if not exists kb_embeddings_embedding_idx on kb_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create a function to search the knowledge base embeddings
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
