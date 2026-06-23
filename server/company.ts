import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Branding, Contact } from "../shared/types.js";

// Resolve data/company.json relative to this file, so it works regardless of cwd.
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "..", "data", "company.json");

// The fixture is read-only reference data. We load it ONCE at startup into memory — it is never
// written, so it does not belong in the database. `deliveries` is the only mutable state we own.
const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));

const b = raw.company.branding;
export const branding: Branding = {
  name: raw.company.name,
  tagline: raw.company.tagline,
  email: raw.company.contact.email,
  logo_wordmark_url: b.logo_wordmark_url,
  primary_color: b.primary_color,
  secondary_color: b.secondary_color,
  accent_color: b.accent_color,
  font_heading: b.font_heading,
  font_body: b.font_body,
};

export const contacts: Contact[] = raw.contacts as Contact[];

// Indexed for O(1) server-side lookup during send validation. The server validates opt-in against
// THIS map — it never trusts the recipient list the client sends.
const byId = new Map<string, Contact>(contacts.map((c) => [c.id, c]));

export function getContact(id: string): Contact | undefined {
  return byId.get(id);
}
