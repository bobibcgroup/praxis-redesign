/** Progress spine definitions for the moment and DNA journeys. */
import type { Answers } from "./journeyContext";
import type { SpineStep } from "../ui/TopBar";

export type MomentGroup = "occasion" | "room" | "feel" | "you" | "looks";

const MOMENT_ORDER: readonly { id: MomentGroup; label: string; path: string }[] = [
  { id: "occasion", label: "Occasion", path: "moment/occasion" },
  { id: "room", label: "Room", path: "moment/venue" },
  { id: "feel", label: "Feel", path: "moment/feel" },
  { id: "you", label: "You", path: "moment/you" },
  { id: "looks", label: "Looks", path: "moment/results" },
];

export function momentSpine(current: MomentGroup, answers: Answers, href: (p: string) => string): SpineStep[] {
  const idx = MOMENT_ORDER.findIndex((g) => g.id === current);
  return MOMENT_ORDER.map((g, i) => {
    const answered =
      g.id === "occasion"
        ? Boolean(answers.occasion)
        : g.id === "room"
          ? Boolean(answers.venue && answers.time)
          : g.id === "feel"
            ? Boolean(answers.vibe && answers.spend)
            : g.id === "you"
              ? i < idx
              : false;
    const state: SpineStep["state"] = i === idx ? "current" : i < idx && answered ? "done" : "todo";
    return { label: g.label, to: state === "done" ? href(g.path) : null, state };
  });
}

export type DnaGroup = "face" | "fit" | "life" | "taste" | "dna";

const DNA_ORDER: readonly { id: DnaGroup; label: string; path: string }[] = [
  { id: "face", label: "Face", path: "dna/face" },
  { id: "fit", label: "Fit", path: "dna/fit" },
  { id: "life", label: "Life", path: "dna/lifestyle" },
  { id: "taste", label: "Taste", path: "dna/inspiration" },
  { id: "dna", label: "DNA", path: "dna/result" },
];

export function dnaSpine(current: DnaGroup, href: (p: string) => string): SpineStep[] {
  const idx = DNA_ORDER.findIndex((g) => g.id === current);
  return DNA_ORDER.map((g, i) => {
    const state: SpineStep["state"] = i === idx ? "current" : i < idx ? "done" : "todo";
    return { label: g.label, to: state === "done" ? href(g.path) : null, state };
  });
}
