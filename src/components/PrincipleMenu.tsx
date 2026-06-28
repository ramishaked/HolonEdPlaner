import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRINCIPLES_DATA } from '../data';
import { DiagnosticAnswers } from '../types';

/**
 * Canonical principle titles used across the whole system.
 * Derived from `PRINCIPLES_DATA` so there is a single source of truth — the
 * exact same phrasing appears in the menu, headers, plan, diagnostic and print.
 */
export const PRINCIPLE_SHORT_TITLES: Record<number, string> = Object.fromEntries(
  PRINCIPLES_DATA.map((p) => [p.id, p.title])
);

export type MenuSelection = number | 'intro';

interface PrincipleMenuProps {
  selected: MenuSelection;
  onSelect: (id: MenuSelection) => void;
  scores: { [key: number]: number };
  answers: DiagnosticAnswers;
  /** Show the intro entry at the top (above the principles). Default true. */
  includeIntro?: boolean;
  /** Intro entry label / icon / hover summary (defaults to the orient "מבוא"). */
  introLabel?: string;
  introIcon?: string;
  introSummary?: string;
  /** Header label for the menu. */
  title?: string;
}

const COLLAPSE_KEY = 'school_principle_menu_collapsed_v1';
const INTRO_SUMMARY = 'סקירה כללית על הקיט ועל אופן השימוש בו.';
const TIP_WIDTH = 224; // px — keep in sync with the tooltip card width (w-56)

type TipState = { top: number; left: number; title: string; text: string };

/**
 * Uniform principles menu, shared across the system.
 * - Always shows each principle's icon, color, short title and current map score.
 * - Behaves like the Claude/Gemini side panels: a persistent sidebar (RTL right)
 *   with a single toggle that collapses it to a narrow icon rail and back.
 *   The collapsed/expanded choice is remembered (localStorage).
 * - Hovering a principle reveals a one-line summary flyout — the key affordance
 *   in the collapsed rail where labels are hidden. The flyout is rendered in a
 *   portal on <body> with fixed positioning so no ancestor's stacking context or
 *   overflow can ever clip it (e.g. the detail view's animated transform).
 */
