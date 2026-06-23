/**
 * The "send" side-effect is MOCKED — we never wire up real email (per the brief).
 *
 * A Deliver is a single side-effect: hand off one announcement to one recipient. The send service
 * calls it ONLY for recipients whose delivery row was actually inserted on this request, and only
 * AFTER the transaction commits — so it fires exactly once per recipient per send, ever.
 *
 * It is injected (not imported) into the send service so tests can pass a spy and assert how many
 * real deliveries happened — which is how we prove "at most once" under a double-trigger.
 */
export interface Delivery {
  contactId: string;
  email: string;
  subject: string;
  body: string;
}

export type Deliver = (delivery: Delivery) => void;

/** Creates a mock deliverer that logs to the console and keeps an in-memory record of every send. */
export function createMockDeliver(): { deliver: Deliver; sent: Delivery[] } {
  const sent: Delivery[] = [];
  const deliver: Deliver = (delivery) => {
    sent.push(delivery);
    // eslint-disable-next-line no-console
    console.log(`[deliver] -> ${delivery.email}  "${delivery.subject}"`);
  };
  return { deliver, sent };
}
