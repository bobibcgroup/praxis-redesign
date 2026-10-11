/**
 * Image services, behind provider-independent interfaces: colour analysis of a face photo, garment
 * recognition from a wardrobe photo, outfit visualization, and virtual try-on. Each adapter says
 * whether calling it costs money. One switch, read at build time (VITE_ALLOW_BILLABLE_IMAGES), decides
 * whether billable adapters may run at all: when it is off, the registry refuses the call before any
 * request is made, whatever the screens show. Today every adapter is a free mock.
 */
import { ALLOW_BILLABLE_IMAGES } from "./config";
import type { Slot } from "./contracts";
import { newId } from "./ids";
import { IMAGE_POLICIES, type ImageCategory, type ImageProblem } from "./images";
import { simScenario, wait } from "./sim";

/** A photo the customer gave, as the services see it: a reference, never inlined into analytics. */
export interface ImageInput {
  /** A data URL or object URL held in this tab, or a storage reference once uploads exist. */
  ref: string;
  category: ImageCategory;
  width: number;
  height: number;
  /** The consent the customer gave for this kind of photo. */
  consentVersion: string;
}

export interface Inferred<T> {
  value: T;
  /** Where the estimate came from. "sample" is a fixed example, not an analysis of the photo. */
  source: "sample" | "model";
  adapter: string;
}

export interface ColourAnalysis {
  status: "completed" | "unreadable" | "failed" | "disabled";
  problem?: ImageProblem;
  undertone?: Inferred<"cool" | "warm" | "neutral">;
  contrast?: Inferred<"high" | "medium" | "low">;
}

export interface GarmentAnalysis {
  status: "completed" | "unreadable" | "failed" | "disabled";
  slot?: Inferred<Slot>;
  colour?: Inferred<string>;
  category?: Inferred<string>;
}

/** A generated picture, with what is needed to trace, keep and delete it. */
export interface GeneratedImage {
  imageId: string;
  outfitId: string;
  kind: "styled_visualization" | "try_on";
  sourceGarmentIds: string[];
  provider: string;
  modelVersion: string;
  status: "ready" | "pending" | "failed" | "disabled";
  width?: number;
  height?: number;
  /** Where the image is kept: a URL or a storage key. */
  storageRef?: string;
  createdAt: string;
  retention: { deleteAfter?: string; deletable: boolean };
}

interface Adapter {
  readonly id: string;
  readonly version: string;
  /** True when a call is charged by a provider. Such adapters only run with the switch on. */
  readonly billable: boolean;
}

export interface ColourAnalysisAdapter extends Adapter {
  analyse(image: ImageInput, options?: { signal?: AbortSignal }): Promise<ColourAnalysis>;
}
export interface GarmentRecognitionAdapter extends Adapter {
  recognise(image: ImageInput, options?: { signal?: AbortSignal }): Promise<GarmentAnalysis>;
}
export interface OutfitVisualizationAdapter extends Adapter {
  visualize(outfit: { outfitId: string; garmentIds: string[] }, options?: { signal?: AbortSignal }): Promise<GeneratedImage>;
}
export interface TryOnAdapter extends Adapter {
  tryOn(input: { outfitId: string; garmentIds: string[]; person: ImageInput }, options?: { signal?: AbortSignal }): Promise<GeneratedImage>;
}

/* -------------------------------------------------------------- mocks */

/** The same example every time, labelled as a sample, so nothing pretends the photo was read. */
export const mockColourAnalysis: ColourAnalysisAdapter = {
  id: "mock-colour",
  version: "1.0.0",
  billable: false,
  async analyse(image, options) {
    const sim = simScenario();
    if (sim === "slow") await wait(2500, options?.signal);
    if (sim === "invalid_image") return { status: "unreadable", problem: "too_dark" };
    if (sim === "failure") return { status: "failed" };
    if (image.category !== "face_colour") return { status: "failed" };
    return {
      status: "completed",
      undertone: { value: "cool", source: "sample", adapter: "mock-colour" },
      contrast: { value: "high", source: "sample", adapter: "mock-colour" },
    };
  },
};

