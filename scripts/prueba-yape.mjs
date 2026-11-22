// Run with Node 20+ and the two test credentials in the environment.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const publicKey = process.env.MP_TEST_PUBLIC_KEY;
const accessToken = process.env.MP_TEST_ACCESS_TOKEN;
if (![publicKey, accessToken].every(value => value?.startsWith("TEST-"))) {
  throw new Error("Configura las dos credenciales TEST de Mercado Pago.");
}

const api = "https://api.mercadopago.com";
const authorization = { Authorization: "Bearer " + accessToken };
async function request(path, options = {}) {
  const response = await fetch(api + path, { ...options, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Mercado Pago respondió HTTP " + response.status);
  return response.json();
}

async function testPayment(phoneNumber, expectedStatus) {
  const reference = "nexora-test-" + randomUUID();
  const token = await request("/platforms/pci/yape/v1/payment?public_key=" + encodeURIComponent(publicKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, otp: "123456", requestId: randomUUID() })
  });
  assert.equal(token.live_mode, false);
  assert.ok(token.id);
  const created = await request("/v1/payments", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json", "X-Idempotency-Key": reference },
    body: JSON.stringify({ transaction_amount: 4, description: "NEXORA prueba Free Fire 100 + 10",
      external_reference: reference, payment_method_id: "yape", installments: 1,
      token: token.id, payer: { email: "test_payer@example.com" } })
  });
  assert.ok(created.id);
  const payment = await request("/v1/payments/" + encodeURIComponent(created.id), { headers: authorization });
  assert.equal(payment.live_mode, false);
  assert.equal(payment.external_reference, reference);
  assert.equal(payment.currency_id, "PEN");
  assert.equal(payment.transaction_amount, 4);
  assert.equal(payment.payment_method_id, "yape");
  assert.equal(payment.status, expectedStatus);
  console.log("Yape de prueba:", payment.status);
}

await testPayment("111111111", "approved");
await testPayment("111111113", "rejected");
