const initialState = {
  route: window.location.pathname,
  mobileNavOpen: false,
  isProcessing: false,
  activeProjectId: 'orbit',
  projects: [
    { id: 'orbit', name: 'Orbit Commerce', description: 'Loja virtual headless para marcas independentes.', status: 'Em andamento', repository: 'acme/orbit-commerce', updatedAt: 'há 2 horas', color: 'violet' },
    { id: 'studio', name: 'Studio North', description: 'Site institucional para um estúdio de arquitetura.', status: 'Pronto para preview', repository: 'acme/studio-north', updatedAt: 'ontem', color: 'blue' },
    { id: 'pulse', name: 'Pulse Analytics', description: 'Painel de métricas de produto.', status: 'Rascunho', repository: 'Ainda não conectado', updatedAt: 'há 3 dias', color: 'green' },
  ],
  messages: [],
  integrations: {},
  changedFiles: [],
};

let state = structuredClone(initialState);
const listeners = new Set();

export function getState() {
  return state;
}

export function updateState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addProject(project) {
  state = { ...state, projects: [project, ...state.projects], activeProjectId: project.id };
  listeners.forEach((listener) => listener(state));
}

export function addMessage(message) {
  const messages = [...state.messages, message].slice(-100);
  state = { ...state, messages };
  listeners.forEach((listener) => listener(state));
}

export function resetChangedFiles() {
  state = { ...state, changedFiles: [] };
  listeners.forEach((listener) => listener(state));
}
