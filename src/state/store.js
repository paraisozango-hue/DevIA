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
  messages: [
    { id: 'm1', role: 'assistant', text: 'Oi! Estou acompanhando o projeto Orbit Commerce. O que você gostaria de explorar por aqui?', time: '10:42' },
    { id: 'm2', role: 'user', text: 'Cria uma página de login moderna.', time: '10:43' },
    { id: 'm3', role: 'assistant', text: 'Entendi. Vou analisar o projeto e preparar as alterações.', time: '10:43' },
  ],
  changedFiles: [
    { path: 'src/pages/Login.tsx', change: 'M', language: 'tsx' },
    { path: 'src/components/Button.tsx', change: 'A', language: 'tsx' },
    { path: 'src/styles/global.css', change: 'M', language: 'css' },
  ],
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
  state = { ...state, messages: [...state.messages, message] };
  listeners.forEach((listener) => listener(state));
}

export function resetChangedFiles() {
  state = { ...state, changedFiles: [] };
  listeners.forEach((listener) => listener(state));
}
