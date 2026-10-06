import { badge, icon, pageHeading } from '../components/ui.js';

function settingRow(symbol, title, description, status) {
  return `<div class="setting-row"><span class="setting-row__icon">${icon(symbol, 17)}</span><div><strong>${title}</strong><p>${description}</p></div><span class="setting-row__status">${status}</span></div>`;
}

export function renderSettings() {
  return `${pageHeading('WORKSPACE', 'Configurações', 'A base do seu espaço de trabalho, pronta para crescer.', badge('Inicial', 'violet', true))}
    <section class="settings-card panel"><div class="settings-card__header"><div><span class="eyebrow">PREFERÊNCIAS DO WORKSPACE</span><h2>Um espaço para construir.</h2><p>As opções de conta, provedores e execução serão adicionadas conforme o produto evoluir.</p></div><span class="settings-emblem">${icon('settings', 22)}</span></div><div class="settings-list">${settingRow('layers', 'Workspace', 'Estrutura local de demonstração', 'Ativo')}${settingRow('github', 'Repositórios', 'Conexão disponível em etapa futura', 'Em breve')}${settingRow('database', 'Serviços de dados', 'Sem backend ou banco configurado', 'Em breve')}${settingRow('shield', 'Privacidade', 'Nenhuma integração externa ativa', 'Local')}</div><div class="settings-card__footer">${icon('sparkle', 15)} DevIA · uma fundação modular, preparada para evoluir.</div></section>`;
}
