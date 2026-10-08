import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const values = new Map();
globalThis.sessionStorage = globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
let opened;
let focused = false;
let closed = false;
globalThis.window = {
  location: { origin: "https://league.test", pathname: "/league/42/gpt-vision", search: "?round=2", hash: "#scores" },
  open: url => { opened = url; return {}; },
  alert: () => {},
  close: () => { closed = true; },
  opener: { closed: false, focus: () => { focused = true; } },
};
const source = readFileSync(new URL("../src/utils/returnNavigation.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const nav = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
for (const unsafe of ["https://other.test", "//other.test", "/\\other.test", "/\nother.test"]) {
  assert.equal(nav.safeReturnPath(unsafe), null);
}
assert.equal(nav.safeReturnPath("/league/42?round=2#scores"), "/league/42?round=2#scores");
assert.equal(new URL(nav.loginUrl(), window.location.origin).searchParams.get("redirect"), "/league/42/gpt-vision?round=2#scores");
nav.openUsagePurchase();
const purchase = new URL(opened);
assert.equal(purchase.searchParams.get("returnTo"), "/league/42/gpt-vision?round=2#scores");
assert.equal(purchase.hash, "#token-packages");
assert.equal(window.location.pathname, "/league/42/gpt-vision");
window.location.search = purchase.search;
assert.equal(new URLSearchParams(nav.paymentReturnParams()).get("resume"), "1");
assert.equal(nav.completePaymentReturn(), null);
assert.equal(focused && closed, true);
assert.ok(values.get("usage-purchase-completed"));
window.opener = null;
assert.equal(nav.completePaymentReturn(), "/league/42/gpt-vision?round=2#scores");
window.location.search = "?returnTo=https://other.test";
assert.equal(nav.completePaymentReturn(), null);
values.set("login-return-to", "/league/42?round=2#scores");
window.location.pathname = "/account/find";
window.location.search = "";
window.location.hash = "";
assert.equal(new URL(nav.loginUrl(), window.location.origin).searchParams.get("redirect"), "/league/42?round=2#scores");
console.log("Navigation return checks passed");
