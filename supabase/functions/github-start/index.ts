import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://deviahg.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlText(value: string) {
  return base64Url(new TextEncoder().encode(value));
}

async function signState(payload: object, secret: string) {
  const body = base64UrlText(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)),
  );
  return body + '.' + base64Url(signature);
}

function getSecretConfig() {
  const raw = Deno.env.get('GITHUB_APP_CONFIG');
  if (!raw) throw new Error('GITHUB_APP_CONFIG não configurado no Supabase.');
  const config = JSON.parse(raw);
  if (!config.clientId || !config.clientSecret || !config.appSlug) {
    throw new Error('GITHUB_APP_CONFIG está incompleto.');
  }
  return config;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ message: 'Sessão não encontrada.' }, 401);

    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY');
    if (!publishableKey) throw new Error('Chave publishable do Supabase não disponível.');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ message: 'Sessão do Supabase inválida.' }, 401);

    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || '');
    if (!workspaceId) return json({ message: 'Workspace não informado.' }, 400);

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .maybeSingle();

    if (workspaceError || !workspace) return json({ message: 'Workspace não encontrado ou sem acesso.' }, 403);

    const config = getSecretConfig();
    const redirectUri = 'https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-callback';

    // Use GitHub's standard web OAuth flow for a GitHub App.
    // The client secret never leaves this Edge Function. The browser only
    // receives the public GitHub authorization URL.
    const payload = {
      userId: userData.user.id,
      workspaceId,
      nonce: base64Url(crypto.getRandomValues(new Uint8Array(24))),
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
    };

    const state = await signState(payload, config.clientSecret);
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('allow_signup', 'false');

    return json({
      authorizationUrl: authorizeUrl.toString(),
      redirectUri,
      expiresIn: 600,
    });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Não foi possível iniciar a conexão com o GitHub.' },
      500,
    );
  }
});
