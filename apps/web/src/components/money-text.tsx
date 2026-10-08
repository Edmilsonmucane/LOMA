/** Present an already formatted monetary value without performing financial arithmetic. */
export function MoneyText({ text }: { text: string }) {
  const separator = text.lastIndexOf(' ');
  return (
    <span className="money-text numeric">
      <span>{text.slice(0, separator)}</span>{' '}
      <span className="money-unit">{text.slice(separator + 1)}</span>
    </span>
  );
}
