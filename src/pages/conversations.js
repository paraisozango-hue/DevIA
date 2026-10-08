import { icon, escapeHtml, renderMarkdown } from '../components/ui.js';
import { getState } from '../state/store.js';
import { getActiveProject } from '../services/project-service.js';

function messageBubble(message) {
  const isUser = message.role === 'user';
  const content = message.audioUrl
    ? `<div class="chat-audio-message">${icon('mic', 14)}<span>Mensagem de áudio</span><audio controls preload="metadata" src="${escapeHtml(message.audioUrl)}"></audio></div>`
    : (isUser ? escapeHtml(message.text) : renderMarkdown(message.text));
  return `<article class="chat-message ${isUser ? 'chat-message--user' : ''}"><span class="chat-avatar ${isUser ? 'chat-avatar--user' : ''}">${isUser ? 'M' : icon('sparkle', 15)}</span><div class="chat-message__body"><div class="chat-message__meta"><strong>${isUser ? 'Você' : 'DevIA'}</strong><span>${escapeHtml(message.time)}</span></div><div class="chat-message__content ${isUser ? 'chat-message__content--user' : ''}">${content}</div></div></article>`;
}

function actionPanel(state) {
  if (!state.changedFiles.length) return `<div class="empty-files">${icon('check', 18)}<strong>Tudo em dia</strong><span>Nenhum arquivo modificado nesta sessão.</span></div>`;
  return `<div class="file-list">${state.changedFiles.map((file) => `<div class="file-row"><span class="file-change file-change--${file.change.toLowerCase()}">${file.change}</span>${icon('file', 15)}<span class="file-row__name">${escapeHtml(file.path)}</span><span class="file-row__type">${escapeHtml(file.language)}</span></div>`).join('')}</div><div class="file-actions"><button class="button button--secondary button--sm" type="button" data-action="view-changes">${icon('code', 14)} Ver alterações</button><button class="button button--ghost button--sm" type="button" data-action="undo">Desfazer</button></div><div class="panel-footnote">${icon('shield', 13)} O Gemini já está ativo. A próxima camada adicionará as ferramentas para ler e alterar o projeto.</div>`;
}

