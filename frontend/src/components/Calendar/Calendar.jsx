import React, { useMemo, useState } from 'react';
import './Calendar.css';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function buildGrid() {
  // 35 cells ending today, aligned to Sun–Sat columns
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Sunday on or before (today - 34 days)
  const startAnchor = new Date(today);
  startAnchor.setDate(today.getDate() - 34);
  const dayOfWeek = startAnchor.getDay(); // 0=Sun
  startAnchor.setDate(startAnchor.getDate() - dayOfWeek);

  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(startAnchor);
    d.setDate(startAnchor.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function Calendar({ history = [], onDayClick }) {
  const [tooltip, setTooltip] = useState(null); // { date, sessionsPlayed, sessionsWon, x, y }

  const historyMap = useMemo(() => {
    const map = {};
    history.forEach(h => { map[h.date] = h; });
    return map;
  }, [history]);

  const cells = useMemo(() => buildGrid(), []);

  // Track month label shown per row
  const monthShown = {};

  return (
    <div className="calendar">
      {/* Day-of-week headers */}
      <div className="calendar-row calendar-header-row">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="calendar-header-cell">{l}</div>
        ))}
      </div>

      {/* 5 weeks */}
      {[0, 1, 2, 3, 4].map(week => (
        <div key={week} className="calendar-row">
          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
            const cellIdx = week * 7 + dow;
            const date = cells[cellIdx];
            const key = isoDate(date);
            const entry = historyMap[key] || { sessionsPlayed: 0, sessionsWon: 0 };
            const { sessionsPlayed, sessionsWon } = entry;

            // Month label on first cell of a new month
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const showMonth = !monthShown[monthKey];
            if (showMonth) monthShown[monthKey] = true;

            // Opacity based on sessions
            let opacity = 0;
            if (sessionsPlayed === 1) opacity = 0.3;
            else if (sessionsPlayed === 2) opacity = 0.6;
            else if (sessionsPlayed >= 3) opacity = 1;

            const hasWin = sessionsWon > 0;
            const isFuture = date > new Date();

            return (
              <div
                key={dow}
                className={`calendar-cell${hasWin && sessionsPlayed > 0 ? ' calendar-cell--won' : ''}${isFuture ? ' calendar-cell--future' : ''}`}
                style={opacity > 0 ? { '--cell-opacity': opacity } : undefined}
                data-active={opacity > 0 ? 'true' : undefined}
                onMouseEnter={e => {
                  if (isFuture) return;
                  setTooltip({
                    date: key,
                    sessionsPlayed,
                    sessionsWon,
                    x: e.currentTarget.getBoundingClientRect().left,
                    y: e.currentTarget.getBoundingClientRect().top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (!isFuture && onDayClick) onDayClick(key);
                }}
              >
                {showMonth && (
                  <span className="calendar-month-label">
                    {date.toLocaleString('default', { month: 'short' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Tooltip */}
      {tooltip && (
        <div className="calendar-tooltip" style={{ '--tip-x': `${tooltip.x}px`, '--tip-y': `${tooltip.y}px` }}>
          <div className="calendar-tooltip-date">{tooltip.date}</div>
          <div className="calendar-tooltip-line">{tooltip.sessionsPlayed} played · {tooltip.sessionsWon} won</div>
        </div>
      )}
    </div>
  );
}
