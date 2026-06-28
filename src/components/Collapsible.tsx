import React, { useState } from 'react';

interface CollapsibleProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string; // FontAwesome class, e.g. "fa-solid fa-book"
  tone?: 'light' | 'dark';
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable RTL accordion frame. Used to keep dense content blocks clean &
 * collapsed by default ("collapsed frames wherever there's too much info").
 */
export const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  defaultOpen = false,
  icon,
  tone = 'light',
  children,
  className = '',
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const dark = tone === 'dark';

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border overflow-hidden ${
        dark ? 'border-slate-700/60 bg-slate-950/40' : 'border-slate-200/70 bg-white'
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 p-4 text-right transition-colors cursor-pointer ${
          dark ? 'hover:bg-white/5' : 'hover:bg-slate-50/70'
        }`}
      >
        <span className={`flex items-center gap-2 font-bold text-sm ${dark ? 'text-white' : 'text-slate-900'}`}>
          {icon && <i className={`${icon} ${dark ? 'text-primary-300' : 'text-primary-600'}`}></i>}
          <span>{title}</span>
        </span>
        <i
          className={`fa-solid fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        ></i>
      </button>
      {open && <div className={`px-4 pb-4 pt-1 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{children}</div>}
    </div>
  );
};
