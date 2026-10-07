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

const githubToolDeclarations = [
  {
    name: 'list_repositories',
    description: 'Lista os repositórios GitHub acessíveis pela conexão do workspace. Use para descobrir o repositório correto antes de editar código.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'read_file',
    description: 'Lê o conteúdo completo de um arquivo de texto do repositório em um branch/ref.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        path: { type: 'string' },
        ref: { type: 'string', description: 'Branch, tag ou commit. Use o branch de trabalho depois de criá-lo.' },
      },
      required: ['repositoryFullName', 'path'],
    },
  },
  {
    name: 'search_code',
    description: 'Pesquisa código e nomes de arquivos no repositório GitHub.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        query: { type: 'string' },
      },
      required: ['repositoryFullName', 'query'],
    },
  },
  {
    name: 'create_branch',
    description: 'Cria um branch de trabalho a partir de outro branch. Nunca use main/master como branch de escrita.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        branch: { type: 'string', description: 'Nome único do branch de trabalho, por exemplo devia/ai-ajuste-menu-20261007.' },
        baseBranch: { type: 'string' },
      },
      required: ['repositoryFullName', 'branch'],
    },
  },
  {
    name: 'replace_in_file',
    description: 'Altera uma parte específica de um arquivo no branch de trabalho. O oldText deve ser uma ocorrência exata e única; a ferramenta lê o arquivo, substitui e prepara a alteração para o commit.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        branch: { type: 'string' },
        path: { type: 'string' },
        oldText: { type: 'string' },
        newText: { type: 'string' },
      },
      required: ['repositoryFullName', 'branch', 'path', 'oldText', 'newText'],
    },
  },
  {
    name: 'stage_change',
    description: 'Prepara o conteúdo completo de um arquivo para o próximo commit. Use para arquivos novos ou quando for melhor substituir o arquivo inteiro.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        branch: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        operation: { type: 'string', enum: ['upsert', 'delete'] },
      },
      required: ['repositoryFullName', 'branch', 'path', 'content'],
    },
  },
  {
    name: 'commit_changes',
    description: 'Cria o commit real no GitHub com todas as alterações preparadas no branch. Só use depois de concluir e revisar as alterações solicitadas pelo usuário.',
    parameters: {
      type: 'object',
      properties: {
        repositoryFullName: { type: 'string' },
        branch: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['repositoryFullName', 'branch', 'message'],
    },
  },
];

async function invokeGithubTool(accessToken: string, workspaceId: string, action: string, args: Record<string, unknown>) {
  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
  const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY');
  if (!publishableKey) throw new Error('Chave publicável do Supabase não disponível.');

  const response = await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/github-tools', {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId, action, ...args }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || 'A ferramenta GitHub falhou.');
  return body;
}

async function executeGithubTool(accessToken: string, workspaceId: string, name: string, args: Record<string, unknown>) {
  const actionMap: Record<string, string> = {
    list_repositories: 'list_repositories',
    read_file: 'read_file',
    search_code: 'search_code',
    create_branch: 'create_branch',
    replace_in_file: 'replace_in_file',
    stage_change: 'stage_change',
    commit_changes: 'commit_changes',
  };
  const action = actionMap[name];
  if (!action) throw new Error('Ferramenta não permitida: ' + name);
  return invokeGithubTool(accessToken, workspaceId, action, args);
}

async function callGemini(apiKey: string, preferredModel: string, contents: any[], systemInstruction: string, tools: any[]) {
  const candidates = [...new Set([preferredModel, 'gemini-3.7-flash', 'gemini-3.5-flash-lite'])];
  let lastError = 'Gemini indisponível.';
  for (const model of candidates) {
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
          ...(tools?.length ? {
            tools,
            toolConfig: { functionCallingConfig: { mode: 'auto' } },
          } : {}),
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    const body = await response.json().catch(() => ({}));
    if (response.ok) return { body, model };

    const detail = body?.error?.message || 'Gemini retornou HTTP ' + response.status;
    lastError = detail;

    // 429/5xx são transitórios: troca imediatamente para um modelo Flash mais leve.
    if (response.status !== 429 && response.status < 500) break;
  }
  throw new Error(lastError);
}

function extractFunctionCalls(body: any) {
  return (body?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .filter((part: any) => part?.functionCall)
    .map((part: any) => part.functionCall);
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método não suportado.' }, 405);

  const startedAt = Date.now();
  let runId: string | null = null;

  try {
    const { admin, user } = await authenticate(req);
    const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
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
      'Você é a DevIA, uma engenheira de software com acesso controlado ao GitHub do workspace.',
      'Responda em português quando o usuário falar português. Seja prática, técnica e objetiva.',
      'Você pode ler, pesquisar e alterar código real usando as ferramentas GitHub disponíveis.',
      'Quando o usuário pedir uma alteração de código, execute o trabalho de verdade: descubra o repositório, leia/pesquise o contexto necessário, crie um branch de trabalho, faça as alterações, revise o resultado e crie o commit.',
      'Nunca escreva diretamente em main ou master. Sempre crie e use um branch de trabalho.',
      'Não invente sucesso: só diga que leu, alterou, criou branch ou commit quando a ferramenta retornar sucesso.',
      'Não faça alterações em código por mera conversa ou explicação; use as ferramentas quando houver um pedido claro de implementação, correção ou alteração.',
      'Prefira replace_in_file para alterações pequenas e precisas. Use stage_change para arquivos novos ou quando a substituição integral for necessária.',
      'Depois de alterar, use read_file ou search_code quando necessário para verificar o contexto. Só faça commit quando a tarefa solicitada estiver concluída.',
      'Ao terminar, explique no chat o que foi feito e inclua branch, arquivos alterados e SHA do commit quando disponíveis.',
    ].join(' ');

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    const tools = [{ functionDeclarations: githubToolDeclarations }];
    let geminiBody: any = null;
    let toolRounds = 0;
    const maxToolRounds = 6;

    while (toolRounds < maxToolRounds) {
      const geminiResult = await callGemini(apiKey, model, contents, systemInstruction, tools);
      geminiBody = geminiResult.body;

      const calls = extractFunctionCalls(geminiBody);
      if (!calls.length) break;

      const candidateContent = geminiBody?.candidates?.[0]?.content;
      if (!candidateContent) throw new Error('Gemini solicitou uma ferramenta sem devolver o contexto da chamada.');
      contents.push(candidateContent);

      const functionResponseParts = [];
      for (const call of calls) {
        const callName = String(call?.name || '');
        const callArgs = call?.args && typeof call.args === 'object' ? call.args : {};
        let result: unknown;
        try {
          result = await executeGithubTool(accessToken, workspaceId, callName, callArgs);
        } catch (toolError) {
          result = { error: toolError instanceof Error ? toolError.message : 'Falha desconhecida na ferramenta.' };
        }
        functionResponseParts.push({
          functionResponse: {
            name: callName,
            id: call?.id,
            response: { result },
          },
        });
      }
      contents.push({ role: 'user', parts: functionResponseParts });
      toolRounds += 1;
    }

    if (!geminiBody) throw new Error('Gemini não retornou resposta.');
    const reply = extractText(geminiBody);
    if (!reply) {
      throw new Error(toolRounds >= maxToolRounds
        ? 'A IA atingiu o limite de etapas de ferramentas antes de concluir a resposta.'
        : 'O Gemini não retornou texto.');
    }

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
