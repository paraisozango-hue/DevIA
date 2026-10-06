import { bindRouter, navigate } from './router.js';
import { renderShell } from './layout.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProjects } from './pages/projects.js';
import { renderConversations } from './pages/conversations.js';
import { renderPreview } from './pages/preview.js';
import { renderIntegration } from './pages/integrations.js';
import { renderSettings } from './pages/settings.js';
import { renderAuthPage } from './pages/auth.js';
import { renderLanding } from './pages/landing.js';
import { getState, subscribe, updateState, addMessage, resetChangedFiles } from './state/store.js';
import { createDemoProject } from './services/project-service.js';
import { requestAssistantReply } from './services/chat-service.js';
import { supabaseIntegration } from './integrations/supabase.js';
import { getSession, signIn, signUp, signOut, createInitialWorkspace, getCurrentWorkspace, getIntegrations, saveIntegration, disconnectIntegration, refreshSession } from './integrations/auth.js';
import { showDialog, showToast, icon, escapeHtml } from './components/ui.js';
import { appConfig } from './config.js';

const app = document.querySelector('#app');
let authReady = false;

const PUBLIC_ROUTES = new Set(['/', '/login', '/signup']);
const PROTECTED_ROUTES = new Set(['/projects', '/conversations', '/preview', '/github', '/supabase', '/settings']);

function isPublicRoute(route) {
  return PUBLIC_ROUTES.has(route);
}

function isProtectedRoute(route) {
  return PROTECTED_ROUTES.has(route);
}

function renderPage(state) {
  const session = getSession();
  // A raiz é sempre a porta de entrada pública. O formulário de login só aparece
  // quando a pessoa acessa explicitamente /login ou tenta entrar numa rota protegida.
  if (!session && isProtectedRoute(state.route)) return renderAuthPage('login');
  if (!session && !isPublicRoute(state.route)) return renderLanding();
  if (!session && state.route === '/') return renderLanding();
  if (!session && state.route === '/signup') return renderAuthPage('signup');
  if (!session && state.route === '/login') return renderAuthPage('login');

  let content;
  switch (state.route) {
    case '/projects': content = renderProjects(); break;
    case '/conversations': content = renderConversations(state); break;
    case '/preview': content = renderPreview(); break;
    case '/github': content = renderIntegration('github', state.integrations.github); break;
    case '/supabase': content = renderIntegration('supabase', state.integrations.supabase); break;
    case '/settings': content = renderSettings(); break;
    default: content = renderDashboard();
  }

  return renderShell(content, state);
}

function render() {
  if (!authReady) return;
  const state = getState();
  const session = getSession();
  if (!session && isProtectedRoute(state.route)) {
    window.history.replaceState({}, '', '/login');
    updateState({ route: '/login' });
    return;
  }
  if (!session && !isPublicRoute(state.route)) {
    window.history.replaceState({}, '', '/');
    updateState({ route: '/' });
    return;
  }
  if (session && (state.route === '/login' || state.route === '/signup')) {
    window.history.replaceState({}, '', '/');
    updateState({ route: '/' });
    return;
  }
  app.innerHTML = renderPage(state);
  if (state.route === '/conversations') {
    const history = document.querySelector('#chat-history');
    if (history) history.scrollTop = history.scrollHeight;
  }
}

function openNewProjectDialog() {
  const body = '<form id="new-project-form" class="dialog-form"><label for="new-project-name">Nome do projeto</label><input id="new-project-name" name="name" maxlength="48" placeholder="Ex.: Aurora Studio" required autofocus /><label for="new-project-description">Descrição <span>Opcional</span></label><textarea id="new-project-description" name="description" maxlength="140" rows="3" placeholder="O que você quer construir?"></textarea><div class="dialog-hint">' + icon('sparkle', 14) + ' Este projeto ficará disponível nesta sessão de demonstração.</div><button class="button button--primary dialog-form__submit" type="submit">Criar projeto ' + icon('arrow', 15) + '</button></form>';
  showDialog({ title: 'Criar projeto', body, form: true });
  window.setTimeout(() => document.querySelector('#new-project-name')?.focus(), 0);
}

