# VEYRION OS

**Tecnologia. Inteligência. Crescimento.**

Sistema B2B para prospecção e gestão comercial de locação e intermediação de notebooks/equipamentos de TI: empresas, contatos, oportunidades, fornecedores, catálogo, propostas, contratos, assinatura e acompanhamento de ativação.

## Escopo aprovado
- CRM e pipeline de oportunidades.
- Cadastro/enriquecimento de empresas e CNPJ.
- Cadastro de fornecedores e catálogo de equipamentos.
- Propostas comerciais, margem estimada e contratos.
- Assinatura eletrônica (ZapSign) e notificações operacionais, quando configuradas.
- Landing page comercial de locação: `/locacao`.
- Caixa de leads do formulário: `/leads` (perfis Owner/Admin/Manager/Sales).
- Zoho CRM: sincronização manual e controlada de empresas/Leads.
- Login Supabase por e-mail/senha; primeiro acesso restrito a convite.
- Dados segregados por organização, RLS e permissões por perfil.

**Fora do escopo:** pagamentos, cobrança, split, repasses, conciliação e gateway financeiro. O pagamento da locação é tratado diretamente pelas partes, fora da VEYRION.

## Stack
Next.js 15 · React 19 · TypeScript · Supabase Auth/Postgres/RLS · Vercel.

## Desenvolvimento local
```bash
npm install
cp .env.example .env.local
npm run dev
```
Abra http://localhost:3000.

## Validação
```bash
npm test
npm run build
```
O comando `npm run build` executa automaticamente os testes estruturais, TypeScript e build Next.js. GitHub Actions não é requisito do projeto.

## Banco de dados
O projeto usa migrations versionadas em `supabase/migrations/`. O Supabase VEYRION conectado já contém o schema e as migrations do CRM, contratos, segurança, integrações e captação de leads. Não desligue RLS nem aplique migrations manualmente sem revisar o ambiente alvo.

A migration `034_public_lead_inquiries_role_restriction.sql` restringe leitura de dados pessoais dos leads aos perfis comerciais autorizados. Ela foi aplicada ao Supabase conectado em 25/11/2026 e sua policy foi verificada após a aplicação.

## Rotas e integrações
- `/locacao`: página pública e formulário de qualificação comercial.
- `/leads`: inbox autenticada; lista, pesquisa e contato por e-mail.
- `/api/public-leads`: gravação de solicitações públicas e leitura autenticada.
- `/api/company-enrichment`: consulta de empresas/CNPJ protegida por sessão e papel comercial.
- `/api/integrations/zoho/sync-company`: sincronização manual e idempotente.
- `/api/integrations/zoho/create-lead`: criação/atualização de Lead autenticada.
- `/api/b2b/contracts`: criação de minuta e, se habilitado no Preview, envio para ZapSign Sandbox.
- `/api/webhooks/zapsign`: confirmação de assinatura e ativação idempotente.
- `/api/cron/notifications`: worker de notificações, bloqueado fora do Preview e em modo de destinatário de teste.

Integrações exigem credenciais server-side no ambiente apropriado. Nenhuma chave privada deve ser commitada ou compartilhada no chat.

## Situação de finalização
- Pull request #8 está em Draft; alterações ainda não foram mescladas à branch principal.
- O Preview da branch `finish/veyrion-lead-inbox` é usado para validação.
- Produção não deve ser atualizada antes da validação humana de login, fluxo comercial, formulário e integrações.
- ZapSign Sandbox, Zoho e e-mail de teste ainda dependem de credenciais/autorizações e teste end-to-end.
- A minuta de contrato é operacional e precisa de revisão jurídica antes de uso real.

Consulte `docs/lead-inbox.md` e `docs/ZOHO_CRM_INTEGRATION.md` para os detalhes de cada integração.
