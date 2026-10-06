# DevIA — AI Development Workspace

Fundação front-end demonstrativa para uma futura IDE de desenvolvimento assistida por IA. O projeto está propositalmente enxuto: sem framework, instalação de pacotes, backend, banco de dados, OAuth, chamadas de IA ou integração externa.

## Executar

Requer Node.js 20 ou superior. Na raiz do projeto:

```bash
node server.mjs
```

Abra `http://localhost:3000`. O servidor usa apenas módulos nativos do Node.js e também atende as rotas da aplicação para o Preview.

## Estrutura

```text
server.mjs                 servidor estático mínimo, sem dependências
index.html                 entrada semântica e metadados
manus-routes.json          rotas visuais declaradas para o Preview
preview-demo.html          amostra isolada que abre em nova aba
src/
  app.js                   composição das páginas e interações da interface
  router.js                navegação do lado do cliente
  layout.js                marca, sidebar, breadcrumb e estrutura comum
  components/ui.js         ícones SVG, botões, badges, diálogos e feedback
  pages/                   páginas de dashboard, projetos, conversas e preview
  services/                serviços mockados locais para projetos e chat
  integrations/            contratos iniciais GitHub e Supabase (sem rede)
  state/store.js           estado efêmero em memória
  types.d.ts               contratos TypeScript opcionais para expansão
  styles.css               design system e estilos responsivos
```

## Limites intencionais

- Projetos, mensagens e alterações são demonstrativos e não persistem após recarregar.
- Conversas usam resposta local fixa: nenhuma IA é chamada.
- GitHub e Supabase não autenticam nem acessam serviços reais.
- O preview é uma cena estática demonstrativa, não uma sandbox de execução.
- “Ver alterações” e “Desfazer” são ações visuais; nenhum diff ou arquivo de código é alterado.
- O servidor existe somente para executar esta pequena fundação no ambiente atual; não é um backend de produto.

O próximo estágio pode substituir os adaptadores mock, conectar um repositório e então adicionar a camada de execução/preview com permissões explícitas.
