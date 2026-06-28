import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * One unified button across the whole kit. Presentational only — it passes
 * through every native button prop (onClick, disabled, type, aria-*, …) and
 * just standardizes the visual language (single blue primary, slate neutrals,
 * consistent rounding/spacing). Replaces the dozen ad-hoc button styles.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm disabled:bg-primary-300',
  secondary:
    'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 disabled:text-slate-300',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:text-slate-300',
  danger:
    'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-sm md:text-base gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => (
  <button
    className={`inline-flex items-center justify-center rounded-xl font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
