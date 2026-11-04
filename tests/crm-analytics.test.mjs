import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePipelineForecast } from '../lib/crm-analytics.ts';

const opportunity = (id, payload, created_at = '2026-10-01T12:00:00.000Z') => ({ id, module: 'opportunities', payload, created_at });

test('calcula pipeline bruto e ponderado sem incluir negócios encerrados', () => {
  const result = calculatePipelineForecast([
    opportunity('a', { stage: 'Negociação', value: 10000, probability: 50, owner: 'Ana' }),
    opportunity('b', { stage: 'Proposta enviada', value: 5000, probability: 80, owner: 'Bruno' }),
    opportunity('c', { stage: 'Ganha', value: 9000, probability: 100 }),
    opportunity('d', { stage: 'Perdida', value: 4000, probability: 0 }),
  ], '2026-11-04');
  assert.equal(result.count, 2);
  assert.equal(result.pipeline, 15000);
  assert.equal(result.weighted, 9000);
  assert.equal(result.bySeller[0].seller, 'Ana');
});

test('limita probabilidade e ignora valores inválidos ou negativos', () => {
  const result = calculatePipelineForecast([
    opportunity('a', { stage: 'Novo lead', value: -200, probability: 150 }),
    opportunity('b', { stage: 'Qualificada', value: 'inválido', probability: 'inválido' }),
  ], '2026-11-04');
  assert.equal(result.pipeline, 0);
  assert.equal(result.weighted, 0);
});

test('sinaliza negócios vencidos, sem próxima ação e sem movimentação', () => {
  const result = calculatePipelineForecast([
    opportunity('a', { title: 'Renovação', stage: 'Negociação', value: 20000, probability: 70, expected_close: '2026-10-20', stage_updated_at: '2026-10-01' }),
  ], '2026-11-04');
  assert.equal(result.overdue, 1);
  assert.equal(result.risks.length, 1);
  assert.ok(result.risks[0].reasons.includes('Previsão de fechamento vencida'));
  assert.ok(result.risks[0].reasons.includes('Sem próxima ação definida'));
  assert.ok(result.risks[0].reasons.includes('Sem movimentação há 34 dias'));
});

test('conta fechamento próximo em janela inclusiva de 14 dias', () => {
  const result = calculatePipelineForecast([
    opportunity('a', { stage: 'Proposta enviada', value: 100, probability: 75, expected_close: '2026-11-18', next_step: 'Ligar para cliente' }),
    opportunity('b', { stage: 'Qualificada', value: 100, probability: 25, expected_close: '2026-11-19', next_step: 'Enviar orçamento' }),
  ], '2026-11-04');
  assert.equal(result.closingSoon, 1);
  assert.equal(result.bySeller[0].closingSoon, 1);
});

test('não cria risco para data inválida e mantém responsável padrão', () => {
  const result = calculatePipelineForecast([
    opportunity('a', { stage: 'Novo lead', value: 100, probability: 10, expected_close: 'data-errada', next_step: 'Qualificar' }, '2026-11-04T12:00:00.000Z'),
  ], '2026-11-04');
  assert.equal(result.overdue, 0);
  assert.equal(result.closingSoon, 0);
  assert.equal(result.bySeller[0].seller, 'Sem responsável');
  assert.equal(result.risks.length, 0);
});
