/** Holds the page still while a sheet, the menu or a full-screen look is open, so a swipe on it never scrolls the page behind. */
import { useEffect } from "react";

let holds = 0;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (holds++ === 0) root.style.overflow = "hidden";
    return () => {
      if (--holds === 0) root.style.overflow = "";
    };
  }, [active]);
}
