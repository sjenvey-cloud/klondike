import React, { useMemo, useState } from 'react';
import './Calendar.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/**
 * Build a 6-row grid for the given year/month.
 * Cells before the 1st and after the last day are null (greyed out padding).
 */
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing empty cells to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

export function Calendar({ history = [], onDayClick, onMonthChange }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const historyMap = useMemo(() => {
    const map = {};
    history.forEach(h => { map[h.date] = h; });
    return map;
  }, [history]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const navigate = (deltaMonth) => {
    let m = month + deltaMonth;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m);
    setYear(y);
    if (onMonthChange) onMonthChange(y, m);
  };

  const navigateYear = (deltaYear) => {
    const y = year + deltaYear;
    setYear(y);
    if (onMonthChange) onMonthChange(y, month);
  };

  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const isFutureCell = (d) => {
    if (d === null) return false;
    return isoDate(year, month, d) > todayKey;
  };

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div className="calendar">
      {/* ── Navigation header ──────────────────────────────────────────── */}
      <div className="calendar-nav">
        <div className="calendar-nav-side">
          <button className="cal-nav-btn" onClick={() => navigateYear(-1)} title="Previous year">«</button>
          <button className="cal-nav-btn" onClick={() => navigate(-1)}     title="Previous month">‹</button>
        </div>
        <div className="calendar-nav-title">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="calendar-nav-side">
          <button
            className="cal-nav-btn"
            onClick={() => navigate(1)}
            disabled={year === today.getFullYear() && month === today.getMonth()}
            title="Next month"
          >›</button>
          <button
            className="cal-nav-btn"
            onClick={() => navigateYear(1)}
            disabled={year >= today.getFullYear()}
            title="Next year"
          >»</button>
        </div>
      </div>

      {/* ── Day-of-week headers ─────────────────────────────────────────── */}
      <div className="calendar-row calendar-header-row">
        {DAY_LABELS.map(l => (
          <div key={l} className="calendar-header-cell">{l}</div>
        ))}
      </div>

      {/* ── Weeks ──────────────────────────────────────────────────────── */}
      {rows.map((row, wi) => (
        <div key={wi} className="calendar-row">
          {row.map((day, di) => {
            if (day === null) {
              return <div key={di} className="calendar-cell calendar-cell--empty" />;
            }

            const key = isoDate(year, month, day);
            const entry = historyMap[key] || { sessionsPlayed: 0, sessionsWon: 0 };
            const { sessionsPlayed, sessionsWon } = entry;
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

            return (
              <div
                key={di}
                className={classes}
                style={opacity > 0 ? { '--cell-opacity': opacity } : undefined}
                onClick={() => !isFuture && onDayClick && onDayClick(key)}
                title={hasPlayed ? `${sessionsPlayed} played · ${sessionsWon} won` : undefined}
              >
                <span className="calendar-day-num">{day}</span>
                {hasPlayed && !isFuture && (
                  <span className="calendar-dot-row">
                    {sessionsWon > 0 && <span className="calendar-dot calendar-dot--win" />}
                    {sessionsPlayed - sessionsWon > 0 && <span className="calendar-dot calendar-dot--play" />}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
