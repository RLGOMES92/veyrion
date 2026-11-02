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
4. Por último, execute `supabase/migrations/003_unique_monthly_rental_charges.sql` para impedir cobranças mensais duplicadas por contrato e competência. Se a migration apontar duplicidades existentes, revise os lançamentos antes de tentar novamente.
5. Execute `supabase/migrations/004_workspace_audit_logs.sql` para habilitar o histórico de auditoria de criação, edição e exclusão. O histórico registra organização, usuário, módulo, ação, data e nomes dos campos alterados, sem copiar os valores dos cadastros.
6. Execute `supabase/migrations/005_sales_goals.sql` para habilitar metas comerciais mensais por responsável. A migration aplica RLS: leitura para membros da organização e criação/edição/exclusão somente para Owner, Admin e Gerente.
7. Em Authentication > Providers, habilite Email.
8. Configure Site URL e Redirect URLs para localhost e o domínio Vercel.
9. Copie Project URL e anon/publishable key para `.env.local` e para as Environment Variables da Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
10. Cadastre/invite somente membros autorizados.

**Banco de dados:** a migration 003 cria um índice único por organização e `charge_key` no módulo financeiro. A aplicação trata conflito de inserção simultânea como cobrança já existente. Execute-a somente depois das migrations 001 (schema inicial) e 002 (organizações/permissões).\n\n**Segurança:** execute a migration 002 depois do schema inicial. Ela cria uma organização por usuário existente, cria automaticamente a organização do próximo usuário cadastrado e aplica políticas RLS por organização e função. Papéis: Owner/Admin, Gerente, Comercial, Operações, Financeiro e Visualizador. Financeiro fica restrito a Financeiro/Admin; equipamentos e contratos a Operações/Admin; dados comerciais a Comercial/Gerente/Admin. O frontend ainda precisa de uma tela administrativa para convidar membros, trocar organização e gerenciar papéis; até isso existir, faça o provisionamento de membros com cuidado pelo painel Supabase. Não desligue RLS.

## Integrações previstas (não ativadas)
O arquivo `.env.example` lista variáveis para OpenAI, WhatsApp Cloud API, Zoho e SMTP. A presença dessas variáveis não significa que a integração esteja ativa. Implementar cada conector exige credenciais reais, URLs de webhook, templates aprovados e testes. Nenhum segredo deve ser commitado no GitHub.

## Painel operacional de locação

A Visão geral apresenta indicadores calculados a partir dos registros existentes: total de equipamentos por status, contratos ativos, receita mensal contratada (soma das mensalidades dos contratos com status Ativo), lançamentos financeiros vencidos e contratos com término previsto em até 30 dias ou já vencidos.

Os alertas de contrato consideram o campo de término previsto e excluem contratos encerrados ou cancelados. Os indicadores são operacionais e dependem da qualidade dos dados cadastrados; receita mensal contratada não equivale a recebimento confirmado. O contador financeiro considera lançamentos não pagos/cancelados com vencimento anterior à data atual.

## Gestão individual de equipamentos

O módulo de equipamentos mantém um registro por notebook, com patrimônio/etiqueta, marca, modelo, número de série, configuração, condição, custos, valor de locação, localização, garantia e observações de manutenção. O número de série é validado para evitar duplicidade no cadastro.

O ciclo operacional disponível é:
1. **Disponível:** pode ser reservado para um contrato em preparação, aguardando assinatura ou ativo.
2. **Reservado:** fica vinculado ao contrato e à empresa; a equipe pode registrar a entrega.
3. **Alugado:** registra a entrega e a data de início da posse pelo cliente.
4. **Devolvido:** a ação de devolução registra a data e libera o vínculo atual, mantendo a referência do último contrato para histórico.

A reserva e a entrega são registros administrativos. O sistema não confirma movimentação física, assinatura ou disponibilidade real sem conferência da equipe. A baixa de devolução retorna o item a Disponível; inspecione o notebook antes de disponibilizá-lo novamente. Para equipamentos em manutenção, atualize o status após a devolução e registre as observações.

## Conversão de propostas aceitas em contratos

Uma proposta com status **Aceita** pode ser convertida em um registro do módulo **Contratos e locações** pela ação "Gerar contrato". O sistema aproveita os dados comerciais, cliente, equipamento, quantidade, prazo e valores da proposta, gera um número de contrato e registra a referência interna da proposta para evitar conversões duplicadas.

O contrato é criado inicialmente em **Preparação**, com datas previstas calculadas a partir da data atual e do prazo informado. Antes de ativar a locação, a equipe deve confirmar a assinatura, disponibilidade dos equipamentos, números de série, endereço e agenda de entrega.

A conversão **não reserva equipamentos automaticamente**, não assina documentos, não envia contrato ao cliente e não cria cobranças. Essas ações exigem validação operacional e integrações específicas.


## Cobranças mensais de locação

No módulo **Financeiro**, a ação **Gerar cobranças do mês** cria uma receita prevista para cada contrato com status **Ativo**, modalidade de locação e data de início válida, para a competência atual (`YYYY-MM`). A chave do registro combina o ID do contrato e a competência, permitindo reconhecer cobranças já geradas e evitar duplicidade em execuções repetidas.

O vencimento é calculado usando o dia do mês da data de início do contrato; quando o mês tiver menos dias, usa-se o último dia daquele mês. Contratos com início futuro ou sem data de início válida são ignorados e contabilizados no retorno da operação. A geração é manual e não cria cobranças para contratos em preparação, encerrados, cancelados ou de venda.

