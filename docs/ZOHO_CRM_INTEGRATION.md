# Integração VEYRION OS ↔ Zoho CRM (API v2)

## Escopo inicial

- Sincronização manual de uma empresa por vez, pela ação **Sincronizar Zoho** no módulo Empresas.
- Endpoint autenticado para receber dados de formulário: `POST /api/integrations/zoho/create-lead`.
- Ambos os fluxos usam a API Zoho CRM v2 (`/crm/v2`) e renovam o access token no servidor com o refresh token.
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

## OAuth e versão da API

O helper compartilhado em `lib/zoho.ts` usa `ZOHO_ACCOUNTS_URL` para renovar o access token em `/oauth/v2/token` e `ZOHO_API_DOMAIN` para operações em `/crm/v2`. Portanto, os endpoints efetivos são definidos pelas variáveis configuradas na Vercel; o código não fixa a região `.com`. Configure ambos os domínios para o mesmo data center da conta Zoho.

O endpoint `POST /api/integrations/zoho/create-lead` exige uma sessão Supabase válida no cabeçalho `Authorization: Bearer <supabase_access_token>`. Envie JSON com `firstName`, `lastName`, `email`, `phone` e `company`. `lastName` e `company` são obrigatórios. O endpoint pesquisa por e-mail: se encontrar o mesmo e-mail e a mesma empresa, atualiza o Lead; se o e-mail existir em outra empresa, responde `409 POSSIBLE_DUPLICATE`; caso contrário, cria o Lead. Não é uma rota pública anônima.

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

1. Aplique a migration `032_zoho_crm_sync_jobs.sql` no projeto Supabase.
2. Configure os cinco segredos Zoho na Vercel, no ambiente de Preview usado para o teste, com o data center confirmado.
3. Confirme que o usuário está autenticado no VEYRION e que o cliente envia o token de sessão Supabase no cabeçalho `Authorization`.
4. Faça um cadastro de teste com e-mail controlado pela equipe.
5. Use **Sincronizar Zoho** somente nesse registro.
6. Confirme no Zoho o lead criado e, em seguida, sincronize novamente para validar atualização sem duplicação.
7. Só depois libere o uso operacional pela equipe e configure Production separadamente.

A integração não faz importação em massa, não envia e-mails/WhatsApp e não converte leads em contatos ou negócios automaticamente.
