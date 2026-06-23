import type { Branding } from "../../shared/types";

interface Props {
  branding: Branding;
  subject: string;
  body: string;
  recipientCount: number;
}

/**
 * Renders the announcement the way a recipient actually receives it: an email, with From / To /
 * Subject metadata, then the message body in the company's OWN branding from the fixture.
 *
 * Note the split: Tailwind classes handle *structure* (layout, spacing, rounding) — but the brand
 * colours and fonts are runtime data from the fixture, so they're applied as inline styles. You
 * cannot express `#7A1F1F` as a compile-time Tailwind class; this is the correct way to theme from
 * data. The intent is restraint: one clean email, no decoration.
 */
export function Preview({ branding, subject, body, recipientCount }: Props) {
  const headingFont = `"${branding.font_heading}", Georgia, serif`;
  const bodyFont = `"${branding.font_body}", Inter, sans-serif`;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70"
      style={{ borderColor: `${branding.primary_color}22` }}
    >
      {/* Mail metadata — makes it read as a real inbox preview, not just a card. */}
      <dl className="space-y-1 border-b border-stone-100 bg-stone-50/60 px-5 py-3.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-stone-400">From</dt>
          <dd className="truncate text-stone-600">
            {branding.name} <span className="text-stone-400">&lt;{branding.email}&gt;</span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-stone-400">To</dt>
          <dd className="text-stone-600">
            {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-stone-400">Subject</dt>
          <dd className="truncate font-medium text-stone-700">
            {subject.trim() || <span className="font-normal text-stone-400">(no subject)</span>}
          </dd>
        </div>
      </dl>

      {/* Brand band — primary colour, with the company wordmark. */}
      <div className="px-6 py-5 text-center" style={{ background: branding.primary_color }}>
        <img
          src={branding.logo_wordmark_url}
          alt={branding.name}
          className="mx-auto h-10 max-w-full object-contain"
        />
      </div>

      {/* Message body — secondary (cream) colour. */}
      <div className="px-7 pb-8 pt-7" style={{ background: branding.secondary_color }}>
        <h3
          className="text-[22px] leading-tight"
          style={{ fontFamily: headingFont, color: branding.primary_color }}
        >
          {subject.trim() || <span className="opacity-45">Your subject will appear here</span>}
        </h3>

        <div
          className="my-4 h-0.75 w-11 rounded-sm"
          style={{ background: branding.accent_color }}
        />

        <div
          className="whitespace-pre-wrap text-[15px] leading-relaxed"
          style={{ fontFamily: bodyFont, color: "#3a322f" }}
        >
          {body.trim() || <span className="opacity-45">Your message will appear here…</span>}
        </div>
      </div>

      {/* Footer — restaurant identity, quietly. */}
      <div
        className="px-6 py-3.5 text-xs"
        style={{
          fontFamily: bodyFont,
          color: "#9b938f",
          borderTop: `1px solid ${branding.primary_color}14`,
        }}
      >
        {branding.name} · {branding.tagline}
      </div>
    </div>
  );
}
