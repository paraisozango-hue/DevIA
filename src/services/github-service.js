import { appConfig } from '../config.js';
import { getSession, getCurrentWorkspace } from '../integrations/auth.js';

async function githubTool(action, payload = {}) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Entre na DevIA antes de usar o GitHub.');

  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error('Workspace não encontrado.');

  const response = await fetch(appConfig.github.toolsUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: workspace.id, action, ...payload }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'A ferramenta do GitHub falhou.');
  return body;
}

export function listGithubRepositories() {
  return githubTool('list_repositories');
}

export function readGithubFile(repositoryFullName, path, ref = '') {
  return githubTool('read_file', { repositoryFullName, path, ref });
}

export function searchGithubCode(repositoryFullName, query) {
  return githubTool('search_code', { repositoryFullName, query });
}

export function createGithubBranch(repositoryFullName, branch, baseBranch = 'main') {
  return githubTool('create_branch', { repositoryFullName, branch, baseBranch });
}

export function stageGithubChange(repositoryFullName, branch, path, content, operation = 'upsert') {
  return githubTool('stage_change', { repositoryFullName, branch, path, content, operation });
}

export function commitGithubChanges(repositoryFullName, branch, message) {
  return githubTool('commit_changes', { repositoryFullName, branch, message });
}
