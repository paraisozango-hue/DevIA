create table if not exists public.github_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_full_name text not null,
  branch text not null,
  path text not null,
  content text not null,
  operation text not null default 'upsert' check (operation in ('upsert','delete')),
  created_at timestamptz not null default now(),
  unique (workspace_id, repository_full_name, branch, path)
);

create index if not exists github_changes_workspace_idx
  on public.github_changes (workspace_id, created_at desc);

alter table public.github_changes enable row level security;

drop policy if exists "github_changes_select_member" on public.github_changes;
create policy "github_changes_select_member"
  on public.github_changes for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "github_changes_insert_member" on public.github_changes;
create policy "github_changes_insert_member"
  on public.github_changes for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = (select auth.uid()));

drop policy if exists "github_changes_update_member" on public.github_changes;
create policy "github_changes_update_member"
  on public.github_changes for update to authenticated
  using (public.is_workspace_member(workspace_id) and user_id = (select auth.uid()))
  with check (public.is_workspace_member(workspace_id) and user_id = (select auth.uid()));

drop policy if exists "github_changes_delete_member" on public.github_changes;
create policy "github_changes_delete_member"
  on public.github_changes for delete to authenticated
  using (public.is_workspace_member(workspace_id) and user_id = (select auth.uid()));

revoke all on public.github_changes from anon;
grant select, insert, update, delete on public.github_changes to authenticated;
