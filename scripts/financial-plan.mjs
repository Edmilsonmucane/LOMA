import { createHmac } from 'node:crypto';
/** The key stays in the server / private schema; never send it to browsers. */
export function attestPlan({ tenant, contract, actor, plan, key }) {
  const plan_payload = JSON.stringify(
    {
      tenant,
      contract,
      actor,
      expires: new Date(Date.now() + 300_000).toISOString(),
      plan,
    },
    (_, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
  return {
    plan_payload,
    plan_signature: createHmac('sha256', key)
      .update(plan_payload)
      .digest('hex'),
  };
}
