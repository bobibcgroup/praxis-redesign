// ============= STRICT ENUMS =============

// Flow Mode
export type FlowMode = 'quick' | 'personal';

// Occasion
export type OccasionType = 'WEDDING' | 'WORK' | 'DINNER' | 'DATE' | 'PARTY';

// Location (expanded)
export type LocationType = 
  | 'RESTAURANT' 
  | 'OFFICE' 
  | 'HOTEL' 
  | 'OUTDOOR_VENUE' 
  | 'HOME'
  | 'BAR'
  | 'CLUB'
  | 'MEETING'
  | 'CONFERENCE'
  | 'BEACH_RESORT'
  | 'GARDEN'
  | 'PRIVATE_ESTATE';

// Time of day
export type TimeType = 'DAY' | 'NIGHT';

// Setting
export type SettingType = 'INDOOR' | 'OUTDOOR' | 'BOTH';

// Priority
export type PriorityType = 'SHARP' | 'COMFORT' | 'IMPRESSION' | 'SIMPLE';

// Budget
export type BudgetType = 'EVERYDAY' | 'MID_RANGE' | 'PREMIUM';

// Lifestyle (personal flow)
export type LifestyleType = 'WORK' | 'SOCIAL' | 'CASUAL' | 'MIXED';

// Inspiration Style Presets
export type InspirationPresetType = 
  | 'QUIET_LUXURY' 
  | 'SMART_CASUAL' 
  | 'MODERN_MINIMAL' 
  | 'ELEVATED_STREET' 
  | 'CLASSIC_TAILORED' 
  | 'RELAXED_WEEKEND';

// ============= DATA STRUCTURES =============

export interface OccasionData {
  event: OccasionType | '';
  /** Optional date for the occasion (ISO date string) */
  eventDate?: string;
  /** Optional name for this look (e.g. "Interview Tuesday") */
  lookName?: string;
}

export interface ContextData {
  location: LocationType | '';
  when: TimeType | '';
  setting: SettingType | '';
}

export interface PreferencesData {
  priority: PriorityType | '';
  budget: BudgetType | '';
}

// Style DNA - long-term style anchor
export interface StyleDNA {
  primaryStyle: InspirationPresetType;
  secondaryStyle?: InspirationPresetType;
  confidence: 'high' | 'medium' | 'low';
  /** Set by drift helper when persisting */
  version?: number;
  updatedAt?: string;
  /** Biometric-derived identity (when confidence >= threshold) */
  identity_core?: IdentityCore;
}

// ---------- Biometric / Identity core (from face + body pipelines) ----------

export type UndertoneType = 'warm' | 'cool' | 'neutral';

export interface QualityGateReport {
  passed: boolean;
  notes: string[];
}

export interface FaceProfile {
  status: 'ok' | 'low_confidence' | 'rejected';
  color_season?: string;
  confidence: number;
  undertone?: UndertoneType;
  contrast_ratio?: number;
  hair_cluster?: string;
  eye_cluster?: string;
  skin_lab_mean?: { L: number; a: number; b: number };
  quality_gates: QualityGateReport;
  reject_reason?: string;
  how_to_fix?: string;
}

export interface BodyMeasurements {
  vertical_ratio?: number;
  shoulder_angle_deg?: number;
  curve_score?: number;
  width_ratio?: number;
}

export interface KibbeCluster {
  [type: string]: number; // e.g. { Natural: 0.78, Classic: 0.22 }
}

export interface BodyProfile {
  status: 'ok' | 'low_confidence' | 'rejected';
  kibbe_cluster?: KibbeCluster;
  confidence: number;
  measurements?: BodyMeasurements;
  quality_gates: QualityGateReport;
  reject_reason?: string;
  how_to_fix?: string;
}

export interface IdentityCore {
  kibbe?: KibbeCluster;
  color_season?: string;
  assessed_date?: string;
  /** true when confidence was below threshold at capture */
  provisional?: boolean;
  /** From face pipeline for Analysis card */
  undertone?: UndertoneType;
  /** e.g. "Moderate" from body vertical_ratio */
  vertical_line?: string;
  /** e.g. "Blunt" from body measurements */
  shoulder?: string;
}

// Skin tone detection
export type SkinToneBucket = 'very-light' | 'light' | 'medium' | 'tan-olive' | 'deep';

export interface SkinToneData {
  bucket: SkinToneBucket;
  hex: string;
}

// Contrast level detection
export type ContrastLevel = 'low' | 'medium' | 'high';

// Style color profile (derived from photo analysis)
export type PaletteType = 'warm' | 'cool' | 'neutral';

