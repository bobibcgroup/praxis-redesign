/** Progress spine definitions for the moment and DNA journeys. */
import type { Answers } from "./journeyContext";
import type { SpineStep } from "../ui/TopBar";

export type MomentGroup = "occasion" | "venue" | "time" | "feel" | "spend" | "looks";

/** Every answer the looks depend on, in the order they are asked, then the looks. */
const MOMENT_ORDER: readonly { id: MomentGroup; label: string; path: string; answer: keyof Answers | null }[] = [
  { id: "occasion", label: "Occasion", path: "", answer: "occasion" },
  { id: "venue", label: "Place", path: "moment/venue", answer: "venue" },
  { id: "time", label: "Time", path: "moment/time", answer: "time" },
  { id: "feel", label: "Feel", path: "moment/feel", answer: "vibe" },
  { id: "spend", label: "Budget", path: "moment/spend", answer: "spend" },
  { id: "looks", label: "Looks", path: "moment/results", answer: null },
];

/** The first unanswered question after the occasion, or null once every answer is in. */
export function firstMissing(answers: Answers): string | null {
  const step = MOMENT_ORDER.find((g) => g.answer && !answers[g.answer]);
  return step ? step.path : null;
}

/**
 * Any answered step can be opened from any other, backwards or forwards, with every answer kept.
 * A step is reachable once everything before it is answered; the looks once every answer is in.
 */
export function momentSpine(current: MomentGroup, answers: Answers, href: (p: string, patch?: Record<string, string | null>) => string): SpineStep[] {
  return MOMENT_ORDER.map((g, i) => {
    const before = MOMENT_ORDER.slice(0, i).every((p) => !p.answer || Boolean(answers[p.answer]));
    const answered = g.answer ? Boolean(answers[g.answer]) : before;
    const state: SpineStep["state"] = g.id === current ? "current" : answered && before ? "done" : "todo";
    return { label: g.label, to: state === "done" ? href(g.path, { restyle: null }) : null, state };
  });
}

export type DnaGroup = "face" | "fit" | "life" | "taste" | "dna";

const DNA_ORDER: readonly { id: DnaGroup; label: string; path: string }[] = [
  { id: "face", label: "Photo", path: "dna/face" },
  { id: "fit", label: "Fit", path: "dna/fit" },
  { id: "life", label: "Week", path: "dna/lifestyle" },
  { id: "taste", label: "Taste", path: "dna/inspiration" },
  { id: "dna", label: "Style DNA", path: "dna/result" },
];

export function dnaSpine(current: DnaGroup, href: (p: string) => string): SpineStep[] {
  const idx = DNA_ORDER.findIndex((g) => g.id === current);
  return DNA_ORDER.map((g, i) => {
    const state: SpineStep["state"] = i === idx ? "current" : i < idx ? "done" : "todo";
    return { label: g.label, to: state === "done" ? href(g.path) : null, state };
  });
}
