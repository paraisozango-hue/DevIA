import { appConfig } from '../config.js';

async function requestRoot(url = appConfig.supabase.url, publishableKey = appConfig.supabase.publishableKey) {
  const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/', {
    headers: {
      apikey: publishableKey,
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = body ? ' ' + body.slice(0, 180) : '';
    } catch {}
    throw new Error('Supabase respondeu com HTTP ' + response.status + '.' + detail);
  }

  return response;
}

export const supabaseIntegration = Object.freeze({
  provider: 'supabase',

  async testConnection({ url, publishableKey }) {
    const normalizedUrl = String(url || '').trim().replace(/\/$/, '');
    const key = String(publishableKey || '').trim();
    let parsedUrl;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      throw new Error('URL do projeto Supabase inválida.');
    }
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co') || parsedUrl.pathname !== '/') {
      throw new Error('Use a URL HTTPS do projeto, por exemplo: https://seu-projeto.supabase.co');
    }
    if (!key) throw new Error('A chave publishable do Supabase é obrigatória.');
    if (!/^sb_publishable_/i.test(key) && !key.includes('.')) {
      throw new Error('Informe uma publishable key válida do Supabase.');
    }
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
