import { appConfig } from '../config.js';
import { getSession, getCurrentWorkspace } from '../integrations/auth.js';

export async function listGithubRepositories() {
  const session = getSession();
  if (!session?.access_token) throw new Error('Entre na DevIA antes de usar o GitHub.');

  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error('Workspace não encontrado.');

  const response = await fetch(appConfig.github.repositoriesUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: workspace.id }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível listar os repositórios do GitHub.');

  return body;
}
