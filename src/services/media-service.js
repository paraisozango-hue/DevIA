import { appConfig } from '../config.js';
import { getSession } from '../integrations/auth.js';

function headers() {
  const session = getSession();
  if (!session?.access_token) throw new Error('Sessão não encontrada.');
  return {
    apikey: appConfig.supabase.publishableKey,
    Authorization: 'Bearer ' + session.access_token,
  };
}

async function request(path, options = {}) {
  const response = await fetch(appConfig.supabase.url + path, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || body.error_description || 'Não foi possível guardar o áudio.');
  return body;
}

export async function uploadChatAudio(workspaceId, userId, messageId, blob) {
  const path = workspaceId + '/' + userId + '/' + messageId + '.webm';
  const response = await fetch(
    appConfig.supabase.url + '/storage/v1/object/chat-audio/' + path,
    {
      method: 'POST',
      headers: {
        ...headers(),
        'Content-Type': blob.type || 'audio/webm',
        'x-upsert': 'false',
      },
      body: blob,
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || 'Não foi possível enviar o áudio para o Supabase Storage.');
  return {
    bucket: 'chat-audio',
    path,
    mimeType: blob.type || 'audio/webm',
    sizeBytes: blob.size,
  };
}

export async function createChatAttachment(attachment) {
  const rows = await request('/rest/v1/chat_attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      message_id: attachment.messageId,
      workspace_id: attachment.workspaceId,
      user_id: attachment.userId,
      kind: 'audio',
      storage_bucket: attachment.bucket,
      storage_path: attachment.path,
      mime_type: attachment.mimeType,
      size_bytes: attachment.sizeBytes,
    }),
  });
  return rows[0] || null;
}

export async function createSignedAudioUrl(path, expiresIn = 3600) {
  const body = await request('/storage/v1/object/sign/chat-audio/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  return appConfig.supabase.url + '/storage/v1' + (body.signedURL || body.signedUrl || '');
}
