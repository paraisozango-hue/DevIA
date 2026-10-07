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
