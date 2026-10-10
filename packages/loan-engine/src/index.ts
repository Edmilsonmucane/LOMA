export * from './v1';
import { simulate, type Terms } from './v1';
/** Historical contracts retain their calculation version. Never change v1 financial behaviour. */
export function simulateContract(
  version: number,
  input: {
    principal: bigint;
    periods: number;
    startDate: string;
    terms: Terms;
  },
) {
  if (version !== 1) throw new Error('Unsupported contract engine version');
  return simulate(input);
}
