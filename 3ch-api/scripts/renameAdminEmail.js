const configuredPool = require('../src/db/pool');
const { Pool } = require('pg');
const pool = new Pool({ ...configuredPool.options, connectionTimeoutMillis: 10000, query_timeout: 10000 });
const oldEmail = 'admin@3ch.com';
const newEmail = 'admin@threech.com';
const deadline = setTimeout(() => { console.error('DATABASE_TIMEOUT'); process.exit(1); }, 25000);

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id,email,is_admin,system_role,deleted_at FROM users WHERE LOWER(email)=ANY($1::text[]) FOR UPDATE',
      [[oldEmail, newEmail]],
    );
    const source = found.rows.find(user => user.email.toLowerCase() === oldEmail);
    const destination = found.rows.find(user => user.email.toLowerCase() === newEmail);
    if (!source || !source.is_admin || source.deleted_at) throw new Error('ACTIVE_ADMIN_SOURCE_NOT_FOUND');
    if (destination) throw new Error('DESTINATION_EMAIL_ALREADY_EXISTS');
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ ready: true, id: source.id, oldEmail, newEmail, systemRole: source.system_role }));
      await client.query('ROLLBACK');
      return;
    }
    const changed = await client.query(
      'UPDATE users SET email=$1,updated_at=NOW() WHERE id=$2 AND email=$3 AND is_admin=true AND deleted_at IS NULL RETURNING id,email,system_role',
      [newEmail, source.id, source.email],
    );
    if (changed.rowCount !== 1) throw new Error('ADMIN_ACCOUNT_CHANGED');
    await client.query('COMMIT');
    console.log(JSON.stringify({ changed: changed.rows[0] }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
main().catch(error => { console.error(error.message || error.code || 'DATABASE_ERROR'); process.exitCode = 1; })
  .finally(async () => { await pool.end(); await configuredPool.end(); clearTimeout(deadline); });
