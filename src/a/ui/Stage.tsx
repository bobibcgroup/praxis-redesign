/**
 * The stage: a top bar, the question column (left on desktop, bottom on
 * mobile) and the canvas (right on desktop, top band on mobile). The column
 * is a flex column: the body scrolls only if it must and the action row is
 * pinned at the bottom under one rule.
 */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { TopBar, type SpineStep } from "./TopBar";
import { useJourney } from "../lib/journeyContext";

interface StageProps {
  spine?: SpineStep[];
  back?: string | "back" | null;
  wordmark?: boolean;
  canvas: ReactNode;
  children: ReactNode;
  /** The pinned action row. Omit it when no primary action exists. */
  actions?: ReactNode;
  /** Mobile band: 40% of the viewport while answering, 50% once looks exist. */
  band?: "answer" | "looks" | "home";
}

export function Stage({ spine, back, wordmark, canvas, children, actions, band = "answer" }: StageProps) {
  const { pathname } = useLocation();
  const { reduced } = useJourney();

  return (
    <div className="a-stage">
      <TopBar spine={spine} back={back} wordmark={wordmark} />
      <div className="a-split" data-band={band}>
        <section className="a-col px-5 lg:px-12 lg:pb-6">
          <div className="a-body">
            <motion.div
              key={pathname}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex min-h-0 w-full flex-col pt-6 lg:max-w-[480px] lg:pt-12"
            >
              {children}
            </motion.div>
          </div>
          {actions ? <div className="a-actions lg:max-w-[480px]">{actions}</div> : null}
        </section>
        <aside className="a-canvas flex min-h-0 flex-col bg-[var(--surface)] px-5 pb-2 pt-2 lg:px-12 lg:pb-20 lg:pt-8" aria-label="Canvas">
          {canvas}
        </aside>
      </div>
    </div>
  );
}
