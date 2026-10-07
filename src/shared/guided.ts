/**
 * Guided, deterministic build progress for the design lab.
 * The founder's rule: no random waiting, no unknown moments. Every wait is a
 * choreographed sequence of named stages with fixed durations, so the UI can
 * narrate exactly what is happening and how far along it is.
 */
import { useEffect, useMemo, useState } from "react";

export interface BuildStage {
  id: string;
  /** What the user reads while this stage runs. Plain, specific, no jargon. */
  label: string;
  /** Duration in milliseconds. Keep the whole sequence under ~4.5 s. */
  ms: number;
}

export const MOMENT_STAGES: readonly BuildStage[] = [
  { id: "read", label: "Getting the occasion right", ms: 700 },
  { id: "filter", label: "Finding the right pieces", ms: 900 },
  { id: "compose", label: "Putting three looks together", ms: 1100 },
  { id: "check", label: "Checking the colours on you", ms: 800 },
  { id: "render", label: "Finishing your looks", ms: 600 },
];

export const TRYON_STAGES: readonly BuildStage[] = [
  { id: "align", label: "Getting the proportions right", ms: 900 },
  { id: "drape", label: "Putting the look together", ms: 1300 },
  { id: "light", label: "Matching the light", ms: 900 },
  { id: "finish", label: "Finishing the look", ms: 600 },
];

export const DNA_STAGES: readonly BuildStage[] = [
  { id: "tones", label: "Finding your best colours", ms: 900 },
  { id: "contrast", label: "Checking your contrast", ms: 700 },
  { id: "palette", label: "Building your palette", ms: 900 },
  { id: "save", label: "Putting your Style DNA together", ms: 500 },
];

export interface GuidedBuildState {
  /** Index of the running stage, or stages.length when done. */
  index: number;
  /** 0 to 1 across the whole sequence. */
  progress: number;
  done: boolean;
  current: BuildStage | null;
  total: number;
}

/**
 * Runs the stages once when `active` becomes true. Restarts if `runKey` changes.
 * Respects reduced motion by collapsing the sequence to a single short stage.
 */
export function useGuidedBuild(
  stages: readonly BuildStage[],
  active: boolean,
  runKey: string | number = 0,
  reducedMotion = false,
): GuidedBuildState {
  const [index, setIndex] = useState(0);
  const [elapsedInStage, setElapsedInStage] = useState(0);

  const totalMs = useMemo(() => stages.reduce((s, st) => s + st.ms, 0), [stages]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setIndex(0);
    setElapsedInStage(0);

    if (reducedMotion) {
      const t = setTimeout(() => {
        if (!cancelled) setIndex(stages.length);
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    const started = performance.now();
    let frame = 0;
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - started;
      let acc = 0;
      let i = 0;
      while (i < stages.length && elapsed >= acc + stages[i].ms) {
        acc += stages[i].ms;
        i += 1;
      }
      setIndex(i);
      setElapsedInStage(i < stages.length ? elapsed - acc : 0);
      if (i < stages.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [active, runKey, stages, reducedMotion]);

  const doneMs = stages.slice(0, index).reduce((s, st) => s + st.ms, 0) + elapsedInStage;
  const done = index >= stages.length;

  return {
    index,
    progress: done ? 1 : Math.min(1, doneMs / totalMs),
    done,
    current: done ? null : stages[index],
    total: stages.length,
  };
}
