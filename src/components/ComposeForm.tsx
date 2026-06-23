interface Props {
  subject: string;
  body: string;
  disabled?: boolean;
  onChange: (next: { subject: string; body: string }) => void;
}

const fieldClass =
  "w-full rounded-lg border border-stone-300/80 bg-white px-3.5 py-2.5 text-sm text-stone-800 " +
  "placeholder:text-stone-400 transition-colors focus:border-stone-400 disabled:opacity-50";

const labelClass = "mb-1.5 block text-sm font-medium text-stone-700";

// The brief's minimum: a subject and a body. Deliberately a plain textarea — no rich-text editor.
// Plain text covers the real use case ("terrace is open"); formatting is scope we didn't need.
export function ComposeForm({ subject, body, disabled, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>Subject</span>
        <input
          type="text"
          className={fieldClass}
          value={subject}
          disabled={disabled}
          placeholder="Terrace is open"
          onChange={(e) => onChange({ subject: e.target.value, body })}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Message</span>
        <textarea
          className={`${fieldClass} min-h-36 resize-y leading-relaxed`}
          value={body}
          disabled={disabled}
          placeholder={"We're open on the back terrace from tonight —\ncome by for a glass."}
          onChange={(e) => onChange({ subject, body: e.target.value })}
        />
        <span className="mt-1.5 block text-xs text-stone-400">
          Plain text. Line breaks are preserved in the preview.
        </span>
      </label>
    </div>
  );
}
