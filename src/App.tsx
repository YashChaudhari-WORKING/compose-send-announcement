import { useEffect, useMemo, useState } from "react";
import type { CompanyResponse, SendResult } from "../shared/types";
import { getCompany, sendAnnouncement, resetIdempotencyKey } from "./lib/api";
import { ComposeForm } from "./components/ComposeForm";
import { RecipientList } from "./components/RecipientList";
import { Preview } from "./components/Preview";

const panelClass = "rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm";
const panelTitleClass = "mb-4 text-xs font-semibold uppercase tracking-wider text-stone-400";

export default function App() {
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientsOpen, setRecipientsOpen] = useState(true);

  const optedInIds = (data: CompanyResponse) =>
    new Set(data.contacts.filter((c) => c.opt_in).map((c) => c.id));

  // Load branding + contacts once, and pre-select every opted-in contact.
  useEffect(() => {
    getCompany()
      .then((data) => {
        setCompany(data);
        setSelectedIds(optedInIds(data));
      })
      .catch((e) => setError(e.message));
  }, []);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (!company) return;
    const all = optedInIds(company);
    setSelectedIds((prev) => (prev.size >= all.size ? new Set() : all));
  };

  const canSend = useMemo(
    () => subject.trim() !== "" && body.trim() !== "" && selectedIds.size > 0 && !sending,
    [subject, body, selectedIds, sending]
  );

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      // The same session idempotencyKey is attached inside the api layer, so clicking this twice
      // (or a retry) is safe: the server delivers to each recipient at most once.
      const r = await sendAnnouncement({ subject, body, recipientIds: [...selectedIds] });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function composeAnother() {
    resetIdempotencyKey(); // a genuinely new send gets a fresh key
    setSubject("");
    setBody("");
    setResult(null);
    setError(null);
    if (company) setSelectedIds(optedInIds(company));
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-stone-500">
        {error ? `Error: ${error}` : "Loading…"}
      </div>
    );
  }

  const brand = company.branding.primary_color;

  return (
    <div className="min-h-screen">
      {/* Header — a real brand lockup: the company's own wordmark, then the tool's name. */}
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-[#faf7f2]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3.5">
          <img
            src={company.branding.logo_wordmark_url}
            alt={company.branding.name}
            className="h-7 rounded"
          />
          <span className="text-stone-300">/</span>
          <span className="font-serif text-[15px] text-stone-600">Announcements</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-7">
          <h1 className="font-serif text-2xl text-stone-800">Compose an announcement</h1>
          <p className="mt-1 text-sm text-stone-500">
            Write it, preview it in your branding, and send it to your opted-in audience.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2">
          {/* Left: compose + recipients + send */}
          <div className="space-y-5">
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Compose</h2>
              <ComposeForm
                subject={subject}
                body={body}
                disabled={sending}
                onChange={({ subject, body }) => {
                  setSubject(subject);
                  setBody(body);
                }}
              />
            </section>

            <section className={panelClass}>
              <button
                type="button"
                onClick={() => setRecipientsOpen((o) => !o)}
                className="flex w-full items-center justify-between"
                aria-expanded={recipientsOpen}
              >
                <h2 className={`${panelTitleClass} mb-0`}>Recipients</h2>
                <span className="flex items-center gap-2 text-sm text-stone-500">
                  {selectedIds.size} selected
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${recipientsOpen ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>
              {recipientsOpen && (
                <div className="mt-4">
                  <RecipientList
                    contacts={company.contacts}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                    brandColor={brand}
                  />
                </div>
              )}
            </section>

            <section className={panelClass}>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: brand }}
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  {sending
                    ? "Sending…"
                    : `Send to ${selectedIds.size} recipient${selectedIds.size === 1 ? "" : "s"}`}
                </button>
                {result && (
                  <button
                    className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                    onClick={composeAnother}
                  >
                    Compose another
                  </button>
                )}
              </div>

              {/* Result — written so a second click visibly delivers 0 (idempotency, on screen). */}
              {result && (
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
                  {result.delivered > 0 ? (
                    <p>
                      <span className="font-semibold text-stone-800">
                        ✓ Delivered to {result.delivered} recipient
                        {result.delivered === 1 ? "" : "s"}.
                      </span>{" "}
                      {result.alreadyDelivered > 0 && (
                        <span className="text-stone-500">
                          ({result.alreadyDelivered} already had it.)
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      <span className="font-semibold text-stone-800">
                        Already delivered to {result.alreadyDelivered} recipient
                        {result.alreadyDelivered === 1 ? "" : "s"}.
                      </span>{" "}
                      <span className="text-stone-500">
                        Nothing was sent again — this send is idempotent.
                      </span>
                    </p>
                  )}
                  {result.skipped.length > 0 && (
                    <p className="mt-1 text-stone-500">
                      {result.skipped.length} skipped (not opted in or unknown).
                    </p>
                  )}
                </div>
              )}
              {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            </section>
          </div>

          {/* Right: live branded preview, sticky so it stays in view while composing */}
          <div className="lg:sticky lg:top-20">
            <section className={panelClass}>
              <h2 className={panelTitleClass}>Preview</h2>
              <Preview
                branding={company.branding}
                subject={subject}
                body={body}
                recipientCount={selectedIds.size}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
