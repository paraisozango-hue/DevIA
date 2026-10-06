import { icon, escapeHtml } from './components/ui.js';
import { getActiveProject } from './services/project-service.js';
import { getUser } from './integrations/auth.js';

const navigation = [
  { label: 'Visão geral', href: '/', icon: 'grid', section: 'workspace' },
  { label: 'Projetos', href: '/projects', icon: 'folder', section: 'workspace' },
  { label: 'Conversas', href: '/conversations', icon: 'message', section: 'workspace' },
  { label: 'Preview', href: '/preview', icon: 'monitor', section: 'workspace' },
  { label: 'GitHub', href: '/github', icon: 'github', section: 'integrations' },
  { label: 'Supabase', href: '/supabase', icon: 'database', section: 'integrations' },
  { label: 'Configurações', href: '/settings', icon: 'settings', section: 'account' },
];

function navLink(item, activePath) {
  const active = item.href === activePath || (item.href !== '/' && activePath.startsWith(item.href + '/'));
  return '<a class="nav-link ' + (active ? 'is-active' : '') + '" href="' + item.href + '" data-link ' + (active ? 'aria-current="page"' : '') + '>' + icon(item.icon, 17) + '<span>' + item.label + '</span>' + (item.href === '/conversations' ? '<i class="nav-link__ping"></i>' : '') + '</a>';
}

function brandMark() {
  return '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 8.5h8.5c2 0 3.5 1.5 3.5 3.5v8.5c0 2 1.5 3.5 3.5 3.5H26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M7 23.5h4.5c2 0 3.5-1.5 3.5-3.5v-8.5C15 9.5 16.5 8 18.5 8H25" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="7" cy="8.5" r="2" fill="currentColor"/><circle cx="25" cy="23.5" r="2" fill="currentColor"/><circle cx="25" cy="8" r="2" fill="currentColor"/><circle cx="7" cy="23.5" r="2" fill="currentColor"/></svg></span>';
}

export function renderShell(content, state) {
  const project = getActiveProject();
  const user = getUser();
  const pathname = state.route || '/';
  const title = navigation.find((item) => item.href === pathname)?.label || 'Visão geral';
  const groups = { workspace: 'Workspace', integrations: 'Conexões', account: 'Conta' };
  const grouped = ['workspace', 'integrations', 'account'];
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Minha conta';
  const initial = displayName.slice(0, 1).toUpperCase();
  const sidebar = grouped.map((group) => '<div class="nav-group"><div class="nav-group__title">' + groups[group] + '</div>' + navigation.filter((item) => item.section === group).map((item) => navLink(item, pathname)).join('') + '</div>').join('');

  return '<div class="app-shell ' + (state.mobileNavOpen ? 'nav-open' : '') + '">' +
    '<div class="mobile-scrim" data-action="close-nav"></div>' +
    '<aside class="sidebar" aria-label="Navegação principal">' +
      '<a class="brand" href="/" data-link>' + brandMark() + '<span class="brand__word">DevIA<span class="brand__dot">.</span></span><span class="brand__badge">BETA</span></a>' +
      '<div class="workspace-switcher"><span class="workspace-switcher__avatar">' + escapeHtml(initial) + '</span><span class="workspace-switcher__copy"><strong>' + escapeHtml(displayName) + '</strong><small>Workspace pessoal</small></span>' + icon('chevron', 15, 'workspace-switcher__chevron') + '</div>' +
      '<nav class="sidebar__nav">' + sidebar + '</nav>' +
      '<div class="sidebar__bottom"><div class="usage-card"><div class="usage-card__top"><span>Espaço de trabalho</span>' + icon('zap', 15) + '</div><strong>Seu próximo passo, com IA.</strong><div class="usage-card__bar"><i></i></div><small>Integrações disponíveis em breve</small></div><button class="profile-button" type="button" data-action="logout"><span class="profile-avatar">' + escapeHtml(initial) + '</span><span><strong>' + escapeHtml(displayName) + '</strong><small>Sair da conta</small></span>' + icon('logout', 17) + '</button></div>' +
    '</aside>' +
    '<main class="main-area"><header class="topbar"><div class="topbar__left"><button class="icon-button mobile-menu" type="button" data-action="toggle-nav" aria-label="Abrir menu">' + icon('menu') + '</button><div class="breadcrumbs"><span>DevIA</span>' + icon('chevron', 13) + '<strong>' + title + '</strong></div></div><div class="topbar__right"><span class="topbar__status"><i></i> Sessão ativa</span><span class="topbar__divider"></span><button class="icon-button topbar__help" type="button" data-action="show-help" aria-label="Ajuda">' + icon('sparkle', 17) + '</button><span class="profile-avatar profile-avatar--small">' + escapeHtml(initial) + '</span></div></header><div class="page-content">' + content + '</div></main>' +
  '</div>';
}
