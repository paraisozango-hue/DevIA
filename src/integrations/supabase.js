/**
 * Extensão futura para projetos, tabelas e migrations do Supabase.
 * Nenhum segredo, banco de dados ou serviço remoto é acessado nesta etapa.
 */
export const supabaseIntegration = Object.freeze({
  provider: 'supabase',
  async getConnectionState() {
    return 'disconnected';
  },
  async connect() {
    throw new Error('A integração real com Supabase ainda não foi configurada.');
  },
});
