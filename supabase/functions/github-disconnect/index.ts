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

function getKeys() {
  const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
  const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  return {
    publishableKey: publishable.default || Deno.env.get('SUPABASE_ANON_KEY'),
    secretKey: secret.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ message: 'Sessão não encontrada.' }, 401);

    const keys = getKeys();
    if (!keys.publishableKey || !keys.secretKey) throw new Error('Chaves do Supabase não disponíveis.');

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, keys.publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ message: 'Sessão inválida.' }, 401);

    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || '');
    if (!workspaceId) return json({ message: 'Workspace não informado.' }, 400);

    const { data: workspace } = await userClient
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .maybeSingle();

    if (!workspace) return json({ message: 'Workspace não encontrado ou sem acesso.' }, 403);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, keys.secretKey);
    const { data: current } = await admin
      .from('integrations')
      .select('secret_ref')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'github')
      .maybeSingle();

    if (current?.secret_ref) {
      await admin.rpc('delete_github_oauth_secret', { secret_id: current.secret_ref });
    }

    await admin
      .from('integrations')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'github');

    return json({ disconnected: true });
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : 'Não foi possível desconectar o GitHub.' }, 500);
  }
});
