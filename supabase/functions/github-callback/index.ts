import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_URL = 'https://deviahg.lovable.app';
const GITHUB_API = 'https://api.github.com';
const GITHUB_VERSION = '2026-03-10';
const GITHUB_REDIRECT_URI = 'https://deviahg.lovable.app/';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://deviahg.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyState(state: string, secret: string) {
  const [body, encodedSignature] = state.split('.');
  if (!body || !encodedSignature) throw new Error('Estado OAuth inválido.');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(body),
  );
  if (!valid) throw new Error('Estado OAuth não pôde ser validado.');

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
  if (!payload.userId || !payload.workspaceId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Estado OAuth expirado ou incompleto.');
  }
  return payload;
}

function getConfig() {
  const raw = Deno.env.get('GITHUB_APP_CONFIG');
  if (!raw) throw new Error('GITHUB_APP_CONFIG não configurado no Supabase.');
  const config = JSON.parse(raw);
  if (!config.clientId || !config.clientSecret || !config.appId || !config.appSlug) {
    throw new Error('GITHUB_APP_CONFIG está incompleto.');
  }
  return config;
}

function supabaseAdmin() {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey) throw new Error('Chave secreta do Supabase não disponível.');
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey);
}

async function githubRequest(path: string, token: string) {
  const response = await fetch(GITHUB_API + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': GITHUB_VERSION,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('GitHub respondeu HTTP ' + response.status + ': ' + (body.message || 'erro desconhecido'));
  }
  return body;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirect(params: Record<string, string>) {
  // O hosting da DevIA serve a SPA de forma garantida na raiz, mas pode
  // devolver 404 quando o navegador entra diretamente em uma rota profunda.
  // O callback volta para "/" e o frontend navega para /github sem recarregar.
  const url = new URL(APP_URL + '/');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let code: string | null = null;
    let state: string | null = null;
    let error: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      code = url.searchParams.get('code');
      state = url.searchParams.get('state');
      error = url.searchParams.get('error');
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      code = body.code ? String(body.code) : null;
      state = body.state ? String(body.state) : null;
      error = body.error ? String(body.error) : null;
    } else {
      return json({ message: 'Método não suportado.' }, 405);
    }

    if (error) return redirect({ github: 'error', reason: error });
    if (!code || !state) return redirect({ github: 'error', reason: 'missing_oauth_parameters' });

    const config = getConfig();
    const payload = await verifyState(state, config.clientSecret);
    const redirectUri = GITHUB_REDIRECT_URI;

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || tokenBody.error || !tokenBody.access_token) {
      const detail = tokenBody.error_description || tokenBody.error || 'resposta inválida';
      throw new Error('GitHub não entregou o token de acesso: ' + detail);
    }

    const accessToken = String(tokenBody.access_token);
    const githubUser = await githubRequest('/user', accessToken);
    const installations = await githubRequest('/user/installations?per_page=100', accessToken);
    const installation = (installations.installations || []).find(
      (item: any) => String(item.app_id) === String(config.appId),
    );

    if (!installation) {
      const installUrl = new URL('https://github.com/apps/' + config.appSlug + '/installations/new');
      installUrl.searchParams.set('state', state);
      if (req.method === 'POST') return json({ action: 'install', installationUrl: installUrl.toString() });
      return Response.redirect(installUrl.toString(), 302);
    }

    const admin = supabaseAdmin();

    const secretPayload = JSON.stringify({
      accessToken,
      refreshToken: tokenBody.refresh_token || null,
      expiresAt: tokenBody.expires_in ? Date.now() + Number(tokenBody.expires_in) * 1000 : null,
      refreshTokenExpiresAt: tokenBody.refresh_token_expires_in
        ? Date.now() + Number(tokenBody.refresh_token_expires_in) * 1000
        : null,
      githubUserId: githubUser.id,
      githubLogin: githubUser.login,
    });

    const secretName = 'devia_github_' + payload.workspaceId + '_' + Date.now();
    const { data: secretId, error: secretError } = await admin.rpc('store_github_oauth_secret', {
      secret_value: secretPayload,
      secret_name: secretName,
    });
    if (secretError || !secretId) throw new Error('Não foi possível guardar o token do GitHub com segurança.');

    const { data: current } = await admin
      .from('integrations')
      .select('secret_ref')
      .eq('workspace_id', payload.workspaceId)
      .eq('provider', 'github')
      .maybeSingle();

    if (current?.secret_ref) {
      await admin.rpc('delete_github_oauth_secret', { secret_id: current.secret_ref });
    }

    const metadata = {
      login: githubUser.login,
      avatarUrl: githubUser.avatar_url || null,
      installationId: installation.id,
      repositorySelection: installation.repository_selection || null,
      permissions: installation.permissions || {},
    };

    const { error: saveError } = await admin
      .from('integrations')
      .upsert({
        workspace_id: payload.workspaceId,
        provider: 'github',
        status: 'connected',
        display_name: githubUser.login,
        external_account_id: String(githubUser.id),
        external_project_id: String(installation.id),
        metadata,
        secret_ref: String(secretId),
        connected_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,provider' });

    if (saveError) {
      await admin.rpc('delete_github_oauth_secret', { secret_id: String(secretId) });
      throw new Error('Não foi possível guardar a conexão do GitHub.');
    }

    if (req.method === 'POST') return json({ github: 'connected' });
    return redirect({ github: 'connected' });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'github_oauth_failed';
    if (req.method === 'POST') return json({ github: 'error', reason: reason.slice(0, 180) }, 400);
    return redirect({ github: 'error', reason: reason.slice(0, 180) });
  }
});
