import React, { useState } from 'react';
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
    <div className="max-w-5xl mx-auto space-y-6 print:hidden" dir="rtl">
      {/* Deliberately unlike the school chrome — you are not in "my settings" here. */}
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg shrink-0">
            <i className="fa-solid fa-user-shield" />
          </span>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">מסך מנהל המערכת</h1>
            <p className="text-xs text-white/60 mt-0.5">
              {/* No name until it loads — better a shorter line than a flash of the wrong city. */}
              ניהול עירוני{municipality && ` — ${municipality}`} · שינויים כאן משפיעים על כל בתי הספר
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

      <TabBar tabs={TABS} active={tab} onSelect={selectTab} />

      {notice && <Notice text={notice} onClose={() => setNotice('')} />}

      {tab === 'dashboard' && <MunicipalDashboard bank={bankState} />}
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
        <p className="text-[11px] text-slate-400 text-center pb-2">
          טרם נבנה במסך זה: גרסאות תוכנית מרובות.
        </p>
      )}
    </div>
  );
};
