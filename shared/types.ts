// Types shared by the frontend and the backend — the single source of truth for the API contract.
// Keeping these in one place means a change to the wire format is a compile error on both sides.

/** A contact from the fixture. `name` is intentionally nullable — one fixture row has no name. */
export interface Contact {
  id: string;
  name: string | null;
  email: string;
  locale: string | null;
  opt_in: boolean;
}

/** The branding subset of the fixture we actually use for the preview. */
export interface Branding {
  name: string;
  tagline: string;
  email: string;
  logo_wordmark_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
}

/** Payload the UI loads on start: who we can send to + how to brand the preview. */
export interface CompanyResponse {
  branding: Branding;
  contacts: Contact[];
}

/** The request body for a send. `idempotencyKey` is minted once on page load. */
export interface SendRequest {
  idempotencyKey: string;
  subject: string;
  body: string;
  recipientIds: string[];
}

/** Why a requested recipient was not delivered to. */
export type SkipReason = "opted_out" | "unknown";

/**
 * The result of a send. `delivered` counts recipients delivered to *on this call*.
 * A replay (same idempotencyKey) returns delivered: 0 with alreadyDelivered > 0 — a success, not
 * an error. `skipped` lists recipients the server refused (opted out / unknown id).
 */
export interface SendResult {
  delivered: number;
  alreadyDelivered: number;
  skipped: Array<{ id: string; reason: SkipReason }>;
}
