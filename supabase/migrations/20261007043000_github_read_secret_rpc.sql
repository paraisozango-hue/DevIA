create or replace function public.read_github_oauth_secret(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  if secret_id is null then
    raise exception 'GitHub secret id is required';
  end if;

  select decrypted_secret
    into secret_value
    from vault.decrypted_secrets
   where id = secret_id;

  if secret_value is null then
    raise exception 'GitHub secret not found';
  end if;

  return secret_value;
end;
$$;

revoke all on function public.read_github_oauth_secret(uuid) from public, anon, authenticated;
grant execute on function public.read_github_oauth_secret(uuid) to service_role;
