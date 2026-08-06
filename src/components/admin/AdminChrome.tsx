import React from 'react';

/**
 * The shared shell of the municipal admin console. Lives outside AdminArea so the
 * per-tab components can use it without importing back from their own parent.
 *
 * The visual language is deliberately unlike the school chrome — dark header, indigo
 * accents — because everything done here changes what all the schools see.
 */

export const Section: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, right, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 bg-indigo-50">
          <i className={`${icon} text-base`} />
        </span>
        <div>
          <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </section>
);

export const Stat: React.FC<{ value: number | string; label: string }> = ({ value, label }) => (
  <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center min-w-[86px]">
    <p className="text-xl font-bold text-white leading-none">{value}</p>
    <p className="text-[10px] text-white/60 mt-1">{label}</p>
  </div>
);

/** The console's one feedback channel — there is no toast layer in this app. */
export const Notice: React.FC<{ text: string; onClose: () => void; tone?: 'info' | 'error' }> = ({
  text,
  onClose,
  tone = 'info',
}) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 border ${
      tone === 'error'
        ? 'bg-rose-50 border-rose-100'
        : 'bg-indigo-50 border-indigo-100'
    }`}
  >
    <p className={`text-xs font-bold ${tone === 'error' ? 'text-rose-800' : 'text-indigo-800'}`}>
      {text}
    </p>
    <button
      onClick={onClose}
      aria-label="סגירת ההודעה"
      className={`cursor-pointer ${
        tone === 'error' ? 'text-rose-400 hover:text-rose-700' : 'text-indigo-400 hover:text-indigo-700'
      }`}
    >
      <i className="fa-solid fa-xmark" />
    </button>
  </div>
);

export interface TabDef<K extends string> {
  key: K;
  icon: string;
  label: string;
}

export function TabBar<K extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly TabDef<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            active === t.key
              ? 'bg-white text-indigo-700 border border-indigo-100 shadow-sm'
              : 'text-slate-500 hover:bg-white/60'
          }`}
        >
          <i className={t.icon} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