function openChangesDialog() {
  const body = '<p class="dialog-copy">Uma visualização fictícia de como as alterações poderão aparecer. Nenhum Git diff está sendo calculado.</p><div class="mock-diff"><div><span>src/pages/Login.tsx</span><small>+ 12 linhas</small></div><pre><span class="diff-add">+ export function LoginPage() {</span>\n<span class="diff-add">+   return &lt;main&gt;Entre na sua conta&lt;/main&gt;;</span>\n<span class="diff-add">+ }</span></pre></div>';
  showDialog({ title: 'Alterações demonstrativas', body, confirmLabel: 'Entendi' });
}

function openUndoDialog() {
  showDialog({ title: 'Desfazer alterações?', body: '<p class="dialog-copy">Esta ação limpa apenas o painel demonstrativo de arquivos. Ela não altera código, repositório ou arquivos do projeto.</p>', confirmLabel: 'Limpar demonstração', onConfirmAction: 'confirm-undo' });
}

function submitChat(form) {
  const input = form.querySelector('[name="message"]');
  const text = input?.value.trim();
  if (!text || getState().isProcessing) return;
  addMessage({ id: 'message-' + Date.now(), role: 'user', text, time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()) });
  updateState({ isProcessing: true });
  requestAssistantReply().then((reply) => {
    addMessage({ id: 'message-' + Date.now() + '-reply', role: 'assistant', text: reply, time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()) });
  }).finally(() => updateState({ isProcessing: false }));
}

function openSupabaseConnectionDialog() {
  const existing = getState().integrations.supabase;
  const currentUrl = existing?.metadata?.url || '';
  const currentKey = existing?.metadata?.publishableKey || '';
  const body = '<form id="supabase-connection-form" class="dialog-form">' +
    '<label for="integration-supabase-url">URL do projeto</label><input id="integration-supabase-url" name="url" type="url" placeholder="https://seu-projeto.supabase.co" value="' + escapeHtml(currentUrl) + '" required />' +
    '<label for="integration-supabase-key">Chave publishable</label><input id="integration-supabase-key" name="publishableKey" type="text" placeholder="sb_publishable_..." value="' + escapeHtml(currentKey) + '" required />' +
    '<div class="dialog-hint">' + icon('shield', 14) + ' A chave publishable foi feita para uso público com RLS. Nunca cole aqui uma secret/service_role key.</div>' +
    '<button class="button button--primary dialog-form__submit" type="submit">Conectar o Supabase ' + icon('arrow', 15) + '</button></form>';
  showDialog({ title: 'Conectar Supabase', body, form: true });
}

async function connectSupabase() {
  openSupabaseConnectionDialog();
}

async function persistSupabaseConnection(form) {
  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.dataset.originalText = submit.textContent;
    submit.textContent = 'Testando conexão...';
  }

  try {
    const values = new FormData(form);
    const url = String(values.get('url') || '').trim().replace(/\/$/, '');
    const publishableKey = String(values.get('publishableKey') || '').trim();
    const workspace = await getCurrentWorkspace();
    if (!workspace) throw new Error('Workspace não encontrado. Entre novamente para inicializar o workspace.');

    const { supabaseIntegration: integration } = await import('./integrations/supabase.js');
    const result = await integration.testConnection({ url, publishableKey });

    if (submit) submit.textContent = 'Guardando conexão...';

    await saveIntegration(workspace.id, 'supabase', {
      displayName: url.replace('https://', '').replace('.supabase.co', ''),
      externalProjectId: url.split('https://')[1]?.split('.')[0] || null,
      metadata: { url, publishableKey },
    });

    const persisted = (await getIntegrations(workspace.id)).find((row) => row.provider === 'supabase');
    if (!persisted || persisted.status !== 'connected') {
      throw new Error('A conexão foi validada, mas não foi possível confirmar a persistência no workspace.');
    }

    document.querySelector('.dialog-backdrop')?.remove();
    updateState({ integrations: { ...getState().integrations, supabase: persisted } });
    showToast('Supabase conectado, validado e guardado no workspace.', 'success');
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = submit.dataset.originalText || 'Conectar o Supabase';
    }
  }
}

