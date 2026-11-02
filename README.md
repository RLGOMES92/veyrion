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

## Ações comerciais a partir da prospecção

Na fila **Empresas prioritárias** e nos cartões do quadro de prospecção, a ação **Criar tarefa** abre um follow-up pré-preenchido com empresa, contato, próxima ação e data de retorno. A prioridade da tarefa deriva da prioridade comercial cadastrada (Alta → Urgente; Média → Alta; demais → Normal). O contexto disponível — canal de contato, demanda estimada, interesse declarado e observações — é incluído nas notas, e o identificador interno da empresa e a pontuação estimada acompanham o registro da tarefa.

A tarefa só é gravada depois que o usuário revisa e clica em **Salvar registro**. Depois disso, ela aparece no módulo **Tarefas** e na agenda/central de follow-ups, onde pode ser acompanhada e atualizada. A criação não envia mensagens nem realiza ligações automaticamente.

## Cadência inteligente de prospecção

A fila de empresas prioritárias também apresenta a quantidade de interações registradas, data do último contato, situação da cadência e próxima ação sugerida. As recomendações usam apenas o histórico salvo no cadastro: sinais positivos (interessado, proposta solicitada ou reunião agendada) recebem prioridade; follow-ups vencidos ou para hoje vêm em seguida; contatos sem resposta há pelo menos três dias sugerem avaliar um canal alternativo; contatos parados há sete dias sugerem retomada contextual. Empresas sem interesse declarado devem ser respeitadas e não recebem sugestão de insistência.

A ordenação combina prioridade da cadência, pontuação de potencial e prioridade comercial. O sistema não envia e-mails, WhatsApp ou ligações automaticamente: a equipe registra cada tentativa no histórico da empresa e executa a ação manualmente. A contagem considera registros de interação existentes, não mensagens efetivamente entregues ou visualizadas.

## Abordagens comerciais por canal

Na fila de empresas prioritárias, a ação **Abordar** prepara um rascunho para WhatsApp, e-mail ou LinkedIn. O texto considera somente dados já cadastrados (nome da empresa, contato, setor, demanda estimada e observações), evita afirmar necessidades não confirmadas e pode ser editado antes de copiar. No e-mail, também sugere assunto. A ferramenta não envia mensagens nem confirma destinatário, entrega ou leitura; a equipe deve revisar, personalizar e respeitar as preferências de contato e regras aplicáveis antes de usar.

## Inteligência de mercado e prospecção regional

O módulo **Empresas** inclui o painel **Inteligência de mercado · Prospecção regional**, com filtros sobre a base de empresas já cadastrada:
- Região/cidade (busca textual no campo Cidade / UF).
- Setor empresarial.
- Porte informado por número de funcionários: pequena (até 99), média (100–499) e grande (500+).
- Visualização da demanda de notebooks cadastrada, pontuação heurística e origem da informação.
- Acesso ao cadastro existente e criação de tarefas de follow-up.
- Atalho para registrar uma empresa pesquisada manualmente, já identificada como **Empresa pesquisada**, com data e origem sugeridas para preenchimento.

O painel **não realiza busca na internet, raspagem, enriquecimento automático ou consulta a bases empresariais externas**. Ele filtra os registros existentes no CRM. O cadastro manual e a importação CSV são os caminhos atuais para incluir empresas verificadas. Registre uma referência rastreável em **Fonte / referência da pesquisa**, revise a data e não preencha decisores ou demanda sem evidência. Os limites de porte são filtros operacionais configuráveis pela equipe, não uma classificação legal de porte empresarial.

### Fluxo recomendado de pesquisa
1. Pesquise empresas em fontes públicas ou bases autorizadas, fora do VEYRION, e valide nome, cidade, setor e site.
2. Registre a origem e a data da consulta; inclua apenas dados profissionais necessários e pertinentes.
3. Importe uma planilha CSV no módulo Empresas ou use **Registrar empresa pesquisada**.
4. Complete porte, contato/decisor e demanda somente quando houver fonte confiável.
5. Use a nota de potencial como apoio à priorização, abra o cadastro e crie uma tarefa para a próxima ação.

A integração futura com fontes externas deverá ser implementada por conectores autorizados, com origem, data de atualização, limites de uso e revisão humana. Nenhuma coleta externa é ativada por esta entrega.

### Segmentação territorial da Grande São Paulo

O painel regional também oferece macro-regiões operacionais para organizar a carteira: Capital, ABC Paulista, Oeste, Norte e Leste, Noroeste e Sudoeste. O agrupamento é feito localmente a partir do texto informado em Cidade / UF; municípios não reconhecidos aparecem como **Fora da cobertura mapeada**, e registros sem cidade como **Não identificada**. Use o filtro de cidade para refinar a seleção. Os indicadores mostram quantidade de empresas, empresas com pontuação heurística igual ou superior a 70 e soma da demanda de notebooks informada nos cadastros. A soma não representa demanda confirmada de mercado. Revise o município e os dados de cada empresa antes da abordagem. A tabela também lista os dados de perfil ainda ausentes e a data da pesquisa; quando não houver data registrada, sinaliza a pendência. Use essas lacunas para orientar a próxima pesquisa, sem completar campos por suposição. A importação CSV também reconhece cabeçalhos alternativos para número de funcionários, fonte/referência da pesquisa, data da pesquisa e cargo do decisor (por exemplo: `funcionarios`, `numerodefuncionarios`, `fontereferencia`, `datadapesquisa`, `cargododecisor`).


