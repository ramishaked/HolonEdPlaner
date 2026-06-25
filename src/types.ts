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
