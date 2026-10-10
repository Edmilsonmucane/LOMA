import 'server-only';
import { createHmac } from 'node:crypto';
import { contractSnapshotSchema, contractQuote } from './domain/applications';
export function attestContract(
  tenant: string,
  actor: string,
  contract: { id: string; snapshot: unknown; engine_version: number },
) {
  const key = process.env.FINANCIAL_SIGNING_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    throw new Error('Financial signing is not configured');
  const plan = contractQuote(
    contractSnapshotSchema.parse(contract.snapshot),
    contract.engine_version,
  );
  const plan_payload = JSON.stringify(
    {
      tenant,
      contract: contract.id,
      actor,
      expires: new Date(Date.now() + 300_000).toISOString(),
      plan,
    },
    (_, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
  );
  return {
    plan_payload,
    plan_signature: createHmac('sha256', key)
      .update(plan_payload)
      .digest('hex'),
  };
}
