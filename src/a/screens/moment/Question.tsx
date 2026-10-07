/**
 * One question per frame. Tapping an answer fills the control, lets the
 * canvas react, then advances after a beat. The spine and the "n of 6"
 * line say where he is.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { OCCASIONS, SPEND, TIMES, VENUES, VIBES, type ChoiceOption } from "../../../shared/catalog";
import { useJourney, type Answers } from "../../lib/journeyContext";
import { canvasImage, occasionLabel, resolveLooks } from "../../lib/looks";
import { momentSpine, type MomentGroup } from "../../lib/spine";
import { ChoiceList, Count } from "../../ui/controls";
import { Frame } from "../../ui/Frame";
import { Stage } from "../../ui/Stage";

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
  occasion: { key: "occasion", group: "occasion", step: 1, question: () => "Where are you going?", options: () => OCCASIONS, next: "moment/venue", prev: "", requires: [] },
  venue: {
    key: "venue",
    group: "room",
    step: 2,
    question: () => "Where is it?",
    options: (a) => (a.occasion ? VENUES[a.occasion] : []),
    next: "moment/time",
    prev: "moment/occasion",
    requires: ["occasion"],
  },
  time: { key: "time", group: "room", step: 3, question: () => "Day or night?", options: () => TIMES, next: "moment/feel", prev: "moment/venue", requires: ["occasion", "venue"] },
  feel: { key: "vibe", group: "feel", step: 4, question: () => "How do you want to come across?", options: () => VIBES, next: "moment/spend", prev: "moment/time", requires: ["occasion", "venue", "time"] },
  spend: { key: "spend", group: "feel", step: 5, question: () => "What would you like to spend?", options: () => SPEND, next: "moment/you", prev: "moment/feel", requires: ["occasion", "venue", "time", "vibe"] },
};

const ADVANCE_MS = 260;

export function Question({ step }: { step: string }) {
  const def = STEPS[step];
  const { answers, href, go, ownedItem, reduced } = useJourney();
  const [pending, setPending] = useState<string | null>(null);

  const missing = def.requires.find((k) => !answers[k]);
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => go(def.next, { [def.key]: pending, hero: null }), reduced ? 0 : ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pending, def, go, reduced]);

  if (missing) return <Navigate to={href(`moment/${missing === "vibe" ? "feel" : missing}`)} replace />;

  const value = pending ?? answers[def.key];
  const preview: Answers = pending ? { ...answers, [def.key]: pending } : answers;
  const previewResolved = pending ? resolveLooks(preview, ownedItem) : resolved;
  const image = canvasImage(preview, previewResolved);

  return (
    <Stage
      spine={momentSpine(def.group, answers, href)}
      back={def.prev === "" ? href("") : href(def.prev)}
      canvas={<Frame image={image} alt={answers.occasion ? `${occasionLabel(answers.occasion)} look` : ""} night={preview.time === "NIGHT"} preview={OCCASIONS} reduced={reduced} />}
    >
      <h1 className="a-display">{def.question(answers)}</h1>
      <Count step={def.step} total={6} />
      <div className="mt-6">
        <ChoiceList label={def.question(answers)} options={def.options(answers)} value={value} onChange={(id) => setPending(id)} />
      </div>
    </Stage>
  );
}
