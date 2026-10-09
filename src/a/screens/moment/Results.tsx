/**
 * Results: the looks come first. The hero fills the print with the three looks beside it
 * (under it on a phone, where a tap opens them full screen). The column offers to make it
 * personal (see it on me, build around something I own), lists the pieces to check out,
 * and ends with a way to start a new look. Save lands in the completion state.
 */
import { usePieceSelection } from "../../lib/selection";
import { useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { FRESH, useGateAction, useGated, useJourney } from "../../lib/journeyContext";
import { defaultHeroId, money, occasionLabel, resolveLooks, ROLE_LABEL } from "../../lib/looks";
import { momentSpine } from "../../lib/spine";
import { Completion, CompletionActions } from "../../ui/Completion";
import { LinkButton, PlusMark, PrimaryButton, QuietButton, TextButton } from "../../ui/controls";
import { LookViewer } from "../../ui/LookViewer";
import { ShareSheet } from "../../ui/ShareSheet";
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
  const [viewer, setViewer] = useState(false);
  const [sharing, setSharing] = useState(false);
  const hero = resolved?.hero ?? null;
  const selection = usePieceSelection(hero);
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
  const pick = (id: string) => go("moment/results", { hero: id }, { replace: true });
  const hasFace = Boolean(answers.face || store.dna?.portrait);
  const eyebrow = isPick ? `My pick for ${label.toLowerCase()}` : `${ROLE_LABEL[hero.role]} for ${label.toLowerCase()}`;
  const seeOnMe = () => gated("tryon", () => go(hasFace ? "moment/tryon" : "moment/you/face"));

  return (
    <Stage
      spine={momentSpine("looks", answers, href)}
      back={href("moment/spend")}
      band="looks"
      canvas={
        <Frame
          book
          image={hero.image}
          alt={`${hero.title}, the ${ROLE_LABEL[hero.role].toLowerCase()} look for ${label.toLowerCase()}`}
          reduced={reduced}
          belowHeight={BELOW.thumbs}
          below={<Thumbs looks={looks} activeId={hero.id} onPick={pick} reduced={reduced} />}
          bleedDesktop
          overlay={
            <>
              <button type="button" className="a-enlarge" aria-label={`Open ${hero.title} full screen`} onClick={() => setViewer(true)} />
              <div className="a-thumbs-index">
                <Thumbs looks={looks} activeId={hero.id} onPick={pick} reduced={reduced} vertical />
              </div>
            </>
          }
        />
      }
      actions={
        done ? (
          <CompletionActions />
        ) : (
          <div className="flex flex-wrap items-center gap-1 lg:gap-2">
            <PrimaryButton onClick={openBuy} disabled={selection.chosen.length === 0}>
              Check out
              <span className="hint">{money(selection.total)}</span>
            </PrimaryButton>
            <TextButton onClick={() => setSharing(true)}>Share</TextButton>
            <TextButton onClick={() => gated("save", save)} disabled={saved}>
              {saved ? "Saved" : "Save"}
            </TextButton>
            <LinkButton to={href("", FRESH)} variant="tertiary" className="a-desktop ml-auto lg:-mr-2">
              Try a new look
            </LinkButton>
          </div>
        )
      }
    >
      <LookDetails
        look={hero}
        eyebrow={eyebrow}
        compact={done !== null}
        selection={selection}
        end={
          done ? null : (
            <LinkButton to={href("", FRESH)} variant="tertiary" className="a-phone mt-2 self-start !px-0">
              Try a new look
            </LinkButton>
          )
        }
        personal={
          done ? null : (
            <div className="mt-6">
              <p className="a-label text-[var(--muted)]">Make it yours</p>
              <div className="a-personal mt-3">
                <QuietButton onClick={seeOnMe}>
                  See it on me
                  <PlusMark show={!plus} />
                </QuietButton>
                <QuietButton onClick={() => go("moment/you/item")}>
                  {ownedItem ? "Change my piece" : "Use something I own"}
                </QuietButton>
              </div>
            </div>
          )
        }
      />
      {done ? <Completion kind={done} /> : null}
      <LookViewer
        open={viewer}
        looks={looks}
        activeId={hero.id}
        onPick={pick}
        onClose={() => setViewer(false)}
        onShare={() => {
          setViewer(false);
          setSharing(true);
        }}
        reduced={reduced}
      />
      <ShareSheet look={hero} eyebrow={eyebrow} occasion={label.toLowerCase()} open={sharing} onClose={() => setSharing(false)} />
      <PiecesSheet look={hero} open={sheet} onClose={() => setSheet(false)} selection={selection} />
    </Stage>
  );
}
