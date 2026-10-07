import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';

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

function supabaseAdmin() {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey) throw new Error('Chave secreta do Supabase não disponível.');
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey);
}

async function authenticate(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Sessão não encontrada.');

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('Sessão inválida ou expirada.');
  return { admin, user: data.user };
}

async function assertWorkspaceMember(admin: ReturnType<typeof supabaseAdmin>, workspaceId: string, userId: string) {
  const { data, error } = await admin
    .from('workspace_members')
    .select('workspace_id,role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error('Não foi possível validar o workspace.');
  if (!data) throw new Error('Você não tem acesso a este workspace.');
  return data;
}

function normalizeHistory(history: unknown) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && typeof item === 'object')
    .slice(-20)
    .map((item: any) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(item.text || item.content || '').slice(0, 12000) }],
    }))
    .filter((item) => item.parts[0].text.trim());
}

function extractText(body: any) {
  return (body?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => part?.text || '')
    .join('')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  const startedAt = Date.now();
  let runId: string | null = null;

  try {
    const { admin, user } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || '').trim();
    const message = String(body.message || '').trim();
    const history = normalizeHistory(body.history);

    if (!workspaceId) return json({ message: 'workspaceId é obrigatório.' }, 400);
    if (!message) return json({ message: 'message é obrigatório.' }, 400);
    if (message.length > 12000) return json({ message: 'A mensagem é muito longa.' }, 400);

    await assertWorkspaceMember(admin, workspaceId, user.id);

    const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no Supabase.');

    const { data: run, error: runError } = await admin
      .from('ai_runs')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        provider: 'gemini',
        model,
        status: 'started',
        input_chars: message.length,
      })
      .select('id')
      .single();

    if (runError) throw new Error('Não foi possível registrar a execução da IA.');
    runId = run.id;

    const systemInstruction = [
      'Você é a DevIA, uma engenheira de software dentro de um ambiente de desenvolvimento.',
      'Responda em português quando o usuário falar português.',
      'Seja prática, técnica e objetiva.',
      'Nesta primeira fase você é somente o cérebro conversacional: não diga que alterou arquivos, fez commits ou executou ferramentas que ainda não recebeu.',
      'Quando o pedido envolver código, explique a abordagem e peça contexto somente quando realmente necessário.',
    ].join(' ');

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await fetch(
      GEMINI_API + '/models/' + encodeURIComponent(model) + ':generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    const geminiBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = geminiBody?.error?.message || 'Gemini retornou HTTP ' + response.status;
      throw new Error(detail);
    }

    const reply = extractText(geminiBody);
    if (!reply) throw new Error('O Gemini não retornou texto.');

    const latencyMs = Date.now() - startedAt;
    await admin
      .from('ai_runs')
      .update({
        status: 'completed',
        output_chars: reply.length,
        latency_ms: latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return json({
      reply,
      provider: 'gemini',
      model,
      runId,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'ai_request_failed';

    if (runId) {
      try {
        const admin = supabaseAdmin();
        await admin
          .from('ai_runs')
          .update({
            status: 'error',
            latency_ms: Date.now() - startedAt,
            error_message: reason.slice(0, 500),
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId);
      } catch {
        // O erro original é mais importante que uma falha secundária de telemetria.
      }
    }

    return json({ message: reason.slice(0, 500), runId }, 400);
  }
});
