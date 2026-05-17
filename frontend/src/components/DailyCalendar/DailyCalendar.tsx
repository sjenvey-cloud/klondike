import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getDailyCalendar,
  getDailyLeaderboard,
  getMyDailyRank,
  getDailyByDate,
} from '../../services/api';
import type { DailyCalendarEntry, DailyLeaderboardEntry } from '../../types/api';
import './DailyCalendar.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatTime(s: number | null | undefined): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function HeartIcon({ filled, faint }: { filled?: boolean; faint?: boolean }): React.JSX.Element {
  return (
    <svg
      className={`dc-heart${filled ? ' dc-heart--filled' : ''}${faint ? ' dc-heart--faint' : ''}`}
      width="12" height="11" viewBox="0 0 12 11" aria-hidden="true"
    >
      <path
        d="M6 10.5C6 10.5 1 7 1 3.5a2.5 2.5 0 0 1 5-0C6 3.5 6 3.5 6 3.5a2.5 2.5 0 0 1 5 0C11 7 6 10.5 6 10.5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

interface DailyCalendarProps {
  drawMode?: string;
  onPlay: (hand: unknown, date: string, userHasRankedAttempt: boolean) => void;
}

export function DailyCalendar({ drawMode = 'draw3', onPlay }: DailyCalendarProps): React.JSX.Element {
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);
  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [entries,  setEntries]  = useState<DailyCalendarEntry[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [leaderboard,  setLeaderboard]  = useState<DailyLeaderboardEntry[]>([]);
  const [lbLoading,    setLbLoading]    = useState(false);
  const [sort,         setSort]         = useState('moves');
  const [myRank,       setMyRank]       = useState<DailyLeaderboardEntry | null>(null);
  const [replaying,    setReplaying]    = useState(false);

  useEffect(() => {
    setLoading(true);
    getDailyCalendar(drawMode, 4)
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [drawMode]);

  const entryMap = useMemo(() => {
    const map: Record<string, DailyCalendarEntry> = {};
    entries.forEach(e => { map[e.date] = e; });
    return map;
  }, [entries]);

  useEffect(() => {
    if (!selectedDate) return;
    setLbLoading(true);
    setLeaderboard([]);
    setMyRank(null);
    getDailyLeaderboard(selectedDate, sort, drawMode)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false));
    if (user) {
      getMyDailyRank(selectedDate, String(user.id), sort, drawMode)
        .then(data => setMyRank(data))
        .catch(() => setMyRank(null));
    }
  }, [selectedDate, sort, drawMode, user]);

  const handleDayClick = useCallback((key: string): void => {
    if (!entryMap[key]) return;
    setSort('moves');
    setSelectedDate(key);
  }, [entryMap]);

  const handlePlay = useCallback(async (): Promise<void> => {
    if (!selectedDate || replaying) return;
    setReplaying(true);
    try {
      const data = await getDailyByDate(selectedDate, drawMode) as unknown as { hand: unknown; userHasRankedAttempt?: boolean };
      onPlay(data.hand, selectedDate, !!data.userHasRankedAttempt);
    } catch {
      // fall through
    } finally {
      setReplaying(false);
    }
  }, [selectedDate, drawMode, replaying, onPlay]);

  const navigateMonth = useCallback((delta: number): void => {
    let m = month + delta;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m);
    setYear(y);
  }, [month, year]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const rows  = useMemo(() => {
    const r: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) r.push(cells.slice(i, i + 7));
    return r;
  }, [cells]);

  const atCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  if (selectedDate) {
    const entry = entryMap[selectedDate];
    const isToday = selectedDate === todayKey;
    const label = isToday ? 'Today' : selectedDate;

    return (
      <div className="dc-detail">
        <div className="dc-detail-header">
          <button className="dc-back-btn" onClick={() => setSelectedDate(null)}>‹ Calendar</button>
          <span className="dc-detail-date">{label}</span>
        </div>

        {entry?.userStatus === 'won' && myRank && (
          <div className="dc-my-rank-bar">
            Your rank: <strong>#{myRank.rank}</strong>
            {myRank.moves && (
              <> · {myRank.moves} moves · {formatTime(myRank.timeSeconds)}</>
            )}
          </div>
        )}

        <div className="dc-sort-row">
          <span className="dc-sort-label">Sort by:</span>
          <button
            className={`dc-sort-btn${sort === 'moves' ? ' active' : ''}`}
            onClick={() => setSort('moves')}
            aria-pressed={sort === 'moves'}
          >Moves</button>
          <button
            className={`dc-sort-btn${sort === 'time' ? ' active' : ''}`}
            onClick={() => setSort('time')}
            aria-pressed={sort === 'time'}
          >Time</button>
          <button
            className="dc-play-btn"
            onClick={handlePlay}
            disabled={replaying}
          >
            {replaying ? 'Loading…' : '▶ Play'}
          </button>
        </div>

        {lbLoading && <p className="dc-empty">Loading…</p>}

        {!lbLoading && leaderboard.length === 0 && (
          <p className="dc-empty">No winners yet for this challenge.</p>
        )}

        {!lbLoading && leaderboard.length > 0 && (
          <table className="dc-lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Moves</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr
                  key={i}
                  className={user && row.userUuid === user.uuid ? 'dc-lb-me' : ''}
                >
                  <td>{row.rank}</td>
                  <td>{row.displayName}</td>
                  <td>{row.moves}</td>
                  <td>{formatTime(row.timeSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="dc-container">
      {loading && <p role="status" className="dc-empty dc-empty--center">Loading calendar…</p>}

      {!loading && (
        <>
          <div className="dc-nav">
            <button className="dc-nav-btn" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
            <span className="dc-nav-title" aria-live="polite">{MONTH_NAMES[month]} {year}</span>
            <button
              className="dc-nav-btn"
              onClick={() => navigateMonth(1)}
              disabled={atCurrentMonth}
              aria-label="Next month"
            >›</button>
          </div>

          <div className="dc-grid">
            {DAY_LABELS.map(l => (
              <div key={l} className="dc-cell dc-cell--label">{l}</div>
            ))}

            {rows.map((row, wi) =>
              row.map((day, di) => {
                if (day === null) {
                  return <div key={`${wi}-${di}`} className="dc-cell dc-cell--empty" />;
                }

                const key     = isoDate(year, month, day);
                const entry   = entryMap[key];
                const isToday = key === todayKey;
                const isFuture = key > todayKey;
                const won    = entry?.userStatus === 'won';
                const played = entry?.userStatus === 'played';

                const cls = [
                  'dc-cell',
                  entry    ? 'dc-cell--has-challenge' : '',
                  isToday  ? 'dc-cell--today'         : '',
                  isFuture ? 'dc-cell--future'        : '',
                  won      ? 'dc-cell--won'            : '',
                  played && !won ? 'dc-cell--played'  : '',
                ].filter(Boolean).join(' ');

                const cellLabel = [
                  MONTH_NAMES[month], String(day),
                  isToday  ? '(today)' : '',
                  won      ? 'Won' : '',
                  played && !won ? 'Played' : '',
                  !played && entry && !isFuture ? 'Challenge available' : '',
                  isFuture ? '(future)' : '',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={`${wi}-${di}`}
                    className={cls}
                    onClick={() => !isFuture && handleDayClick(key)}
                    disabled={isFuture || !entry}
                    aria-label={cellLabel}
                    type="button"
                  >
                    <span className="dc-day-num" aria-hidden="true">{day}</span>
                    {won && <HeartIcon filled />}
                    {played && !won && <HeartIcon faint />}
                    {!played && entry && !isFuture && <span className="dc-dot" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="dc-legend">
            <span className="dc-legend-item"><HeartIcon filled /> Won</span>
            <span className="dc-legend-item"><HeartIcon faint /> Played</span>
            <span className="dc-legend-item"><span className="dc-dot" /> Not played</span>
          </div>
        </>
      )}
    </div>
  );
}
