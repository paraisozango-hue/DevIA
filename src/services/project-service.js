import { getState, addProject } from '../state/store.js';

export function listProjects() {
  return getState().projects;
}

export function getActiveProject() {
  const { projects, activeProjectId } = getState();
  return projects.find((project) => project.id === activeProjectId) || projects[0];
}

export function createDemoProject(name, description) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Informe o nome do projeto.');
  const project = {
    id: `project-${Date.now()}`,
    name: cleanName,
    description: description.trim() || 'Novo projeto criado neste workspace demonstrativo.',
    status: 'Rascunho',
    repository: 'Ainda não conectado',
    updatedAt: 'agora',
    color: 'blue',
  };
  addProject(project);
  return project;
}
