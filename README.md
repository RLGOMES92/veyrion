# VEYRION OS
**Tecnologia. Inteligência. Crescimento.**

Plataforma B2B para prospecção, CRM, venda e locação de notebooks, ativos, propostas, contratos e acompanhamento financeiro.

## O que está no repositório
- Aplicação Next.js 15 + React 19 + TypeScript.
- Interface responsiva VEYRION OS.
- Login por link mágico via Supabase Auth (sem senha ou perfil selecionável fictício).
- Módulos: dashboard, empresas, contatos, oportunidades, equipamentos, propostas, tarefas, contratos/locações e financeiro.
- Exportação CSV e impressão de proposta para PDF pelo navegador.
- Supabase com RLS por organização, associação de equipe e permissões por função (migration 002 preparada).
- Modelos de variáveis em `.env.example`.
- Versões HTML anteriores preservadas em `legacy/`.

## Rodar localmente
```bash
npm install
cp .env.example .env.local
npm run dev
```
Acesse http://localhost:3000.

## Configurar Supabase
1. Crie um projeto Supabase.
2. No SQL Editor, execute todo o arquivo `supabase/schema.sql`.
3. Depois, execute `supabase/migrations/002_organizations_roles.sql` para habilitar organizações, membros e permissões por função.
4. Em Authentication > Providers, habilite Email.
5. Configure Site URL e Redirect URLs para localhost e o domínio Vercel.
6. Copie Project URL e anon/publishable key para `.env.local` e para as Environment Variables da Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
7. Cadastre/invite somente membros autorizados.

**Segurança:** execute a migration 002 depois do schema inicial. Ela cria uma organização por usuário existente, cria automaticamente a organização do próximo usuário cadastrado e aplica políticas RLS por organização e função. Papéis: Owner/Admin, Gerente, Comercial, Operações, Financeiro e Visualizador. Financeiro fica restrito a Financeiro/Admin; equipamentos e contratos a Operações/Admin; dados comerciais a Comercial/Gerente/Admin. O frontend ainda precisa de uma tela administrativa para convidar membros, trocar organização e gerenciar papéis; até isso existir, faça o provisionamento de membros com cuidado pelo painel Supabase. Não desligue RLS.

## Integrações previstas (não ativadas)
O arquivo `.env.example` lista variáveis para OpenAI, WhatsApp Cloud API, Zoho e SMTP. A presença dessas variáveis não significa que a integração esteja ativa. Implementar cada conector exige credenciais reais, URLs de webhook, templates aprovados e testes. Nenhum segredo deve ser commitado no GitHub.

## Conversão de propostas aceitas em contratos

Uma proposta com status **Aceita** pode ser convertida em um registro do módulo **Contratos e locações** pela ação "Gerar contrato". O sistema aproveita os dados comerciais, cliente, equipamento, quantidade, prazo e valores da proposta, gera um número de contrato e registra a referência interna da proposta para evitar conversões duplicadas.

O contrato é criado inicialmente em **Preparação**, com datas previstas calculadas a partir da data atual e do prazo informado. Antes de ativar a locação, a equipe deve confirmar a assinatura, disponibilidade dos equipamentos, números de série, endereço e agenda de entrega.

A conversão **não reserva equipamentos automaticamente**, não assina documentos, não envia contrato ao cliente e não cria cobranças. Essas ações exigem validação operacional e integrações específicas.

## Propostas comerciais de locação

O módulo de propostas permite criar um rascunho a partir de uma oportunidade e aproveitar os dados de contato já cadastrados na empresa. O editor contempla empresa contratante, responsável, e-mail, telefone, CNPJ/CPF, modelo e especificações dos notebooks, quantidade, valor mensal por equipamento, prazo, condições comerciais, entrega/suporte e validade.

Ao salvar uma proposta, o sistema calcula:
- **Mensalidade total:** quantidade × valor mensal por equipamento.
- **Valor estimado do contrato:** mensalidade total × prazo em meses.

Cada proposta possui acompanhamento de status (Rascunho, Enviada, Em negociação, Aceita, Recusada ou Expirada). A ação de impressão gera um documento comercial VEYRION em formato A4; no diálogo de impressão do navegador, selecione **Salvar como PDF** para gerar o arquivo.

Os status e datas de movimentação são registrados no payload da proposta. A ação de alterar para "Enviada" registra a data de envio, mas não dispara e-mail ou WhatsApp: o envio externo depende de uma integração configurada e autorizada.

## Escopo comercial e operacional
- Prospecção B2B em São Paulo e Grande São Paulo, para empresas de todos os portes.
- Setores iniciais: tecnologia, BPO/call center, consultorias, logística, saúde, educação, indústria e serviços financeiros.
- Pipeline com 12 etapas, desde novo lead até ganho/perdido.
- Cadastro de notebooks com número de série, configuração, custo, preço, aluguel, localização e status.
- Propostas, tarefas/follow-ups, contratos, entrega/devolução e registros financeiros.

## Organizações e permissões (migration 002)\n\nArquivo: `supabase/migrations/002_organizations_roles.sql`. Execute no SQL Editor somente depois do `schema.sql`. A migration adiciona `organizations`, `organization_members` e `workspace_records.organization_id`, migra os registros existentes e substitui as políticas individuais por políticas multi-tenant com controle por módulo. Ela não foi executada automaticamente no projeto Supabase.\n\n| Papel | Acesso previsto |\n|---|---|\n| Owner / Admin | Todos os módulos e gestão da organização |\n| Gerente | Módulos comerciais |\n| Comercial | Empresas, contatos, oportunidades, propostas e tarefas |\n| Operações | Equipamentos e contratos |\n| Financeiro | Financeiro |\n| Visualizador | Leitura dos módulos não financeiros |\n\nO usuário atual não recebe automaticamente uma tela de administração por esta migration; a gestão de membros e a seleção de organização no frontend são etapas seguintes.\n\n## Próximas etapas antes de produção
- Criar tela administrativa para convidar membros, selecionar organização e gerenciar papéis; validar os fluxos multiempresa.
- Validar CNPJ, deduplicar empresas e implementar importação CSV com pré-visualização.
- Implementar contratos com geração PDF, assinatura e trilha de auditoria.
- Criar ciclo de vida do ativo: reserva, entrega, manutenção, devolução e conferência.
- Conectar WhatsApp Cloud API, Zoho CRM, e-mail e Google Workspace por webhooks seguros.
- Implementar IA com aprovação humana, limites de uso e registro das ações.
- Testes automatizados, logs, backups, monitoramento e revisão LGPD.

## Observação
O HTML anterior foi preservado em `legacy/`. Dados de demonstração devem ser identificados como DEMO; não representam clientes ou oportunidades reais.
