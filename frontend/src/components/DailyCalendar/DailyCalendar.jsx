import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import {
  getDailyCalendar,
  getDailyLeaderboard,
  getMyDailyRank,
  getDailyByDate,
} from '../../services/api';
import './DailyCalendar.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatTime(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function HeartIcon({ filled, faint }) {
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

export function DailyCalendar({ drawMode = 'draw3' }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const todayKey = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Detail view
  const [selectedDate, setSelectedDate] = useState(null);
  const [leaderboard,  setLeaderboard]  = useState([]);
  const [lbLoading,    setLbLoading]    = useState(false);
  const [sort,         setSort]         = useState('moves');
  const [myRank,       setMyRank]       = useState(null);
  const [replaying,    setReplaying]    = useState(false);

  // Load calendar data
  useEffect(() => {
    setLoading(true);
    getDailyCalendar(drawMode, 4)
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [drawMode]);

  const entryMap = useMemo(() => {
    const map = {};
    entries.forEach(e => { map[e.date] = e; });
    return map;
  }, [entries]);

  // Load leaderboard when a date is selected
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
      getMyDailyRank(selectedDate, user.id, sort, drawMode)
        .then(setMyRank)
        .catch(() => setMyRank(null));
    }
  }, [selectedDate, sort, drawMode, user]);

  const handleDayClick = useCallback((key) => {
    if (!entryMap[key]) return; // no challenge for this day
    setSort('moves');
    setSelectedDate(key);
  }, [entryMap]);

  const handlePlay = useCallback(async () => {
    if (!selectedDate || replaying) return;
    setReplaying(true);
    try {
      const data = await getDailyByDate(selectedDate, drawMode);
      navigate('/game', {
        state: {
          replayHandId:    data.hand.id,
          replayDrawMode:  data.hand.drawMode,
          replayIsDaily:   true,
          replayDailyDate: selectedDate,
          // isRanked not forced here — backend applies the same one-ranked-win-per-day
          // rule as today's daily: ranked if the user hasn't won it yet, unranked if they have.
        },
      });
    } catch {
      setReplaying(false);
    }
  }, [selectedDate, drawMode, replaying, navigate]);

  const navigate_month = useCallback((delta) => {
    let m = month + delta;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m);
    setYear(y);
  }, [month, year]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const rows  = useMemo(() => {
    const r = [];
    for (let i = 0; i < cells.length; i += 7) r.push(cells.slice(i, i + 7));
    return r;
  }, [cells]);

  const atCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // ── Detail view ──────────────────────────────────────────────────────────
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
          >Moves</button>
          <button
            className={`dc-sort-btn${sort === 'time' ? ' active' : ''}`}
            onClick={() => setSort('time')}
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
              {leaderboard.map(row => (
                <tr
                  key={row.userId}
                  className={user && row.userId === user.id ? 'dc-lb-me' : ''}
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

  // ── Calendar grid view ───────────────────────────────────────────────────
  return (
    <div className="dc-container">
      {loading && <p className="dc-empty dc-empty--center">Loading calendar…</p>}

      {!loading && (
        <>
          <div className="dc-nav">
            <button
              className="dc-nav-btn"
              onClick={() => navigate_month(-1)}
              title="Previous month"
            >‹</button>
            <span className="dc-nav-title">{MONTH_NAMES[month]} {year}</span>
            <button
              className="dc-nav-btn"
              onClick={() => navigate_month(1)}
              disabled={atCurrentMonth}
              title="Next month"
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
                const status  = entry?.userStatus;

                const cls = [
                  'dc-cell',
                  entry    ? 'dc-cell--has-challenge' : '',
                  isToday  ? 'dc-cell--today'         : '',
                  isFuture ? 'dc-cell--future'        : '',
                  status === 'won'    ? 'dc-cell--won'    : '',
                  status === 'played' ? 'dc-cell--played' : '',
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={`${wi}-${di}`}
                    className={cls}
                    onClick={() => !isFuture && handleDayClick(key)}
                  >
                    <span className="dc-day-num">{day}</span>
                    {status === 'won' && (
                      <HeartIcon filled />
                    )}
                    {status === 'played' && (
                      <HeartIcon faint />
                    )}
                    {!status && entry && !isFuture && (
                      <span className="dc-dot" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="dc-legend">
            <span className="dc-legend-item">
              <HeartIcon filled /> Won
            </span>
            <span className="dc-legend-item">
              <HeartIcon faint /> Played
            </span>
            <span className="dc-legend-item">
              <span className="dc-dot" /> Not played
            </span>
          </div>
        </>
      )}
    </div>
  );
}
