// Copied from Woo-Prompt-Pay/site/lib/promptpay.ts (tested there); keep the two in sync.
// PromptPay QR payloads in the EMVCo merchant-presented format, as Thai
// banking apps read them. No network calls: everything runs in the browser.

/** PromptPay's application ID inside merchant account field 29. */
const PROMPTPAY_AID = "A000000677010111";

export type PromptPayTarget =
  | { kind: "phone"; value: string }
  | { kind: "nationalId"; value: string };

/** One EMVCo TLV field: two-digit ID, two-digit length, value. */
function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Field ${id} is longer than 99 characters`);
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo field 63 requires. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Validates and normalizes a Thai mobile number or 13-digit national/tax ID. */
export function parseTarget(raw: string): PromptPayTarget {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) throw new Error("Use digits only.");
  if (digits.length === 13) return { kind: "nationalId", value: digits };
  if (/^0\d{9}$/.test(digits)) return { kind: "phone", value: digits };
  throw new Error("Enter a 10-digit mobile number starting with 0, or a 13-digit ID.");
}

/** Mobile numbers go in as 0066 plus the number without its leading 0 (13 characters). */
function targetField(target: PromptPayTarget): string {
  if (target.kind === "phone") return field("01", "0066" + target.value.slice(1));
  return field("02", target.value);
}

/**
 * Builds the payload string a QR code carries. With an amount the QR is
 * single-use style (point of initiation 12) and the banking app fills the
 * amount in; without one it is reusable (11) and the payer types it.
 */
export function buildPayload(target: PromptPayTarget, amountBaht?: number): string {
  const parts = [
    field("00", "01"),
    field("01", amountBaht === undefined ? "11" : "12"),
    field("29", field("00", PROMPTPAY_AID) + targetField(target)),
    field("53", "764"), // THB
  ];
  if (amountBaht !== undefined) {
    if (!Number.isFinite(amountBaht) || amountBaht <= 0) throw new Error("Amount must be above 0.");
    if (amountBaht > 9_999_999.99) throw new Error("Amount is too large.");
    parts.push(field("54", amountBaht.toFixed(2)));
  }
  parts.push(field("58", "TH"));
  const body = parts.join("") + "6304";
  return body + crc16(body);
}
