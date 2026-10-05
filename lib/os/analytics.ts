import { initialProducts, people } from './data';

/** A deterministic demonstration dataset. Each row is a lead, with a sale only when successful. */
export type AnalyticsRecord = {
  id: string; date: string; name: string; client: string; channel: string;
  employee: string; product: string; segment: string; revenue: number;
  cost: number; spend: number; status: 'Успешно' | 'Неуспешно' | 'В работе';
  ai: boolean; aiCost: number; messages: number; responseMinutes: number;
  rating: number; stock: number;
};

let seed = 104205;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const channels = ['WhatsApp', 'Instagram', 'Telegram', 'Сайт'];
const employees = ['Айым', 'Медина', 'Алихан', 'Sales Agent'];
const clients = [
  ...people,
  ...['Зарина', 'Камила', 'Салтанат', 'Амина', 'Наргиза', 'Вероника', 'София', 'Жанара', 'Алия', 'Назгуль', 'Елена', 'Наталья']
    .flatMap(first => ['Осмонова', 'Канатова', 'Ибраимова', 'Садыкова', 'Асанова', 'Абдиева'].map(last => `${first} ${last}`)),
];
const choose = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
const round = (n: number) => Math.round(n * 100) / 100;
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;

export const records: AnalyticsRecord[] = Array.from({ length: 90 }, (_, day) => {
  const date = new Date(Date.UTC(2026, 6, 8 + day)).toISOString().slice(0, 10);
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  const volume = 8 + Math.floor(random() * 7) + Math.floor(day / 30) + (weekend ? 2 : 0);
  return Array.from({ length: volume }, (_, index): AnalyticsRecord => {
    const channel = choose(channels);
    const product = choose(initialProducts);
    // A smaller returning cohort creates a measurable repeat-purchase distribution.
    const client = random() < 0.35 ? choose(people) : choose(clients);
    const ai = random() < 0.45 + day / 300;
    const employee = ai ? 'Sales Agent' : choose(employees.slice(0, 3));
    const outcome = random();
    const winProbability = 0.34 + day / 600 + (channel === 'WhatsApp' ? 0.1 : 0) + (people.includes(client) ? 0.08 : 0);
    const status: AnalyticsRecord['status'] = day > 83 && outcome > 0.68 ? 'В работе' : outcome < winProbability ? 'Успешно' : 'Неуспешно';
    const revenue = status === 'Успешно' ? Math.round(product.value * (1 + Math.floor(random() * 3)) * (0.9 + random() * 0.2)) : 0;
    const spend = round(channel === 'Instagram' ? 100 + random() * 140 : channel === 'Сайт' ? 60 + random() * 110 : 10 + random() * 55);
    return {
      id: `AN-${date}-${index + 1}`, date, name: client, client, channel,
      employee, product: product.name,
      segment: people.includes(client) ? 'Постоянные' : revenue > 6500 ? 'VIP' : 'Новые',
      revenue, cost: round(revenue * (0.42 + random() * 0.13)), spend, status, ai,
      aiCost: ai ? round(0.7 + random() * 5.3) : 0,
      messages: 3 + Math.floor(random() * 24),
      responseMinutes: round(ai ? 0.15 + random() * 1.4 : 2 + random() * 23),
      rating: status === 'Успешно' ? round(3.6 + random() * 1.4) : 0,
      stock: Math.max(0, Number(product.note) + Math.floor(random() * 20) - 10),
    };
  });
}).flat();

export function summarize(rows: AnalyticsRecord[]) {
  const leads = rows.length;
  const won = rows.filter(row => row.status === 'Успешно');
  const orders = won.length;
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const aiCost = rows.reduce((sum, row) => sum + row.aiCost, 0);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  const purchaseCounts = new Map<string, number>();
  won.forEach(row => purchaseCounts.set(row.client, (purchaseCounts.get(row.client) ?? 0) + 1));
  const customers = purchaseCounts.size;
  const repeatCustomers = [...purchaseCounts.values()].filter(count => count > 1).length;
  const closed = rows.filter(row => row.status !== 'В работе').length;
  return {
    revenue: round(revenue), profit: round(revenue - cost - spend - aiCost),
    orders, leads, conversion: round(ratio(orders, leads) * 100),
    averageCheck: round(ratio(revenue, orders)), customers,
    repeatRate: round(ratio(repeatCustomers, customers) * 100),
    // Observed-period estimates: CAC uses purchasing customers, LTV uses period revenue/customer.
    cac: round(ratio(spend, customers)), ltv: round(ratio(revenue, customers)),
    roas: round(ratio(revenue, spend)), aiCost: round(aiCost),
    aiShare: round(ratio(rows.filter(row => row.ai).length, leads) * 100),
    responseMinutes: round(ratio(rows.reduce((sum, row) => sum + row.responseMinutes, 0), leads)),
    successRate: round(ratio(orders, closed) * 100),
  };
}

export function aggregate(rows: AnalyticsRecord[], key: string) {
  const groups = new Map<string, AnalyticsRecord[]>();
  rows.forEach(row => {
    const raw = row[key as keyof AnalyticsRecord];
    const name = raw === undefined ? 'Не указано' : typeof raw === 'boolean' ? raw ? 'ИИ' : 'Сотрудники' : String(raw);
    const group = groups.get(name) ?? [];
    group.push(row);
    groups.set(name, group);
  });
  return [...groups.entries()].map(([name, group]) => {
    const summary = summarize(group);
    const rated = group.filter(row => row.rating > 0);
    return {
      name, count: group.length, revenue: summary.revenue, profit: summary.profit,
      spend: round(group.reduce((sum, row) => sum + row.spend, 0)),
      orders: summary.orders, conversion: summary.conversion, aiCost: summary.aiCost,
      messages: group.reduce((sum, row) => sum + row.messages, 0),
      responseMinutes: summary.responseMinutes,
      rating: round(ratio(rated.reduce((sum, row) => sum + row.rating, 0), rated.length)),
    };
  }).sort((a, b) => key === 'date' ? a.name.localeCompare(b.name) : b.revenue - a.revenue || b.count - a.count);
}
