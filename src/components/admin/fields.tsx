import React from 'react';

/**
 * Form primitives shared by the admin console (the activity wizard, the principle
 * editor, the audience manager). They were grown inside ActivityWizard; extracting
 * them keeps the console visually one thing rather than three near-copies.
 */

export const inputClass =
  'border border-slate-200 text-sm rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full';

export const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({
  on, onClick, children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
      on
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    }`}
  >
    {children}
  </button>
);

export const Labeled: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label, hint, children,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-slate-600">
      {label} {hint && <span className="font-normal text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
);

/**
 * Editor for a `text[]` column (gaps solved, implementation steps, KPIs). One row per
 * item with reorder arrows and a remove button, because these render as ordered lists
 * on the school side and the order carries meaning.
 */
export const ArrayField: React.FC<{
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  rows?: number;
}> = ({ label, hint, values, onChange, placeholder, addLabel = 'הוספת שורה', rows = 2 }) => {
  const set = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(values.filter((_, j) => j !== i));
  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= values.length) return;
    const next = [...values];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Labeled label={label} hint={hint}>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 w-4 pt-3 shrink-0">{i + 1}</span>
            <textarea
              rows={rows}
              className={inputClass}
              value={v}
              placeholder={placeholder}
              onChange={(e) => set(i, e.target.value)}
            />
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="הזזה למעלה"
                className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-1 cursor-pointer"
              >
                <i className="fa-solid fa-chevron-up text-[10px]" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === values.length - 1}
                aria-label="הזזה למטה"
                className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default p-1 cursor-pointer"
              >
                <i className="fa-solid fa-chevron-down text-[10px]" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="הסרת השורה"
              className="text-slate-300 hover:text-rose-600 p-1.5 pt-2.5 cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...values, ''])}
          className="text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <i className="fa-solid fa-plus ml-1.5" aria-hidden="true" />
          {addLabel}
        </button>
      </div>
    </Labeled>
  );
};

/**
 * The console's confirm dialog. Destructive actions get the rose button; reversible
 * ones (deactivate, restore) get indigo, so "this can be undone" is visible before
 * reading the text.
 */
export const ConfirmDialog: React.FC<{
  title: string;
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  /** For a dialog that only acknowledges something — "cancel" would be meaningless. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}> = ({ title, confirmLabel, tone = 'danger', busy, hideCancel, onConfirm, onCancel, children }) => (
  <div
    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    onClick={onCancel}
    dir="rtl"
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-right"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <div className="text-xs text-slate-600 leading-relaxed space-y-2">{children}</div>
      <div className="flex items-center justify-end gap-2 pt-1">
        {!hideCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            ביטול
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 cursor-pointer ${
            tone === 'danger' ? 'bg-rose-600' : 'bg-indigo-600'
          }`}
        >
          {busy ? 'רגע…' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
