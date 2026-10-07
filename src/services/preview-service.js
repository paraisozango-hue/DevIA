import { appConfig } from '../config.js';
import { getSession, getCurrentWorkspace } from '../integrations/auth.js';
import { listGithubRepositories } from './github-service.js';

async function requestPreview(payload = {}) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Entre na DevIA antes de abrir o Preview.');
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error('Workspace não encontrado.');
  const response = await fetch(appConfig.github.previewUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: workspace.id, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível preparar o Preview.');
  return body;
}

export function prepareGithubPreview(repositoryFullName, ref = 'main') {
  return requestPreview({ repositoryFullName, ref });
}

export function getGithubPreviewRepositories() {
  return listGithubRepositories();
}


export async function savePreviewSession(session) {
  const current = getCurrentWorkspace();
  const auth = getSession();
  if (!current || !auth?.access_token || !session?.previewUrl) return null;
  const response = await fetch(
    appConfig.supabase.url + '/rest/v1/preview_sessions',
    {
      method: 'POST',
      headers: {
        apikey: appConfig.supabase.publishableKey,
        Authorization: 'Bearer ' + auth.access_token,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        workspace_id: current.id,
        user_id: auth.user.id,
        repository_full_name: session.repository,
        ref: session.ref || 'main',
        preview_url: session.previewUrl,
        status: 'ready',
        expires_at: new Date(Date.now() + Number(session.expiresIn || 600) * 1000).toISOString(),
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.hint || 'Não foi possível guardar a sessão do Preview.');
  return body[0] || null;
}

export async function loadLatestPreviewSession() {
  const auth = getSession();
  const workspace = await getCurrentWorkspace();
  if (!auth?.access_token || !workspace) return null;
  const response = await fetch(
    appConfig.supabase.url + '/rest/v1/preview_sessions?select=id,repository_full_name,ref,preview_url,status,expires_at,created_at&workspace_id=eq.' +
    encodeURIComponent(workspace.id) +
    '&status=eq.ready&order=created_at.desc&limit=1',
    {
      headers: {
        apikey: appConfig.supabase.publishableKey,
        Authorization: 'Bearer ' + auth.access_token,
      },
    },
  );
  const body = await response.json().catch(() => ([]));
  if (!response.ok) return null;
  const session = body[0];
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
  return session;
}
