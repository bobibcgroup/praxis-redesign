/** The running stage of a guided build, one line. The last stage holds once the build is done. */
import type { BuildStage } from "../../shared/guided";

export function StageList({ stages, index }: { stages: readonly BuildStage[]; index: number }) {
  const current = stages[Math.min(index, stages.length - 1)];
  return <p className="a-mono text-[13px] leading-5 text-[var(--text)]">{current?.label}</p>;
}
