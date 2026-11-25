# Caixa de leads do site — VEYRION

A rota `/leads` apresenta solicitações enviadas pelo formulário público `/locacao`.

## Segurança
- A API GET exige token Supabase validado com `requireUser`.
- A organização ativa deve ser a organização VEYRION.
- Apenas Owner, Admin, Manager e Sales têm acesso à lista.
- O endpoint consulta apenas os campos de contato/demanda necessários, limita a 100 registros e não permite alteração ou exportação.
- A tabela `public_lead_inquiries` tem RLS: visitantes anônimos podem inserir apenas solicitações com organização, origem e status fixos; membros autenticados da organização podem ler.
- O formulário tem honeypot; isso é proteção básica anti-bot, não substitui rate-limit/CAPTCHA em caso de abuso.

## Operação
1. Acesse o CRM e use o link **Leads do site** na barra lateral.
2. Atualize a lista e pesquise por empresa, nome, e-mail, cidade ou demanda.
3. Contate o lead pelo e-mail e registre a continuidade no CRM.
4. Leads públicos ainda não são sincronizados automaticamente com Zoho; essa integração deve ser testada e habilitada separadamente.

## Validação
- Build Preview comprova compilação, não a autenticação real nem uma submissão ao banco.
- O teste de submissão requer autorização para criar um lead de teste e confirmar a gravação no Supabase.
- O Preview está conectado ao Supabase compartilhado; não realizar testes de gravação sem combinar o registro de teste com o proprietário.


## Security hardening follow-up
A live read-only policy/privilege inspection found the original SELECT policy allowed all organization members (including Viewer/Operations/Finance) to read lead PII, even though the inbox API restricted roles. The staged migration `034_public_lead_inquiries_role_restriction.sql` narrows SELECT to Owner/Admin/Manager/Sales and removes unused SELECT/UPDATE/DELETE grants from anonymous/authenticated roles, re-granting only the intended SELECT/INSERT. **This migration has not been applied to production.**
