/**
 * Results: the hero fills the print; the three looks sit under it in a
 * stable order with the hero underlined. Tapping one crossfades the print
 * and moves the underline. Save lands in the completion state.
 */
import { useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useGateAction, useGated, useJourney } from "../../lib/journeyContext";
import { defaultHeroId, occasionLabel, resolveLooks, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { Completion, CompletionActions } from "../../ui/Completion";
import { PlusMark, PrimaryButton, TextButton } from "../../ui/controls";
import { BELOW, Frame } from "../../ui/Frame";
import { LookDetails } from "../../ui/LookDetails";
import { PiecesSheet } from "../../ui/PiecesSheet";
import { Stage } from "../../ui/Stage";
import { Thumbs } from "../../ui/Thumbs";

export function Results() {
  const { answers, href, go, ownedItem, store, reduced, user } = useJourney();
  const gated = useGated();
  const resolved = useMemo(() => resolveLooks(answers, ownedItem), [answers, ownedItem]);
  const [sheet, setSheet] = useState(false);
  const hero = resolved?.hero ?? null;
  const label = occasionLabel(answers.occasion);

  const save = useCallback(() => {
    if (!hero) return;
    store.saveLook(hero, label);
    go("moment/results", { done: "saved" }, { replace: true });
  }, [hero, label, store, go]);
  const openBuy = useCallback(() => setSheet(true), []);
  useGateAction("save", save);

  if (!answers.spend || !resolved || !hero) return <Navigate to={href("moment/occasion")} replace />;

  const { looks } = resolved;
  const saved = store.looks.some((s) => s.look.id === hero.id && s.occasionLabel === label);
  const done = answers.done;
  const plus = user?.plus ?? false;
  const isPick = hero.id === defaultHeroId(looks, answers.vibe);

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/you")}
      band="looks"
      canvas={
        <Frame
          image={hero.image}
          alt={`${hero.title}, the ${ROLE_LABEL[hero.role].toLowerCase()} look for ${label.toLowerCase()}`}
          reduced={reduced}
          belowHeight={BELOW.thumbs}
          below={<Thumbs looks={looks} activeId={hero.id} onPick={(id) => go("moment/results", { hero: id }, { replace: true })} reduced={reduced} />}
        />
      }
      actions={
        done ? (
          <CompletionActions />
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              <PrimaryButton onClick={() => gated("tryon", () => go("moment/tryon"))}>
                See it on me
                <PlusMark show={!plus} />
              </PrimaryButton>
              <TextButton onClick={openBuy}>Get the pieces</TextButton>
              <TextButton onClick={() => gated("save", save)} disabled={saved}>
                {saved ? "Saved" : "Save"}
              </TextButton>
            </div>
          </div>
        )
      }
    >
      <LookDetails look={hero} eyebrow={isPick ? `My pick for ${label.toLowerCase()}` : `${ROLE_LABEL[hero.role]} for ${label.toLowerCase()}`} compact={done !== null} onOpenPieces={() => setSheet(true)} />
      {done ? <Completion kind={done} /> : null}
      <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} mode="buy" />
    </Stage>
  );
}
