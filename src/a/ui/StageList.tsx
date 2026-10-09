/** The running stage of a guided build, one line. The last stage holds once the build is done. */
import type { BuildStage } from "../../shared/guided";

export function StageList({ stages, index }: { stages: readonly BuildStage[]; index: number }) {
  const current = stages[Math.min(index, stages.length - 1)];
  return <p className="text-[15px] leading-6 text-[var(--muted)]">{current?.label}</p>;
}
