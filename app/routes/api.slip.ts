/**
 * POST /api/slip — called by the PromptPay thank-you page extension.
 * Form fields: `image` (slip photo) and `orderId` (from shopify.orderConfirmation).
 *
 * The amount is read from the order here, never taken from the browser. The slip
 * goes to the Swadipay service with the shop's store key; a verified slip
 * marks the order as paid.
 */
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import prisma from "../db.server";

const SERVICE_URL = process.env.SWADIPAY_URL || "https://promptpay-storefront.vercel.app";

const ORDER_QUERY = `#graphql
  query PromptPayOrder($id: ID!) {
    order(id: $id) {
      id
      canMarkAsPaid
      totalOutstandingSet { shopMoney { amount currencyCode } }
    }
  }`;

const MARK_PAID = `#graphql
  mutation PromptPayMarkPaid($input: OrderMarkAsPaidInput!) {
    orderMarkAsPaid(input: $input) {
      order { id displayFinancialStatus }
      userErrors { field message }
    }
  }`;

export async function action({ request }: ActionFunctionArgs) {
  // Answers the CORS preflight itself and rejects requests without a valid checkout session token.
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const reply = (body: Record<string, unknown>, status = 200) => cors(json(body, { status }));
  const shop = new URL(String(sessionToken.dest)).hostname;

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  // The extension sends gid://shopify/OrderIdentity/<n>; the Admin API wants gid://shopify/Order/<n>.
  const orderNumber = /(\d+)$/.exec(String(form?.get("orderId") ?? ""))?.[1];
  if (!(image instanceof Blob) || !orderNumber) return reply({ verified: false, reason: "invalid_request" }, 400);

  const profile = await prisma.merchantProfile.findUnique({ where: { shop } });
  if (!profile?.promptpayStoreKey) return reply({ verified: false, reason: "not_configured" });

  const { admin } = await unauthenticated.admin(shop);
  const orderRes = await admin.graphql(ORDER_QUERY, { variables: { id: `gid://shopify/Order/${orderNumber}` } });
  const order = (await orderRes.json()).data?.order;
  // On the thank-you page the order can take a few seconds to exist.
  if (!order) return reply({ verified: false, reason: "order_not_ready" });
  if (!order.canMarkAsPaid) return reply({ verified: true, reason: "already_paid" });
  const { amount, currencyCode } = order.totalOutstandingSet.shopMoney;
  if (currencyCode !== "THB") return reply({ verified: false, reason: "not_thb" });

  const upstream = new FormData();
  upstream.append("image", image);
  upstream.append("amount", amount);
  const verdict = await fetch(`${SERVICE_URL}/api/v1/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${profile.promptpayStoreKey}` },
    body: upstream,
  })
    .then((r) => r.json())
    .catch(() => ({ verified: false, reason: "verifier_unavailable" }));
  if (!verdict.verified) return reply({ verified: false, reason: verdict.reason ?? "verifier_unavailable" });

  const markRes = await admin.graphql(MARK_PAID, { variables: { input: { id: order.id } } });
  const errors = (await markRes.json()).data?.orderMarkAsPaid?.userErrors ?? [];
  if (errors.length) {
    // Money arrived but Shopify refused the update: log it so the merchant can mark it by hand.
    console.error("orderMarkAsPaid failed", shop, order.id, verdict.transRef, errors);
    return reply({ verified: true, reason: "mark_paid_failed" });
  }
  return reply({ verified: true, transRef: verdict.transRef });
}
