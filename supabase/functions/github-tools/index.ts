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

async function assertMember(admin: any, workspaceId: string, userId: string) {
  const { data, error } = await admin.from('workspace_members')
    .select('workspace_id,role').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Não foi possível validar o workspace.');
  if (!data) throw new Error('Você não tem acesso a este workspace.');
}

async function githubRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(GITHUB_API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': GITHUB_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('GitHub respondeu HTTP ' + response.status + ': ' + (body.message || 'erro desconhecido'));
  return body;
}

function repoParts(value: string) {
  const match = String(value || '').trim().match(/^([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('repositoryFullName inválido. Use owner/repository.');
  return { owner: match[1], repo: match[2] };
}

async function getToken(admin: any, workspaceId: string) {
  const { data: integration, error } = await admin.from('integrations')
    .select('secret_ref,status,external_project_id,metadata')
    .eq('workspace_id', workspaceId).eq('provider', 'github').maybeSingle();
  if (error) throw new Error('Não foi possível carregar a conexão do GitHub.');
  if (!integration || integration.status !== 'connected' || !integration.secret_ref) throw new Error('GitHub não está conectado neste workspace.');
  const { data: secret, error: secretError } = await admin.rpc('read_github_oauth_secret', { secret_id: integration.secret_ref });
  if (secretError || !secret) throw new Error('Não foi possível recuperar a credencial segura do GitHub.');
  const payload = JSON.parse(String(secret));
  if (!payload.accessToken) throw new Error('Credencial do GitHub inválida ou expirada.');
  return payload.accessToken;
}

async function listRepositories(token: string) {
  const body = await githubRequest('/user/installations?per_page=100', token);
  const output = [];
  for (const installation of body.installations || []) {
    const repos = await githubRequest('/user/installations/' + installation.id + '/repositories?per_page=100', token);
    for (const repo of repos.repositories || []) {
      output.push({
        id: repo.id, fullName: repo.full_name, name: repo.name,
        owner: repo.owner?.login || '', private: Boolean(repo.private),
        defaultBranch: repo.default_branch || 'main', htmlUrl: repo.html_url || null,
        permissions: repo.permissions || {},
      });
    }
  }
  return output;
}

async function readFile(token: string, repositoryFullName: string, path: string, ref = '') {
  const { owner, repo } = repoParts(repositoryFullName);
  const query = ref ? '?ref=' + encodeURIComponent(ref) : '';
  const body = await githubRequest('/repos/' + owner + '/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + query, token);
  if (Array.isArray(body)) throw new Error('O caminho informado é uma pasta; informe um arquivo.');
  if (body.encoding !== 'base64' || !body.content) throw new Error('GitHub não retornou o conteúdo do arquivo.');
  const binary = atob(String(body.content).replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const text = new TextDecoder().decode(bytes);
  return { path: body.path, sha: body.sha, size: body.size, content: text };
}

async function searchCode(token: string, query: string, repositoryFullName: string) {
  const encoded = encodeURIComponent(query + ' repo:' + repositoryFullName);
  const body = await githubRequest('/search/code?q=' + encoded + '&per_page=20', token);
  return (body.items || []).map((item: any) => ({
    path: item.path, name: item.name, sha: item.sha, htmlUrl: item.html_url,
    repository: item.repository?.full_name || repositoryFullName,
  }));
}

async function createBranch(token: string, repositoryFullName: string, branch: string, baseBranch: string) {
  const { owner, repo } = repoParts(repositoryFullName);
  const base = await githubRequest('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(baseBranch), token);
  try {
    await githubRequest('/repos/' + owner + '/' + repo + '/git/ref', token, {
      method: 'POST',
      body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: base.object.sha }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('422')) throw error;
  }
  return { branch, baseBranch, sha: base.object.sha };
}

async function stageChange(admin: any, userId: string, workspaceId: string, input: any) {
  const repositoryFullName = String(input.repositoryFullName || '').trim();
  const branch = String(input.branch || '').trim();
  const path = String(input.path || '').replace(/^\/+/, '').trim();
  const operation = input.operation === 'delete' ? 'delete' : 'upsert';
  if (!repositoryFullName || !branch || !path) throw new Error('repositoryFullName, branch e path são obrigatórios.');
  if (operation === 'upsert' && String(input.content ?? '').length > 500000) throw new Error('Arquivo muito grande para staging.');

  const { data, error } = await admin.from('github_changes').upsert({
    workspace_id: workspaceId, user_id: userId, repository_full_name: repositoryFullName,
    branch, path, content: String(input.content ?? ''), operation,
  }, { onConflict: 'workspace_id,repository_full_name,branch,path' }).select('id,path,operation,branch').single();
  if (error) throw new Error('Não foi possível preparar a alteração: ' + error.message);
  return data;
}

async function commitChanges(admin: any, token: string, workspaceId: string, input: any) {
  const repositoryFullName = String(input.repositoryFullName || '').trim();
  const branch = String(input.branch || '').trim();
  const message = String(input.message || '').trim();
  if (!repositoryFullName || !branch || !message) throw new Error('repositoryFullName, branch e message são obrigatórios.');
  const { owner, repo } = repoParts(repositoryFullName);

  const { data: changes, error } = await admin.from('github_changes')
    .select('id,path,content,operation').eq('workspace_id', workspaceId)
    .eq('repository_full_name', repositoryFullName).eq('branch', branch).order('created_at');
  if (error) throw new Error('Não foi possível carregar as alterações preparadas.');
  if (!changes?.length) throw new Error('Nenhuma alteração preparada para este branch.');

  const ref = await githubRequest('/repos/' + owner + '/' + repo + '/git/ref/heads/' + encodeURIComponent(branch), token);
  const commitSha = ref.object.sha;
  const baseCommit = await githubRequest('/repos/' + owner + '/' + repo + '/git/commits/' + commitSha, token);
  const treeEntries = [];

  for (const change of changes) {
    if (change.operation === 'delete') {
      treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await githubRequest('/repos/' + owner + '/' + repo + '/git/blobs', token, {
      method: 'POST', body: JSON.stringify({ content: change.content, encoding: 'utf-8' }),
    });
    treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const tree = await githubRequest('/repos/' + owner + '/' + repo + '/git/trees', token, {
    method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
  });
  const commit = await githubRequest('/repos/' + owner + '/' + repo + '/git/commits', token, {
    method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [commitSha] }),
  });
  await githubRequest('/repos/' + owner + '/' + repo + '/git/refs/heads/' + encodeURIComponent(branch), token, {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  const { error: deleteError } = await admin.from('github_changes').delete()
    .eq('workspace_id', workspaceId).eq('repository_full_name', repositoryFullName).eq('branch', branch);
  if (deleteError) throw new Error('Commit criado, mas não foi possível limpar o staging.');

  return { commitSha: commit.sha, branch, files: changes.map((change: any) => change.path) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  try {
    const { admin, user } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || '').trim();
    const action = String(body.action || '').trim();
    if (!workspaceId || !action) return json({ message: 'workspaceId e action são obrigatórios.' }, 400);
    await assertMember(admin, workspaceId, user.id);

    const token = await getToken(admin, workspaceId);
    if (action === 'list_repositories') return json({ repositories: await listRepositories(token) });
    if (action === 'read_file') {
      const result = await readFile(token, String(body.repositoryFullName || ''), String(body.path || ''), String(body.ref || ''));
      return json(result);
    }
    if (action === 'search_code') return json({ results: await searchCode(token, String(body.query || ''), String(body.repositoryFullName || '')) });
    if (action === 'create_branch') return json(await createBranch(token, String(body.repositoryFullName || ''), String(body.branch || ''), String(body.baseBranch || 'main')));
    if (action === 'stage_change') return json({ change: await stageChange(admin, user.id, workspaceId, body) });
    if (action === 'commit_changes') return json(await commitChanges(admin, token, workspaceId, body));
    return json({ message: 'Ação GitHub não suportada.' }, 400);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'github_tool_failed';
    return json({ message: reason.slice(0, 500) }, 400);
  }
});
