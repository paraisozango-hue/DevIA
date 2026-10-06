create extension if not exists supabase_vault with schema vault;

create or replace function public.store_github_oauth_secret(
  secret_value text,
  secret_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if coalesce(trim(secret_value), '') = '' then
    raise exception 'GitHub secret cannot be empty';
  end if;

  return vault.create_secret(
    secret_value,
    secret_name,
    'DevIA GitHub OAuth access and refresh tokens'
  );
end;
$$;

create or replace function public.delete_github_oauth_secret(secret_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if secret_id is null then
    return;
  end if;

  perform vault.delete_secret(secret_id);
end;
$$;

revoke all on function public.store_github_oauth_secret(text, text) from public, anon, authenticated;
revoke all on function public.delete_github_oauth_secret(uuid) from public, anon, authenticated;
grant execute on function public.store_github_oauth_secret(text, text) to service_role;
grant execute on function public.delete_github_oauth_secret(uuid) to service_role;
