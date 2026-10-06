/**
 * Extensão futura para GitHub App/OAuth.
 * Neste scaffold, nenhuma solicitação de rede ou autenticação é executada.
 */
export const githubIntegration = Object.freeze({
  provider: 'github',
  async getConnectionState() {
    return 'disconnected';
  },
  async connect() {
    throw new Error('A integração real com GitHub ainda não foi configurada.');
  },
});
