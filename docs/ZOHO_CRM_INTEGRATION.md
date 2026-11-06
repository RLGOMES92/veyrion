# Integração VEYRION OS ↔ Zoho CRM

## Escopo inicial

- Sincronização manual de uma empresa por vez, pela ação **Sincronizar Zoho** no módulo Empresas.
- Destino: módulo **Leads** do Zoho CRM.
- A sincronização usa a sessão autenticada do usuário e valida o acesso ao registro no Supabase.
- O estado da integração fica em `public.zoho_sync_jobs`, acessível somente pelo servidor com service role.
- O identificador do lead no Zoho é guardado para que sincronizações seguintes atualizem o mesmo registro.
- Antes de criar um lead, o endpoint procura pelo e-mail e só reutiliza um registro quando o nome da empresa também corresponde. Não importa toda a carteira automaticamente.

## Migration

Execute `supabase/migrations/032_zoho_crm_sync_jobs.sql` no SQL Editor do projeto Supabase antes de testar a integração.

## Variáveis na Vercel

Configure somente no servidor (Production e Preview, conforme o ambiente de teste):

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ACCOUNTS_URL`: domínio de autenticação da região da conta, sem barra final.
- `ZOHO_API_DOMAIN`: domínio da API CRM da mesma região, sem barra final.

Exemplos de domínios para contas em data centers diferentes (confirme o data center da conta antes de configurar):
- Estados Unidos: `https://accounts.zoho.com` e `https://www.zohoapis.com`
- Brasil: `https://accounts.zoho.com.br` e `https://www.zohoapis.com.br`
- Europa: `https://accounts.zoho.eu` e `https://www.zohoapis.eu`

Os dois domínios precisam pertencer à mesma região da conta Zoho. Não use os exemplos sem confirmar a URL de login da sua organização.

## OAuth

Crie um cliente OAuth no Zoho API Console. Para o fluxo Self Client, gere um grant token com estes escopos mínimos:

```text
ZohoCRM.modules.leads.READ
ZohoCRM.modules.leads.CREATE
ZohoCRM.modules.leads.UPDATE
```

Troque o grant token por um refresh token no data center correto e armazene os valores diretamente nas variáveis criptografadas da Vercel. Nunca cole segredos no chat, no código ou em arquivos versionados. O refresh token não deve ser regenerado em cada sincronização.

## Mapeamento

- Empresa VEYRION → `Company`
- Pessoa de contato (ou nome da empresa como fallback) → `Last_Name`
- E-mail do contato → `Email`
- Telefone do contato (ou telefone geral) → `Phone`
- Site → `Website`
- Cidade, setor, CNPJ, demanda de notebooks, interesse e observações → `Description` (contexto textual)

O e-mail do contato é exigido nesta primeira versão para permitir pesquisa de duplicidade antes da criação. Se estiver ausente, o estado será `needs_data`, sem criar lead no Zoho.

## Teste seguro

1. Aplique a migration.
2. Configure os cinco segredos na Vercel.
3. Faça um cadastro de teste com e-mail controlado pela equipe.
4. Use **Sincronizar Zoho** somente nesse registro.
5. Confirme no Zoho o lead criado e, em seguida, sincronize novamente para validar atualização sem duplicação.
6. Só depois libere o uso operacional pela equipe.

A integração não faz importação em massa, não envia e-mails/WhatsApp e não converte leads em contatos ou negócios automaticamente.
