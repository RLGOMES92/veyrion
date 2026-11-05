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

A migration `029_assistant_analysis_quota.sql` cria um contador privado no Supabase e a função `public.consume_assistant_analysis_quota()`. A função valida a sessão e a associação à organização, serializa requisições concorrentes e limita cada usuário a 10 chamadas generativas por hora UTC. A tabela fica no schema privado, sem acesso direto pela Data API; somente a função autenticada pode reservar uma unidade.

## Próxima evolução

O histórico de análises já aparece no painel **Assistente IA**. A próxima etapa é consolidar o consumo por organização (somando os membros), apresentar limites e utilização no dashboard e permitir que o administrador configure limites, sem ativar cobrança ou chave paga automaticamente.