As cobranças são gravadas como **Previsto** quando ainda não venceram ou **Pendente** quando o vencimento já passou. A ação nunca marca uma cobrança como paga. O recebimento mensal considera lançamentos de receita com status **Pago** e data de pagamento na competência atual. Revise valor, vencimento e condições antes de cobrar o cliente; o sistema não envia boletos, não processa pagamentos e não substitui a conciliação bancária.

A proteção contra duplicidade é aplicada pela chave no payload e pela conferência dos registros carregados. Em ambientes com múltiplos operadores gerando cobranças simultaneamente, recomenda-se adicionar uma restrição única no banco para `module` + `charge_key`, como reforço transacional.

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

## Organizações e permissões (migration 002)\n\nArquivo: `supabase/migrations/002_organizations_roles.sql`. Execute no SQL Editor somente depois do `schema.sql`. A migration adiciona `organizations`, `organization_members` e `workspace_records.organization_id`, migra os registros existentes e substitui as políticas individuais por políticas multi-tenant com controle por módulo. Ela não foi executada automaticamente no projeto Supabase.\n\n| Papel | Acesso previsto |\n|---|---|\n| Owner / Admin | Todos os módulos e gestão da organização |\n| Gerente | Módulos comerciais |\n| Comercial | Empresas, contatos, oportunidades, propostas e tarefas |\n| Operações | Equipamentos e contratos |\n| Financeiro | Financeiro |\n| Visualizador | Leitura dos módulos não financeiros |\n\nO usuário atual não recebe automaticamente uma tela de administração por esta migration; a gestão de membros e a seleção de organização no frontend são etapas seguintes.\n\n## Metas comerciais (migration 005)\n\nArquivo: `supabase/migrations/005_sales_goals.sql`. Cria metas por organização, responsável (nome), competência `YYYY-MM`, valor financeiro e quantidade de oportunidades. Use a mesma grafia do campo Responsável nos registros comerciais para comparar meta e realizado. A tabela não calcula comissão nem altera negócios. A criação e edição são restritas a Owner/Admin/Gerente por RLS.\n\n## Próximas etapas antes de produção
- Criar tela administrativa para convidar membros, selecionar organização e gerenciar papéis; validar os fluxos multiempresa.
- Validar CNPJ, deduplicar empresas e implementar importação CSV com pré-visualização.
- Implementar contratos com geração PDF, assinatura e trilha de auditoria.
- Criar ciclo de vida do ativo: reserva, entrega, manutenção, devolução e conferência.
- Conectar WhatsApp Cloud API, Zoho CRM, e-mail e Google Workspace por webhooks seguros.
- Implementar IA com aprovação humana, limites de uso e registro das ações.
- Testes automatizados, logs, backups, monitoramento e revisão LGPD.

## Observação
O HTML anterior foi preservado em `legacy/`. Dados de demonstração devem ser identificados como DEMO; não representam clientes ou oportunidades reais.


## Histórico do funil e conversão mensal

A edição de oportunidades registra cada mudança de etapa em `payload.stage_history`, com etapa anterior, nova etapa, data/hora e usuário autenticado. Ao entrar em **Ganha**, a oportunidade recebe `won_at`; ao sair de **Ganha**, essa data é limpa. Propostas também mantêm `status_history` quando seu status é alterado pela ação do módulo. O painel de metas calcula o ganho do mês a partir de `won_at` e o volume de oportunidades a partir de `created_at`. O histórico é iniciado a partir desta versão: mudanças antigas não são reconstruídas retroativamente e não devem ser interpretadas como dados históricos completos.


## Previsão comercial e alertas de pipeline

O painel **Previsão comercial** considera oportunidades abertas (exclui Ganha e Perdida), soma o pipeline nominal e calcula a previsão ponderada por responsável com `valor estimado × probabilidade / 100`. A probabilidade é limitada ao intervalo de 0 a 100. O quadro também destaca oportunidades com previsão de fechamento vencida, sem próxima ação, sem movimentação há pelo menos 14 dias ou com probabilidade de 70% ou mais e fechamento previsto nos próximos 7 dias. O indicador de fechamento próximo usa janela de 14 dias. Esses indicadores são sinais de priorização, não previsões garantidas; mantenha valor, probabilidade, responsável, etapa, próxima ação e data de fechamento atualizados. Para registros antigos sem `stage_updated_at`, a idade do último movimento é aproximada pela data de criação.

## Inteligência de prospecção B2B

O painel **Empresas prioritárias** calcula uma nota heurística de potencial de locação a partir dos dados preenchidos no cadastro: porte (até 25 pontos), demanda estimada de notebooks (até 30), setor (até 15), interesse declarado em locação (até 20) e existência de canal/pessoa de contato (até 10). A nota é limitada a 100 e não usa dados externos nem presume demanda quando os campos estão vazios.

A classe de prospecção é A (70+), B (40–69) ou C (abaixo de 40). A qualidade/completude do cadastro aparece separadamente da nota, com indicação dos dados que ainda faltam. A fila prioriza empresas com follow-up vencido ou previsto para hoje e, em seguida, potencial e prioridade comercial. Empresas nas etapas **Cliente** e **Sem interesse** não aparecem na fila de novos alvos. Essa classificação apoia a organização da equipe; não substitui qualificação humana, pesquisa da empresa ou confirmação do interesse.
