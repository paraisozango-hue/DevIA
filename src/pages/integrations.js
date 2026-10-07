import { badge, button, icon, pageHeading, escapeHtml } from '../components/ui.js';

const integrationContent = {
  github: {
    name: 'GitHub', icon: 'github', tone: 'blue', accent: 'integration-visual--github',
    description: 'Conecte sua conta para que a DevIA possa trabalhar com seus repositórios.',
    detail: 'A conexão ficará vinculada ao seu workspace. O token de acesso nunca será colocado no código do frontend.',
    capabilities: ['Repositórios e branches', 'Leitura e alteração de arquivos', 'Commits sob sua aprovação'],
    action: 'connect-github', button: 'Conectar GitHub',
  },
  supabase: {
    name: 'Supabase', icon: 'database', tone: 'green', accent: 'integration-visual--supabase',
    description: 'Conecte o projeto Supabase que pertence ao seu produto.',
    detail: 'Informe a URL e a chave publishable do projeto. A DevIA testa a conexão antes de guardar o vínculo no seu workspace.',
    capabilities: ['Projeto e ambiente', 'Tabelas e migrations', 'RLS e dados do workspace'],
    action: 'connect-supabase', button: 'Conectar Supabase',
  },
};

function statusView(integration) {
  if (!integration || integration.status !== 'connected') {
    return badge('Desconectado', 'neutral', true) + '<span>Ainda não conectado</span>';
  }
  const label = integration.display_name || integration.metadata?.name || 'Conta conectada';
  return badge('Conectado', 'green', true) + '<span>' + escapeHtml(label) + '</span>';
}

function connectionFooter(provider, integration) {
  if (integration?.status === 'connected') {
    const manage = provider === 'github' && integration?.metadata?.installationId
      ? '<a class="button button--secondary" href="https://github.com/settings/installations/' + encodeURIComponent(integration.metadata.installationId) + '" target="_blank" rel="noreferrer">' + icon('external', 15) + '<span>Gerenciar acesso</span></a>'
      : '';
    return manage + '<button class="button button--secondary" type="button" data-action="disconnect-' + provider + '">' + icon('link', 15) + '<span>Desconectar</span></button>';
  }
  return '<button class="button button--primary" type="button" data-action="' + integrationContent[provider].action + '">' + icon('link', 15) + '<span>' + integrationContent[provider].button + '</span>' + icon('arrow', 15) + '</button>';
}

export function renderIntegration(provider, integration = null) {
  const item = integrationContent[provider];
  return pageHeading('INTEGRAÇÕES', item.name, item.description, null) +
    '<section class="integration-card panel"><div class="integration-card__top"><div class="integration-visual ' + item.accent + '">' + icon(item.icon, 29) + '</div><div><span class="eyebrow">ESTADO DA CONEXÃO</span><div class="integration-card__status">' + statusView(integration) + '</div></div><span class="integration-card__badge">' + icon('shield', 14) + ' Persistente no workspace</span></div>' +
    '<div class="integration-card__body"><h2>Seu código, sob seu controle.</h2><p>' + escapeHtml(item.detail) + '</p><div class="integration-feature-list">' + item.capabilities.map((feature) => '<div>' + icon('check', 15) + '<span>' + feature + '</span></div>').join('') + '</div>' +
    (provider === 'github' && !integration ? '<div class="integration-note">' + icon('shield', 15) + ' A autorização do GitHub usa OAuth e precisa de uma aplicação GitHub configurada no backend; nenhum token será salvo no navegador.</div>' : '') +
    (provider === 'github' && integration?.status === 'connected' ? '<div class="integration-note">' + icon('github', 15) + ' O acesso aos repositórios é controlado pela instalação do GitHub App. Se a lista estiver vazia, use <strong>Gerenciar acesso</strong> e selecione o repositório.</div>' : '') +
    '</div><div class="integration-card__footer"><span>' + icon('sparkle', 15) + ' A conexão permanece associada ao seu workspace.</span>' + connectionFooter(provider, integration) + '</div></section>' +
    (provider === 'supabase' && integration?.metadata?.url ? '<div class="integration-note">' + icon('database', 16) + ' Projeto conectado: ' + escapeHtml(integration.metadata.url) + '</div>' : '');
}
