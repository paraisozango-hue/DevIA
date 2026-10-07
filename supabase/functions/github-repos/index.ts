import { createClient } from 'npm:@supabase/supabase-js@2';

const GITHUB_API = 'https://api.github.com';
const GITHUB_VERSION = '2026-03-10';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://deviahg.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function supabaseAdmin() {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey) throw new Error('Chave secreta do Supabase não disponível.');
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey);
}

async function authenticate(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Sessão não encontrada.');
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('Sessão inválida ou expirada.');
  return { admin, user: data.user };
}

async function assertWorkspaceMember(admin: any, workspaceId: string, userId: string) {
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id,role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Não foi possível validar o workspace.');
  if (!data) throw new Error('Você não tem acesso a este workspace.');
}

async function githubRequest(path: string, token: string) {
  const response = await fetch(GITHUB_API + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': GITHUB_VERSION,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('GitHub respondeu HTTP ' + response.status + ': ' + (body.message || 'erro desconhecido'));
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  try {
    const { admin, user } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || '').trim();
    if (!workspaceId) return json({ message: 'workspaceId é obrigatório.' }, 400);

    await assertWorkspaceMember(admin, workspaceId, user.id);

    const { data: integration, error: integrationError } = await admin
      .from('integrations')
      .select('secret_ref,external_project_id,status,metadata,display_name')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'github')
      .maybeSingle();

    if (integrationError) throw new Error('Não foi possível carregar a conexão do GitHub.');
    if (!integration || integration.status !== 'connected' || !integration.secret_ref) {
      return json({ message: 'GitHub não está conectado neste workspace.' }, 409);
    }

    const installationId = String(
      integration.external_project_id ||
      integration.metadata?.installationId ||
      '',
    ).trim();
    if (!installationId) throw new Error('Instalação do GitHub não encontrada.');

    const { data: secret, error: secretError } = await admin.rpc('read_github_oauth_secret', {
      secret_id: integration.secret_ref,
    });
    if (secretError || !secret) throw new Error('Não foi possível recuperar a credencial segura do GitHub.');

    const secretPayload = JSON.parse(String(secret));
    if (!secretPayload.accessToken) throw new Error('Credencial do GitHub inválida ou expirada.');

    const repositories = await githubRequest(
      '/user/installations/' + encodeURIComponent(installationId) + '/repositories?per_page=100',
      secretPayload.accessToken,
    );

    const items = (repositories.repositories || []).map((repo: any) => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login || '',
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || 'main',
      htmlUrl: repo.html_url || null,
      permissions: repo.permissions || {},
    }));

    return json({
      connected: true,
      account: integration.display_name || null,
      repositories: items,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'github_repositories_failed';
    return json({ message: reason.slice(0, 500) }, 400);
  }
});
