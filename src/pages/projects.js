import { badge, button, icon, pageHeading, escapeHtml } from '../components/ui.js';
import { listProjects } from '../services/project-service.js';

function projectRow(project) {
  const tone = project.status === 'Em andamento' ? 'green' : project.status === 'Pronto para preview' ? 'blue' : 'neutral';
  return `<article class="project-row" data-project-row data-search="${escapeHtml(`${project.name} ${project.repository} ${project.status}`.toLowerCase())}"><div class="project-row__identity"><span class="project-logo project-logo--${project.color}">${icon('layers', 18)}</span><div><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.description)}</span></div></div><div class="project-row__status">${badge(project.status, tone, true)}</div><div class="project-row__repo">${icon('branch', 14)} ${escapeHtml(project.repository)}</div><div class="project-row__updated">${escapeHtml(project.updatedAt)}</div><a class="button button--secondary button--sm" href="/preview" data-link>Abrir ${icon('arrow', 14)}</a></article>`;
}

export function renderProjects() {
  const projects = listProjects();
  const actions = button('Novo projeto', { iconName: 'plus', action: 'new-project', variant: 'primary' });
  return `${pageHeading('SEU WORKSPACE', 'Projetos', 'Seus espaços de trabalho, prontos para ganhar forma.', actions)}
    <div class="projects-toolbar"><div class="projects-toolbar__copy"><span class="eyebrow">${projects.length} PROJETOS</span><p>Projetos demonstrativos neste workspace.</p></div><label class="search-field">${icon('search', 16)}<input id="project-search" type="search" placeholder="Buscar projeto..." aria-label="Buscar projetos" /></label></div>
    <section class="project-list" aria-label="Lista de projetos"><div class="project-list__header"><span>PROJETO</span><span>STATUS</span><span>REPOSITÓRIO</span><span>ATUALIZADO</span><span></span></div>${projects.map(projectRow).join('')}<div class="project-list__empty" hidden>Nenhum projeto corresponde à sua busca.</div></section>
    <div class="demo-note">${icon('sparkle', 16)} Os dados desta lista são demonstrativos e ficam apenas nesta sessão.</div>`;
}
