import { icon, escapeHtml, renderMarkdown } from '../components/ui.js';
import { getState } from '../state/store.js';
import { getActiveProject } from '../services/project-service.js';

function messageBubble(message) {
  const isUser = message.role === 'user';
  return `<article class="chat-message ${isUser ? 'chat-message--user' : ''}"><span class="chat-avatar ${isUser ? 'chat-avatar--user' : ''}">${isUser ? 'M' : icon('sparkle', 15)}</span><div class="chat-message__body"><div class="chat-message__meta"><strong>${isUser ? 'Você' : 'DevIA'}</strong><span>${escapeHtml(message.time)}</span></div><div class="chat-message__content">${renderMarkdown(message.text)}</div></div></article>`;
}

function actionPanel(state) {
  if (!state.changedFiles.length) return `<div class="empty-files">${icon('check', 18)}<strong>Tudo em dia</strong><span>Nenhum arquivo modificado nesta sessão.</span></div>`;
  return `<div class="file-list">${state.changedFiles.map((file) => `<div class="file-row"><span class="file-change file-change--${file.change.toLowerCase()}">${file.change}</span>${icon('file', 15)}<span class="file-row__name">${escapeHtml(file.path)}</span><span class="file-row__type">${escapeHtml(file.language)}</span></div>`).join('')}</div><div class="file-actions"><button class="button button--secondary button--sm" type="button" data-action="view-changes">${icon('code', 14)} Ver alterações</button><button class="button button--ghost button--sm" type="button" data-action="undo">Desfazer</button></div><div class="panel-footnote">${icon('shield', 13)} O Gemini já está ativo. A próxima camada adicionará as ferramentas para ler e alterar o projeto.</div>`;
}

export function renderConversations(state) {
  const project = getActiveProject();
  return `<div class="conversation-heading"><div>${icon('sparkle', 17)} <span class="eyebrow">WORKSPACE DE IA</span><span class="conversation-heading__dot"></span> Gemini</div><h1>Uma ideia para começar?</h1><p>Converse com seu projeto. O Gemini já está conectado ao cérebro da DevIA.</p></div>
    <div class="conversation-layout"><section class="chat-panel panel"><header class="chat-panel__header"><div class="chat-project"><span class="project-logo project-logo--${project.color}">${icon('layers', 16)}</span><span><strong>${escapeHtml(project.name)}</strong><small>Contexto da conversa</small></span>${icon('chevron', 14)}</div><button class="icon-button" type="button" data-action="show-chat-info" aria-label="Informação">${icon('dots')}</button></header><div class="chat-history" id="chat-history">${state.messages.map(messageBubble).join('')}${state.isProcessing ? `<article class="chat-message"><span class="chat-avatar">${icon('sparkle', 15)}</span><div class="chat-message__body"><div class="chat-message__meta"><strong>DevIA</strong><span class="processing-label">Preparando resposta...</span></div><div class="typing-indicator"><i></i><i></i><i></i></div></div></article>` : ''}</div><form class="chat-composer" data-form="chat"><label class="sr-only" for="chat-input">Escreva um comando para a DevIA</label><textarea id="chat-input" name="message" rows="1" placeholder="Descreva o que você quer criar..." ${state.isProcessing ? 'disabled' : ''}></textarea><div class="chat-composer__bottom"><span>${icon('sparkle', 14)} Gemini conectado pelo backend seguro</span><button class="send-button" type="submit" aria-label="Enviar mensagem" ${state.isProcessing ? 'disabled' : ''}>${icon('send', 16)}</button></div></form></section>
    <aside class="panel actions-panel"><div class="panel-heading"><div><span class="eyebrow">SESSÃO ATUAL</span><h2>Ações realizadas</h2></div><span class="count-badge">${state.changedFiles.length}</span></div><p class="actions-panel__intro">As alterações reais aparecerão aqui quando o agente receber acesso às ferramentas de código.</p>${actionPanel(state)}</aside></div>`;
}
