/** The named stages of a guided build. Done in accent, running in ink, waiting in muted. */
import type { BuildStage } from "../../shared/guided";

export function StageList({ stages, index }: { stages: readonly BuildStage[]; index: number }) {
  return (
    <ol className="a-mono flex flex-col gap-2 text-[13px] leading-5" aria-label="Build stages">
      {stages.map((s, i) => {
        const color = i < index ? "text-[var(--accent)]" : i === index ? "text-[var(--text)]" : "text-[var(--muted)]";
        return (
          <li key={s.id} className={`${color} transition-colors duration-200`}>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
