import { simulateContract, type Terms } from '@loma/loan-engine';
const firstNames = [
  'Amélia',
  'Ernesto',
  'Celina',
  'Olívia',
  'Tomás',
  'Lídia',
  'Arnaldo',
  'Esperança',
  'Dulce',
  'Joaquim',
  'Madalena',
  'Bento',
  'Eulália',
  'Inácio',
  'Fátima',
  'Nelson',
  'Isabel',
  'Domingos',
  'Graça',
  'Abel',
];
const lastNames = [
  'Cossa',
  'Matavele',
  'Nhantumbo',
  'Mucavele',
  'Sitoe',
  'Mondlane',
];
const places = [
  ['Maputo', 'KaMpfumo', 'Polana Cimento'],
  ['Sofala', 'Beira', 'Macuti'],
  ['Nampula', 'Nampula', 'Muhala'],
  ['Gaza', 'Xai-Xai', 'Patrice Lumumba'],
  ['Inhambane', 'Maxixe', 'Chambone'],
  ['Zambézia', 'Quelimane', 'Coalane'],
];
const activities = [
  'Venda de hortícolas',
  'Comércio de roupa',
  'Oficina de bicicletas',
  'Funcionário público',
  'Mercearia',
  'Produção de bolos',
];
function dateBefore(today: string, days: number) {
  const d = new Date(today + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
export function demoDataset(
  products: { key: string; name: string; terms: Terms }[],
  today: string,
) {
  if (products.length !== 4) throw new Error('Four demo products required');
  const clients = Array.from({ length: 120 }, (_, i) => {
    const p = places[i % places.length]!;
    return {
      name: `${firstNames[i % 20]} ${lastNames[Math.floor(i / 20)]}`,
      birth_date: `${1978 + (i % 22)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      branch: i % 3,
      created_at: dateBefore(today, 180 + i * 3),
      profile: {
        identities: [
          { kind: 'bi', value: `DEMO${String(i + 1).padStart(8, '0')}` },
        ],
        contacts: [
          { kind: 'phone', value: `+2588400${String(i + 1).padStart(5, '0')}` },
        ],
        province: p[0],
        district: p[1],
        neighbourhood: p[2],
        address: `Rua do Mercado, casa ${i + 1}`,
        activity: activities[i % 6],
        employer: i % 6 === 3 ? 'Serviços distritais' : '',
        income: String(BigInt(8000 + (i % 15) * 2000) * 100n),
        expenses: String(BigInt(3000 + (i % 9) * 500) * 100n),
        references: [
          {
            name: `${firstNames[(i + 7) % 20]} ${lastNames[(Math.floor(i / 20) + 1) % 6]}`,
            phone: `+2588400${String(((i + 7) % 120) + 1).padStart(5, '0')}`,
            relationship: 'Referência comercial',
          },
        ],
        guarantors: [],
      },
      consent: {
        sms: i % 3 !== 0,
        whatsapp: i % 4 === 0,
        email: false,
        source:
          'Dados sintéticos de demonstração; não usar para contactar pessoas.',
      },
      classification: i % 13 === 0 ? 'vip' : 'regular',
      employmentMonths: i % 6 === 3 ? 12 + i : null,
      verifiedReferences: i % 3,
    };
  });
  const loans = Array.from({ length: 60 }, (_, i) => {
    const product = i % 4;
    const p = products[product]!;
    const periods =
      p.terms.periodicity === 'daily'
        ? Math.max(p.terms.minPeriods, 20)
        : Math.max(p.terms.minPeriods, 6);
    const principal =
      BigInt(p.terms.minPrincipal) + BigInt((i % 10) + 1) * 200000n;
    const amount =
      principal > BigInt(p.terms.maxPrincipal)
        ? BigInt(p.terms.maxPrincipal)
        : principal;
    let elapsed =
      i < 12
        ? 400
        : i < 28
          ? 65
          : i < 48
            ? [35, 42, 51, 67, 97, 131][i % 6]!
            : 0;
    if (p.terms.periodicity === 'daily')
      elapsed =
        i < 12
          ? 90
          : i < 28
            ? 5
            : i < 48
              ? [8, 14, 21, 37, 67, 101][i % 6]!
              : 0;
    const startDate = dateBefore(today, elapsed);
    const quote = simulateContract(1, {
      principal: amount,
      periods: Math.min(periods, p.terms.maxPeriods),
      startDate,
      terms: p.terms,
    });
    const payments = quote.instalments
      .filter((inst) => i < 12 || (i < 28 && inst.dueDate < today))
      .map((inst) => ({ date: inst.dueDate, amount: inst.total.toString() }));
    return {
      client: i,
      product,
      principal: amount.toString(),
      periods: Math.min(periods, p.terms.maxPeriods),
      startDate,
      purpose: activities[i % 6]!,
      plan: {
        instalments: quote.instalments.map((inst, index) => ({
          ...inst,
          from: index === 0 ? startDate : quote.instalments[index - 1]!.dueDate,
        })),
        separate: quote.separate,
        disbursed: quote.disbursed,
      },
      payments,
    };
  });
  return {
    today,
    products,
    clients,
    loans,
    branches: ['Maputo · Polana', 'Beira · Macuti', 'Nampula · Muhala'],
  };
}
