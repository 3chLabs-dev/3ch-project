const { z } = require("zod");

const schema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(254),
});
const providers = new Set(["local", "google", "kakao", "naver"]);

function createAccountLookup(pool) {
  return async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "VALIDATION_ERROR" });
    }
    try {
      const result = await pool.query(
        `select auth_provider from users
         where btrim(name) = $1 and lower(email) = lower($2)
           and deleted_at is null`,
        [parsed.data.name, parsed.data.email],
      );
      const methods = [...new Set(result.rows.map(row => providers.has(row.auth_provider) ? row.auth_provider : "unknown"))];
      return res.json({ ok: true, found: methods.length > 0, providers: methods });
    } catch {
      return res.status(500).json({ ok: false, error: "ACCOUNT_LOOKUP_FAILED" });
    }
  };
}

module.exports = { createAccountLookup };
