/** Mode control: a two-option radiogroup for the Style DNA page. */
import type { ModeId } from "../lib/mode";

interface Props {
  mode: ModeId;
  onMode: (m: ModeId) => void;
}

export function ModeRadio({ mode, onMode }: Props) {
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex gap-2">
      {(["light", "dark"] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className="a-control" onClick={() => onMode(m)}>
          {m === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
