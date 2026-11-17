/**
 * POST /api/slip — called by the PromptPay thank-you page extension.
 * Form fields: `image` (slip photo) and `orderId` (from shopify.orderConfirmation).
 * The decisions live in utils/slip.ts; this route wires in Shopify and the Swadipay service.
 */
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import { orderGid, processSlip } from "../utils/slip";

const SERVICE_URL = process.env.SWADIPAY_URL || "https://swadipay-tahmid-bin-taslim-rafis-projects.vercel.app";

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
  const gid = orderGid(form?.get("orderId"));
  if (!(image instanceof Blob) || !gid) return reply({ verified: false, reason: "invalid_request" }, 400);

  const profile = await prisma.merchantProfile.findUnique({ where: { shop } });
  const storeKey = profile?.promptpayStoreKey;
  if (!storeKey) return reply({ verified: false, reason: "not_configured" });

  const { admin } = await unauthenticated.admin(shop);
  return reply(
    await processSlip(image, gid, {
      fetchOrder: async (id) => (await (await admin.graphql(ORDER_QUERY, { variables: { id } })).json()).data?.order ?? null,
      verify: async (img, amount) => {
        const body = new FormData();
        body.append("image", img);
        body.append("amount", amount);
        const res = await fetch(`${SERVICE_URL}/api/v1/verify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${storeKey}` },
          body,
        });
        return res.json();
      },
      markPaid: async (id) =>
        (await (await admin.graphql(MARK_PAID, { variables: { input: { id } } })).json()).data?.orderMarkAsPaid?.userErrors ?? [],
      log: (...args) => console.error(shop, ...args),
    }),
  );
}
