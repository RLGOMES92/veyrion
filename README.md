# VEYRION OS
**Tecnologia. Inteligência. Crescimento.**

Plataforma B2B para prospecção, CRM, venda e locação de notebooks, ativos, propostas, contratos e acompanhamento financeiro.

## O que está no repositório
- Aplicação Next.js 15 + React 19 + TypeScript.
- Interface responsiva VEYRION OS.
- Login por link mágico via Supabase Auth (sem senha ou perfil selecionável fictício).
- Módulos: dashboard, empresas, contatos, oportunidades, equipamentos, propostas, tarefas, contratos/locações e financeiro.
- Exportação CSV e impressão de proposta para PDF pelo navegador.
- Supabase com RLS por usuário e estrutura JSONB para registros.
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
3. Em Authentication > Providers, habilite Email.
4. Configure Site URL e Redirect URLs para localhost e o domínio Vercel.
5. Copie Project URL e anon/publishable key para `.env.local` e para as Environment Variables da Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Cadastre/invite somente membros autorizados.

**Segurança:** RLS está habilitado. Nesta primeira fundação, cada usuário só acessa seus próprios registros. O compartilhamento entre equipe com papéis (Administrador, Gerente Comercial, Gerente de Tecnologia e Representante) exige a próxima migração de organização/membership e políticas; não desligue RLS.

## Integrações previstas (não ativadas)
O arquivo `.env.example` lista variáveis para OpenAI, WhatsApp Cloud API, Zoho e SMTP. A presença dessas variáveis não significa que a integração esteja ativa. Implementar cada conector exige credenciais reais, URLs de webhook, templates aprovados e testes. Nenhum segredo deve ser commitado no GitHub.

## Escopo comercial e operacional
- Prospecção B2B em São Paulo e Grande São Paulo, para empresas de todos os portes.
- Setores iniciais: tecnologia, BPO/call center, consultorias, logística, saúde, educação, indústria e serviços financeiros.
- Pipeline com 12 etapas, desde novo lead até ganho/perdido.
- Cadastro de notebooks com número de série, configuração, custo, preço, aluguel, localização e status.
- Propostas, tarefas/follow-ups, contratos, entrega/devolução e registros financeiros.

## Próximas etapas antes de produção
- Criar organização e membros com papéis e permissões no banco.
- Validar CNPJ, deduplicar empresas e implementar importação CSV com pré-visualização.
- Implementar contratos com geração PDF, assinatura e trilha de auditoria.
- Criar ciclo de vida do ativo: reserva, entrega, manutenção, devolução e conferência.
- Conectar WhatsApp Cloud API, Zoho CRM, e-mail e Google Workspace por webhooks seguros.
- Implementar IA com aprovação humana, limites de uso e registro das ações.
- Testes automatizados, logs, backups, monitoramento e revisão LGPD.

## Observação
O HTML anterior foi preservado em `legacy/`. Dados de demonstração devem ser identificados como DEMO; não representam clientes ou oportunidades reais.