export function renderConversations(state) {
  const audioMode = state.audioMode || 'idle';
  const audioRecording = audioMode === 'recording';
  const audioReview = audioMode === 'review';
  const audioTranscribing = audioMode === 'transcribing';
  const audioElapsed = Math.max(0, Number(state.audioElapsedMs || 0));
  const audioSeconds = Math.floor(audioElapsed / 1000);
  const audioTime = String(Math.floor(audioSeconds / 60)).padStart(2, '0') + ':' + String(audioSeconds % 60).padStart(2, '0');
  const waveform = Array.from({ length: 56 }, (_, index) => {
    const wave = 10 + ((index * 17) % 25);
    return '<i style="--wave-height:' + wave + '%;--wave-delay:' + ((index % 9) * -0.11).toFixed(2) + 's"></i>';
  }).join('');

  const audioPanel = audioMode !== 'idle' ? `
    <div class="audio-capture-panel audio-capture-panel--${audioMode}" role="status" aria-live="polite">
      <div class="audio-capture-panel__top">
        <span class="audio-capture-panel__live">
          <i></i>
          <span>${audioRecording ? 'Gravando' : audioTranscribing ? 'Transcrevendo' : 'Mensagem pronta'}</span>
        </span>
        <span class="audio-capture-panel__timer" id="audio-timer">${audioTime}</span>
      </div>
      <div class="audio-waveform" id="audio-waveform" style="--audio-level:0.15" aria-hidden="true">${waveform}</div>
      ${audioTranscribing
        ? '<div class="audio-capture-panel__hint">Convertendo sua voz em texto…</div>'
        : audioReview
          ? '<div class="audio-capture-panel__hint">Revise a mensagem antes de enviar.</div>'
          : '<div class="audio-capture-panel__hint">Fale naturalmente. Você poderá revisar o texto antes de enviar.</div>'}
      ${audioReview ? `
        <div class="audio-capture-panel__actions">
          <button class="audio-control audio-control--cancel" type="button" data-action="cancel-audio" aria-label="Cancelar áudio" title="Cancelar">${icon('close', 18)}</button>
          <button class="audio-control audio-control--confirm" type="button" data-action="confirm-audio" aria-label="Transcrever áudio" title="Transcrever">${icon('check', 18)}</button>
        </div>` : audioRecording ? `
        <div class="audio-capture-panel__actions">
          <button class="audio-control audio-control--cancel" type="button" data-action="cancel-audio" aria-label="Cancelar gravação" title="Cancelar">${icon('close', 18)}</button>
          <button class="audio-control audio-control--stop" type="button" data-action="stop-audio" aria-label="Parar gravação" title="Parar">${icon('close', 16)}</button>
        </div>` : ''}
    </div>` : '';

  const project = getActiveProject();
  const composerText = audioTranscribing ? '' : (state.audioTranscript || '');
  const composerPlaceholder = audioReview ? 'A transcrição aparecerá aqui…' : 'Descreva o que você quer criar...';

  return `<div class="conversation-heading"><div>${icon('sparkle', 17)} <span class="eyebrow">WORKSPACE DE IA</span><span class="conversation-heading__dot"></span> Gemini</div><h1>Uma ideia para começar?</h1><p>Converse com seu projeto. O Gemini já está conectado ao cérebro da DevIA.</p></div>
    <div class="conversation-layout"><section class="chat-panel panel"><header class="chat-panel__header"><div class="chat-project"><span class="project-logo project-logo--${project.color}">${icon('layers', 16)}</span><span><strong>${escapeHtml(project.name)}</strong><small>Contexto da conversa</small></span>${icon('chevron', 14)}</div><button class="icon-button" type="button" data-action="show-chat-info" aria-label="Informação">${icon('dots')}</button></header><div class="chat-history" id="chat-history">${state.messages.map(messageBubble).join('')}${state.isProcessing ? `<article class="chat-message"><span class="chat-avatar">${icon('sparkle', 15)}</span><div class="chat-message__body"><div class="chat-message__meta"><strong>DevIA</strong><span class="processing-label">Preparando resposta...</span></div><div class="typing-indicator"><i></i><i></i><i></i></div></div></article>` : ''}</div><form class="chat-composer ${audioMode !== 'idle' ? 'chat-composer--audio' : ''}" data-form="chat"><label class="sr-only" for="chat-input">Escreva um comando para a DevIA</label><textarea id="chat-input" name="message" rows="1" placeholder="${composerPlaceholder}" ${state.isProcessing || audioRecording || audioTranscribing ? 'disabled' : ''}>${escapeHtml(composerText)}</textarea>${audioPanel}<div class="chat-composer__bottom"><span id="audio-status">${icon(audioMode === 'recording' ? 'mic' : 'sparkle', 14)} ${audioMode === 'recording' ? 'Escutando…' : audioMode === 'review' ? 'Pronto para transcrever' : audioMode === 'transcribing' ? 'A preparar a transcrição…' : 'Gemini conectado pelo backend seguro'}</span><div class="chat-composer__actions"><button class="icon-button voice-button ${audioRecording ? 'voice-button--recording' : ''}" type="button" data-action="toggle-audio" aria-label="${audioRecording ? 'Parar gravação' : 'Gravar mensagem de voz'}" ${state.isProcessing || audioTranscribing || audioReview ? 'disabled' : ''}>${icon(audioRecording ? 'close' : 'mic', 17)}</button><button class="send-button" type="submit" aria-label="Enviar mensagem" ${state.isProcessing || audioRecording || audioTranscribing ? 'disabled' : ''}>${icon('send', 16)}</button></div></div></form></section>
    <aside class="panel actions-panel"><div class="panel-heading"><div><span class="eyebrow">SESSÃO ATUAL</span><h2>Ações realizadas</h2></div><span class="count-badge">${state.changedFiles.length}</span></div><p class="actions-panel__intro">As alterações reais aparecerão aqui quando o agente receber acesso às ferramentas de código.</p>${actionPanel(state)}</aside></div>`;
}
