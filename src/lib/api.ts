import type { CompanyResponse, SendResult, SendRequest } from "../../shared/types";

// Idempotency key.
// Minted ONCE, here, when this module first loads (i.e. on page load) — before any button exists
// to click. Every send from this compose session carries the SAME key, so a double-click or a
// retried request is recognised by the server as the same send. Composing a fresh announcement
// calls resetIdempotencyKey() to start a genuinely new send.
let idempotencyKey = crypto.randomUUID();
export const getIdempotencyKey = () => idempotencyKey;
export const resetIdempotencyKey = () => {
  idempotencyKey = crypto.randomUUID();
};

export async function getCompany(): Promise<CompanyResponse> {
  const res = await fetch("/api/company");
  if (!res.ok) throw new Error("Failed to load company data");
  return res.json();
}

export async function sendAnnouncement(
  input: Omit<SendRequest, "idempotencyKey">
): Promise<SendResult> {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The current session key is attached here, not chosen by the caller.
    body: JSON.stringify({ ...input, idempotencyKey } satisfies SendRequest),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Send failed");
  return data as SendResult;
}
