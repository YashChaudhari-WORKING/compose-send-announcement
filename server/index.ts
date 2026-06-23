import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createDb } from "./db.js";
import { createMockDeliver } from "./deliver.js";
import { createSendService, SendError } from "./sendService.js";
import { branding, contacts, getContact } from "./company.js";
import type { SendRequest } from "../shared/types.js";

const here = dirname(fileURLToPath(import.meta.url));

// File-backed DB so the idempotency record survives restarts (durable, not in-memory).
const db = createDb(join(here, "..", "app.db"));
const { deliver, sent } = createMockDeliver();
const sendService = createSendService({ db, deliver, getContact });

const app = express();
app.use(express.json());

// What the UI loads on start: branding for the preview + the contact list (so it can show who is
// excluded). The opt-in filtering shown here is also re-enforced server-side on every send.
app.get("/api/company", (_req, res) => {
  res.json({ branding, contacts });
});

// The send endpoint. The service is idempotent: triggering this twice with the same idempotencyKey
// delivers to each recipient at most once.
app.post("/api/send", (req, res) => {
  try {
    const result = sendService.send(req.body as SendRequest);
    res.json(result);
  } catch (err) {
    // Validation / conflict rules surface as typed errors -> 400 / 409. Anything else is a real 500.
    if (err instanceof SendError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  }
});

// Lets you SEE the guarantee: every durable delivery row, plus the mock-delivery log. After a
// double-send the count here does not move.
app.get("/api/deliveries", (_req, res) => {
  const rows = db
    .prepare(`SELECT idempotency_key, contact_id, subject, sent_at FROM deliveries ORDER BY id`)
    .all();
  res.json({ count: rows.length, rows, mockDeliveryLog: sent });
});

// In production we build the frontend to dist/ and serve it from THIS same server, so the deploy is
// a single process. That's not just convenient — it's what keeps idempotency correct: one process
// means one shared SQLite connection, so two requests can't race on separate instances. (In dev,
// dist/ doesn't exist and Vite serves the frontend instead.)
const distDir = join(here, "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-/api GET returns index.html.
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(distDir, "index.html")));
}

// Render (and most hosts) inject the port via PORT; fall back to 3001 locally.
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
