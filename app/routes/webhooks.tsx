/**
 * Webhooks Handler
 * Listens for Shopify webhooks to track conversions and handle app lifecycle
 *
 * Route: /webhooks
 */

import { type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  console.log(`📬 Received webhook: ${topic} for ${shop}`);

  switch (topic) {
    case "ORDERS_CREATE": {
      await handleOrderCreate(shop, payload);
      break;
    }

    case "APP_UNINSTALLED": {
      await handleAppUninstalled(shop);
      break;
    }

    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response();
}

/**
 * Handle order creation - Check for AI attribution
 */
async function handleOrderCreate(shop: string, payload: any) {
  try {
    // Check if this order came from our AI Agent
    // We look for the custom attribute we injected during checkout
    const noteAttributes = payload.note_attributes || [];

    const sourceAttr = noteAttributes.find(
      (attr: any) =>
        attr.name === "_source" && attr.value === "universal_agent_gateway",
    );

    if (!sourceAttr) {
      // Not an AI-generated order, skip
      return;
    }

    const interactionId = noteAttributes.find(
      (attr: any) => attr.name === "_interaction_id",
    )?.value;

    if (!interactionId) {
      console.log(`⚠️ AI order without interaction ID for ${shop}`);
      return;
    }

    // Update our DB to mark this as a successful conversion
    const updatedInteraction = await prisma.agentInteraction.update({
      where: { id: interactionId },
      data: {
        converted: true,
        orderId: String(payload.id),
        orderValue: parseFloat(payload.total_price || "0"),
      },
    });

    console.log(`💰 CHA-CHING! AI Agent generated sale:
      Shop: ${shop}
      Order ID: ${payload.id}
      Order Value: ${payload.currency} ${payload.total_price}
      Interaction ID: ${interactionId}
    `);

    // Optional: Send notification to merchant dashboard
    // await notifyMerchant(shop, payload.total_price);
  } catch (error) {
    console.error("Error processing order webhook:", error);
    // Don't throw - we don't want Shopify to retry
  }
}

/**
 * Handle app uninstallation - Clean up data
 */
async function handleAppUninstalled(shop: string) {
  try {
    console.log(`🗑️ App uninstalled from ${shop}, cleaning up...`);

    // Delete merchant profile (cascades to interactions)
    await prisma.merchantProfile.deleteMany({
      where: { shop },
    });

    // Delete sessions
    await prisma.session.deleteMany({
      where: { shop },
    });

    // Delete missed opportunities
    await prisma.missedOpportunity.deleteMany({
      where: { shop },
    });

    console.log(`✅ Cleanup complete for ${shop}`);
  } catch (error) {
    console.error("Error cleaning up after uninstall:", error);
  }
}
