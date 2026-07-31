require("dotenv").config();

const port = Number(process.env.PORT || 3000);
const secret = process.env.BILLING_CRON_SECRET;

if (!secret) {
  throw new Error("BILLING_CRON_SECRET is not configured");
}

async function run() {
  const response = await fetch(`http://127.0.0.1:${port}/api/payment/billing/run-renewals`, {
    method: "POST",
    headers: {
      "x-billing-cron-secret": secret,
    },
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Billing renewal failed (HTTP ${response.status})`);
  }

  console.log(JSON.stringify(result));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
