import { appConfig } from '../config.js';

async function requestRoot(url = appConfig.supabase.url, publishableKey = appConfig.supabase.publishableKey) {
  const response = await fetch(url.replace(/\\/$/, '') + '/rest/v1/', {
    headers: {
      apikey: publishableKey,
      Authorization: 'Bearer ' + publishableKey,
    },
  });

  if (!response.ok) {
    throw new Error('Supabase respondeu com HTTP ' + response.status + '.');
  }

  return response;
}

export const supabaseIntegration = Object.freeze({
  provider: 'supabase',

  async testConnection({ url, publishableKey }) {
    const normalizedUrl = String(url || '').trim().replace(/\\/$/, '');
    const key = String(publishableKey || '').trim();
    if (!/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/i.test(normalizedUrl)) {
      throw new Error('URL do projeto Supabase inválida.');
    }
    if (!key) throw new Error('A chave publishable do Supabase é obrigatória.');
    await requestRoot(normalizedUrl, key);
    return { state: 'connected', projectUrl: normalizedUrl };
  },

  async getConnectionState() {
    try {
      await requestRoot();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  },

  async connect() {
    await requestRoot();
    return {
      state: 'connected',
      projectUrl: appConfig.supabase.url,
    };
  },
});
