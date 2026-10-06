-- RLS must be able to invoke the private helper functions as authenticated.
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_admin(uuid) to authenticated;
revoke usage on schema private from anon;
revoke execute on function private.is_workspace_member(uuid) from anon;
revoke execute on function private.is_workspace_admin(uuid) from anon;
