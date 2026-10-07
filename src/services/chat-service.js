import { appConfig } from '../config.js';
import { getSession, getCurrentWorkspace } from '../integrations/auth.js';

export async function requestAssistantReply(message, history = [], audio = null) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Entre na DevIA para conversar com a IA.');

  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error('Workspace não encontrado.');

  const response = await fetch(appConfig.ai.chatUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: workspace.id,
      message,
      history,
      audio: audio ? {
        data: audio.data,
        mimeType: audio.mimeType,
      } : null,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível obter resposta da IA.');

  return body.reply;
}
