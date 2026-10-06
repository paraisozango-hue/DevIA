import { bindRouter } from './router.js';
import { renderShell } from './layout.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProjects } from './pages/projects.js';
import { renderConversations } from './pages/conversations.js';
import { renderPreview } from './pages/preview.js';
import { renderIntegration } from './pages/integrations.js';
import { renderSettings } from './pages/settings.js';
import { getState, subscribe, updateState, addMessage, resetChangedFiles } from './state/store.js';
import { createDemoProject } from './services/project-service.js';
import { requestAssistantReply } from './services/chat-service.js';
import { showDialog, showToast, icon, escapeHtml } from './components/ui.js';
import { navigate } from './router.js';

const app = document.querySelector('#app');

function renderPage(state) {
  switch (state.route) {
    case '/projects': return renderProjects();
    case '/conversations': return renderConversations(state);
    case '/preview': return renderPreview();
    case '/github': return renderIntegration('github');
    case '/supabase': return renderIntegration('supabase');
    case '/settings': return renderSettings();
    default: return renderDashboard();
  }
}

function render() {
  const state = getState();
  app.innerHTML = renderShell(renderPage(state), state);
  if (state.route === '/conversations') {
    const history = document.querySelector('#chat-history');
    if (history) history.scrollTop = history.scrollHeight;
  }
}

function openNewProjectDialog() {
  const body = `<form id="new-project-form" class="dialog-form"><label for="new-project-name">Nome do projeto</label><input id="new-project-name" name="name" maxlength="48" placeholder="Ex.: Aurora Studio" required autofocus /><label for="new-project-description">Descrição <span>Opcional</span></label><textarea id="new-project-description" name="description" maxlength="140" rows="3" placeholder="O que você quer construir?"></textarea><div class="dialog-hint">${icon('sparkle', 14)} Este projeto ficará disponível nesta sessão de demonstração.</div><button class="button button--primary dialog-form__submit" type="submit">Criar projeto ${icon('arrow', 15)}</button></form>`;
  showDialog({ title: 'Criar projeto', body, form: true });
  window.setTimeout(() => document.querySelector('#new-project-name')?.focus(), 0);
}

function openChangesDialog() {
  const body = `<p class="dialog-copy">Uma visualização fictícia de como as alterações poderão aparecer. Nenhum Git diff está sendo calculado.</p><div class="mock-diff"><div><span>src/pages/Login.tsx</span><small>+ 12 linhas</small></div><pre><span class="diff-add">+ export function LoginPage() {</span>\n<span class="diff-add">+   return &lt;main&gt;Entre na sua conta&lt;/main&gt;;</span>\n<span class="diff-add">+ }</span></pre><div><span>src/styles/global.css</span><small>+ 8 linhas</small></div><pre><span class="diff-add">+ .login-panel {</span>\n<span class="diff-add">+   border-radius: 20px;</span>\n<span class="diff-add">+ }</span></pre></div>`;
  showDialog({ title: 'Alterações demonstrativas', body, confirmLabel: 'Entendi' });
}

function openUndoDialog() {
  showDialog({ title: 'Desfazer alterações?', body: '<p class="dialog-copy">Esta ação limpa apenas o painel demonstrativo de arquivos. Ela não altera código, repositório ou arquivos do projeto.</p>', confirmLabel: 'Limpar demonstração', onConfirmAction: 'confirm-undo' });
}

function submitChat(form) {
  const input = form.querySelector('[name="message"]');
  const text = input?.value.trim();
  if (!text || getState().isProcessing) return;
  addMessage({ id: `message-${Date.now()}`, role: 'user', text, time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()) });
  updateState({ isProcessing: true });
  requestAssistantReply().then((reply) => {
    addMessage({ id: `message-${Date.now()}-reply`, role: 'assistant', text: reply, time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()) });
  }).finally(() => updateState({ isProcessing: false }));
}

bindRouter();
subscribe(render);
render();

document.addEventListener('click', (event) => {
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
  if (action === 'connect-github' || action === 'connect-supabase') showToast('Conexão real ainda não está ativa neste scaffold.', 'info');
  if (action === 'refresh-preview') {
    trigger.classList.add('is-spinning');
    window.setTimeout(() => trigger.classList.remove('is-spinning'), 700);
    showToast('Preview demonstrativo atualizado.');
  }
  if (action === 'open-demo') window.open('/preview-demo.html', '_blank', 'noopener,noreferrer');
  if (action === 'show-help') showDialog({ title: 'Este é o início.', body: '<p class="dialog-copy">A DevIA está no modo de demonstração. Navegue pelo menu para explorar as telas e os pontos preparados para integrações futuras.</p>', confirmLabel: 'Explorar' });
  if (action === 'show-chat-info') showDialog({ title: 'Contexto da conversa', body: '<p class="dialog-copy">Esta conversa usa mensagens locais de exemplo. Nenhum agente de IA, serviço remoto ou histórico persistente está conectado.</p>', confirmLabel: 'Entendi' });
});

document.addEventListener('submit', (event) => {
  const form = event.target;
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
      showToast(`${escapeHtml(project.name)} foi adicionado nesta sessão.`);
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
