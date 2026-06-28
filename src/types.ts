export interface Principle {
  id: number;
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
export interface PlanActivity {
  id: string;
  title: string;
  desc: string;
  metrics: string;
  target: 'all' | 'layers' | 'teachers';
  owner: string;
  priority: 'high' | 'medium' | 'low';
  type: string; // category label (e.g. בית רותר / סדנת AI / האקתון / אחר / סוכן AI)
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
