import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db.js";
import { createSendService } from "./sendService.js";
import type { Contact } from "../shared/types.js";
import type { Delivery } from "./deliver.js";

// We test the two places where a bug actually causes harm: a double-send (someone gets the message
// twice) and an opt-out leak (someone who opted out gets it at all). Not coverage for its own sake.

// A small in-memory contact set: three opted in, one opted out.
const CONTACTS: Contact[] = [
  { id: "c_001", name: "Marie", email: "marie@example", locale: "fr-BE", opt_in: true },
  { id: "c_002", name: "Tom", email: "tom@example", locale: "nl-BE", opt_in: true },
  { id: "c_004", name: "Lukas", email: "lukas@example", locale: "nl-BE", opt_in: true },
  { id: "c_003", name: "Sofia", email: "sofia@example", locale: "en-GB", opt_in: false },
];

function setup() {
  const db: DB = createDb(":memory:"); // fresh DB per test -> no cross-test state
  const getContact = (id: string) => CONTACTS.find((c) => c.id === id);
  const sent: Delivery[] = [];
  const deliver = (d: Delivery) => sent.push(d); // spy: counts REAL deliveries
  const service = createSendService({ db, deliver, getContact });
  return { db, service, sent };
}

const countRows = (db: DB) =>
  (db.prepare(`SELECT COUNT(*) AS c FROM deliveries`).get() as { c: number }).c;

describe("idempotent send", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("delivers each recipient at most once when the same send is triggered twice", () => {
    const { db, service, sent } = ctx;
    const payload = {
      idempotencyKey: "key-1",
      subject: "Terrace is open",
      body: "We are open on the back terrace from tonight.",
      recipientIds: ["c_001", "c_002", "c_004"], // 3 opted-in recipients
    };

    const first = service.send(payload);
    expect(first.delivered).toBe(3);
    expect(sent).toHaveLength(3);
    expect(countRows(db)).toBe(3);

    // Exact replay — a double-click, a retry, a replayed request.
    const second = service.send(payload);
    expect(second.delivered).toBe(0); // nobody delivered to again
    expect(second.alreadyDelivered).toBe(3);
    expect(sent).toHaveLength(3); // STILL 3, not 6 — the assertion that matters
    expect(countRows(db)).toBe(3); // STILL 3 durable rows
  });

  it("holds even when two identical sends race in parallel", async () => {
    const { db, service, sent } = ctx;
    const payload = {
      idempotencyKey: "key-2",
      subject: "Closed Monday",
      body: "We are closed this Monday for a private event.",
      recipientIds: ["c_001", "c_002"],
    };

    // better-sqlite3 is synchronous, so these resolve on a single thread and serialize. Mirrors
    // the brief's "we will try to trigger it twice".
    await Promise.all([
      Promise.resolve().then(() => service.send(payload)),
      Promise.resolve().then(() => service.send(payload)),
    ]);

    expect(sent).toHaveLength(2); // 2 recipients, delivered once each — never 4
    expect(countRows(db)).toBe(2);
  });

  it("never delivers to an opted-out contact, even if the client includes their id", () => {
    const { db, service, sent } = ctx;

    const result = service.send({
      idempotencyKey: "key-3",
      subject: "Truffle week",
      body: "Truffle week starts Monday.",
      recipientIds: ["c_001", "c_003"], // client tries to include the opted-out contact c_003
    });

    expect(result.delivered).toBe(1); // only the opted-in contact
    expect(sent.map((d) => d.contactId)).toEqual(["c_001"]);
    expect(sent.map((d) => d.contactId)).not.toContain("c_003");
    expect(result.skipped).toEqual([{ id: "c_003", reason: "opted_out" }]);
    // And crucially: NO durable row was written for the opted-out contact.
    expect(countRows(db)).toBe(1);
  });
});
