import { badge, icon, pageHeading, escapeHtml } from '../components/ui.js';
import { getActiveProject } from '../services/project-service.js';

export function renderPreview() {
  const project = getActiveProject();
  return pageHeading(
    'AMBIENTE DO PROJETO',
    'Preview do projeto',
    'Visualização real do código autorizado no GitHub. O Preview acompanha o branch selecionado.',
    badge('Código real', 'green', true),
  ) + `
    <section class="preview-shell">
      <div class="preview-toolbar">
        <div class="preview-toolbar__traffic"><i></i><i></i><i></i></div>
        <div class="preview-address">${icon('shield', 13)}<span>github-preview</span><b>/</b><span id="preview-repository">${escapeHtml(project.name)}</span></div>
        <select id="preview-repository-select" class="preview-select" aria-label="Repositório do Preview"><option value="">Carregando repositórios...</option></select>
        <button class="icon-button preview-refresh" type="button" data-action="refresh-preview" aria-label="Atualizar preview">${icon('refresh', 16)}</button>
        <button class="icon-button" type="button" data-action="open-preview" aria-label="Abrir preview em nova aba">${icon('external', 16)}</button>
      </div>
      <div class="preview-canvas preview-canvas--real">
        <div id="preview-status" class="preview-status">
          <div class="preview-status__icon">${icon('sparkle', 20)}</div>
          <strong>Preparando o código do GitHub...</strong>
          <span>O DevIA está buscando o index.html e os recursos do branch autorizado.</span>
        </div>
        <iframe id="github-preview-frame" title="Preview real do projeto" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" hidden></iframe>
      </div>
      <div class="preview-caption">
        <span>${icon('sparkle', 14)} Preview servido a partir do GitHub</span>
        <span id="preview-ref">Branch: --</span>
      </div>
    </section>`;
}
