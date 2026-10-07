create table if not exists public.chat_messages (
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

drop policy if exists "members can read chat messages" on public.chat_messages;
create policy "members can read chat messages"
on public.chat_messages for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can create own chat messages" on public.chat_messages;
create policy "members can create own chat messages"
on public.chat_messages for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);

create index if not exists chat_messages_workspace_created_idx
on public.chat_messages (workspace_id, created_at desc);
