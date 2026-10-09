/**
 * The three looks, always visible under the print once they exist. 64 x 85
 * prints, 12 px apart, inactive at 0.7, each named under its print; the one
 * in the big frame carries a 2 px accent underline 6 px below. Tapping another crossfades the print
 * and moves the underline. Nothing is ever removed.
 */
import { AnimatePresence, motion } from "motion/react";
import type { Look } from "../../shared/catalog";
import { ROLE_LABEL } from "../lib/looks";

interface Props {
  looks: Look[];
  activeId: string | null;
  onPick?: (id: string) => void;
  reduced: boolean;
  /** Stacked on the print's edge, like a lookbook index, instead of a row under it. */
  vertical?: boolean;
}

export function Thumbs({ looks, activeId, onPick, reduced, vertical = false }: Props) {
  return (
    <ul className={vertical ? "a-thumbs a-thumbs-vertical" : "a-thumbs"} role="group" aria-label="The three looks">
      <AnimatePresence initial={false}>
        {looks.map((look) => {
          const active = look.id === activeId;
          return (
            <motion.li
              key={look.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 28 }}
            >
              <button
                type="button"
                className={active ? "a-thumb is-active" : "a-thumb"}
                aria-pressed={active}
                aria-label={`${look.title}, ${ROLE_LABEL[look.role].toLowerCase()}${active ? ", shown" : ""}`}
                onClick={onPick ? () => onPick(look.id) : undefined}
                disabled={!onPick}
              >
                <img src={look.image} alt="" draggable={false} />
                <span className="a-thumb-label" aria-hidden="true">
                  {ROLE_LABEL[look.role]}
                </span>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
