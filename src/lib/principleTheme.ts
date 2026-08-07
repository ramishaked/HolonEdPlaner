/**
 * The closed palette a principle may use.
 *
 * `principles.color_name` is not free text: `PrincipleDetailView` switches on it, and
 * anything outside this list silently falls back to slate. The admin editor therefore
 * offers exactly these, and both sides read the same table so they cannot drift.
 *
 * The class strings are Tailwind utilities plus the project's semantic colour aliases
 * (`text-ai`, `bg-skills`, …) defined in the stylesheet.
 */

export interface PrincipleTheme {
  bg: string;
  border: string;
  text: string;
  accent: string;
  accentText: string;
  glow: string;
  badge: string;
}

export const PRINCIPLE_THEMES: Record<string, PrincipleTheme> = {
  purple: {
    bg: 'bg-purple-50/50', border: 'border-ai/30', text: 'text-ai', accent: 'bg-ai',
    accentText: 'text-ai', glow: 'shadow-purple-100', badge: 'bg-purple-100/60 text-ai font-bold',
  },
  blue: {
    bg: 'bg-blue-50/50', border: 'border-holistic/30', text: 'text-holistic', accent: 'bg-holistic',
    accentText: 'text-holistic', glow: 'shadow-blue-100', badge: 'bg-blue-100/60 text-holistic font-bold',
  },
  orange: {
    bg: 'bg-orange-50/50', border: 'border-maker/30', text: 'text-maker', accent: 'bg-maker',
    accentText: 'text-maker', glow: 'shadow-orange-100', badge: 'bg-orange-100/60 text-maker font-bold',
  },
  cyan: {
    bg: 'bg-cyan-50/50', border: 'border-byod/30', text: 'text-byod', accent: 'bg-byod',
    accentText: 'text-byod', glow: 'shadow-cyan-100', badge: 'bg-cyan-100/60 text-byod font-bold',
  },
  emerald: {
    bg: 'bg-emerald-50/50', border: 'border-skills/30', text: 'text-skills', accent: 'bg-skills',
    accentText: 'text-skills', glow: 'shadow-emerald-100', badge: 'bg-emerald-100/60 text-skills font-bold',
  },
  indigo: {
    bg: 'bg-primary-50/50', border: 'border-spaces/30', text: 'text-spaces', accent: 'bg-spaces',
    accentText: 'text-spaces', glow: 'shadow-primary-100', badge: 'bg-primary-100/60 text-spaces font-bold',
  },
  rose: {
    bg: 'bg-rose-50/50', border: 'border-human/30', text: 'text-human', accent: 'bg-human',
    accentText: 'text-human', glow: 'shadow-rose-100', badge: 'bg-rose-100/60 text-human font-bold',
  },
};

const SLATE: PrincipleTheme = {
  bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', accent: 'bg-slate-600',
  accentText: 'text-slate-700', glow: 'shadow-slate-100', badge: 'bg-slate-100 text-slate-700 font-bold',
};

export const principleTheme = (colorName: string): PrincipleTheme =>
  PRINCIPLE_THEMES[colorName] ?? SLATE;

/** The picker in the admin editor: name + a representative hex for the swatch. */
export const COLOR_CHOICES: { name: string; label: string; hex: string }[] = [
  { name: 'emerald', label: 'ירוק', hex: '#10b981' },
  { name: 'blue', label: 'כחול', hex: '#3b82f6' },
  { name: 'indigo', label: 'אינדיגו', hex: '#6366f1' },
  { name: 'purple', label: 'סגול', hex: '#8b5cf6' },
  { name: 'cyan', label: 'טורקיז', hex: '#06b6d4' },
  { name: 'orange', label: 'כתום', hex: '#f97316' },
  { name: 'rose', label: 'ורוד', hex: '#f43f5e' },
];

/**
 * The closed icon vocabulary, shared by the municipal editor and the school wizard.
 *
 * It lives here beside COLOR_CHOICES because the two are chosen together and both
 * pickers need both — a second copy would let the admin gain an icon the school's
 * picker never offers.
 */
export const ICON_CHOICES = [
  'fa-solid fa-graduation-cap', 'fa-solid fa-user-tie', 'fa-solid fa-robot',
  'fa-solid fa-microchip', 'fa-solid fa-shapes', 'fa-solid fa-lightbulb',
  'fa-solid fa-compass', 'fa-solid fa-people-group', 'fa-solid fa-seedling',
  'fa-solid fa-puzzle-piece', 'fa-solid fa-globe', 'fa-solid fa-heart',
];
