export const appConfig = Object.freeze({
  supabase: {
    url: 'https://reajamnjltasockpqkrk.supabase.co',
    publishableKey: 'sb_publishable_xnBAXFK8OV8VsIsu5fSAyQ_ludLIbwB',
  },
  github: {
    repository: 'paraisozango-hue/DevIA',
    appSlug: 'devia-developer',
    oauthStartUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-start',
    oauthCallbackUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-callback',
    repositoriesUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-repos',
    previewUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-preview',
    toolsUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-tools',
  },
  ai: {
    chatUrl: 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/ai-chat',
  },
});
