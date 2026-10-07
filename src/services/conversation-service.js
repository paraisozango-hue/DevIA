import { appConfig } from '../config.js';
import { getSession } from '../integrations/auth.js';
import { createSignedAudioUrl } from './media-service.js';

async function dataApi(path, options = {}) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Sessão não encontrada.');

  const response = await fetch(appConfig.supabase.url + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.hint || body.details || 'Não foi possível guardar a conversa.');
  }
  return body;
}

export async function loadChatMessages(workspaceId, limit = 100) {
  if (!workspaceId) return [];
  const rows = await dataApi(
    'chat_messages?select=id,workspace_id,user_id,role,content,message_type,created_at&workspace_id=eq.' +
    encodeURIComponent(workspaceId) +
    '&order=created_at.desc&limit=' + Math.min(Math.max(limit, 1), 100)
  );

  const messages = rows.reverse().map((row) => ({
    id: row.id,
    role: row.role,
    text: row.content,
    messageType: row.message_type || 'text',
    time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at)),
  }));
  const audioRows = await dataApi(
    'chat_attachments?select=message_id,storage_path,mime_type&workspace_id=eq.' +
    encodeURIComponent(workspaceId) +
    '&kind=eq.audio&order=created_at.desc&limit=100'
  ).catch(() => []);
  const audioByMessage = new Map(audioRows.map((row) => [row.message_id, row]));
  for (const message of messages) {
    const audio = audioByMessage.get(message.id);
    if (audio) {
      try {
        message.audioUrl = await createSignedAudioUrl(audio.storage_path);
        message.messageType = 'audio';
      } catch {}
    }
  }
  return messages;
}

export async function saveChatMessage(workspaceId, role, content, options = {}) {
  if (!workspaceId) throw new Error('Workspace não encontrado.');
  if (!['user', 'assistant', 'system'].includes(role)) throw new Error('Papel de mensagem inválido.');

  const rows = await dataApi('chat_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: options.id,
      workspace_id: workspaceId,
      user_id: getSession()?.user?.id,
      role,
      content,
      message_type: options.messageType || 'text',
    }),
  });

  return rows[0] || null;
}
