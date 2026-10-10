import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { engine } from './engine-runtime.mjs';
import { attestPlan } from './financial-plan.mjs';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const local = JSON.parse(readFileSync('.local/supabase.json', 'utf8'));
const accounts = JSON.parse(readFileSync('.local/accounts.json', 'utf8'));
const fixture = JSON.parse(readFileSync('.local/m4.json', 'utf8'));
if (new URL(local.API_URL).hostname !== '127.0.0.1')
  throw new Error('Local verification only');
const db = new pg.Client({ connectionString: local.DB_URL });
await db.connect();
let passed = 0;
function ok(r) {
  assert(!r.error, `Operation failed: ${r.error?.code}`);
  return r.data;
}
async function login(key) {
  const c = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ok(await c.auth.signInWithPassword(accounts[key]));
  return c;
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const today = (
  await db.query(
    "select (now() at time zone 'Africa/Maputo')::date::text as day",
  )
).rows[0].day;
const dateOffset = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
try {
  const [manager, cashier, reader, other, collector] = await Promise.all(
    ['manager', 'cashier', 'reader', 'other', 'collector'].map(login),
  );
  const t = fixture.tenant;
  const base = (
    await db.query('select * from public.contracts where id=$1', [
      fixture.contract,
    ])
  ).rows[0];
  const baseApplication = (
    await db.query('select * from public.applications where id=$1', [
      base.application_id,
    ])
  ).rows[0];
  const key = (
    await db.query('select secret from financial_private.signing_key where id')
  ).rows[0].secret;
  // Isolated owner fixtures represent loans made before M5, to test historical accrual deterministically.
  async function loan({
    terms = {},
    principal = '1000000',
    periods = 6,
    startDate = today,
    historicalReplay = false,
  } = {}) {
    const a = randomUUID(),
      c = randomUUID(),
      l = randomUUID();
    const s = {
      ...base.snapshot,
      principal,
      periods,
      startDate,
      terms: { ...base.snapshot.terms, ...terms },
    };
    if (historicalReplay) await db.query('begin');
    await db.query(
      'insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        a,
        t,
        baseApplication.client_id,
        base.branch_id,
        baseApplication.product_version_id,
        principal,
        periods,
        startDate,
        'Verificação de pagamentos',
        'disbursed',
        accounts.manager.id,
      ],
    );
    await db.query(
      'insert into public.contracts(id,tenant_id,application_id,branch_id,snapshot,approved_by) values($1,$2,$3,$4,$5,$6)',
      [c, t, a, base.branch_id, s, accounts.analyst.id],
    );
    await db.query(
      "insert into public.loans(id,tenant_id,contract_id,branch_id,disbursed_on,method,reference,signed_on,recorded_by) values($1,$2,$3,$4,$5,'transfer','M5-FIXTURE',$5,$6)",
      [l, t, c, base.branch_id, startDate, accounts.cashier.id],
    );
    const plan = engine.simulate({
      principal: BigInt(principal),
      periods,
      startDate,
      terms: s.terms,
    });
    const attested = attestPlan({
      tenant: t,
      contract: c,
      actor: accounts.manager.id,
      plan,
      key,
    });
    if (historicalReplay) {
      await db.query('select financial_private.initialise($1,$2,$3::jsonb)', [
        t,
        l,
        JSON.stringify(plan, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v,
        ),
      ]);
      await db.query('select financial_private.accrue($1,$2,$3)', [
        t,
        l,
        dateOffset(today, -5),
      ]);
      await db.query(
        'update public.loan_instalments set principal=principal-100000 where loan_id=$1',
        [l],
      );
      await db.query(
        "insert into public.journal_transactions(tenant_id,branch_id,loan_id,source,source_key,postings) values($1,$2,$3,'fixture',$4,$5)",
        [
          t,
          base.branch_id,
          l,
          randomUUID(),
          JSON.stringify([
            { account: 'funds_mpesa', debit: '100000', credit: '0' },
            { account: 'receivable_principal', debit: '0', credit: '100000' },
          ]),
        ],
      );
      await db.query('commit');
    } else ok(await manager.rpc('initialise_loan', { t, l, ...attested }));
    return { l, c, s, plan, attested };
  }
  async function balance(l) {
    return ok(await manager.rpc('loan_balance', { t, l }));
  }
  async function preview(l, amount) {
    return ok(await cashier.rpc('preview_payment', { t, l, amount }));
  }
  async function pay(
    l,
    amount,
    method = 'mpesa',
    reference = 'M5-PAGAMENTO',
    requestId = randomUUID(),
    p,
  ) {
    p = p ?? (await preview(l, amount));
    return cashier.rpc('record_payment', {
      t,
      l,
      amount,
      payment_method: method,
      payment_reference: reference,
      expected_revision: p.revision,
      expected_day: p.day,
      request_id: requestId,
    });
  }
  const flat = await loan();
  let payment;
  await check(
    'Attested historical plan is immutable, exact and initialised only once',
    async () => {
      assert.equal((await balance(flat.l)).total, '1600000');
      ok(
        await manager.rpc('initialise_loan', {
          t,
          l: flat.l,
          ...flat.attested,
        }),
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int as n from public.journal_transactions where loan_id=$1 and source=$2',
            [flat.l, 'disbursement'],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await manager.rpc('initialise_loan', {
            t,
            l: flat.l,
            plan_payload: flat.attested.plan_payload.replace('1600000', '1'),
            plan_signature: flat.attested.plan_signature,
          })
        ).error?.code,
        '42501',
      );
      assert(
        (
          await manager.rpc('disburse_application_v4', {
            t,
            a_id: base.application_id,
            expected_revision: 1,
            payment_method: 'cash',
            payment_reference: 'x',
            disbursement_date: today,
            signature_date: today,
          })
        ).error,
      );
    },
  );
  await check(
    'Preview matches oldest-first waterfall and partial payment exactly',
    async () => {
      const p = await preview(flat.l, '100000');
      const first = flat.plan.instalments[0];
      const oracle = engine.allocatePayment({
        amount: 100000n,
        asOf: today,
        debts: flat.plan.instalments.map((r) => ({
          id: String(r.number),
          from: r.from,
          dueDate: r.dueDate,
          principal: r.principal,
          interest: r.interest,
          fine: 0n,
          lateInterest: 0n,
        })),
        order: flat.s.terms.allocation,
        excess: flat.s.terms.excess,
      });
      assert.deepEqual(
        p.allocations,
        oracle.allocations.map((r) => ({
          number: Number(r.id),
          component: r.component,
          amount: r.amount.toString(),
        })),
      );
      payment = ok(
        await pay(flat.l, '100000', 'mpesa', 'PARCIAL', randomUUID(), p),
      );
      const b = await balance(flat.l);
      assert.equal(b.total, '1500000');
      assert.equal(b.rows[0].total, (first.total - 100000n).toString());
    },
  );
  await check(
    'Idempotent retries, stale preview, parallel payments and sequence rollback',
    async () => {
      const p = await preview(flat.l, '200000'),
        id = randomUUID();
      const args = {
        t,
        l: flat.l,
        amount: '200000',
        payment_method: 'emola',
        payment_reference: 'IDEMPOTENTE',
        expected_revision: p.revision,
        expected_day: p.day,
        request_id: id,
      };
      const rs = await Promise.all([
        cashier.rpc('record_payment', args),
        cashier.rpc('record_payment', args),
      ]);
      assert.equal(ok(rs[0]), ok(rs[1]));
      assert.equal(
        (await cashier.rpc('record_payment', { ...args, amount: '1' })).error
          ?.code,
        'PT409',
      );
      assert.equal(
        (await pay(flat.l, '1', 'mpesa', 'STALE', randomUUID(), p)).error?.code,
        'PT409',
      );
      const p2 = await preview(flat.l, '100');
      const before = (
        await db.query(
          'select last_number::text as n from public.receipt_counters where tenant_id=$1',
          [t],
        )
      ).rows[0].n;
      assert(
        (await pay(flat.l, '100', 'bad', 'INVALID', randomUUID(), p2)).error,
      );
      assert.equal(
        (
          await db.query(
            'select last_number::text as n from public.receipt_counters where tenant_id=$1',
            [t],
          )
        ).rows[0].n,
        before,
      );
      const rr = await Promise.all([
        pay(flat.l, '100', 'mpesa', 'A', randomUUID(), p2),
        pay(flat.l, '100', 'mpesa', 'B', randomUUID(), p2),
      ]);
      assert.equal(rr.filter((r) => !r.error).length, 1);
      assert.equal(rr.filter((r) => r.error?.code === 'PT409').length, 1);
      const nums = (
        await db.query(
          'select receipt_number::text as n from public.payments where tenant_id=$1 order by receipt_number',
          [t],
        )
      ).rows.map((r) => BigInt(r.n));
      assert(nums.every((n, i) => n === BigInt(i + 1)));
    },
  );
  await check(
    'Excess respects advance or credit and settled status',
    async () => {
      const advance = await loan();
      const id = ok(await pay(advance.l, '1700000'));
      const b = await balance(advance.l);
      assert.equal(b.total, '0');
      assert.equal(b.credit, '100000');
      assert.equal(b.status, 'settled');
      const credit = await loan({ terms: { excess: 'credit' } });
      ok(await pay(credit.l, '100000'));
      const cb = await balance(credit.l);
      assert.equal(cb.credit, '100000');
      assert.equal(cb.total, '1600000');
      ok(
        await manager.rpc('reverse_payment', {
          t,
          p_id: id,
          reason: 'Montante registado por engano',
        }),
      );
      assert.equal((await balance(advance.l)).status, 'active');
      assert.equal((await balance(advance.l)).credit, '0');
    },
  );
  await check(
    'Reversal preserves receipt, restores only original allocations and requires authority',
    async () => {
      assert.equal(
        (
          await cashier.rpc('reverse_payment', {
            t,
            p_id: payment,
            reason: 'Correcção',
          })
        ).error?.code,
        '42501',
      );
      assert(
        (await manager.rpc('reverse_payment', { t, p_id: payment, reason: '' }))
          .error,
      );
      const before = await balance(flat.l);
      ok(
        await manager.rpc('reverse_payment', {
          t,
          p_id: payment,
          reason: 'Registo duplicado conferido',
        }),
      );
      const b = await balance(flat.l);
      assert.equal(BigInt(b.total) - BigInt(before.total), 100000n);
      assert(b.payments.find((p) => p.id === payment).reversed);
      assert.equal(
        (
          await manager.rpc('reverse_payment', {
            t,
            p_id: payment,
            reason: 'Repetição',
          })
        ).error?.code,
        'PT409',
      );
      for (const table of [
        'payments',
        'payment_reversals',
        'journal_transactions',
      ]) {
        assert((await manager.from(table).delete().eq('tenant_id', t)).error);
        await assert.rejects(
          db.query(`delete from public.${table} where tenant_id=$1`, [t]),
          (e) => e.code === '42501',
        );
      }
    },
  );
  await check(
    'Daily mora mandatory vector, tolerance, one-time fine and idempotency',
    async () => {
      const start = dateOffset(today, -11);
      const terms = {
        method: 'flat',
        periodicity: 'daily',
        rate: '0',
        penalty: {
          toleranceDays: 3,
          dailyRate: '0.005',
          fine: { kind: 'fixed', value: '500' },
        },
      };
      const late = await loan({
        terms,
        principal: '266667',
        periods: 1,
        startDate: start,
      });
      ok(await manager.rpc('refresh_loan', { t, l: late.l }));
      const b = await balance(late.l);
      assert.equal(b.rows[0].lateInterest, '9333');
      assert.equal(b.rows[0].fine, '500');
      assert.equal(b.status, 'overdue');
      const count = (
        await db.query(
          'select count(*)::int n from public.journal_transactions where loan_id=$1',
          [late.l],
        )
      ).rows[0].n;
      ok(await manager.rpc('refresh_loan', { t, l: late.l }));
      assert.equal((await balance(late.l)).rows[0].lateInterest, '9333');
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.journal_transactions where loan_id=$1',
            [late.l],
          )
        ).rows[0].n,
        count,
      );
      const tol = await loan({
        terms,
        principal: '266667',
        periods: 1,
        startDate: dateOffset(today, -3),
      });
      ok(await manager.rpc('refresh_loan', { t, l: tol.l }));
      assert.equal((await balance(tol.l)).rows[0].lateInterest, '0');
      assert.equal((await balance(tol.l)).rows[0].fine, '0');
    },
  );
  await check(
    'Partial payments change later mora basis; cumulative rounding matches exact weighted balances',
    async () => {
      const history = await loan({
        historicalReplay: true,
        terms: {
          method: 'flat',
          periodicity: 'daily',
          rate: '0',
          penalty: {
            toleranceDays: 0,
            dailyRate: '0.005',
            fine: { kind: 'fixed', value: '0' },
          },
        },
        principal: '266667',
        periods: 1,
        startDate: dateOffset(today, -11),
      });
      ok(await manager.rpc('refresh_loan', { t, l: history.l }));
      const after = await balance(history.l);
      // 5 days on 266667 plus 5 days on 166667 = 10833.35 -> 10833 cents.
      assert.equal(after.rows[0].lateInterest, '10833');
    },
  );
  await check(
    'Fees in three treatments, capitalised grace and all methods reconcile',
    async () => {
      for (const method of [
        'flat',
        'annuity',
        'sac',
        'interest_only',
        'bullet',
      ]) {
        const f = await loan({
          terms: {
            method,
            grace: { periods: 2, treatment: 'capitalise' },
            fees: [
              {
                key: 'ded',
                kind: 'fixed',
                value: '10000',
                treatment: 'deducted',
              },
              {
                key: 'fin',
                kind: 'fixed',
                value: '20000',
                treatment: 'financed',
              },
              {
                key: 'sep',
                kind: 'fixed',
                value: '30000',
                treatment: 'separate',
              },
            ],
          },
        });
        assert.equal(BigInt((await balance(f.l)).total), f.plan.total);
        assert.equal(
          (await balance(f.l)).rows.find((r) => r.number === 0).total,
          '30000',
        );
        ok(await pay(f.l, '100000'));
      }
    },
  );
  await check(
    'Cash opening, numeric payment, deposit, reversal and counted close reconcile',
    async () => {
      const cashLoan = await loan();
      const p = await preview(cashLoan.l, '10000');
      assert.equal(
        (await pay(cashLoan.l, '10000', 'cash', 'NUMERARIO', randomUUID(), p))
          .error?.code,
        'PT412',
      );
      ok(
        await cashier.rpc('manage_cash', {
          t,
          b: base.branch_id,
          operation: 'open',
          amount: '100000',
          reference: '',
        }),
      );
      const cashPayment = ok(
        await pay(cashLoan.l, '10000', 'cash', 'NUMERARIO'),
      );
      assert.equal(
        ok(await cashier.rpc('cash_summary', { t, b: base.branch_id }))
          .expected,
        '110000',
      );
      assert(
        (
          await cashier.rpc('manage_cash', {
            t,
            b: base.branch_id,
            operation: 'deposit',
            amount: '120000',
            reference: 'Excesso',
          })
        ).error,
      );
      const dep = {
        t,
        b: base.branch_id,
        operation: 'deposit',
        amount: '20000',
        reference: 'Depósito bancário',
        request_id: randomUUID(),
      };
      const did = ok(await cashier.rpc('manage_cash', dep));
      assert.equal(ok(await cashier.rpc('manage_cash', dep)), did);
      ok(
        await manager.rpc('reverse_payment', {
          t,
          p_id: cashPayment,
          reason: 'Numerário devolvido',
        }),
      );
      assert.equal(
        ok(await cashier.rpc('cash_summary', { t, b: base.branch_id }))
          .expected,
        '80000',
      );
      assert(
        (
          await cashier.rpc('manage_cash', {
            t,
            b: base.branch_id,
            operation: 'close',
            amount: '79000',
            reference: '',
          })
        ).error,
      );
      ok(
        await cashier.rpc('manage_cash', {
          t,
          b: base.branch_id,
          operation: 'close',
          amount: '79000',
          reference: 'Diferença conferida com o gestor',
        }),
      );
      const cs = ok(
        await cashier.rpc('cash_summary', { t, b: base.branch_id }),
      );
      assert(cs.closed);
      assert.equal(cs.expected, '80000');
      assert.equal(cs.counted, '79000');
      const ledgerCash = (
        await db.query(
          "select coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric),0)::text as amount from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=$1 and j.branch_id=$2 and x->>'account'='funds_cash'",
          [t, base.branch_id],
        )
      ).rows[0].amount;
      assert.equal(ledgerCash, cs.counted);

      assert.equal(
        (await pay(cashLoan.l, '100', 'cash', 'APOS FECHO')).error?.code,
        'PT412',
      );
    },
  );
  await check(
    'Cash disbursement, plan and journal commit atomically and insufficient cash rolls back',
    async () => {
      const branch = (
        await db.query(
          'insert into public.branches(tenant_id,name) values($1,$2) returning id',
          [t, `Caixa desembolso ${randomUUID().slice(0, 8)}`],
        )
      ).rows[0].id;
      async function prepared(principal) {
        const a = randomUUID(),
          c = randomUUID();
        const snapshot = { ...base.snapshot, principal, startDate: today };
        await db.query(
          'insert into public.applications(id,tenant_id,client_id,branch_id,product_version_id,principal,periods,start_date,purpose,status,created_by,decided_by) values($1,$2,$3,$4,$5,$6,6,$7,$8,$9,$10,$11)',
          [
            a,
            t,
            baseApplication.client_id,
            branch,
            baseApplication.product_version_id,
            principal,
            today,
            'Verificação do desembolso',
            'approved',
            accounts.manager.id,
            accounts.analyst.id,
          ],
        );
        await db.query(
          'insert into public.contracts(id,tenant_id,application_id,branch_id,snapshot,approved_by) values($1,$2,$3,$4,$5,$6)',
          [c, t, a, branch, snapshot, accounts.analyst.id],
        );
        const plan = engine.simulate({
          principal: BigInt(principal),
          periods: 6,
          startDate: today,
          terms: snapshot.terms,
        });
        return {
          a,
          args: {
            t,
            a_id: a,
            expected_revision: 1,
            payment_method: 'cash',
            payment_reference: 'DESEMBOLSO-M5',
            disbursement_date: today,
            signature_date: today,
            ...attestPlan({
              tenant: t,
              contract: c,
              actor: accounts.cashier.id,
              plan,
              key,
            }),
          },
        };
      }
      const first = await prepared('1000000');
      assert.equal(
        (await cashier.rpc('disburse_application', first.args)).error?.code,
        'PT412',
      );
      ok(
        await cashier.rpc('manage_cash', {
          t,
          b: branch,
          operation: 'open',
          amount: '2000000',
        }),
      );
      const disbursed = ok(
        await cashier.rpc('disburse_application', first.args),
      );
      assert.equal((await balance(disbursed)).total, '1600000');
      assert.equal(
        ok(await cashier.rpc('cash_summary', { t, b: branch })).expected,
        '1000000',
      );
      assert.equal(
        (await cashier.rpc('disburse_application', first.args)).error?.code,
        'PT409',
      );
      const denied = await prepared('1000001');
      assert.equal(
        (await cashier.rpc('disburse_application', denied.args)).error?.code,
        'PT413',
      );
      assert.equal(
        (
          await db.query('select status from public.applications where id=$1', [
            denied.a,
          ])
        ).rows[0].status,
        'approved',
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int n from public.loans l join public.contracts c on c.id=l.contract_id where c.application_id=$1',
            [denied.a],
          )
        ).rows[0].n,
        0,
      );
      for (const method of ['mkesh', 'transfer', 'deposit'])
        ok(await pay(disbursed, '1000', method, `M5-${method}`));
      assert.equal((await balance(disbursed)).total, '1597000');
    },
  );
  await check(
    'Opening cash carries the previous counted balance without duplicating cash in the ledger',
    async () => {
      const branch = (
        await db.query(
          'insert into public.branches(tenant_id,name) values($1,$2) returning id',
          [t, `Caixa anterior ${randomUUID().slice(0, 8)}`],
        )
      ).rows[0].id;
      const sid = (
        await db.query(
          "insert into public.cash_sessions(tenant_id,branch_id,day,opening,opened_by,closed_at,closed_by,counted,expected,difference_reason) values($1,$2,$3,50000,$4,now()-interval '1 day',$4,40000,50000,'Diferença anterior conferida') returning id",
          [t, branch, dateOffset(today, -1), accounts.cashier.id],
        )
      ).rows[0].id;
      for (const [source, postings] of [
        [
          'cash_opening',
          [
            { account: 'funds_cash', debit: '50000', credit: '0' },
            { account: 'cash_opening_balance', debit: '0', credit: '50000' },
          ],
        ],
        [
          'cash_difference',
          [
            { account: 'funds_cash', debit: '0', credit: '10000' },
            { account: 'cash_difference', debit: '10000', credit: '0' },
          ],
        ],
      ])
        await db.query(
          'insert into public.journal_transactions(tenant_id,branch_id,cash_session_id,source,source_key,postings) values($1,$2,$3,$4,$5,$6)',
          [t, branch, sid, source, sid, JSON.stringify(postings)],
        );
      ok(
        await cashier.rpc('manage_cash', {
          t,
          b: branch,
          operation: 'open',
          amount: '40000',
        }),
      );
      assert.equal(
        ok(await cashier.rpc('cash_summary', { t, b: branch })).expected,
        '40000',
      );
      const cash = (
        await db.query(
          "select sum((x->>'debit')::numeric-(x->>'credit')::numeric)::text as amount from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=$1 and j.branch_id=$2 and x->>'account'='funds_cash'",
          [t, branch],
        )
      ).rows[0].amount;
      assert.equal(cash, '40000');
    },
  );
  await check(
    'Real tenant isolation, branch limits, forbidden writes and private signing key',
    async () => {
      for (const table of [
        'loan_accounts',
        'loan_instalments',
        'payments',
        'payment_reversals',
        'cash_sessions',
        'cash_deposits',
        'journal_transactions',
      ]) {
        assert.equal(
          ok(await other.from(table).select('*').eq('tenant_id', t)).length,
          0,
        );
        assert((await other.from(table).insert({ tenant_id: t })).error);
      }
      assert.equal(
        (await other.rpc('preview_payment', { t, l: flat.l, amount: '1' }))
          .error?.code,
        '42501',
      );
      assert.equal(
        (await reader.rpc('preview_payment', { t, l: flat.l, amount: '1' }))
          .error?.code,
        '42501',
      );
      assert.equal(
        (await other.rpc('log_receipt_access', { t, p: payment })).error?.code,
        '42501',
      );
      const b = (
        await db.query(
          'insert into public.branches(tenant_id,name) values($1,$2) returning id',
          [t, `Agência isolada ${randomUUID().slice(0, 8)}`],
        )
      ).rows[0].id;
      await db.query(
        'update public.memberships set branch_id=$1 where tenant_id=$2 and user_id=$3',
        [b, t, accounts.collector.id],
      );
      assert.equal(
        (await collector.rpc('preview_payment', { t, l: flat.l, amount: '1' }))
          .error?.code,
        '42501',
      );
      const raw = await db.query(
        "select has_schema_privilege('authenticated','financial_private','USAGE') permitted",
      );
      assert.equal(raw.rows[0].permitted, false);
      await assert.rejects(
        db.query(
          'begin; set local role authenticated; select secret from financial_private.signing_key',
        ),
        (e) => e.code === '42501',
      );
      await db.query('rollback');
    },
  );
  await check(
    'Scheduled worker updates a prior civil day and repeated runs leave audit unchanged',
    async () => {
      const pending = await loan({
        startDate: dateOffset(today, -1),
        terms: {
          penalty: {
            toleranceDays: 0,
            dailyRate: '0',
            fine: { kind: 'fixed', value: '0' },
          },
        },
      });
      let ready = false;
      for (let i = 0; i < 40; i++) {
        const dates = (
          await db.query(
            'select min(accrued_on)::text as day from public.loan_instalments where loan_id=$1',
            [pending.l],
          )
        ).rows[0].day;
        if (dates === today) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      assert(ready, 'Daily worker did not process the pending civil day');
      const before = (
        await db.query(
          'select count(*)::text n from public.audit_events where tenant_id=$1',
          [t],
        )
      ).rows[0].n;
      await db.query('select financial_private.daily()');
      await db.query('select financial_private.daily()');
      assert.equal(
        (
          await db.query(
            'select count(*)::text n from public.audit_events where tenant_id=$1',
            [t],
          )
        ).rows[0].n,
        before,
      );
    },
  );
  await check(
    'Journal CHECK rejects unbalanced or incomplete entries even for the migration owner',
    async () => {
      for (const postings of [
        [
          { account: 'funds_cash', debit: '10', credit: '0' },
          { account: 'receivable_principal', debit: '0', credit: '9' },
        ],
        [
          { account: 'funds_cash', debit: '10', credit: '0' },
          { account: 'receivable_principal', debit: '0', credit: '10' },
          {},
        ],
        [
          { account: 'funds_cash', debit: 10, credit: '0' },
          { account: 'receivable_principal', debit: '0', credit: '10' },
        ],
      ])
        await assert.rejects(
          db.query(
            "insert into public.journal_transactions(tenant_id,branch_id,source,source_key,postings) values($1,$2,'invalid-fixture',$3,$4)",
            [t, base.branch_id, randomUUID(), JSON.stringify(postings)],
          ),
          (e) => e.code === '23514',
        );
    },
  );
  await check(
    'Every journal balances; receivables match portfolio to the cent and receipts have no gaps',
    async () => {
      const all = (
        await db.query(
          'select postings from public.journal_transactions where tenant_id=$1',
          [t],
        )
      ).rows;
      for (const row of all) {
        assert.equal(
          row.postings.reduce(
            (n, x) => n + BigInt(x.debit) - BigInt(x.credit),
            0n,
          ),
          0n,
        );
      }
      const debts = (
        await db.query(
          'select coalesce(sum(principal+interest+fine+late_interest),0)::text n from public.loan_instalments where tenant_id=$1',
          [t],
        )
      ).rows[0].n;
      const ledger = (
        await db.query(
          "select coalesce(sum((x->>'debit')::numeric-(x->>'credit')::numeric),0)::text n from public.journal_transactions j cross join lateral jsonb_array_elements(j.postings) x where j.tenant_id=$1 and x->>'account' like 'receivable_%'",
          [t],
        )
      ).rows[0].n;
      assert.equal(debts, ledger);
      const nums = (
        await db.query(
          'select receipt_number::text n from public.payments where tenant_id=$1 order by receipt_number',
          [t],
        )
      ).rows;
      assert(nums.every((r, i) => BigInt(r.n) === BigInt(i + 1)));
      const summary = ok(await manager.rpc('today_summary', { t }));
      assert(BigInt(summary.overdue) > 0n);
      ok(await manager.rpc('log_receipt_access', { t, p: payment }));
      assert(
        (
          await db.query(
            "select id from public.audit_events where tenant_id=$1 and entity='payments' and entity_id=$2 and action='access'",
            [t, payment],
          )
        ).rows.length > 0,
      );
    },
  );
  writeFileSync(
    '.local/m5.json',
    JSON.stringify({ tenant: t, loan: flat.l, payment }),
    { mode: 0o600 },
  );
  console.log(
    `${passed} payment/cash/ledger groups passed against real PostgreSQL/Auth/RLS.`,
  );
} finally {
  await db.end();
}
