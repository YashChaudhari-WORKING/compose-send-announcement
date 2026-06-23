import type { DB } from "./db.js";
import type { Deliver } from "./deliver.js";
import type { Contact, SendRequest, SendResult, SkipReason } from "../shared/types.js";

/**
 * A validation/conflict error the HTTP layer maps to a status code. Business rules throw these;
 * the route turns them into 400 / 409 responses. Everything else is a real 500.
 */
export class SendError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SendError";
  }
}

interface Deps {
  db: DB;
  deliver: Deliver;
  getContact: (id: string) => Contact | undefined;
}

/**
 * Builds the send service. Dependencies are injected (db, deliver, getContact) so the same logic
 * runs in the app and in tests — tests pass an in-memory DB and a spy deliverer to count deliveries.
 *
 * Idempotency: one idempotencyKey per send; each recipient is a row under
 * UNIQUE(idempotency_key, contact_id), inserted with INSERT OR IGNORE. A repeat inserts nothing
 * (info.changes === 0), so the delivery — fired only for rows where info.changes === 1, and only
 * after commit — runs at most once per recipient. The database is the guarantee, not app logic.
 */
export function createSendService({ db, deliver, getContact }: Deps) {
  // Prepared once, reused for every request.
  //
  // INSERT OR IGNORE: if a row with the same UNIQUE(idempotency_key, contact_id) already exists,
  // SQLite skips THIS row without raising — and crucially does NOT increment info.changes for it.
  // That `info.changes === 1` signal is what lets us deliver exactly once. We never SELECT-then-
  // INSERT (that has a check-then-act race); the atomic insert itself IS the decision.
  const insertOne = db.prepare(`
    INSERT OR IGNORE INTO deliveries (idempotency_key, contact_id, subject, body)
    VALUES (@key, @contactId, @subject, @body)
  `);

  // Reject-only lookup for the content-divergence guard (see below). It never authorises a send,
  // so it introduces no race — it can only turn a request into a 409.
  const findExistingForKey = db.prepare(
    `SELECT subject, body FROM deliveries WHERE idempotency_key = ? LIMIT 1`
  );

  /**
   * The transaction. better-sqlite3 runs it synchronously and atomically; Node is single-threaded,
   * so two requests with the same key cannot interleave mid-transaction — they serialize, and the
   * second one inserts nothing. Returns only the contact ids that were genuinely inserted now.
   */
  const runSend = db.transaction(
    (key: string, subject: string, body: string, contactIds: string[]): string[] => {
      const newlyInserted: string[] = [];
      for (const contactId of contactIds) {
        const info = insertOne.run({ key, contactId, subject, body });
        if (info.changes === 1) newlyInserted.push(contactId); // 1 == a row was really written now
      }
      return newlyInserted;
    }
  );

  function send(req: SendRequest): SendResult {
    // 1. Validate the request shape. We never trust the client; bad input is a 400, not a send.
    if (!req.idempotencyKey) throw new SendError(400, "idempotencyKey is required");
    if (!req.subject?.trim()) throw new SendError(400, "subject is required");
    if (!req.body?.trim()) throw new SendError(400, "body is required");
    if (!Array.isArray(req.recipientIds) || req.recipientIds.length === 0) {
      throw new SendError(400, "at least one recipient is required");
    }

    // 2. De-duplicate the requested ids (a client could send the same id twice).
    const requestedIds = [...new Set(req.recipientIds)];

    // 3. Partition against our own contact data. Opt-in is re-checked HERE on the server — the
    //    client's list is a request, never the authority. Unknown ids and opted-out contacts are
    //    skipped and can never be delivered to, even if the client insists.
    const validIds: string[] = [];
    const skipped: Array<{ id: string; reason: SkipReason }> = [];
    for (const id of requestedIds) {
      const contact = getContact(id);
      if (!contact) skipped.push({ id, reason: "unknown" });
      else if (!contact.opt_in) skipped.push({ id, reason: "opted_out" });
      else validIds.push(id);
    }

    // 4. Content-divergence guard: if this key was already used to send DIFFERENT content, refuse.
    //    Idempotency means "the same send is safe to repeat" — it must not become a backdoor for
    //    sending new content under an old key. (Pure rejection; never authorises anything.)
    const existing = findExistingForKey.get(req.idempotencyKey) as
      | { subject: string; body: string }
      | undefined;
    if (existing && (existing.subject !== req.subject || existing.body !== req.body)) {
      throw new SendError(409, "idempotencyKey was already used with different content");
    }

    // 5. Atomically record deliveries. Replays insert nothing and return [].
    const newlyInserted = validIds.length > 0
      ? runSend(req.idempotencyKey, req.subject, req.body, validIds)
      : [];

    // 6. Fire the mock delivery AFTER commit, only for rows actually inserted on this call.
    //    Doing this outside the transaction means a rollback can never leave a recipient "sent"
    //    without a record — we persist the truth first, then act on it.
    for (const id of newlyInserted) {
      const contact = getContact(id)!; // guaranteed: it was in validIds
      deliver({ contactId: id, email: contact.email, subject: req.subject, body: req.body });
    }

    // 7. Report. delivered = sent now; alreadyDelivered = valid recipients this key had already
    //    reached (so a replay reads delivered:0, alreadyDelivered:6 — a success, not an error).
    return {
      delivered: newlyInserted.length,
      alreadyDelivered: validIds.length - newlyInserted.length,
      skipped,
    };
  }

  return { send };
}