## Rastreabilidade e validação das fontes de prospecção

O cadastro de empresas agora permite registrar o tipo de fonte (site oficial, cadastro público, diretório autorizado, indicação, pesquisa manual, evento ou outro), a confiabilidade informada (Alta, Média, Baixa ou Não avaliada) e o estado de validação (Pendente, Verificada ou Descartada). Esses campos descrevem a avaliação humana da equipe; não são validação automática nem certificação da fonte.

No painel regional, os filtros de validação e confiabilidade ajudam a separar empresas verificadas de registros ainda pendentes. A tabela também classifica a atualidade da pesquisa: até 30 dias, 31–90 dias ou mais de 90 dias; registros sem data aparecem como sem data. A idade é calculada localmente e deve ser usada como lembrete de revisão, não como garantia de que os dados continuam corretos.

O painel sinaliza possíveis duplicidades por nome normalizado + cidade, apenas como alerta para revisão manual. A proteção por CNPJ continua sendo a regra de bloqueio de duplicidade no cadastro. Não há mesclagem ou exclusão automática. A importação CSV reconhece cabeçalhos para tipo de fonte, confiabilidade e status de validação. Para registros antigos sem esses campos, o sistema assume visualmente **Pendente** e **Não avaliada**, sem alterar os dados salvos.


## Centro de Campanhas B2B

O módulo **Campanhas B2B** permite segmentar empresas já cadastradas por macro-região operacional, setor e porte informado (pequena até 99 funcionários, média de 100 a 499 e grande a partir de 500), selecionar registros e salvar campanhas com objetivo, canal, status, data, responsável, mensagem-base e observações. A campanha guarda os IDs das empresas selecionadas e a quantidade no momento da criação; a lista de empresas é uma seleção da carteira existente, não uma busca externa. A equipe deve revisar os dados e personalizar cada abordagem. A campanha não dispara mensagens, não confirma entrega/leitura e não mede respostas automaticamente. Use o histórico de interações e as etapas das empresas para registrar os resultados reais.


### Indicadores do Centro de Campanhas

O painel de desempenho das campanhas calcula contatos com base em interações ou data de último contato registrada; respostas com base em resultados explícitos do histórico; reuniões e propostas com base em resultados do histórico ou etapas comerciais correspondentes; e ganhos com base nas etapas Cliente/Ganha. Uma empresa pode contribuir para mais de um indicador. Os números representam o estado atual dos cadastros vinculados e não atribuem causalidade exclusiva à campanha. Registros sem histórico não são tratados como contato ou resposta.


### Indicadores das campanhas

O painel de campanhas calcula, por campanha, o total de empresas vinculadas, empresas com histórico de contato, empresas com resultados de interesse/retorno/reunião/proposta registrados, reuniões agendadas, propostas e ganhos. Os números são derivados dos registros atuais de cada empresa e não representam respostas inferidas ou entregas de mensagens. Empresas vinculadas são associadas por IDs de registros; se uma empresa for excluída ou não estiver carregada no workspace, ela não entra na contagem. Para manter os indicadores confiáveis, registre cada interação e atualize a etapa comercial da empresa.


## Central de follow-ups

O módulo **Tarefas e follow-ups** apresenta uma fila operacional combinando datas `next_followup` das empresas e `due_at` das tarefas abertas. A fila permite filtrar todos, atrasados, hoje e próximos sete dias, abrir o registro para atualização e preparar uma abordagem a partir da empresa. A criação de tarefa salva um prazo e status; concluir ou cancelar requer atualizar o status no cadastro. Preparar abordagem não envia mensagens. Os indicadores refletem apenas registros presentes no workspace e não comprovam que um contato foi realizado.


## Assistente comercial · Próximas melhores ações

No dashboard, o assistente prioriza empresas com retorno vencido ou previsto para hoje, sinais positivos sem novo prazo, contatos parados há pelo menos sete dias, primeiros contatos ainda não realizados e cadastros incompletos. Cada sugestão exibe o motivo, a ação recomendada e a pontuação heurística de potencial, com atalhos para abrir a empresa, preparar uma abordagem ou criar uma tarefa. A recomendação usa somente interações e campos já registrados; não faz enriquecimento externo, não confirma intenção de compra e não envia mensagens. Empresas marcadas como Cliente, Sem interesse ou Descartada são excluídas da fila.


### Registro do resultado da abordagem

Na fila do assistente comercial, a ação **Registrar resultado** abre o histórico de interações da empresa com data e canal preenchidos para facilitar o registro. O usuário deve informar o resultado real, um resumo e, quando aplicável, a próxima ação e data de retorno; a empresa precisa ser salva para persistir o histórico. Quando há sinal positivo sem data futura, a recomendação passa a ser registrar o próximo retorno. O sistema não presume que a abordagem foi enviada ou que houve resposta.
