import React, { useState } from 'react';
import { version } from '../../package.json';
import { usePrinciples } from '../lib/PrinciplesContext';
import { useAudiences } from '../lib/audiences';
import { useActivityBank } from '../lib/activityBank';
import { useMunicipality } from '../lib/municipality';
import type { AdminViewer } from '../lib/adminAuth';
import { MunicipalDashboard } from './MunicipalDashboard';
import { Notice, Stat, TabBar, type TabDef } from './admin/AdminChrome';
import { BankTab } from './admin/BankTab';
import { PrinciplesTab } from './admin/PrinciplesTab';
import { AudiencesTab } from './admin/AudiencesTab';
import { SchoolsTab } from './admin/SchoolsTab';

interface Props {
  viewer: AdminViewer;
  /** Logs the admin out of the application. */
  onExit: () => void;
}

/**
 * The municipal admin area — a screen of its own, not a panel inside a school's
 * settings. Everything here is city-wide: editing the bank or a principle changes what
 * all 43 schools see. The deliberately different chrome (dark header, indigo accents)
 * is the signal that this is no longer "my school's settings".
 *
 * This file is only the shell: header, tabs, and the one notice channel. Each tab
 * owns its own data and writes.
 */

type Tab = 'dashboard' | 'bank' | 'principles' | 'audiences' | 'schools';

const TABS: readonly TabDef<Tab>[] = [
  { key: 'dashboard', icon: 'fa-solid fa-chart-line', label: 'דשבורד עירוני' },
  { key: 'bank', icon: 'fa-solid fa-layer-group', label: 'בנק הפעילויות' },
  { key: 'principles', icon: 'fa-solid fa-list-check', label: 'עקרונות' },
  { key: 'audiences', icon: 'fa-solid fa-users', label: 'קהלי יעד' },
  { key: 'schools', icon: 'fa-solid fa-school', label: 'בתי ספר' },
];

export const AdminArea: React.FC<Props> = ({ viewer, onExit }) => {
  const { principles } = usePrinciples();
  // Held here, not per tab: the header counters and the tabs must see the same data,
  // and a write in one tab has to refresh the counters above it.
  const audiencesState = useAudiences();
  // Hidden activities included: the console lists them so they can be restored, and
  // the dashboard needs them to keep naming an adoption of an activity since hidden.
  const bankState = useActivityBank({ includeInactive: true });
  const { name: municipality } = useMunicipality();

  // The dashboard is the landing view: an admin arrives asking "what's going on",
  // not "let me edit the bank".
  const [tab, setTab] = useState<Tab>('dashboard');
  const [notice, setNotice] = useState('');

  const selectTab = (next: Tab) => {
    setTab(next);
    // A message about the bank is meaningless once you're looking at the principles.
    setNotice('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Printing this screen means printing the municipal dashboard — the header goes
          light, the console furniture drops out, and the editing tabs never print. */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h1 className="text-lg font-bold text-slate-900">
          מסך מנהל המערכת · ניהול עירוני{municipality && ` — ${municipality}`}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          הופק ב-{new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Deliberately unlike the school chrome — you are not in "my settings" here. */}
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg shrink-0">
            <i className="fa-solid fa-user-shield" />
          </span>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">מסך מנהל המערכת</h1>
            <p className="text-xs text-white/60 mt-0.5">
              {/* No name until it loads — better a shorter line than a flash of the wrong city. */}
              ניהול עירוני{municipality && ` — ${municipality}`} · שינויים כאן משפיעים על כל בתי הספר{' '}
              <span dir="ltr" className="font-mono text-white/40">· v{version}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Stat value={bankState.all.filter((i) => i.isActive).length} label="פעילויות" />
          <Stat value={principles.length} label="עקרונות" />
          <Stat value={audiencesState.audiences.length} label="קהלי יעד" />
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer mr-2"
          >
            <i className="fa-solid fa-right-from-bracket" />
            יציאה
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <TabBar tabs={TABS} active={tab} onSelect={selectTab} />
        {tab === 'dashboard' && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-print" />
            הדפסה / PDF
          </button>
        )}
      </div>

      {notice && <Notice text={notice} onClose={() => setNotice('')} />}

      {tab === 'dashboard' && <MunicipalDashboard bank={bankState} />}

      {/* The editing consoles are working surfaces, not documents — they never print. */}
      <div className="print:hidden">
        {tab === 'bank' && (
          <BankTab viewer={viewer} onNotice={setNotice} bank={bankState} audiences={audiencesState} />
        )}
        {tab === 'principles' && (
          <PrinciplesTab viewer={viewer} onNotice={setNotice} bank={bankState} />
        )}
        {tab === 'audiences' && (
          <AudiencesTab viewer={viewer} onNotice={setNotice} audiences={audiencesState} />
        )}
        {tab === 'schools' && <SchoolsTab onNotice={setNotice} />}

        {tab !== 'dashboard' && (
          <p className="text-[11px] text-slate-400 text-center pt-6 pb-2">
            טרם נבנה במסך זה: גרסאות תוכנית מרובות.
          </p>
        )}
      </div>
    </div>
  );
};