async function connectGithub() {
  const session = getSession();
  if (!session?.access_token) throw new Error('Entre na DevIA antes de conectar o GitHub.');

  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error('Workspace não encontrado.');

  const response = await fetch(appConfig.github.oauthStartUrl, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.publishableKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: workspace.id }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.authorizationUrl) {
    throw new Error(body.message || 'Não foi possível iniciar a conexão com o GitHub.');
  }

  window.location.assign(body.authorizationUrl);
}

async function loadPersistedIntegrations() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return;
  const rows = await getIntegrations(workspace.id);
  const integrations = Object.fromEntries(rows.map((row) => [row.provider, row]));
  updateState({ integrations });
}

async function submitAuth(form) {
  const values = new FormData(form);
  const mode = form.dataset.mode;
  const email = String(values.get('email') || '').trim();
  const password = String(values.get('password') || '');
  const fullName = String(values.get('name') || '').trim();

  if (mode === 'signup' && password !== String(values.get('passwordConfirm') || '')) {
    showToast('As senhas não coincidem.', 'info');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.dataset.originalText = submit.textContent;
    submit.textContent = mode === 'signup' ? 'Criando conta...' : 'Entrando...';
  }

  try {
    const result = mode === 'signup'
      ? await signUp({ email, password, fullName })
      : await signIn({ email, password });

    if (!result.session) {
      showToast('Conta criada. Verifica o teu e-mail para confirmar a conta e depois entra na DevIA.', 'success');
      return;
    }

    await createInitialWorkspace(fullName);
    updateState({ route: '/' });
    window.history.replaceState({}, '', '/');
    render();
    showToast(mode === 'signup' ? 'Conta criada e workspace preparado.' : 'Login efetuado com sucesso.', 'success');
  } catch (error) {
    const message = error.message || 'Não foi possível concluir a operação.';
    if (mode === 'signup' && /email address not authorized|email.*not authorized/i.test(message)) {
      showToast('O Supabase recusou o envio de confirmação para este e-mail. O SMTP padrão só envia para endereços autorizados do projeto.', 'info');
    } else {
      showToast(message, 'info');
    }
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = submit.dataset.originalText || (mode === 'signup' ? 'Criar minha conta' : 'Entrar');
    }
  }
}

bindRouter();
subscribe(render);

