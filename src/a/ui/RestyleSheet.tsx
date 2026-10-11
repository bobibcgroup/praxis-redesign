/**
 * Restyle: change one answer and come straight back to new looks, or start over.
 * Every answer reaches the styling request, so every answer can be changed here.
 */
import { SPEND, TIMES, VENUES, VIBES } from "../../shared/catalog";
import { FRESH, useJourney } from "../lib/journeyContext";
import { occasionLabel } from "../lib/looks";
import { ChoiceList, LinkButton } from "./controls";
import { Sheet } from "./Sheet";

type Change = "venue" | "time" | "feel" | "spend" | "occasion";

export function RestyleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { answers, href, go } = useJourney();
  const options: { id: Change; label: string; hint?: string }[] = [
    { id: "venue", label: "The place", hint: answers.occasion ? VENUES[answers.occasion].find((v) => v.id === answers.venue)?.label : undefined },
    { id: "time", label: "The time of day", hint: TIMES.find((t) => t.id === answers.time)?.label },
    { id: "feel", label: "The feel", hint: VIBES.find((v) => v.id === answers.vibe)?.label },
    { id: "spend", label: "The budget", hint: SPEND.find((s) => s.id === answers.spend)?.label },
    { id: "occasion", label: "The occasion", hint: occasionLabel(answers.occasion) || undefined },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Restyle"
      footer={
        <LinkButton to={href("", FRESH)} variant="secondary" className="w-full justify-center">
          Start a new look
        </LinkButton>
      }
    >
      <p className="text-[15px] leading-6 text-[var(--muted)]">Tell me what to change and I’ll style you again.</p>
      <div className="mt-6">
        <ChoiceList label="What should I change?" options={options} value={null} onChange={(id) => go(`moment/${id}`, { restyle: "1" })} />
      </div>
    </Sheet>
  );
}
