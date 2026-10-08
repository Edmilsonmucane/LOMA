// Development-only Supabase Send SMS hook consumer. Logs contain temporary codes: keep private.
import pg from 'pg';
const db = new pg.Client({
  connectionString: process.env.AUTH_CONSOLE_DATABASE_URL,
});
await db.connect();
do {
  try {
    await db.query(
      "delete from portal_private.auth_codes where created_at<now()-interval '10 minutes'",
    );
    const codes = await db.query(
      'update portal_private.auth_codes set logged_at=now() where logged_at is null returning phone,code',
    );
    for (const row of codes.rows)
      console.log(`[Auth SMS console] ${row.phone}: ${row.code}`);
  } catch {
    console.error('Auth SMS console unavailable; no credentials logged.');
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
} while (true);
