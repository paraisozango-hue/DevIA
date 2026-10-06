import { appConfig } from '../config.js';

async function requestProjectSettings(url = appConfig.supabase.url, publishableKey = appConfig.supabase.publishableKey) {
  const response = await fetch(url.replace(/\/$/, '') + '/auth/v1/settings', {
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
    if (/^sb_secret_/i.test(key)) {
      throw new Error('Não use uma secret key aqui. Para o navegador, use a Publishable Key (sb_publishable_...).');
    }
    if (!/^sb_publishable_/i.test(key) && !key.includes('.')) {
      throw new Error('Informe uma Publishable Key válida do Supabase.');
    }
    await requestProjectSettings(normalizedUrl, key);
    return { state: 'connected', projectUrl: normalizedUrl };
  },

  async getConnectionState() {
    try {
      await requestProjectSettings();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  },

  async connect() {
    await requestProjectSettings();
    return {
      state: 'connected',
      projectUrl: appConfig.supabase.url,
    };
  },
});
