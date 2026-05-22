import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { getDaily, getDailyLeaderboard, getMyDailyRank } from '../services/api';
import type { DailyHandResponse, DailyLeaderboardEntry } from '../types/api';
import { localDateString } from '../services/dateUtils';
import { Game } from './Game';
import { DailyCalendar } from '../components/DailyCalendar/DailyCalendar';
import { DailyWinModal } from '../components/DailyWinModal/DailyWinModal';
import './Daily.css';

function formatTime(s: number | null | undefined): string {
  if (!s) return '—';
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface DailyResponse {
  hand: DailyHandResponse;
  userHasRankedAttempt: boolean;
}

interface DailyWinData {
  moves: number;
  timeFormatted: string;
  rank: number | null;
  sessionUuid?: string | null;
}

interface PriorDailyInfo {
  hand: DailyHandResponse;
  date: string;
  userHasRankedAttempt: boolean;
}

type DailyView = 'board' | 'leaderboard' | 'calendar';
type DailyWinDest = 'leaderboard' | 'calendar' | 'game' | 'home' | 'profile' | 'replay';

export function Daily(): React.JSX.Element {
  const { user }        = useAuth();
  const { preferences } = usePreferences();
  const navigate        = useNavigate();

  const [daily,      setDaily]      = useState<DailyResponse | null>(null);
  const [dailyError, setDailyError] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [myRank,      setMyRank]      = useState<DailyLeaderboardEntry | null>(null);
  const [sort,        setSort]        = useState('moves');
  const [view,        setView]        = useState<DailyView>('board');

  const [dailyWinData, setDailyWinData] = useState<DailyWinData | null>(null);

  const [priorDailyInfo,    setPriorDailyInfo]    = useState<PriorDailyInfo | null>(null);
  const [priorDailyWinData, setPriorDailyWinData] = useState<DailyWinData | null>(null);

  const drawMode = daily?.hand?.drawMode ?? 'draw3';
  // Use the date from the backend response so the header always matches the actual
  // challenge being played — client clock can be ahead of the backend after midnight.
  const handDate   = daily?.hand?.date ?? localDateString(new Date());
  const activeDate = priorDailyInfo?.date ?? handDate;

  useEffect(() => { document.title = 'Daily Challenge – Klondike Pro'; }, []);
  useEffect(() => {
    getDaily()
      .then(data => { setDaily(data as unknown as DailyResponse); setDailyError(false); })
      .catch(() => setDailyError(true));
  }, []);

  useEffect(() => {
    if (view !== 'leaderboard') return;
    getDailyLeaderboard(activeDate, sort, drawMode)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [activeDate, sort, view, drawMode]);

  useEffect(() => {
    if (view !== 'leaderboard') return;
    if (user) {
      getMyDailyRank(activeDate, String(user.id), sort, drawMode)
        .then(data => setMyRank(data))
        .catch(() => {});
    }
  }, [activeDate, user, sort, view, drawMode]);

  const handlePriorDailyPlay = useCallback((hand: unknown, date: string, userHasRankedAttempt: boolean): void => {
    setPriorDailyWinData(null);
    setPriorDailyInfo({ hand: hand as DailyHandResponse, date, userHasRankedAttempt });
    setView('board');
  }, []);

  const handleWinNavigate = (dest: DailyWinDest): void => {
    setDailyWinData(null);
    if (dest === 'leaderboard') { setView('leaderboard'); return; }
    if (dest === 'calendar')    { setView('calendar');    return; }
    if (dest === 'game')        { navigate('/game');      return; }
    if (dest === 'home')        { navigate('/');          return; }
    if (dest === 'profile')     { navigate('/profile');   return; }
  };

  const handlePriorWinNavigate = (dest: DailyWinDest): void => {
    setPriorDailyWinData(null);
    if (dest === 'leaderboard') { setView('leaderboard'); return; }
    if (dest === 'calendar')    { setView('calendar');    return; }
    if (dest === 'game')        { setPriorDailyInfo(null); setView('board'); return; }
    if (dest === 'home')        { navigate('/');           return; }
    if (dest === 'profile')     { navigate('/profile');    return; }
  };

  const handleRowReplay = useCallback((sessionUuid: string): void => {
    if (sessionUuid) navigate(`/replay/${sessionUuid}`);
  }, [navigate]);

  return (
    <div className="screen daily-screen">
      <div className="daily-header">
        <div>
          <h2 className="daily-title">Daily Challenge</h2>
          <p className="daily-date">{activeDate}</p>
        </div>
        <div className="daily-tabs" role="tablist" aria-label="Daily challenge views">
          <button id="tab-daily-board" role="tab" aria-selected={view === 'board'} aria-controls="panel-daily-board" className={`daily-tab${view === 'board' ? ' active' : ''}`} onClick={() => setView('board')}>Game</button>
          <button id="tab-daily-lb" role="tab" aria-selected={view === 'leaderboard'} aria-controls="panel-daily-lb" className={`daily-tab${view === 'leaderboard' ? ' active' : ''}`} onClick={() => setView('leaderboard')}>Leaderboard</button>
          <button id="tab-daily-cal" role="tab" aria-selected={view === 'calendar'} aria-controls="panel-daily-cal" className={`daily-tab${view === 'calendar' ? ' active' : ''}`} onClick={() => setView('calendar')}>Calendar</button>
        </div>
      </div>

      {view === 'board' && dailyError && (
        <div className="daily-unavailable">
          <div className="daily-unavailable-box">
            <div className="daily-unavailable-icon">🃏</div>
            <h3 className="daily-unavailable-title">No Daily Challenge Available</h3>
            <p className="daily-unavailable-body">
              We couldn't load today's challenge. Please check your connection and try again.
            </p>
            <button
              className="daily-unavailable-btn"
              onClick={() => {
                setDailyError(false);
                getDaily()
                  .then(data => { setDaily(data as unknown as DailyResponse); setDailyError(false); })
                  .catch(() => setDailyError(true));
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {view === 'board' && !dailyError && !daily && (
        <div role="status" className="daily-loading">Loading today's challenge…</div>
      )}

      {!dailyError && daily && (
        <div
          id="panel-daily-board"
          role="tabpanel"
          aria-labelledby="tab-daily-board"
          aria-hidden={view !== 'board' || undefined}
          className={view === 'board' && !priorDailyInfo
            ? 'daily-board-wrap'
            : 'daily-board-wrap daily-board-wrap--hidden'}>
          <Game
            dailyHand={daily.hand}
            isRanked={!daily.userHasRankedAttempt}
            onShowLeaderboard={() => setView('leaderboard')}
            onDailyWin={setDailyWinData}
          />
        </div>
      )}

      {priorDailyInfo && (
        <div className={view === 'board' ? 'daily-board-wrap' : 'daily-board-wrap daily-board-wrap--hidden'}>
          <div className="daily-prior-bar">
            <button
              className="daily-prior-back"
              onClick={() => { setPriorDailyInfo(null); setPriorDailyWinData(null); setView('board'); }}
            >
              ← Today's Daily
            </button>
            <span className="daily-prior-label">{priorDailyInfo.date}</span>
          </div>
          <Game
            key={priorDailyInfo.date}
            dailyHand={priorDailyInfo.hand}
            dailyDate={priorDailyInfo.date}
            isRanked={!priorDailyInfo.userHasRankedAttempt}
            onShowLeaderboard={() => setView('leaderboard')}
            onDailyWin={setPriorDailyWinData}
          />
        </div>
      )}

      {view === 'leaderboard' && (
        <div id="panel-daily-lb" role="tabpanel" aria-labelledby="tab-daily-lb" className="leaderboard">
          <h3 className="sr-only">Leaderboard</h3>
          {myRank && (
            <div className="my-rank-bar">
              Your rank: <strong>#{myRank.rank}</strong>
              {myRank.moves && <> · {myRank.moves} moves · {formatTime(myRank.timeSeconds)}</>}
            </div>
          )}
          <div className="sort-row" role="group" aria-label="Sort by">
            <span className="sort-label">Sort by:</span>
            <button className={`sort-btn${sort === 'moves' ? ' active' : ''}`} onClick={() => setSort('moves')} aria-pressed={sort === 'moves'}>Moves</button>
            <button className={`sort-btn${sort === 'time'  ? ' active' : ''}`} onClick={() => setSort('time')} aria-pressed={sort === 'time'}>Time</button>
          </div>
          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th><th></th></tr>
            </thead>
            <tbody>
              {leaderboard.map((row, i) => (
                <tr key={row.userUuid} className={user && row.userUuid === user.uuid ? 'lb-me' : ''}>
                  <td>{i + 1}</td>
                  <td>{row.displayName}</td>
                  <td>{row.moves}</td>
                  <td>{formatTime(row.timeSeconds)}</td>
                  <td>
                    {(row as unknown as { sessionUuid?: string }).sessionUuid && (
                      <button
                        className="lb-replay-btn"
                        onClick={() => handleRowReplay((row as unknown as { sessionUuid: string }).sessionUuid)}
                        title="Watch replay"
                        aria-label={`Watch ${row.displayName}'s replay`}
                      >▶</button>
                    )}
                  </td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={5} className="lb-empty">No entries yet — be the first!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'calendar' && (
        <div id="panel-daily-cal" role="tabpanel" aria-labelledby="tab-daily-cal">
          <h3 className="sr-only">Challenge Calendar</h3>
          <DailyCalendar drawMode={drawMode} onPlay={handlePriorDailyPlay} />
        </div>
      )}

      {dailyWinData && (
        <DailyWinModal
          moves={dailyWinData.moves}
          timeFormatted={dailyWinData.timeFormatted}
          rank={dailyWinData.rank}
          date={handDate}
          drawMode={drawMode}
          userUuid={user?.uuid}
          sessionUuid={dailyWinData.sessionUuid}
          winAnimation={preferences?.winAnimation ?? 'confetti'}
          onNavigate={handleWinNavigate}
        />
      )}

      {priorDailyWinData && priorDailyInfo && (
        <DailyWinModal
          moves={priorDailyWinData.moves}
          timeFormatted={priorDailyWinData.timeFormatted}
          rank={priorDailyWinData.rank}
          date={priorDailyInfo.date}
          drawMode={priorDailyInfo.hand.drawMode}
          userUuid={user?.uuid}
          sessionUuid={priorDailyWinData.sessionUuid}
          winAnimation={preferences?.winAnimation ?? 'confetti'}
          onNavigate={handlePriorWinNavigate}
        />
      )}
    </div>
  );
}
