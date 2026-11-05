# Análise inteligente do Assistente VEYRION

## Estado desta entrega

Esta branch adiciona a rota autenticada `POST /api/assistant/analyze`. Ela complementa o mecanismo determinístico existente em `lib/ai-assistant.ts`; não substitui a priorização local.

## Contrato da rota

A chamada exige sessão Supabase válida no cabeçalho `Authorization: Bearer <access_token>` e recebe:

```json
{
  "today": "AAAA-MM-DD",
  "records": [
    {
      "id": "identificador",
      "module": "companies",
      "payload": {},
      "created_at": "2026-11-01T12:00:00Z"
    }
  ]
}
```

Somente os módulos `companies`, `tasks` e `opportunities` são considerados. A rota limita a análise a 300 registros e seleciona campos operacionais permitidos, evitando enviar o payload completo ao provedor.

## Modos de operação

- **Regras locais:** se `OPENAI_API_KEY` não estiver configurada, a rota retorna o resumo determinístico e informa que a análise generativa está desativada. Não há custo de API.
- **IA generativa:** quando a chave server-side estiver configurada, a rota envia somente o resumo operacional e campos compactados para a API OpenAI. O modelo pode ser definido por `OPENAI_MODEL` (padrão `gpt-4o-mini`).
- **Fallback:** falha do provedor ou resposta inválida mantém as recomendações locais disponíveis.

## Limites e segurança

- A rota não cria, edita ou exclui registros.
- Não envia e-mails, WhatsApp ou qualquer mensagem.
- Não faz score de crédito, reputação, solvência ou intenção de compra.
- A IA deve usar apenas evidências fornecidas e retornar resumo, insights e foco recomendado.
- A resposta generativa é validada e limitada antes de retornar ao cliente.
- `OPENAI_API_KEY` é segredo server-side; nunca usar prefixo `NEXT_PUBLIC_`.
- Antes de cada chamada generativa, o servidor reserva atomicamente uma cota de até 10 análises por usuário e por hora UTC. O limite é aplicado no banco, não no botão do navegador.
- Se o controle de cota estiver indisponível, a rota falha fechada (HTTP 503) e não chama o provedor. Ao exceder a cota, retorna HTTP 429 com `Retry-After`.
- A cota só é consumida quando a chave generativa está configurada e há uma análise que realmente seria enviada ao provedor; o fallback local gratuito não consome cota.

## Controle de utilização

A migration `029_assistant_analysis_quota.sql` cria um contador privado no Supabase. A migration `030_assistant_analysis_quota_rpc_hardening.sql` mantém a rotina privilegiada no schema privado e expõe somente um wrapper `SECURITY INVOKER` autenticado. A rotina valida sessão e vínculo à organização, serializa requisições concorrentes e limita cada usuário a 10 chamadas generativas por hora UTC. A tabela fica no schema privado, sem acesso direto pela Data API.

## Painel de consumo por organização

A migration `031_assistant_analysis_usage_dashboard.sql` adiciona `public.get_assistant_analysis_usage()`, um RPC `SECURITY INVOKER` que delega a função de leitura privada e só permite consulta a owner, admin e manager. O retorno contém total de chamadas generativas na hora UTC, limite agregado da equipe, análises por IA e por regras no mês, e métricas por membro. Não retorna prompts, payloads comerciais ou conteúdo das análises.

O painel **Assistente IA** carrega esse resumo automaticamente ao abrir a seção e permite atualizar manualmente. O limite está fixado em 10 chamadas generativas por membro/hora; não há configuração de cobrança, alteração automática de plano ou ativação de chave paga. O histórico de análises continua separado e limitado às últimas 20 execuções.
