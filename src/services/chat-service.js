/**
 * Adaptador de demonstração para a futura API de conversas.
 * Mantém os limites claros: sem modelo, chave, rede ou agente autônomo.
 */
export async function requestAssistantReply() {
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  return 'Entendi. Esta é uma resposta demonstrativa — o conector de IA poderá ser adicionado aqui na próxima etapa.';
}
