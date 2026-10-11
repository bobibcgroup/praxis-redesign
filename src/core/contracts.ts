/**
 * The contracts between the Praxis interface and whatever recommends the looks: today a deterministic
 * mock adapter, later a production service (Gemini or another provider). Screens only read these
 * shapes, so replacing the adapter changes no screen. Plain TypeScript with no framework; the
 * validators that guard the boundary live in validate.ts.
 *
 * Three kinds of garment data stay distinct on purpose: a retailer product (something that can be
 * bought), a wardrobe item (something the customer already owns), and a visualization (a picture of
 * a look, which proves nothing about stock, exact colour or fit).
 */

/** Bumped when a field changes meaning or a required field is added. */
export const CONTRACT_VERSION = "1.0";

export type Occasion = "DINNER" | "WORK" | "DATE" | "WEDDING" | "PARTY";
export type TimeOfDay = "SUNRISE" | "DAY" | "SUNSET" | "NIGHT";
/** The feel the customer asked for: Classic, Sharp or Relaxed on screen. */
export type Vibe = "SAFE" | "SHARP" | "RELAXED";
export type BudgetBand = "SENSIBLE" | "ELEVATED" | "OPEN";
export type Slot = "top" | "bottom" | "shoes" | "extras";
export type Currency = "USD";

/* ------------------------------------------------------------------ request */

/** A piece the customer owns, as the recommendation service sees it. Never carries the photo. */
export interface WardrobeItemRef {
  wardrobeItemId: string;
  slot: Slot;
  /** What the customer called it, or the sample's name. */
  label: string;
  source: "sample" | "upload";
}

/** What feedback so far says, for an engine that can use it. The mock adapter does not. */
export interface PreferenceSnapshot {
  likedOutfitIds: string[];
  rejectedOutfitIds: string[];
  reasonCounts: Partial<Record<FeedbackReason, number>>;
  dislikedGarmentIds: string[];
}

export interface StylingRequest {
  requestId: string;
  /** The same answers always give the same key, so a response can be tied to the exact inputs it answered. */
  inputKey: string;
  contractVersion: string;
  journey: "style_a_moment";
  anonymousSessionId: string;
  userId?: string;
  occasion: Occasion;
  venue: {
    /** The answer's id, such as RESTAURANT. */
    type: string;
    /** The answer as the customer read it, such as "Restaurant". */
    label: string;
    context?: string;
  };
  timeOfDay: TimeOfDay;
  preferredVibe: Vibe;
  budget: {
    band: BudgetBand;
    minimum?: number;
    maximum?: number;
    currency: Currency;
  };
  /** The saved Style DNA, when there is one. */
  styleProfileId?: string;
  wardrobeItems: WardrobeItemRef[];
  preferences?: PreferenceSnapshot;
  location?: { country?: string; city?: string };
  generatedAt: string;
}

/* ----------------------------------------------------------------- response */

export type PriceStatus = "example" | "estimated" | "live";
export type Availability = "in_stock" | "out_of_stock" | "unknown";

/** A reference to something a retailer sells. */
export interface ProductRef {
  productId: string;
  retailerId: string;
  retailerName: string;
  price: number;
  currency: Currency;
  /** Example prices are illustrations; only live prices come from a retailer feed. */
  priceStatus: PriceStatus;
  availability: Availability;
  productUrl?: string;
  imageUrl?: string;
  lastUpdatedAt?: string;
}

interface GarmentBase {
  garmentId: string;
  slot: Slot;
  name: string;
}

export interface RetailGarment extends GarmentBase {
  source: "retail";
  product: ProductRef;
}

export interface WardrobeGarment extends GarmentBase {
  source: "wardrobe";
  wardrobeItemId: string;
}

export type Garment = RetailGarment | WardrobeGarment;

export type VisualizationKind = "product_photo" | "styled_visualization" | "try_on";

/** A picture of the look. It shows a styling, and is never proof of stock, exact colour or fit. */
export interface Visualization {
  imageId: string;
  outfitId: string;
  kind: VisualizationKind;
  url: string;
  /** Who made it: "praxis-library" for the curated photographs. */
  provider: string;
  /** "exact" only when the picture shows these very garments. */
  fidelity: "exact" | "representative";
  sourceGarmentIds: string[];
  status: "ready" | "pending" | "failed" | "unavailable";
  width?: number;
  height?: number;
  createdAt?: string;
}

export type FactorKind = "occasion" | "venue" | "time" | "style" | "budget" | "body" | "colour" | "wardrobe" | "weather";

export interface RecommendationFactor {
  factor: FactorKind;
  /** The input as the customer gave it, such as "Restaurant". */
  value: string;
  /** What it did to this look, in a few plain words. */
  influence?: string;
}

export interface RecommendationExplanation {
  /** One sentence tying the look to the brief. */
  summary: string;
  contributingFactors: RecommendationFactor[];
  /** Where the words came from: fixed rules in the mock adapter, or a model's validated decision data. */
  source: "mock_rules" | "model";
}

export type OutfitRole = "classic" | "sharper" | "relaxed";

export interface OutfitRecommendation {
  outfitId: string;
  /** 1 is the pick. */
  rank: number;
  role: OutfitRole;
  title: string;
  /** Why the pieces work together. */
  rationale: string;
  explanation: RecommendationExplanation;
  garments: Garment[];
  visualization: Visualization;
  pricing: {
    /** Retail pieces only; owned pieces cost nothing. */
    total: number;
    currency: Currency;
    status: PriceStatus;
  };
}

export type ResponseStatus = "completed" | "partial" | "empty" | "failed";

export interface StylingResponse {
  recommendationId: string;
  requestId: string;
  inputKey: string;
  contractVersion: string;
  adapter: { id: string; version: string };
  /** Demonstration: looks from a fixed sample set. Personalized: built for this customer by a real engine. */
  mode: "demonstration" | "personalized";
  status: ResponseStatus;
  outfits: OutfitRecommendation[];
  /** Why fewer looks than usual came back, or what stood in. */
  fallback?: { code: string; message: string };
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
}

/* ----------------------------------------------------------------- feedback */

export type FeedbackKind = "more_like_this" | "not_for_me";
export type FeedbackReason = "too_formal" | "too_casual" | "wrong_colours" | "wrong_fit" | "too_expensive";

export interface OutfitFeedback {
  eventId: string;
  anonymousSessionId: string;
  userId?: string;
  recommendationId: string;
  requestId: string;
  outfitId: string;
  garmentId?: string;
  feedback: FeedbackKind;
  reason?: FeedbackReason;
  adapter: { id: string; version: string };
  createdAt: string;
}