export const PrincipleMenu: React.FC<PrincipleMenuProps> = ({
  selected,
  onSelect,
  scores,
  answers,
  includeIntro = true,
  introLabel = 'מבוא · על הקיט',
  introIcon = 'fa-solid fa-circle-info',
  introSummary = INTRO_SUMMARY,
  title = 'שבעת העקרונות',
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    // No saved preference: start collapsed on small screens (no room to expand).
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const [tip, setTip] = useState<TipState | null>(null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  // Position the flyout just to the left of the hovered row (toward the content),
  // flipping to the right only if there is no room on the left.
  const showTip = (el: HTMLElement, title: string, text: string) => {
    const rect = el.getBoundingClientRect();
    const gap = 8;
    let left = rect.left - gap - TIP_WIDTH;
    if (left < 8) left = rect.right + gap;
    setTip({ top: rect.top + rect.height / 2, left, title, text });
  };
  const hideTip = () => setTip(null);

  const handleSelect = (id: MenuSelection) => {
    onSelect(id);
    hideTip();
    // On a small screen the expanded panel overlays the content — close it after
    // a choice so the user sees the result. On desktop it stays put.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setCollapsed(true);
  };

  const toggleCollapsed = () => {
    hideTip();
    setCollapsed((c) => !c);
  };

  // ---- a single row (intro entry or a principle) -----------------------------
  const renderRow = (opts: {
    key: string;
    icon: string;
    accent: string;
    label: string;
    summary: string;
    active: boolean;
    onClick: () => void;
    scoreLabel?: string;
    assessed?: boolean;
  }) => {
    const { key, icon, accent, label, summary, active, onClick, scoreLabel, assessed } = opts;
    return (
      <button
        key={key}
        onClick={onClick}
        onMouseEnter={(e) => showTip(e.currentTarget, label, summary)}
        onMouseLeave={hideTip}
        onFocus={(e) => showTip(e.currentTarget, label, summary)}
        onBlur={hideTip}
        aria-label={label}
        className={`w-full flex cursor-pointer transition-all duration-200 rounded-xl ${
          collapsed ? 'flex-col items-center gap-0.5 p-1.5' : 'items-center gap-2.5 p-2.5 text-right'
        } ${
          active && !collapsed
            ? 'bg-primary-600 text-white shadow-md shadow-primary-600/15'
            : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <span
          className={`rounded-lg flex items-center justify-center shrink-0 ${
            collapsed ? 'w-9 h-9' : 'w-7 h-7'
          } ${collapsed && active ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
          style={{ backgroundColor: active && !collapsed ? 'rgba(255,255,255,0.18)' : `${accent}1a` }}
        >
          <i
            className={`${icon} ${collapsed ? 'text-base' : 'text-sm'}`}
            style={{ color: active && !collapsed ? '#ffffff' : accent }}
          ></i>
        </span>

        {!collapsed && <span className="flex-1 text-xs font-bold leading-tight">{label}</span>}

        {!collapsed && scoreLabel !== undefined && (
          <span
            className={`text-[0.65rem] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
              active
                ? 'bg-white/20 text-white'
                : assessed
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-amber-50 text-amber-600'
            }`}
          >
            {scoreLabel}
          </span>
        )}

        {collapsed && scoreLabel !== undefined && (
          <span className={`text-[0.6rem] font-mono leading-none ${assessed ? 'text-slate-400' : 'text-amber-500'}`}>
            {scoreLabel}
          </span>
        )}
      </button>
    );
  };

  const list = (
    <div className={collapsed ? 'space-y-1' : 'space-y-1.5'}>
      {includeIntro &&
        renderRow({
          key: 'intro',
          icon: introIcon,
          accent: '#2563eb',
          label: introLabel,
          summary: introSummary,
          active: selected === 'intro',
          onClick: () => handleSelect('intro'),
        })}

      {includeIntro && <div className="h-px bg-slate-100 my-1"></div>}

      {PRINCIPLES_DATA.map((p) => {
        const assessed = !!answers[p.id];
        const score = scores[p.id] ?? 1;
        return renderRow({
          key: String(p.id),
          icon: p.icon,
          accent: p.accentColor,
          label: PRINCIPLE_SHORT_TITLES[p.id] ?? p.title,
          summary: p.shortSummary,
          active: selected === p.id,
          onClick: () => handleSelect(p.id),
          scoreLabel: assessed ? score.toFixed(1) : '—',
          assessed,
        });
      })}
    </div>
  );

  // Toggle button — chevrons point the way the panel will move.
  const toggle = (
    <button
      onClick={toggleCollapsed}
      title={collapsed ? 'הרחב את התפריט' : 'כווץ את התפריט'}
      aria-label={collapsed ? 'הרחב את התפריט' : 'כווץ את התפריט'}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
    >
      <i className={`fa-solid ${collapsed ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
    </button>
  );

  return (
    <>
      {/* Scrim behind the expanded panel on small screens (it overlays content). */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 top-16 bg-slate-900/30 backdrop-blur-[2px] z-40 print:hidden"
          onClick={() => setCollapsed(true)}
        ></div>
      )}

      <aside
        className={`shrink-0 lg:sticky lg:top-36 print:hidden ${
          collapsed
            ? 'w-14'
            : 'w-[17rem] max-lg:fixed max-lg:top-16 max-lg:bottom-0 max-lg:right-0 max-lg:z-50 max-lg:shadow-2xl'
        }`}
      >
        <div className={`bg-white border border-slate-200 shadow-sm rounded-2xl ${collapsed ? 'p-1.5' : 'p-3'} max-lg:h-full max-lg:rounded-none max-lg:overflow-y-auto custom-scroll`}>
          {/* Header row: title (expanded only) + toggle */}
          <div className={`flex items-center pb-2 mb-1 border-b border-slate-100 ${collapsed ? 'justify-center' : 'justify-between gap-2 px-1'}`}>
            {!collapsed && (
              <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-compass text-primary-400"></i>
                {title}
              </h3>
            )}
            {toggle}
          </div>
          {list}
        </div>
      </aside>

      {/* Hover flyout — portaled to <body> with fixed positioning so it always
          renders on top, regardless of ancestor stacking contexts / overflow. */}
      {tip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[60] w-56 print:hidden"
            style={{ top: tip.top, left: tip.left, transform: 'translateY(-50%)' }}
            dir="rtl"
          >
            <div className="bg-white border border-slate-200 shadow-lg rounded-xl p-3 text-right">
              <p className="text-xs font-bold text-slate-800 mb-0.5">{tip.title}</p>
              <p className="text-[0.7rem] leading-snug text-slate-500">{tip.text}</p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
