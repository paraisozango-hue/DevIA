-- DevIA — estrutura multi-tenant inicial
-- Aplicar no SQL Editor do projeto Supabase externo.
-- A identidade vem de auth.users (Supabase Auth).
-- Segredos de OAuth/API NÃO devem ser armazenados em texto nesta tabela;
-- o backend/Edge Function deverá guardar referências a segredos protegidos.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  repository text,
  repository_id bigint,
  default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai')),
  model text not null,
  status text not null check (status in ('started', 'completed', 'error')),
  input_chars integer not null default 0 check (input_chars >= 0),
  output_chars integer not null default 0 check (output_chars >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('github', 'supabase')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error')),
  display_name text,
  external_account_id text,
  external_project_id text,
  metadata jsonb not null default '{}'::jsonb,
  secret_ref text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists profiles_updated_at_idx on public.profiles (updated_at);
create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists projects_workspace_id_idx on public.projects (workspace_id);
create index if not exists projects_repository_id_idx on public.projects (repository_id);
create index if not exists conversations_project_id_idx on public.conversations (project_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists integrations_workspace_id_idx on public.integrations (workspace_id);
create index if not exists integrations_external_account_id_idx on public.integrations (external_account_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at before update on public.integrations
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.integrations enable row level security;
alter table public.ai_runs enable row level security;

revoke all on table public.profiles, public.workspaces, public.workspace_members,
  public.projects, public.conversations, public.messages, public.integrations from anon;

grant select, insert, update, delete on table public.profiles, public.workspaces,
  public.workspace_members, public.projects, public.conversations,
  public.messages, public.integrations to authenticated;
grant select on table public.ai_runs to authenticated;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "users can create own profile" on public.profiles;
create policy "users can create own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "members can read workspaces" on public.workspaces;
create policy "members can read workspaces" on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists "authenticated users can create workspaces" on public.workspaces;
create policy "authenticated users can create workspaces" on public.workspaces for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "workspace admins can update workspaces" on public.workspaces;
create policy "workspace admins can update workspaces" on public.workspaces for update to authenticated
using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists "workspace owners can delete workspaces" on public.workspaces;
create policy "workspace owners can delete workspaces" on public.workspaces for delete to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "members can read workspace membership" on public.workspace_members;
create policy "members can read workspace membership" on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can add members" on public.workspace_members;
create policy "workspace admins can add members" on public.workspace_members for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace admins can update members" on public.workspace_members;
create policy "workspace admins can update members" on public.workspace_members for update to authenticated
using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace admins can remove members" on public.workspace_members;
create policy "workspace admins can remove members" on public.workspace_members for delete to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "members can read projects" on public.projects;
create policy "members can read projects" on public.projects for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can create projects" on public.projects;
create policy "members can create projects" on public.projects for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can update projects" on public.projects;
create policy "members can update projects" on public.projects for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can delete projects" on public.projects;
create policy "workspace admins can delete projects" on public.projects for delete to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "members can read conversations" on public.conversations;
create policy "members can read conversations" on public.conversations for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = conversations.project_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "members can create conversations" on public.conversations;
create policy "members can create conversations" on public.conversations for insert to authenticated
with check (exists (
  select 1 from public.projects p
  where p.id = conversations.project_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "members can update conversations" on public.conversations;
create policy "members can update conversations" on public.conversations for update to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = conversations.project_id and public.is_workspace_member(p.workspace_id)
))
with check (exists (
  select 1 from public.projects p
  where p.id = conversations.project_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "workspace admins can delete conversations" on public.conversations;
create policy "workspace admins can delete conversations" on public.conversations for delete to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = conversations.project_id and public.is_workspace_admin(p.workspace_id)
));

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages" on public.messages for select to authenticated
using (exists (
  select 1 from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = messages.conversation_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "members can create messages" on public.messages;
create policy "members can create messages" on public.messages for insert to authenticated
with check (exists (
  select 1 from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = messages.conversation_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "members can update messages" on public.messages;
create policy "members can update messages" on public.messages for update to authenticated
using (exists (
  select 1 from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = messages.conversation_id and public.is_workspace_member(p.workspace_id)
))
with check (exists (
  select 1 from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = messages.conversation_id and public.is_workspace_member(p.workspace_id)
));

drop policy if exists "workspace admins can delete messages" on public.messages;
create policy "workspace admins can delete messages" on public.messages for delete to authenticated
using (exists (
  select 1 from public.conversations c
  join public.projects p on p.id = c.project_id
  where c.id = messages.conversation_id and public.is_workspace_admin(p.workspace_id)
));

drop policy if exists "members can read ai runs" on public.ai_runs;
create policy "members can read ai runs" on public.ai_runs for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "members can read integrations" on public.integrations;
create policy "members can read integrations" on public.integrations for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace admins can create integrations" on public.integrations;
create policy "workspace admins can create integrations" on public.integrations for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace admins can update integrations" on public.integrations;
create policy "workspace admins can update integrations" on public.integrations for update to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace admins can delete integrations" on public.integrations;
create policy "workspace admins can delete integrations" on public.integrations for delete to authenticated
using (public.is_workspace_admin(workspace_id));

-- O owner entra automaticamente no workspace.
create or replace function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_add_owner on public.workspaces;
create trigger workspaces_add_owner after insert on public.workspaces
for each row execute function public.add_workspace_owner();

revoke execute on function public.add_workspace_owner() from public, anon, authenticated;

-- Perfil básico criado automaticamente após signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;


-- Server-backed DevIA chat history
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon;
grant select, insert on public.chat_messages to authenticated;

create policy "members can read chat messages"
on public.chat_messages for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "members can create own chat messages"
on public.chat_messages for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create index chat_messages_workspace_created_idx
on public.chat_messages (workspace_id, created_at desc);


-- Chat audio + Preview persistence
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('audio')),
  storage_bucket text not null default 'chat-audio',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from anon;
grant select, insert on public.chat_attachments to authenticated;

drop policy if exists "members can read chat attachments" on public.chat_attachments;
create policy "members can read chat attachments" on public.chat_attachments for select to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can create own chat attachments" on public.chat_attachments;
create policy "members can create own chat attachments" on public.chat_attachments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.chat_messages m
    where m.id = message_id and m.workspace_id = workspace_id and m.user_id = user_id
  )
);

create index if not exists chat_attachments_message_idx on public.chat_attachments(message_id);
create index if not exists chat_attachments_workspace_created_idx on public.chat_attachments(workspace_id, created_at desc);

create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_full_name text not null,
  ref text not null default 'main',
  preview_url text not null,
  status text not null default 'ready' check (status in ('ready','expired','error')),
  expires_at timestamptz not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.preview_sessions enable row level security;
revoke all on public.preview_sessions from anon;
grant select, insert, update on public.preview_sessions to authenticated;

drop policy if exists "members can read preview sessions" on public.preview_sessions;
create policy "members can read preview sessions" on public.preview_sessions for select to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can create preview sessions" on public.preview_sessions;
create policy "members can create preview sessions" on public.preview_sessions for insert to authenticated
with check (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

drop policy if exists "members can update preview sessions" on public.preview_sessions;
create policy "members can update preview sessions" on public.preview_sessions for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

alter table public.chat_messages add column if not exists message_type text not null default 'text'
  check (message_type in ('text','audio','mixed'));

create index if not exists chat_messages_workspace_type_idx
  on public.chat_messages(workspace_id, message_type, created_at desc);

insert into storage.buckets (id,name,public)
values ('chat-audio','chat-audio',false)
on conflict (id) do update set public=false;

drop policy if exists "chat audio upload by workspace members" on storage.objects;
create policy "chat audio upload by workspace members" on storage.objects for insert to authenticated
with check (
  bucket_id='chat-audio'
  and (storage.foldername(name))[1] <> ''
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "chat audio read by workspace members" on storage.objects;
create policy "chat audio read by workspace members" on storage.objects for select to authenticated
using (
  bucket_id='chat-audio'
  and (storage.foldername(name))[1] <> ''
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
