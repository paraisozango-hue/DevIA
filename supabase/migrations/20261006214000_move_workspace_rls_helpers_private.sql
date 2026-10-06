-- Keep SECURITY DEFINER RLS helpers out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  );
$$;

alter policy "members can read workspace membership"
  on public.workspace_members
  using (private.is_workspace_member(workspace_id));

alter policy "workspace admins can add members"
  on public.workspace_members
  with check (private.is_workspace_admin(workspace_id));

alter policy "workspace admins can remove members"
  on public.workspace_members
  using (private.is_workspace_admin(workspace_id));

alter policy "workspace admins can update members"
  on public.workspace_members
  using (private.is_workspace_admin(workspace_id))
  with check (private.is_workspace_admin(workspace_id));

alter policy "members can read workspaces"
  on public.workspaces
  using (private.is_workspace_member(id));

alter policy "workspace admins can update workspaces"
  on public.workspaces
  using (private.is_workspace_admin(id))
  with check (private.is_workspace_admin(id));

revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_workspace_admin(uuid) from public, anon, authenticated;
revoke all on function private.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function private.is_workspace_admin(uuid) from public, anon, authenticated;
