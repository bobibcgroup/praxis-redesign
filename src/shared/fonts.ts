import { useEffect } from "react";

/**
 * Injects a Google Fonts stylesheet for one concept, with preconnect, once.
 * Concepts own their typography; the production font import is untouched.
 */
export function useConceptFonts(id: string, href: string): void {
  useEffect(() => {
    const key = `lab-font-${id}`;
    if (document.getElementById(key)) return;

    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.gstatic.com";
    preconnect.crossOrigin = "anonymous";
    preconnect.id = `${key}-preconnect`;

    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = href;
    sheet.id = key;

    document.head.append(preconnect, sheet);
  }, [id, href]);
}
