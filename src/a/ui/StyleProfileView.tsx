/**
 * The Style DNA as the customer reads and changes it. Each part says whether it is an estimate, the
 * customer's own answer, or their correction; the colours follow whatever wins. "Not quite right?"
 * opens the editor, where any part can be changed, a correction dropped, or the photo retaken.
 */
import { track } from "../../core/analytics";
import {
  basisOf,
  clearCorrection,
  colourGuide,
  CONTRAST_LABEL,
  correct,
  UNDERTONE_LABEL,
  valueOf,
  type Attribute,
  type Contrast,
  type EditableField,
  type StyleProfile,
  type Undertone,
} from "../../core/styleProfile";
import { FITS, LIFESTYLES } from "../../shared/catalog";
import { TextButton } from "./controls";
import { Sheet } from "./Sheet";

const BASIS_LABEL = { inferred: "Estimate", confirmed: "Confirmed", corrected: "Your correction" } as const;
const FIT_LABEL = Object.fromEntries(FITS.map((f) => [f.id, f.label])) as Record<string, string>;
const WEEK_LABEL = Object.fromEntries(LIFESTYLES.map((l) => [l.id, l.label])) as Record<string, string>;

function Row<T extends string>({ name, attr, labels }: { name: string; attr: Attribute<T>; labels: Record<string, string> }) {
  const value = valueOf(attr);
  const basis = basisOf(attr);
  const label = basis === "inferred" && attr.inferred?.source === "sample" ? "Example" : basis ? BASIS_LABEL[basis] : null;
  return (
    <div>
      <span>
        <span className="a-label block text-[var(--muted)]">{name}</span>
        <span className="mt-1 block text-[17px] leading-6">{value ? labels[value] : "Not set"}</span>
      </span>
      {label ? <span className="a-basis">{label}</span> : null}
    </div>
  );
}

function Swatches({ hexes, label }: { hexes: string[]; label: string }) {
  return (
    <div>
      <p className="mb-2 text-[13px] text-[var(--muted)]">{label}</p>
      <ul className="flex gap-2" aria-label={label}>
        {hexes.map((hex) => (
          <li key={hex} className="a-swatch h-8 w-8" style={{ background: hex }} title={hex} />
        ))}
      </ul>
    </div>
  );
}

/** Whether the colours are the fixed example from the sample portrait (or test mode), not a reading. */
export function isSampleEstimate(p: StyleProfile): boolean {
  return p.undertone.inferred?.source === "sample" || p.contrast.inferred?.source === "sample";
}

export function StyleProfileView({ profile }: { profile: StyleProfile }) {
  const undertone = valueOf(profile.undertone);
  const contrast = valueOf(profile.contrast);
  const guide = colourGuide(undertone, contrast);
  return (
    <div className="flex flex-col gap-6">
      {guide ? (
        <div className="flex flex-col gap-4">
          <p className="max-w-[40ch] leading-6">{guide.line}</p>
          <Swatches hexes={guide.palette} label="Colours to start with" />
          <Swatches hexes={guide.avoid} label="Use these less" />
        </div>
      ) : (
        <p className="max-w-[40ch] leading-6 text-[var(--muted)]">No colours yet. Add a photo, or tell me your undertone, and I’ll suggest some.</p>
      )}
      <div className="a-profile">
        <Row name="Undertone" attr={profile.undertone} labels={UNDERTONE_LABEL} />
        <Row name="Contrast" attr={profile.contrast} labels={CONTRAST_LABEL} />
        <Row name="Fit" attr={profile.fit} labels={FIT_LABEL} />
        <Row name="Your lifestyle" attr={profile.week} labels={WEEK_LABEL} />
      </div>
    </div>
  );
}

const UNDERTONES: { id: Undertone; label: string }[] = (Object.keys(UNDERTONE_LABEL) as Undertone[]).map((id) => ({ id, label: UNDERTONE_LABEL[id] }));
const CONTRASTS: { id: Contrast; label: string }[] = (Object.keys(CONTRAST_LABEL) as Contrast[]).map((id) => ({ id, label: CONTRAST_LABEL[id] }));

function Choice<T extends string>({ name, field, profile, options, onChange }: { name: string; field: EditableField; profile: StyleProfile; options: readonly { id: T; label: string }[]; onChange: (p: StyleProfile) => void }) {
  const attr = profile[field] as Attribute<T>;
  const current = valueOf(attr);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="a-label text-[var(--muted)]">{name}</legend>
      <div className="a-chips mt-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="a-chip"
            aria-pressed={current === o.id}
            onClick={() => {
              if (current === o.id) return;
              onChange(correct(profile, field, o.id as never));
              track("style_dna_corrected", { field });
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {attr.corrected && attr.inferred ? (
        <TextButton className="self-start" onClick={() => onChange(clearCorrection(profile, field))}>
          Go back to {attr.inferred.source === "sample" ? "the example" : "my estimate"} ({(UNDERTONE_LABEL as Record<string, string>)[attr.inferred.value] ?? (CONTRAST_LABEL as Record<string, string>)[attr.inferred.value]})
        </TextButton>
      ) : null}
    </fieldset>
  );
}

interface EditorProps {
  open: boolean;
  onClose: () => void;
  profile: StyleProfile;
  onChange: (p: StyleProfile) => void;
  onRetake: () => void;
}

export function StyleProfileEditor({ open, onClose, profile, onChange, onRetake }: EditorProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Change your Style DNA"
      footer={
        <TextButton onClick={onRetake} className="self-start">
          Retake the photo
        </TextButton>
      }
    >
      <div className="flex flex-col gap-8 pb-4">
        <p className="max-w-[40ch] leading-6 text-[var(--muted)]">Change anything that isn’t you. Your changes stay, even if you retake the photo.</p>
        <Choice name="Undertone" field="undertone" profile={profile} options={UNDERTONES} onChange={onChange} />
        <Choice name="Contrast" field="contrast" profile={profile} options={CONTRASTS} onChange={onChange} />
        <Choice name="Fit" field="fit" profile={profile} options={FITS} onChange={onChange} />
        <Choice name="Your lifestyle" field="week" profile={profile} options={LIFESTYLES} onChange={onChange} />
      </div>
    </Sheet>
  );
}
