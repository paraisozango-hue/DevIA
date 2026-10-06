-- Ensure every workspace owner is automatically added as an owner member.
-- This keeps the workspace visible under the existing RLS policies.

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

create trigger workspaces_add_owner
after insert on public.workspaces
for each row
execute function public.add_workspace_owner();

revoke execute on function public.add_workspace_owner() from public, anon, authenticated;

-- Repair workspaces that were created before the trigger was present.
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;
