import { updateState } from './state/store.js';

const routes = new Set(['/', '/login', '/signup', '/projects', '/conversations', '/preview', '/github', '/supabase', '/settings']);

const ROUTE_STORAGE_KEY = 'devia.navigation.route';

export function getStoredRoute() {
  try {
    const route = localStorage.getItem(ROUTE_STORAGE_KEY);
    return routes.has(route) ? route : null;
  } catch {
    return null;
  }
}

function persistRoute(route) {
  try { localStorage.setItem(ROUTE_STORAGE_KEY, route); } catch {}
}

export function navigate(path, { replace = false, persist = true } = {}) {
  const nextPath = routes.has(path) ? path : '/';
  if (window.location.pathname !== nextPath) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
  }
  if (persist) persistRoute(nextPath);
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
  window.addEventListener('popstate', () => {
    const route = routes.has(window.location.pathname) ? window.location.pathname : '/';
    persistRoute(route);
    updateState({ route });
  });
}
