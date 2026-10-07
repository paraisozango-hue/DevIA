import { appConfig } from '../config.js';
import { getSession } from '../integrations/auth.js';

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
    'chat_messages?select=id,workspace_id,user_id,role,content,created_at&workspace_id=eq.' +
    encodeURIComponent(workspaceId) +
    '&order=created_at.desc&limit=' + Math.min(Math.max(limit, 1), 100)
  );

  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role,
    text: row.content,
    time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at)),
  }));
}

export async function saveChatMessage(workspaceId, role, content) {
  if (!workspaceId) throw new Error('Workspace não encontrado.');
  if (!['user', 'assistant', 'system'].includes(role)) throw new Error('Papel de mensagem inválido.');

  const rows = await dataApi('chat_messages', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      user_id: getSession()?.user?.id,
      role,
      content,
    }),
  });

  return rows[0] || null;
}
