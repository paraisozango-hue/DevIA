import { badge, button, icon, pageHeading, escapeHtml } from '../components/ui.js';

const integrationContent = {
  github: {
    name: 'GitHub', icon: 'github', tone: 'blue', accent: 'integration-visual--github',
    description: 'Conecte seu repositório para permitir que a plataforma trabalhe sobre o seu código.',
    detail: 'Seus repositórios e branches poderão ser usados como contexto do projeto. A autorização será adicionada em uma próxima etapa.',
    capabilities: ['Acesso a repositórios', 'Branches e histórico', 'Commits sob sua aprovação'],
    action: 'connect-github', button: 'Conectar GitHub',
  },
  supabase: {
    name: 'Supabase', icon: 'database', tone: 'green', accent: 'integration-visual--supabase',
    description: 'Conecte seu projeto Supabase para permitir futuramente que a IA trabalhe com banco de dados, tabelas, migrations e políticas.',
    detail: 'As credenciais e permissões ficam sob seu controle. Esta demonstração não acessa nenhum projeto ou dado real.',
    capabilities: ['Projetos e ambientes', 'Tabelas e migrations', 'Políticas sob revisão'],
    action: 'connect-supabase', button: 'Conectar Supabase',
  },
};

export function renderIntegration(provider) {
  const item = integrationContent[provider];
  const actions = button(item.button, { iconName: 'link', action: item.action, variant: 'primary' });
  return `${pageHeading('INTEGRAÇÕES', item.name, item.description, actions)}
    <section class="integration-card panel"><div class="integration-card__top"><div class="integration-visual ${item.accent}">${icon(item.icon, 29)}</div><div><span class="eyebrow">ESTADO DA CONEXÃO</span><div class="integration-card__status">${badge('Desconectado', 'neutral', true)}<span>Conecte quando estiver pronto</span></div></div><span class="integration-card__badge">${icon('shield', 14)} Seguro por padrão</span></div><div class="integration-card__body"><h2>Seu código, sob seu controle.</h2><p>${escapeHtml(item.detail)}</p><div class="integration-feature-list">${item.capabilities.map((feature) => `<div>${icon('check', 15)}<span>${feature}</span></div>`).join('')}</div></div><div class="integration-card__footer"><span>${icon('sparkle', 15)} Integração real será configurada em uma próxima etapa.</span><button class="button button--primary" type="button" data-action="${item.action}">${icon('link', 15)}<span>${item.button}</span>${icon('arrow', 15)}</button></div></section>
    <div class="integration-note">${icon('shield', 16)} Nenhuma autorização, credencial ou requisição externa será solicitada nesta demonstração.</div>`;
}
