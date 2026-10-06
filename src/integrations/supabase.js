import { appConfig } from '../config.js';

async function requestRoot() {
  const response = await fetch(appConfig.supabase.url + '/rest/v1/', {
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + appConfig.supabase.publishableKey,
    },
  });

  if (!response.ok) {
    throw new Error('Supabase respondeu com HTTP ' + response.status + '.');
  }

  return response;
}

export const supabaseIntegration = Object.freeze({
  provider: 'supabase',

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
