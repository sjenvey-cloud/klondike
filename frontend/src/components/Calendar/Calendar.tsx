import React, { useMemo, useState } from 'react';
import './Calendar.css';

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

interface HistoryEntry {
  date: string;
  played: number;
  won: number;
}

interface CalendarProps {
  history?: HistoryEntry[];
  onDayClick?: (dateKey: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function Calendar({ history = [], onDayClick, onMonthChange }: CalendarProps): React.JSX.Element {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const historyMap = useMemo(() => {
    const map: Record<string, HistoryEntry> = {};
    history.forEach(h => { map[h.date] = h; });
    return map;
  }, [history]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const navigate = (deltaMonth: number): void => {
    let m = month + deltaMonth;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m);
    setYear(y);
    if (onMonthChange) onMonthChange(y, m);
  };

  const navigateYear = (deltaYear: number): void => {
    const y = year + deltaYear;
    setYear(y);
    if (onMonthChange) onMonthChange(y, month);
  };

  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const isFutureCell = (d: number | null): boolean => {
    if (d === null) return false;
    return isoDate(year, month, d) > todayKey;
  };

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <div className="calendar-nav-side">
          <button className="cal-nav-btn" onClick={() => navigateYear(-1)} aria-label="Previous year">«</button>
          <button className="cal-nav-btn" onClick={() => navigate(-1)} aria-label="Previous month">‹</button>
        </div>
        <div className="calendar-nav-title" aria-live="polite">{MONTH_NAMES[month]} {year}</div>
        <div className="calendar-nav-side">
          <button
            className="cal-nav-btn"
            onClick={() => navigate(1)}
            disabled={year === today.getFullYear() && month === today.getMonth()}
            aria-label="Next month"
          >›</button>
          <button
            className="cal-nav-btn"
            onClick={() => navigateYear(1)}
            disabled={year >= today.getFullYear()}
            aria-label="Next year"
          >»</button>
        </div>
      </div>

      <div className="calendar-row calendar-header-row">
        {DAY_LABELS.map(l => (
          <div key={l} className="calendar-header-cell">{l}</div>
        ))}
      </div>

      {rows.map((row, wi) => (
        <div key={wi} className="calendar-row">
          {row.map((day, di) => {
            if (day === null) {
              return <div key={di} className="calendar-cell calendar-cell--empty" />;
            }

            const key = isoDate(year, month, day);
            const entry = historyMap[key] ?? { played: 0, won: 0, date: key };
            const { played: sessionsPlayed, won: sessionsWon } = entry;
            const isToday   = key === todayKey;
            const isFuture  = isFutureCell(day);
            const hasWin    = sessionsWon > 0;
            const hasPlayed = sessionsPlayed > 0;

            let opacity = 0;
            if (sessionsPlayed === 1) opacity = 0.35;
            else if (sessionsPlayed === 2) opacity = 0.65;
            else if (sessionsPlayed >= 3) opacity = 1;

            const classes = [
              'calendar-cell',
              hasPlayed && !isFuture ? 'calendar-cell--played' : '',
              hasWin && !isFuture    ? 'calendar-cell--won'    : '',
              isToday                ? 'calendar-cell--today'  : '',
              isFuture               ? 'calendar-cell--future' : '',
            ].filter(Boolean).join(' ');

            const dayLabel = [
              MONTH_NAMES[month], String(day),
              isToday ? '(today)' : '',
              hasWin   ? `${sessionsWon} won` : '',
              hasPlayed && !hasWin ? `${sessionsPlayed} played` : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={di}
                className={classes}
                style={opacity > 0 ? { '--cell-opacity': opacity } as React.CSSProperties : undefined}
                onClick={() => !isFuture && onDayClick && onDayClick(key)}
                disabled={isFuture || !onDayClick}
                aria-label={dayLabel}
                aria-pressed={false}
                type="button"
              >
                <span className="calendar-day-num" aria-hidden="true">{day}</span>
                {hasPlayed && !isFuture && (
                  <span className="calendar-dot-row" aria-hidden="true">
                    {sessionsWon > 0 && <span className="calendar-dot calendar-dot--win" />}
                    {sessionsPlayed - sessionsWon > 0 && <span className="calendar-dot calendar-dot--play" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
