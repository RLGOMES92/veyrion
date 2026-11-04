# VEYRION OS — segurança e operação

## Proteções incluídas no repositório

- Dependências instaladas por `npm ci` com `package-lock.json` versionado.
- Auditoria de dependências no CI; vulnerabilidades moderadas ou superiores interrompem a validação.
- PostCSS fixado por override em versão corrigida, sem upgrade major automático do Next.js.
- Cabeçalhos HTTP: HSTS, proteção contra framing, MIME sniffing, política de referência e permissões do navegador.
- Arquivos `.env*` ignorados pelo Git; somente `.env.example` pode ser versionado.
- Dados do workspace protegidos por Supabase RLS e papéis por organização; trilha de auditoria sem cópia de dados pessoais para `changed_fields`.
- Migration 008 impede que um administrador altere/remova o próprio vínculo e protege a identidade do vínculo de equipe.

## Segredos

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são configurações públicas do cliente Supabase e dependem das políticas RLS. Chaves `service_role`, OpenAI, WhatsApp, Zoho e SMTP devem permanecer exclusivamente em variáveis de ambiente server-side; nunca usar prefixo `NEXT_PUBLIC_` nelas. Se um segredo real tiver sido enviado ao Git, revogue/rotacione-o no provedor imediatamente.

## Migrations Supabase

Execute no SQL Editor do projeto, em ordem, somente as migrations ainda não aplicadas: `schema.sql`, `002_organizations_roles.sql`, `003_unique_monthly_rental_charges.sql`, `004_workspace_audit_logs.sql`, `005_sales_goals.sql`, `006_organization_invitations.sql`, `007_team_audit_history.sql` e `008_security_role_self_escalation.sql`.

A migration 008 é aditiva e idempotente, mas precisa ser aplicada no projeto Supabase real. Não foi executada automaticamente porque este ambiente de desenvolvimento não tem acesso administrativo ao banco do cliente.

## Checklist de validação operacional

1. Testar login por magic link com uma conta de cada organização.
2. Confirmar que um usuário não lê nem altera registros de outra organização.
3. Confirmar permis...[truncated]