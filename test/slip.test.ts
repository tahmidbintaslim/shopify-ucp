import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderGid, processSlip, type SlipDeps, type SlipOrder } from "../app/utils/slip.ts";

const order = (amount = "1250.00", currencyCode = "THB", canMarkAsPaid = true): SlipOrder => ({
  id: "gid://shopify/Order/7",
  canMarkAsPaid,
  totalOutstandingSet: { shopMoney: { amount, currencyCode } },
});
const image = new Blob(["img"]);

function deps(over: Partial<SlipDeps> = {}) {
  const calls = { verifyAmount: "", marked: "" };
  const d: SlipDeps = {
    fetchOrder: async () => order(),
    verify: async (_img, amount) => ((calls.verifyAmount = amount), { verified: true, transRef: "TX1" }),
    markPaid: async (gid) => ((calls.marked = gid), []),
    ...over,
  };
  return { d, calls };
}

describe("orderGid", () => {
  it("turns the extension's order identity into an Admin API order id", () => {
    assert.equal(orderGid("gid://shopify/OrderIdentity/123"), "gid://shopify/Order/123");
    assert.equal(orderGid("nope"), null);
    assert.equal(orderGid(undefined), null);
  });
});

describe("processSlip", () => {
  it("verifies with Shopify's outstanding amount and marks the order paid", async () => {
    const { d, calls } = deps();
    assert.deepEqual(await processSlip(image, "gid://shopify/Order/7", d), { verified: true, transRef: "TX1" });
    assert.equal(calls.verifyAmount, "1250.00");
    assert.equal(calls.marked, "gid://shopify/Order/7");
  });

  it("does not mark paid when the slip fails", async () => {
    const { d, calls } = deps({ verify: async () => ({ verified: false, reason: "duplicate" }) });
    assert.deepEqual(await processSlip(image, "x", d), { verified: false, reason: "duplicate" });
    assert.equal(calls.marked, "");
  });

  it("handles missing, paid, non-THB orders and a down verifier", async () => {
    assert.equal((await processSlip(image, "x", deps({ fetchOrder: async () => null }).d)).reason, "order_not_ready");
    assert.equal((await processSlip(image, "x", deps({ fetchOrder: async () => order("1", "THB", false) }).d)).reason, "already_paid");
    assert.equal((await processSlip(image, "x", deps({ fetchOrder: async () => order("1", "USD") }).d)).reason, "not_thb");
    const down = deps({ verify: async () => Promise.reject(new Error("timeout")) });
    assert.deepEqual(await processSlip(image, "x", down.d), { verified: false, reason: "verifier_unavailable" });
    assert.equal(down.calls.marked, "");
  });

  it("reports a refused orderMarkAsPaid instead of hiding it", async () => {
    const logged: unknown[] = [];
    const { d } = deps({ markPaid: async () => [{ message: "no" }], log: (...a) => logged.push(a) });
    assert.deepEqual(await processSlip(image, "x", d), { verified: true, reason: "mark_paid_failed" });
    assert.equal(logged.length, 1);
  });
});
