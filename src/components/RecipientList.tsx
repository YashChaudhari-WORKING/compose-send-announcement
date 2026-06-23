import type { Contact } from "../../shared/types";

interface Props {
  contacts: Contact[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  brandColor: string;
}

// One contact in the fixture has no name. Everywhere we show a name, we fall back to the email —
// never "undefined", never a crash.
const displayName = (c: Contact) => c.name ?? c.email;

// Initials for the avatar: from the name if present, otherwise the first letter of the email.
function initials(c: Contact): string {
  if (c.name) {
    const parts = c.name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return c.email[0].toUpperCase();
}

/**
 * Shows who can receive the announcement. Opted-in contacts are selectable; opted-out contacts are
 * listed but disabled and clearly marked — we surface consent rather than hiding it. (The server
 * re-enforces opt-in regardless of what the UI sends.)
 */
export function RecipientList({ contacts, selectedIds, onToggle, onToggleAll, brandColor }: Props) {
  const optedIn = contacts.filter((c) => c.opt_in);
  const optedOut = contacts.filter((c) => !c.opt_in);
  const allSelected = optedIn.every((c) => selectedIds.has(c.id));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">{selectedIds.size}</span> of {optedIn.length}{" "}
          opted-in selected
        </p>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="space-y-1">
        {optedIn.map((c) => {
          const checked = selectedIds.has(c.id);
          return (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
              style={{
                borderColor: checked ? `${brandColor}33` : "transparent",
                background: checked ? `${brandColor}0d` : "transparent",
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: brandColor }}
              >
                {initials(c)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-800">
                  {displayName(c)}
                </span>
                <span className="block truncate text-xs text-stone-400">{c.email}</span>
              </span>
              <input
                type="checkbox"
                className="size-4 shrink-0"
                style={{ accentColor: brandColor }}
                checked={checked}
                onChange={() => onToggle(c.id)}
              />
            </label>
          );
        })}
      </div>

      {optedOut.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
            Excluded · not opted in
          </p>
          <div className="space-y-1">
            {optedOut.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-1.5 opacity-60">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-500">
                  {initials(c)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-600">
                  {displayName(c)}
                </span>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  opted out
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
