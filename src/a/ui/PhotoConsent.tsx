/**
 * Before any photo is taken or chosen: why it is needed, how it is used, whether it leaves the
 * device, how long it is kept and how to delete it, read from the photo's policy in
 * src/core/images.ts so the words always match what the app does. Agreeing is recorded against the
 * current wording; a sample never needs it.
 */
import { track } from "../../core/analytics";
import { checkFile, checkQuality, disclosure, grantConsent, PROBLEM_COPY, type ImageCategory, type ImageProblem } from "../../core/images";
import { imageStats } from "../lib/image";
import { PrimaryButton, TextButton } from "./controls";

interface Props {
  category: ImageCategory;
  onAgree: () => void;
  onDecline: () => void;
  declineLabel: string;
}

export function PhotoConsent({ category, onAgree, onDecline, declineLabel }: Props) {
  const d = disclosure(category);
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[40ch] leading-6">{d.why}</p>
      <dl className="a-facts max-w-[44ch] text-[15px] leading-6">
        <dt className="a-label text-[var(--muted)]">How I use it</dt>
        <dd>{d.use}</dd>
        <dt className="a-label text-[var(--muted)]">Where it goes</dt>
        <dd>{d.leaves}</dd>
        <dt className="a-label text-[var(--muted)]">How long</dt>
        <dd>
          {d.kept} {d.deletion}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton
          onClick={() => {
            grantConsent(category);
            track("photo_consent_given", { category });
            onAgree();
          }}
        >
          I agree
        </PrimaryButton>
        <TextButton onClick={onDecline}>{declineLabel}</TextButton>
      </div>
    </div>
  );
}

/** Checks a file before reading it; records a refusal by its reason only. */
export function rejectFile(file: File, category: ImageCategory): ImageProblem | null {
  const problem = checkFile(file, category);
  if (problem) track("photo_rejected", { category, problem });
  return problem;
}

/** Checks a read photo for size and light; records a refusal by its reason only. */
export async function rejectImage(dataUrl: string, category: ImageCategory): Promise<ImageProblem | null> {
  const problem = checkQuality(await imageStats(dataUrl), category);
  if (problem) track("photo_rejected", { category, problem });
  return problem;
}

/** What went wrong with a photo. The colour wording is for the face photo; other kinds get their own. */
export function problemText(problem: ImageProblem, category: ImageCategory = "face_colour"): string {
  if (category === "try_on" && problem === "too_dark") return "That photo is too dark for me to see you clearly. Try again in good light.";
  if (category === "try_on" && problem === "too_bright") return "That photo is too bright for me to see you clearly. Try again out of direct sun.";
  return PROBLEM_COPY[problem];
}
