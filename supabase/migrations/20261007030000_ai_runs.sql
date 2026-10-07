-- DevIA — observabilidade das chamadas de IA
-- A chave do Gemini NÃO fica nesta tabela; ela deve existir apenas como secret do Edge Function.

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

create index if not exists ai_runs_workspace_id_idx on public.ai_runs(workspace_id);
create index if not exists ai_runs_user_id_idx on public.ai_runs(user_id);
create index if not exists ai_runs_created_at_idx on public.ai_runs(created_at desc);

alter table public.ai_runs enable row level security;

revoke all on table public.ai_runs from anon;
revoke all on table public.ai_runs from authenticated;
grant select on table public.ai_runs to authenticated;

drop policy if exists "members can read ai runs" on public.ai_runs;
create policy "members can read ai runs"
on public.ai_runs
for select
to authenticated
using (public.is_workspace_member(workspace_id));
