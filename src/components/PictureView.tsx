import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPicture, picturePageUrl, PictureData } from '../lib/picture';
import { pictureOrigin } from '../../api/_lib/pictureSource';

/**
 * "התמונה החינוכית" — the school's tech-matriculation page, framed.
 *
 * The page is a separate app (the Holon tech dashboard's school view). In `?embed`
 * mode it loads nothing itself: it announces `ready` and waits. This component fetches
 * the school's data from /api/picture — where the server, not the browser, decided
 * which school this is and stripped the other schools' names — and hands it over.
 * The page reports its height back so the frame grows with it (no inner scrollbar).
 *
 * All state lives here and dies with the component, so a different school signing in
 * on the same browser starts from nothing.
 */
export const PictureView: React.FC = () => {
  const frame = useRef<HTMLIFrameElement>(null);
  const data = useRef<PictureData | null>(null);
  const ready = useRef(false);
  const [height, setHeight] = useState(900);
  const [state, setState] = useState<'loading' | 'shown' | 'error'>('loading');
  const [error, setError] = useState('');
  const origin = pictureOrigin(picturePageUrl);

  const send = useCallback(() => {
    if (!ready.current || !data.current || !frame.current?.contentWindow) return;
    frame.current.contentWindow.postMessage(
      { source: 'holon-planner', type: 'data', school: data.current.school, tabs: data.current.tabs },
      origin,
    );
    setState('shown');
  }, [origin]);

  const load = useCallback(() => {
    setState('loading');
    setError('');
    fetchPicture()
      .then((d) => {
        data.current = d;
        send();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'טעינת התמונה החינוכית נכשלה.');
        setState('error');
      });
  }, [send]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== origin || ev.source !== frame.current?.contentWindow) return;
      const m = ev.data as { source?: string; type?: string; height?: number } | null;
      if (!m || m.source !== 'holon-picture') return;
      if (m.type === 'ready') {
        ready.current = true;
        send();
      } else if (m.type === 'height' && typeof m.height === 'number' && m.height > 0) {
        setHeight(Math.min(Math.round(m.height), 20000));
      }
    };
    window.addEventListener('message', onMessage);
    load();
    return () => window.removeEventListener('message', onMessage);
  }, [origin, send, load]);

  return (
    <div dir="rtl">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">התמונה החינוכית</h1>
        <p className="text-sm text-slate-500 mt-1">
          נתוני בית הספר במדד בגרות הטק, מול המדד העירוני. הנתונים מוצגים לבית הספר שלכם בלבד.
        </p>
      </div>

      {state === 'error' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-slate-700 font-bold">{error}</p>
          <button
            onClick={load}
            className="mt-4 px-4 py-2 rounded-full bg-primary-600 text-white text-sm font-bold cursor-pointer hover:bg-primary-700"
          >
            נסו שוב
          </button>
        </div>
      ) : (
        <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {state === 'loading' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-slate-300" aria-label="טוען" />
            </div>
          )}
          <iframe
            ref={frame}
            src={`${picturePageUrl}?embed=1`}
            title="התמונה החינוכית"
            className="block w-full border-0"
            style={{ height }}
          />
        </div>
      )}
    </div>
  );
};
