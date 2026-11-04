type CrmRecord = {
  id: string;
  module: string;
  payload?: Record<string, any> | null;
  created_at?: string;
};

type PipelineRisk<T extends CrmRecord> = {
  record: T;
  title: string;
  company: string;
  seller: string;
  value: number;
  probability: number;
  days: number | null;
  reasons: string[];
};

function nonNegative(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function boundedProbability(value: unknown): number {
  return Math.min(100, nonNegative(value));
}

function dayDifference(dateValue: unknown, today: Date): number | null {
  const key = String(dateValue ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(key + "T00:00:00");
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function calculatePipelineForecast<T extends CrmRecord>(records: T[], todayKey: string) {
  const today = new Date(todayKey + "T00:00:00");
  const validToday = Number.isNaN(today.getTime()) ? new Date() : today;
  const open = records.filter(record => record.module === "opportunities" && !["Ganha", "Perdida"].includes(String(record.payload?.stage ?? "")));
  const bySeller = new Map<string, { seller: string; count: number; pipeline: number; weighted: number; closingSoon: number; overdue: number }>();
  const risks: PipelineRisk<T>[] = [];

  for (const record of open) {
    const payload = record.payload ?? {};
    const seller = String(payload.owner ?? "").trim() || "Sem responsável";
    const value = nonNegative(payload.value);
    const probability = boundedProbability(payload.probability);
    const expected = value * probability / 100;
    const item = bySeller.get(seller) ?? { seller, count: 0, pipeline: 0, weighted: 0, closingSoon: 0, overdue: 0 };
    item.count += 1;
    item.pipeline += value;
    item.weighted += expected;

    const days = dayDifference(payload.expected_close, validToday);
    if (days !== null && days >= 0 && days <= 14) item.closingSoon += 1;
    if (days !== null && days < 0) item.overdue += 1;
    bySeller.set(seller, item);

    const updated = String(payload.stage_updated_at || record.created_at || "").slice(0, 10);
    const staleDays = dayDifference(updated, validToday);
    const reasons: string[] = [];
    if (days !== null && days < 0) reasons.push("Previsão de fechamento vencida");
    if (!String(payload.next_step ?? "").trim()) reasons.push("Sem próxima ação definida");
    if (staleDays !== null && staleDays <= -14) reasons.push("Sem movimentação há " + Math.abs(staleDays) + " dias");
    if (probability >= 70 && days !== null && days >= 0 && days <= 7) reasons.push("Fechamento provável nos próximos 7 dias");
    if (reasons.length) risks.push({ record, title: String(payload.title || "Oportunidade"), company: String(payload.company || "Empresa não informada"), seller, value, probability, days, reasons });
  }

  return {
    count: open.length,
    pipeline: open.reduce((sum, record) => sum + nonNegative(record.payload?.value), 0),
    weighted: open.reduce((sum, record) => sum + nonNegative(record.payload?.value) * boundedProbability(record.payload?.probability) / 100, 0),
    bySeller: Array.from(bySeller.values()).sort((a, b) => b.weighted - a.weighted || a.seller.localeCompare(b.seller)),
    risks: risks.sort((a, b) => Number(a.days ?? 9999) - Number(b.days ?? 9999) || b.value - a.value).slice(0, 12),
    closingSoon: open.filter(record => { const days = dayDifference(record.payload?.expected_close, validToday); return days !== null && days >= 0 && days <= 14; }).length,
    overdue: open.filter(record => { const days = dayDifference(record.payload?.expected_close, validToday); return days !== null && days < 0; }).length,
  };
}
