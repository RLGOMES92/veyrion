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

## Próxima integração

A interface do módulo **Assistente IA** ainda precisa chamar esta rota, apresentar o resumo generativo e manter o painel atual como fallback. A rota isolada não significa que a análise generativa já esteja visível no dashboard.
