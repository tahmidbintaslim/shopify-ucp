import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState } from "preact/hooks";
import { buildPayload, parseTarget } from "./promptpay";

// Same host as application_url in shopify.app.toml.
const APP_URL = "https://universal-agent-gateway.vercel.app";

const MESSAGES: Record<string, string> = {
  verified: "Payment confirmed. Thank you!",
  already_paid: "This order is already paid.",
  order_not_ready: "Your order is still being created. Please try again in a few seconds.",
  slip_not_found: "We could not read this slip. Please upload a clear photo of the original bank slip.",
  slip_pending: "Your bank has not released this slip yet. Please try again in 5 minutes.",
  amount_mismatch: "The amount on the slip does not match this order.",
  wrong_receiver: "This slip was paid to a different account.",
  duplicate: "This slip has already been used.",
  invalid_image: "Please upload a JPG, PNG or WebP image under 4 MB.",
};
const FALLBACK = "We could not check the slip right now. The store will confirm your payment.";

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState("");

  const orderId = shopify.orderConfirmation.value?.order?.id;
  const total = shopify.cost.totalAmount.value;
  const rawId = String(shopify.settings.value.promptpay_id ?? "");
  if (!orderId || !rawId || total?.currencyCode !== "THB") return null;

  let payload: string;
  try {
    payload = buildPayload(parseTarget(rawId), total.amount);
  } catch {
    return null; // Misconfigured PromptPay ID: show nothing rather than a QR that pays no one.
  }

  async function submit() {
    if (!file || !orderId) return;
    setStatus("sending");
    const body = new FormData();
    body.append("image", file);
    body.append("orderId", orderId);
    try {
      const token = await shopify.sessionToken.get();
      const res = await fetch(`${APP_URL}/api/slip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      setMessage(data.verified ? MESSAGES[data.reason === "already_paid" ? "already_paid" : "verified"] : MESSAGES[data.reason] ?? FALLBACK);
      setStatus(data.verified ? "done" : "idle");
    } catch {
      setMessage(FALLBACK);
      setStatus("idle");
    }
  }

  return (
    <s-section heading="Pay with PromptPay">
      <s-stack gap="base" alignItems="center">
        <s-text>{`${total.amount.toFixed(2)} THB`}</s-text>
        <s-qr-code content={payload} accessibilityLabel="PromptPay QR code for this order" />
        <s-text>Scan with your Thai banking app, then upload the slip.</s-text>
        {status !== "done" && (
          <s-drop-zone
            label="Transfer slip"
            accept="image/jpeg,image/png,image/webp"
            // Shopify's docs read `files` from the drop zone, but the checkout DropZoneElement type omits it.
            onInput={(event) => setFile((event.currentTarget as unknown as { files?: readonly File[] }).files?.[0] ?? null)}
          />
        )}
        {status !== "done" && (
          <s-button variant="primary" disabled={!file} loading={status === "sending"} onClick={submit}>
            Submit slip
          </s-button>
        )}
        {message && <s-banner tone={status === "done" ? "success" : "info"}>{message}</s-banner>}
      </s-stack>
    </s-section>
  );
}