export interface StyleColorProfile {
  palette: PaletteType;
  contrast: ContrastLevel;
}

// Body proportion types
export type ShoulderWidth = 'narrow' | 'average' | 'broad';
export type TorsoLength = 'short' | 'balanced' | 'long';
export type LegLength = 'short' | 'balanced' | 'long';
export type BuildType = 'lean' | 'average' | 'solid';

export interface BodyProportions {
  shoulders: ShoulderWidth;
  torso: TorsoLength;
  legs: LegLength;
  build: BuildType;
}

// Face shape types
export type FaceShape = 'oval' | 'round' | 'square' | 'long';

export interface FaceShapeData {
  shape: FaceShape;
  confidence: 'high' | 'medium' | 'low';
}

// Fit calibration types
export type HeightUnit = 'cm' | 'ft-in';
export type FitPreference = 'slim' | 'regular' | 'relaxed';

export interface FitCalibration {
  height?: number; // Always stored in cm
  heightUnit: HeightUnit;
  fitPreference?: FitPreference;
}

// Wardrobe items structure
export interface WardrobeItems {
  top: string | null;
  jacket: string | null;
  bottom: string | null;
  shoes: string | null;
}

export interface PersonalData {
  hasPhoto: boolean;
  photoOriginal?: string; // Original uncropped photo
  photoData?: string; // Base64 encoded image data (legacy, use photoCropped)
  photoCropped?: string; // Cropped version for styling
  skinTone?: SkinToneData; // Detected skin tone
  contrastLevel?: ContrastLevel; // Detected contrast level
  styleColorProfile?: StyleColorProfile; // Derived color profile for styling
  bodyProportions?: BodyProportions; // Detected body proportions
  faceShape?: FaceShapeData; // Detected face shape
  /** From biometric API (face pipeline); used for DNA card and copy generation */
  faceProfile?: FaceProfile;
  /** From biometric API (body pipeline); used for DNA card and copy generation */
  bodyProfile?: BodyProfile;
  fitCalibration?: FitCalibration; // Height and fit preference
  lifestyle: LifestyleType | '';
  hasInspiration: boolean;
  inspirationData?: string; // Base64 encoded image data
  inspirationPreset?: InspirationPresetType; // Selected style preset
  /** Multiple inspiration presets with weights (e.g. [{ preset: 'QUIET_LUXURY', weight: 0.7 }, ...]) */
  inspirationPresets?: Array<{ preset: InspirationPresetType; weight: number }>;
  styleDirectionImages?: string[]; // Image URLs/identifiers for the selected style
  styleDNA?: StyleDNA; // Style DNA anchor
  hasWardrobe: boolean;
  /** When user skips wardrobe: 'later' | 'no' */
  wardrobeSkipReason?: 'later' | 'no';
  wardrobeItems?: WardrobeItems; // Structured wardrobe uploads
}

// Lifestyle usage tracking (stored in localStorage)
export interface LifestyleUsageData {
  occasionCounts: Record<string, number>;
  lastUpdated: string;
}

export interface FlowData {
  occasion: OccasionData;
  context: ContextData;
  preferences: PreferencesData;
}

export interface PersonalFlowData {
  personal: PersonalData;
}

// ============= RESULT LABELS =============

export type OutfitLabel = 'Safest choice' | 'Sharper choice' | 'More relaxed choice' | 'Best for you' | 'More expressive' | 'More relaxed';

// ============= OUTFIT STRUCTURE (UI) =============

/** Optional backend-generated reasoning (Decision Engine) */
export interface ReasoningExplanation {
  summary: string;
  silhouette?: string;
  color_logic?: string;
  context_logic?: string;
}

/** Chain-of-Style score breakdown (0–1 per dimension), from Decision Engine */
export interface ScoreBreakdown {
  body_harmony?: number;
  color_harmony?: number;
  event_appropriateness?: number;
  psychological_projection?: number;
  weather_compatibility?: number;
  user_preference_match?: number;
}

export interface Outfit {
  id: number;
  title: string;
  label: OutfitLabel;
  items: {
    top: string;
    bottom: string;
    shoes: string;
    extras?: string;
  };
  reason: string;
  imageUrl: string;
  /** From Decision Engine */
  reasoning?: ReasoningExplanation;
  /** 0-100, from Decision Engine */
  confidence?: number;
  /** Chain-of-Style sub-scores when present */
  score_breakdown?: ScoreBreakdown;
  /** Library entry id (e.g. date_safest_01) for replace-one and alternatives */
  libraryId?: string;
  /** Retailer/shop ids for "Where to buy" */
  retailer_ids?: string[];
}
