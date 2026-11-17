// What /api/slip decides, with Shopify and the Swadipay service passed in so it can be tested.

export type SlipOrder = {
  id: string;
  canMarkAsPaid: boolean;
  totalOutstandingSet: { shopMoney: { amount: string; currencyCode: string } };
};

export type SlipReply = { verified: boolean; reason?: string; transRef?: string };

export type SlipDeps = {
  fetchOrder: (gid: string) => Promise<SlipOrder | null>;
  verify: (image: Blob, amount: string) => Promise<{ verified: boolean; reason?: string; transRef?: string }>;
  markPaid: (gid: string) => Promise<{ message: string }[]>;
  log?: (...args: unknown[]) => void;
};

/** The extension sends gid://shopify/OrderIdentity/<n>; the Admin API wants gid://shopify/Order/<n>. */
export function orderGid(raw: unknown): string | null {
  const n = /(\d+)$/.exec(String(raw ?? ""))?.[1];
  return n ? `gid://shopify/Order/${n}` : null;
}

export async function processSlip(image: Blob, gid: string, deps: SlipDeps): Promise<SlipReply> {
  const order = await deps.fetchOrder(gid);
  // On the thank-you page the order can take a few seconds to exist.
  if (!order) return { verified: false, reason: "order_not_ready" };
  if (!order.canMarkAsPaid) return { verified: true, reason: "already_paid" };
  // The amount always comes from Shopify, never from the browser.
  const { amount, currencyCode } = order.totalOutstandingSet.shopMoney;
  if (currencyCode !== "THB") return { verified: false, reason: "not_thb" };

  const verdict: SlipReply = await deps.verify(image, amount).catch(() => ({ verified: false, reason: "verifier_unavailable" }));
  if (!verdict.verified) return { verified: false, reason: verdict.reason ?? "verifier_unavailable" };

  const errors = await deps.markPaid(order.id);
  if (errors.length) {
    // Money arrived but Shopify refused the update: log it so the merchant can mark it by hand.
    deps.log?.("orderMarkAsPaid failed", order.id, verdict.transRef, errors);
    return { verified: true, reason: "mark_paid_failed" };
  }
  return { verified: true, transRef: verdict.transRef };
}
