/**
 * One question per frame. Tapping an answer fills the control, lets the
 * canvas react, then advances after a beat. The spine says where they are.
 * The occasion is chosen on home, so the count covers the four questions that
 * follow it: Step 1 of 4 is the place. After an answer the journey goes to the
 * first question still unanswered, or straight to the looks once all are in, so
 * changing one answer never means repeating the others.
 */
import { useEffect, useRef, useState } from "react";
import { track } from "../../../core/analytics";
import { Navigate } from "react-router-dom";
import { OCCASIONS, SPEND, VENUES, VIBES, timesFor, type ChoiceOption, type OccasionId } from "../../../shared/catalog";
import { useJourney, type Answers } from "../../lib/journeyContext";
import { canvasImage, occasionLabel } from "../../lib/looks";
import { firstMissing, momentSpine, type MomentGroup } from "../../lib/spine";
import { ChoiceList, Count } from "../../ui/controls";
import { Frame } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";
import { PhoneSpine } from "../../ui/TopBar";

type QuestionKey = "occasion" | "venue" | "time" | "vibe" | "spend";

interface StepDef {
  key: QuestionKey;
  group: MomentGroup;
  step: number;
  question: (a: Answers) => string;
  options: (a: Answers) => readonly ChoiceOption[];
  next: string;
  prev: string;
  /** Answers this step needs before it can be shown. */
  requires: QuestionKey[];
}

const STEPS: Record<string, StepDef> = {
  occasion: { key: "occasion", group: "occasion", step: 0, question: () => "Where are you going?", options: () => OCCASIONS, next: "moment/venue", prev: "", requires: [] },
  venue: {
    key: "venue",
    group: "venue",
    step: 1,
    question: () => "Where is it?",
    options: (a) => (a.occasion ? VENUES[a.occasion] : []),
    next: "moment/time",
    prev: "",
    requires: ["occasion"],
  },
  time: { key: "time", group: "time", step: 2, question: (a) => (a.occasion === "WORK" ? "Day or night?" : "What time of day?"), options: (a) => timesFor(a.occasion), next: "moment/feel", prev: "moment/venue", requires: ["occasion", "venue"] },
  feel: { key: "vibe", group: "feel", step: 3, question: () => "How do you want to come across?", options: () => VIBES, next: "moment/spend", prev: "moment/time", requires: ["occasion", "venue", "time"] },
  spend: { key: "spend", group: "spend", step: 4, question: () => "What’s your budget for the whole look?", options: () => SPEND, next: "moment/build", prev: "moment/feel", requires: ["occasion", "venue", "time", "vibe"] },
};

const ADVANCE_MS = 260;
/** Place, time of day, feel, spend. The occasion comes first and is not counted. */
export const MOMENT_STEPS = 4;

export function Question({ step }: { step: string }) {
  const def = STEPS[step];
  const { answers, params, href, go, reduced } = useJourney();
  /* Sent here from the results to change one answer: go straight back to the looks after it. */
  const restyle = params.get("restyle") !== null;
  const [pending, setPending] = useState<string | null>(null);

  const missing = def.requires.find((k) => !answers[k]);

  /* Leaving the page (closing the tab, going elsewhere) on an unanswered question counts as dropping off there. */
  const answered = useRef(false);
  useEffect(() => {
    answered.current = false;
    const onHide = () => {
      if (!answered.current && !missing) track("step_abandoned", { question: def.key });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [def.key, missing]);

  const choose = (id: string) => {
    answered.current = true;
    setPending(id);
    track("question_answered", { question: def.key, answer: id, step: def.step, restyle });
    if (def.key === "occasion") track("occasion_selected", { occasion: id as OccasionId, surface: "question" });
    if (restyle) track("restyle_changed", { field: def.key });
  };

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      const next = firstMissing({ ...answers, [def.key]: pending });
      if (next) go(next, { [def.key]: pending, hero: null });
      else go("moment/build", { [def.key]: pending, hero: null, restyle: null });
    }, reduced ? 0 : ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pending, def, go, reduced, answers]);

  if (missing) return <Navigate to={href(`moment/${missing === "vibe" ? "feel" : missing}`)} replace />;

  const value = pending ?? answers[def.key];
  const preview: Answers = pending ? { ...answers, [def.key]: pending } : answers;
  const image = canvasImage(preview);

  const spine = momentSpine(def.group, answers, href);
  return (
    <Stage
      spine={spine}
      back={restyle ? href("moment/results", { restyle: null }) : def.prev === "" ? href("") : href(def.prev)}
      canvas={<Frame image={image} alt={answers.occasion ? `${occasionLabel(answers.occasion)} look` : ""} night={preview.time === "NIGHT"} golden={preview.time === "SUNRISE" || preview.time === "SUNSET" ? preview.time : null} preview={OCCASIONS} reduced={reduced} />}
    >
      <PhoneSpine steps={spine} />
      {restyle ? <p className="a-label mb-3 text-[var(--muted)]">Restyle</p> : def.step > 0 ? <Count step={def.step} total={MOMENT_STEPS} /> : null}
      <h1 className="a-display">{def.question(answers)}</h1>
      <div className="mt-8">
        <ChoiceList label={def.question(answers)} options={def.options(answers)} value={value} onChange={choose} />
      </div>
    </Stage>
  );
}
