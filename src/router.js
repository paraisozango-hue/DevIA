import { updateState } from './state/store.js';

const routes = new Set(['/', '/login', '/signup', '/projects', '/conversations', '/preview', '/github', '/supabase', '/settings']);

export function navigate(path) {
  const nextPath = routes.has(path) ? path : '/';
  if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
  updateState({ route: nextPath, mobileNavOpen: false });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function bindRouter() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-link]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.getAttribute('href') || '/');
  });
  window.addEventListener('popstate', () => updateState({ route: window.location.pathname }));
}
