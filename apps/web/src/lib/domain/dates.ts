export function formatDate(value: string, months: readonly string[]): string {
  if (months.length !== 12) throw new Error('Twelve month labels required');
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Maputo',
  }).formatToParts(date);
  const part = (type: string) => parts.find((x) => x.type === type)!.value;
  return `${Number(part('day'))} ${months[Number(part('month')) - 1]} ${part('year')}`;
}
export function maputoToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Maputo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
