-- DevIA: persistência de áudio do chat + sessões de Preview
-- Execute este bloco no SQL Editor do Supabase externo da DevIA.

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

create index if not exists chat_attachments_message_idx
  on public.chat_attachments(message_id);

create index if not exists chat_attachments_workspace_created_idx
  on public.chat_attachments(workspace_id, created_at desc);

alter table public.chat_attachments enable row level security;

revoke all on public.chat_attachments from anon;
grant select, insert on public.chat_attachments to authenticated;

drop policy if exists "members can read chat attachments" on public.chat_attachments;
create policy "members can read chat attachments"
on public.chat_attachments for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can create own chat attachments" on public.chat_attachments;
create policy "members can create own chat attachments"
on public.chat_attachments for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.chat_messages m
    where m.id = message_id
      and m.workspace_id = workspace_id
      and m.user_id = user_id
  )
);

insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', false)
on conflict (id) do update set public = false;

drop policy if exists "chat audio upload by workspace members" on storage.objects;
create policy "chat audio upload by workspace members"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-audio'
  and (storage.foldername(name))[1] <> ''
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists "chat audio read by workspace members" on storage.objects;
create policy "chat audio read by workspace members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-audio'
  and (storage.foldername(name))[1] <> ''
  and private.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create table if not exists public.preview_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_full_name text not null,
  ref text not null default 'main',
  preview_url text not null,
  status text not null default 'ready'
    check (status in ('ready', 'expired', 'error')),
  expires_at timestamptz not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists preview_sessions_workspace_created_idx
  on public.preview_sessions(workspace_id, created_at desc);

alter table public.preview_sessions enable row level security;

revoke all on public.preview_sessions from anon;
grant select, insert, update on public.preview_sessions to authenticated;

drop policy if exists "members can read preview sessions" on public.preview_sessions;
create policy "members can read preview sessions"
on public.preview_sessions for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can create preview sessions" on public.preview_sessions;
create policy "members can create preview sessions"
on public.preview_sessions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

drop policy if exists "members can update preview sessions" on public.preview_sessions;
create policy "members can update preview sessions"
on public.preview_sessions for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

alter table public.chat_messages
  add column if not exists message_type text not null default 'text'
  check (message_type in ('text', 'audio', 'mixed'));

create index if not exists chat_messages_workspace_type_idx
  on public.chat_messages(workspace_id, message_type, created_at desc);