export const mockGarmentRecognition: GarmentRecognitionAdapter = {
  id: "mock-garment",
  version: "1.0.0",
  billable: false,
  async recognise() {
    // Nothing is read from the photo: the customer says which piece it is.
    return { status: "completed" };
  },
};

function notGenerated(outfitId: string, garmentIds: string[], kind: GeneratedImage["kind"], provider: string): GeneratedImage {
  return {
    imageId: newId("img"),
    outfitId,
    kind,
    sourceGarmentIds: garmentIds,
    provider,
    modelVersion: "none",
    status: "disabled",
    createdAt: new Date().toISOString(),
    retention: { deletable: true },
  };
}

/** No pictures are generated: looks use the photographs in the library. */
export const mockVisualization: OutfitVisualizationAdapter = {
  id: "mock-visualization",
  version: "1.0.0",
  billable: false,
  async visualize(outfit) {
    return notGenerated(outfit.outfitId, outfit.garmentIds, "styled_visualization", "mock-visualization");
  },
};

export const mockTryOn: TryOnAdapter = {
  id: "mock-try-on",
  version: "1.0.0",
  billable: false,
  async tryOn(input) {
    return notGenerated(input.outfitId, input.garmentIds, "try_on", "mock-try-on");
  },
};

/* ----------------------------------------------------------- registry */

export class BillableCallBlocked extends Error {
  constructor(adapter: string) {
    super(`${adapter} is billable and billable image calls are switched off.`);
    this.name = "BillableCallBlocked";
  }
}

/** Throws before any request when the adapter costs money and the switch is off. */
export function guardBillable(adapter: Adapter, allowed: boolean = ALLOW_BILLABLE_IMAGES): void {
  if (adapter.billable && !allowed) throw new BillableCallBlocked(adapter.id);
}

/**
 * The image services the app uses. Every call goes through guardBillable, so a billable adapter
 * registered here still cannot run unless the deployment allows it.
 */
export function imageServices(
  adapters: {
    colour?: ColourAnalysisAdapter;
    garment?: GarmentRecognitionAdapter;
    visualization?: OutfitVisualizationAdapter;
    tryOn?: TryOnAdapter;
  } = {},
  allowed: boolean = ALLOW_BILLABLE_IMAGES,
) {
  const colour = adapters.colour ?? mockColourAnalysis;
  const garment = adapters.garment ?? mockGarmentRecognition;
  const visualization = adapters.visualization ?? mockVisualization;
  const tryOn = adapters.tryOn ?? mockTryOn;
  return {
    async analyseColour(image: ImageInput, options?: { signal?: AbortSignal }): Promise<ColourAnalysis> {
      if (image.consentVersion !== IMAGE_POLICIES.face_colour.consentVersion) return { status: "failed" };
      try {
        guardBillable(colour, allowed);
      } catch {
        return { status: "disabled" };
      }
      return colour.analyse(image, options);
    },
    async recogniseGarment(image: ImageInput, options?: { signal?: AbortSignal }): Promise<GarmentAnalysis> {
      try {
        guardBillable(garment, allowed);
      } catch {
        return { status: "disabled" };
      }
      return garment.recognise(image, options);
    },
    async visualize(outfit: { outfitId: string; garmentIds: string[] }, options?: { signal?: AbortSignal }): Promise<GeneratedImage> {
      try {
        guardBillable(visualization, allowed);
      } catch {
        return notGenerated(outfit.outfitId, outfit.garmentIds, "styled_visualization", visualization.id);
      }
      return visualization.visualize(outfit, options);
    },
    async tryOn(input: { outfitId: string; garmentIds: string[]; person: ImageInput }, options?: { signal?: AbortSignal }): Promise<GeneratedImage> {
      if (IMAGE_POLICIES.try_on.status !== "collecting") return notGenerated(input.outfitId, input.garmentIds, "try_on", tryOn.id);
      try {
        guardBillable(tryOn, allowed);
      } catch {
        return notGenerated(input.outfitId, input.garmentIds, "try_on", tryOn.id);
      }
      return tryOn.tryOn(input, options);
    },
  };
}