(async function initializeAuth() {
  try {
    await refreshSession();
  } catch {
    // Uma falha de refresh não pode impedir a aplicação de renderizar a tela pública/login.
  }

  authReady = true;
  const session = getSession();
  const currentRoute = getState().route;

  if (session && (currentRoute === '/login' || currentRoute === '/signup')) {
    window.history.replaceState({}, '', '/');
    updateState({ route: '/' });
  }

  if (session) {
    await createInitialWorkspace(
      session.user?.user_metadata?.full_name ||
      session.user?.email?.split('@')[0] ||
      'Meu workspace'
    ).catch(() => null);

    await loadPersistedIntegrations().catch(() => null);
  }

  const githubResult = new URLSearchParams(window.location.search).get('github');
  const githubReason = new URLSearchParams(window.location.search).get('reason');
  if (githubResult) {
    window.history.replaceState({}, '', '/github');
    if (githubResult === 'connected') {
      await loadPersistedIntegrations().catch(() => null);
      showToast('GitHub conectado ao workspace com sucesso.', 'success');
    } else {
      showToast(githubReason || 'Não foi possível concluir a conexão com o GitHub.', 'info');
    }
  }

  render();
})();

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;
  if (action === 'toggle-nav') updateState({ mobileNavOpen: !getState().mobileNavOpen });
  if (action === 'close-nav') updateState({ mobileNavOpen: false });
  if (action === 'new-project') openNewProjectDialog();
  if (action === 'close-dialog') document.querySelector('.dialog-backdrop')?.remove();
  if (action === 'view-changes') openChangesDialog();
  if (action === 'undo') openUndoDialog();
  if (action === 'confirm-undo') {
    document.querySelector('.dialog-backdrop')?.remove();
    resetChangedFiles();
    showToast('Painel de demonstração limpo. Nenhum arquivo foi alterado.');
  }
  if (action === 'connect-supabase') connectSupabase().catch((error) => showToast(error.message || 'Não foi possível iniciar a conexão.', 'info'));
  if (action === 'connect-github') connectGithub().catch((error) => showToast(error.message || 'Não foi possível iniciar a conexão com o GitHub.', 'info'));
  if (action === 'disconnect-supabase') disconnectIntegration(getState().integrations.supabase?.workspace_id, 'supabase').then(() => { updateState({ integrations: { ...getState().integrations, supabase: null } }); showToast('Supabase desconectado.'); }).catch((error) => showToast(error.message || 'Não foi possível desconectar.', 'info'));
  if (action === 'disconnect-github') {
    const workspaceId = getState().integrations.github?.workspace_id;
    if (!workspaceId) {
      showToast('Workspace não encontrado.', 'info');
    } else {
      fetch('https://reajamnjltasockpqkrk.supabase.co/functions/v1/github-disconnect', {
        method: 'POST',
        headers: {
          apikey: appConfig.supabase.publishableKey,
          Authorization: 'Bearer ' + (getSession()?.access_token || ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.message || 'Não foi possível desconectar o GitHub.');
          updateState({ integrations: { ...getState().integrations, github: null } });
          showToast('GitHub desconectado e credenciais protegidas removidas.', 'success');
        })
        .catch((error) => showToast(error.message || 'Não foi possível desconectar o GitHub.', 'info'));
    }
  }
  if (action === 'logout') {
    try {
      await signOut();
      window.history.replaceState({}, '', '/');
      updateState({ route: '/' });
      render();
      showToast('Sessão encerrada.');
    } catch (error) {
      showToast(error.message || 'Não foi possível encerrar a sessão.', 'info');
    }
  }
  if (action === 'refresh-preview') {
    trigger.classList.add('is-spinning');
    window.setTimeout(() => trigger.classList.remove('is-spinning'), 700);
    showToast('Preview demonstrativo atualizado.');
  }
  if (action === 'open-demo') window.open('/preview-demo.html', '_blank', 'noopener,noreferrer');
  if (action === 'show-help') showDialog({ title: 'Este é o início.', body: '<p class="dialog-copy">A DevIA agora possui cadastro e login reais através do Supabase Auth. O próximo passo será conectar o GitHub por workspace.</p>', confirmLabel: 'Entendi' });
  if (action === 'show-chat-info') showDialog({ title: 'Contexto da conversa', body: '<p class="dialog-copy">Esta conversa ainda usa mensagens locais de exemplo. A persistência real virá na próxima etapa.</p>', confirmLabel: 'Entendi' });
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.matches('#supabase-connection-form')) {
    event.preventDefault();
    persistSupabaseConnection(form).catch((error) => showToast(error.message || 'Não foi possível guardar a conexão.', 'info'));
  }
  if (form.matches('[data-form="auth"]')) {
    event.preventDefault();
    submitAuth(form);
  }
  if (form.matches('[data-form="chat"]')) {
    event.preventDefault();
    submitChat(form);
  }
  if (form.matches('#new-project-form')) {
    event.preventDefault();
    const values = new FormData(form);
    try {
      const project = createDemoProject(String(values.get('name') || ''), String(values.get('description') || ''));
      document.querySelector('.dialog-backdrop')?.remove();
      navigate('/projects');
      showToast(escapeHtml(project.name) + ' foi adicionado nesta sessão.');
    } catch (error) {
      showToast(error.message, 'info');
    }
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'project-search') return;
  const query = event.target.value.trim().toLowerCase();
  let visibleCount = 0;
  document.querySelectorAll('[data-project-row]').forEach((row) => {
    const visible = row.dataset.search.includes(query);
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  const empty = document.querySelector('.project-list__empty');
  if (empty) empty.hidden = visibleCount !== 0;
});
