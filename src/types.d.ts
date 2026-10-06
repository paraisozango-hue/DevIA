export type ProjectStatus = 'Em andamento' | 'Pronto para preview' | 'Rascunho';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  repository: string;
  updatedAt: string;
  color: 'violet' | 'blue' | 'green';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export interface ChangedFile {
  path: string;
  change: 'A' | 'M' | 'D';
  language: string;
}

export interface IntegrationAdapter {
  readonly provider: 'github' | 'supabase' | 'openai' | 'gemini';
  getConnectionState(): Promise<'connected' | 'disconnected'>;
  connect(): Promise<never>;
}
