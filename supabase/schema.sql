-- DevIA — schema inicial
-- Copiar e executar no SQL Editor do projeto Supabase.
-- Este schema prepara a persistência para Auth, sem abrir dados ao anon.
-- A autenticação dos utilizadores será ligada numa etapa seguinte.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  repository text,
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

create index if not exists workspaces_owner_id_idx
  on public.workspaces (owner_id);

create index if not exists projects_workspace_id_idx
  on public.projects (workspace_id);

create index if not exists conversations_project_id_idx
  on public.conversations (project_id);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on table public.workspaces, public.projects, public.conversations, public.messages
  from anon;

grant select, insert, update, delete
  on public.workspaces, public.projects, public.conversations, public.messages
  to authenticated;

create policy "workspace owners can read workspaces"
  on public.workspaces for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "users can create their own workspaces"
  on public.workspaces for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "workspace owners can update workspaces"
  on public.workspaces for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "workspace owners can delete workspaces"
  on public.workspaces for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "workspace owners can read projects"
  on public.projects for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = projects.workspace_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can create projects"
  on public.projects for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspaces w
      where w.id = projects.workspace_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can update projects"
  on public.projects for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = projects.workspace_id
        and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.workspaces w
      where w.id = projects.workspace_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can delete projects"
  on public.projects for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = projects.workspace_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can read conversations"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = conversations.project_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can create conversations"
  on public.conversations for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = conversations.project_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can update conversations"
  on public.conversations for update
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = conversations.project_id
        and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = conversations.project_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can delete conversations"
  on public.conversations for delete
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = conversations.project_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      join public.workspaces w on w.id = p.workspace_id
      where c.id = messages.conversation_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can create messages"
  on public.messages for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      join public.workspaces w on w.id = p.workspace_id
      where c.id = messages.conversation_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can update messages"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      join public.workspaces w on w.id = p.workspace_id
      where c.id = messages.conversation_id
        and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      join public.workspaces w on w.id = p.workspace_id
      where c.id = messages.conversation_id
        and w.owner_id = (select auth.uid())
    )
  );

create policy "workspace owners can delete messages"
  on public.messages for delete
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      join public.projects p on p.id = c.project_id
      join public.workspaces w on w.id = p.workspace_id
      where c.id = messages.conversation_id
        and w.owner_id = (select auth.uid())
    )
  );
