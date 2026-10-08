import { appConfig } from '../config.js';
import { getSession, getCurrentWorkspace } from '../integrations/auth.js';
import { audioBlobToBase64 } from './audio-service.js';

export async function transcribeAudio(blob) {
  const session = getSession();
  const workspace = await getCurrentWorkspace();
  if (!session?.access_token) throw new Error('Sessão não encontrada.');
  if (!workspace) throw new Error('Workspace não encontrado.');

  const response = await fetch(appConfig.ai.transcribeUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: workspace.id,
      data: await audioBlobToBase64(blob),
      mimeType: blob.type || 'audio/webm',
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível transcrever o áudio.');
  return String(body.transcript || '').trim();
}