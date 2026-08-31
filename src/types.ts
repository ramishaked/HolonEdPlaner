export interface Principle {
  /** UI id — the DB's `order_index`. A runtime projection only: everything persisted
   *  (plan_*, activity links) references `uuid`, so reordering never breaks saved data. */
  id: number;
  /** The DB row id — the real key, needed by the admin write layer. */
  uuid: string;
  /** false → hidden from the school journey. Only the admin console ever sees these. */
  isActive: boolean;
  scope: 'municipal' | 'school';
  /** null for a municipal principle; the owning school when `scope === 'school'`.
   *  The municipal dashboard needs it to count each school against its own set. */
  schoolId: string | null;
  title: string;
  icon: string;
  colorName: string; // Tailwind class identifier, e.g., 'purple', 'blue', 'orange', 'cyan', 'emerald', 'indigo', 'rose'
  accentColor: string; // hex code or tailwind equivalent style
  bgLight: string; // tailwind color class
  textDark: string; // tailwind text color
  shortSummary: string;
  rationale: string;
  gapsSolved: string[];
  addedValue: string;
  implementationStrategy: string[];
  sacrificesRequired: string;
  ecosystemPartnerships: string;
  kpis: string[];
  teacherDeliverable: string;
  studentDeliverable: string;
  firstStep: string;
  sources: Source[];
  shortLabel?: string; // short radar label (from DB short_label); optional for static data
}

export interface Source {
  title: string;
  description: string;
  url: string;
  keywords: string;
}

export interface MaturityLevel {
  level: number;
  name: string;
  description: string;
}

export interface PrincipleMaturity {
  id: number;
  levels: MaturityLevel[];
}

export interface DiagnosticResponse {
  whyScore: number; // 1-4
  howScore: number; // 1-4
  whatScore: number; // 1-4
  selectedMaturityLevel: number; // 1-4
  evidence: string;
}

export interface DiagnosticAnswers {
  [principleId: number]: DiagnosticResponse;
}

// --- מתחם התכנון (planning zone): per-principle action-plan builder ---
// Task "source" — where the initiative comes from. Closed vocabulary; becomes a
// per-task DB attribute in Phase 2. Drives the chip label + colour.
export type TaskSource = 'עירוני' | 'בית ספרי' | 'פסג"ה חולון' | 'משרד החינוך' | 'ארצי' | 'עולמי' | 'כללי';

export interface PlanActivity {
  id: string;
  title: string;
  desc: string;
  metrics: string;
  /** Audience slugs from the DB `audiences` picklist — multi-select, never hardcoded. */
  audiences: string[];
  /** Free text shown when the "אחר" audience is picked, or to qualify a broad one. */
  audienceNote: string;
  owner: string;
  priority: 'high' | 'medium' | 'low';
  type: string; // internal category (drives metrics + victory-vision heuristics; not displayed)
  source?: TaskSource; // displayed chip — task origin. Optional for back-compat with older saved plans.
  /** Source bank item id (BankItem.key) when this activity was added from the bank.
   *  Undefined for a custom "יוזמה ייחודית / אחר". Powers the bank's "already in plan" state. */
  bankKey?: string;
  isExpanded?: boolean; // workspace accordion open/closed state
}

export interface PrinciplePlan {
  activities: PlanActivity[];
  victoryVision: string;
}

export interface ActionPlan {
  strengths: number[]; // principle IDs
  breakthroughs: number[]; // principle IDs
  organizationalSacrifice: string;
  schoolName: string;
  schoolYear: string;
  strengthReason?: string;
  breakthroughReason1?: string;
  breakthroughReason2?: string;
}

// --- מסך ההגדרות (settings): the school's "business card" / identity ---
export interface SchoolFileMeta {
  name: string;
  size: number; // bytes
  type: string; // mime
  id?: string; // school_files row id (DB-backed uploads)
  path?: string; // Supabase Storage object path
}

export interface SchoolProfile {
  principalName: string;
  principalSeniority: string; // free text (e.g. "8 שנים")
  studentCount: string; // free text
  vision: string;
  goals: string;
  uniqueness: string;
  logoDataUrl: string; // base64 data URL for a small logo image
  files: SchoolFileMeta[]; // attached docs/presentations (metadata; storage in Phase 2)
}

export const EMPTY_SCHOOL_PROFILE: SchoolProfile = {
  principalName: '',
  principalSeniority: '',
  studentCount: '',
  vision: '',
  goals: '',
  uniqueness: '',
  logoDataUrl: '',
  files: [],
};

/** Result of a logo/file upload, so the UI can show a real error instead of a silent no-op. */
export type UploadOutcome = { ok: boolean; error?: string };
