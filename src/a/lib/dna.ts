/** Style DNA answers ride in the URL: face, fit, life, taste. */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FITS, LIFESTYLES, STAND_IN_PORTRAIT, STYLE_PRESETS, type FitId, type LifestyleId } from "../../shared/catalog";
import { useJourney } from "./journeyContext";

export interface DnaAnswers {
  face: "own" | "sample" | null;
  fit: FitId | null;
  life: LifestyleId | null;
  taste: string[];
}

export function useDnaAnswers(): DnaAnswers {
  const [params] = useSearchParams();
  return useMemo(() => {
    const face = params.get("face");
    const fit = params.get("fit");
    const life = params.get("life");
    const taste = (params.get("taste") ?? "")
      .split(",")
      .filter((id) => STYLE_PRESETS.some((p) => p.id === id))
      .slice(0, 2);
    return {
      face: face === "own" || face === "sample" ? face : null,
      fit: FITS.some((f) => f.id === fit) ? (fit as FitId) : null,
      life: LIFESTYLES.some((l) => l.id === life) ? (life as LifestyleId) : null,
      taste,
    };
  }, [params]);
}

export function useDnaPortrait(): string | null {
  const { faceImage } = useJourney();
  const dna = useDnaAnswers();
  if (dna.face === "own" && faceImage) return faceImage;
  if (dna.face) return STAND_IN_PORTRAIT;
  return null;
}
