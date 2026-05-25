import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MALE_AVATARS, FEMALE_AVATARS } from '@/game/avatars';
import {
  generateResume, randomBetween, pick,
  ROOMS, ROOM_ICONS, APPLICANT_DESCRIPTIONS,
  MALE_NAMES, FEMALE_NAMES, LAST_NAMES_M, LAST_NAMES_F
} from '@/game/data';

type GameState = 'menu' | 'playing' | 'paused' | 'gameover';
type ViewDir = 'center' | 'left' | 'right';
type DeathReason = '' | 'resumes' | 'applicants' | 'energy' | 'win';

interface Resume {
  id: number; name: string; age: number; position: string; gender: string; avatarIndex: number;
}
interface Applicant {
  id: number; roomId: number; descIndex: number; name: string; alive: boolean; stopped: boolean;
}
interface GameRecord {
  survived: string; resumes: number; date: string;
}

const GAME_DURATION_MS = 30 * 60 * 1000;
const GAME_START_HOUR = 9;
const GAME_END_HOUR = 18;
const TOTAL_GAME_HOURS = GAME_END_HOUR - GAME_START_HOUR;
const HR_ROOM_ID = 0;
const COFFEE_MAX_SIPS = 5;
const ENERGY_DRAIN_BASE = 0.35;
const RESUME_LIMIT = 100;

function getLocalRecords(): GameRecord[] {
  try { return JSON.parse(localStorage.getItem('hr_records') || '[]'); } catch { return []; }
}
function saveRecord(r: GameRecord) {
  const records = getLocalRecords();
  records.push(r);
  records.sort((a, b) => b.survived.localeCompare(a.survived));
  localStorage.setItem('hr_records', JSON.stringify(records.slice(0, 10)));
}
function formatGameTime(elapsed: number): string {
  const ratio = Math.min(1, elapsed / GAME_DURATION_MS);
  const totalMinutes = TOTAL_GAME_HOURS * 60;
  const gameMinutes = Math.floor(ratio * totalMinutes);
  const hour = GAME_START_HOUR + Math.floor(gameMinutes / 60);
  const min = gameMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function getGameHour(elapsed: number): number {
  const ratio = elapsed / GAME_DURATION_MS;
  return Math.min(TOTAL_GAME_HOURS - 1, Math.floor(ratio * TOTAL_GAME_HOURS));
}

export default function Index() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [view, setView] = useState<ViewDir>('center');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [energy, setEnergy] = useState(100);
  const [coffeeSips, setCoffeeSips] = useState(COFFEE_MAX_SIPS);
  const [coffeeWalking, setCoffeeWalking] = useState(false);
  const [coffeeProgress, setCoffeeProgress] = useState(0);
  const [coffeeEmpty, setCoffeeEmpty] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [deathReason, setDeathReason] = useState<DeathReason>('');
  const [redButtonUsed, setRedButtonUsed] = useState(false);
  const [redButtonActive, setRedButtonActive] = useState(false);
  const [doorsClosed, setDoorsClosed] = useState(false);
  const [doorsTimer, setDoorsTimer] = useState(0);
  const [records, setRecords] = useState<GameRecord[]>(getLocalRecords());
  const [showRecords, setShowRecords] = useState(false);
  const [survivedTime, setSurvivedTime] = useState('09:00');
  const [processedResumes, setProcessedResumes] = useState(0);

  const resumeIdRef = useRef(0);
  const applicantIdRef = useRef(0);
  const gameStateRef = useRef<GameState>('menu');
  const elapsedRef = useRef(0);
  const energyRef = useRef(100);
  const processedRef = useRef(0);
  const doorClosedRef = useRef(false);
  const selectedRoomRef = useRef<number | null>(null);
  const coffeeWalkRef = useRef(false);

  gameStateRef.current = gameState;
  elapsedRef.current = elapsed;
  energyRef.current = energy;
  processedRef.current = processedResumes;
  doorClosedRef.current = doorsClosed;
  selectedRoomRef.current = selectedRoom;
  coffeeWalkRef.current = coffeeWalking;

  const die = useCallback((reason: DeathReason) => {
    if (gameStateRef.current !== 'playing') return;
    const t = formatGameTime(elapsedRef.current);
    setSurvivedTime(reason === 'win' ? '18:00' : t);
    setDeathReason(reason);
    setGameState('gameover');
    saveRecord({ survived: t, resumes: processedRef.current, date: new Date().toLocaleDateString('ru-RU') });
    setRecords(getLocalRecords());
  }, []);

  const resetGame = useCallback(() => {
    setView('center'); setResumes([]); setElapsed(0); setEnergy(100);
    setCoffeeSips(COFFEE_MAX_SIPS); setCoffeeWalking(false); setCoffeeProgress(0);
    setCoffeeEmpty(false); setApplicants([]); setSelectedRoom(null); setShowMap(true);
    setDeathReason(''); setRedButtonUsed(false); setRedButtonActive(false);
    setDoorsClosed(false); setDoorsTimer(0); setProcessedResumes(0);
    resumeIdRef.current = 0; applicantIdRef.current = 0;
    setGameState('playing');
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const TICK = 150;
    const interval = setInterval(() => {
      setElapsed(prev => {
        const next = prev + TICK;
        if (next >= GAME_DURATION_MS) { setTimeout(() => die('win'), 0); }
        return next;
      });
      const hour = getGameHour(elapsedRef.current);
      const drain = ENERGY_DRAIN_BASE * (1 + hour * 0.25);
      setEnergy(prev => {
        const next = Math.max(0, prev - drain * (TICK / 1000));
        if (next <= 0) setTimeout(() => die('energy'), 0);
        return next;
      });
      if (doorClosedRef.current) {
        setDoorsTimer(prev => {
          const next = prev - TICK;
          if (next <= 0) { setDoorsClosed(false); setRedButtonActive(false); return 0; }
          return next;
        });
      }
    }, TICK);
    return () => clearInterval(interval);
  }, [gameState, die]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const hour = getGameHour(elapsedRef.current);
      const delay = Math.max(1500, 7000 - hour * 600) + randomBetween(-400, 400);
      timeout = setTimeout(() => {
        if (gameStateRef.current !== 'playing') return;
        const count = randomBetween(0, 3);
        if (count > 0) {
          setResumes(prev => {
            if (prev.length >= RESUME_LIMIT) { setTimeout(() => die('resumes'), 0); return prev; }
            const newOnes: Resume[] = [];
            for (let i = 0; i < count; i++) { resumeIdRef.current++; newOnes.push(generateResume(resumeIdRef.current)); }
            const combined = [...prev, ...newOnes];
            if (combined.length >= RESUME_LIMIT) setTimeout(() => die('resumes'), 0);
            return combined;
          });
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [gameState, die]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      if (gameStateRef.current !== 'playing') return;
      const hour = getGameHour(elapsedRef.current);
      if (Math.random() < 0.12 + hour * 0.06) {
        applicantIdRef.current++;
        const id = applicantIdRef.current;
        const descIndex = randomBetween(0, 9);
        const desc = APPLICANT_DESCRIPTIONS[descIndex];
        const isMale = desc.gender === 'M';
        const firstName = pick(isMale ? MALE_NAMES : FEMALE_NAMES);
        const lastName = pick(isMale ? LAST_NAMES_M : LAST_NAMES_F);
        setApplicants(prev => [...prev, { id, roomId: randomBetween(7, 9), descIndex, name: `${firstName} ${lastName}`, alive: true, stopped: false }]);
      }
      setApplicants(prev => {
        const watched = selectedRoomRef.current;
        const updated = prev.map(a => {
          if (!a.alive) return a;
          if (doorClosedRef.current && a.roomId === HR_ROOM_ID) return a;
          const isInWatched = watched !== null && a.roomId === watched;
          if (isInWatched) return { ...a, stopped: true };
          const nextRoom = a.roomId <= 1 ? HR_ROOM_ID : a.roomId - 1;
          return { ...a, stopped: false, roomId: nextRoom };
        });
        const aliveInHR = updated.filter(a => a.alive && a.roomId === HR_ROOM_ID);
        if (aliveInHR.length >= 2 && !doorClosedRef.current) setTimeout(() => die('applicants'), 0);
        return updated.filter(a => a.alive);
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [gameState, die]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'playing') {
        if (e.key === 'ArrowLeft') setView('left');
        if (e.key === 'ArrowRight') setView('right');
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') setView('center');
      }
      if (e.key === 'Escape') {
        if (gameStateRef.current === 'playing') setGameState('paused');
        else if (gameStateRef.current === 'paused') setGameState('playing');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const dismissResume = useCallback((id: number) => {
    setResumes(p => p.filter(r => r.id !== id));
    setProcessedResumes(p => p + 1);
  }, []);

  const drinkCoffee = useCallback(() => {
    if (coffeeSips <= 0) return;
    setCoffeeSips(p => { const n = p - 1; if (n === 0) setCoffeeEmpty(true); return n; });
    setEnergy(p => Math.min(100, p + 18));
  }, [coffeeSips]);

  const goRefill = useCallback(() => {
    if (coffeeWalkRef.current || coffeeSips > 0) return;
    setCoffeeWalking(true); setCoffeeProgress(0);
    const e = energyRef.current;
    const walkMs = Math.max(3000, 10000 - e * 70);
    let step = 0; const steps = 40;
    const iv = setInterval(() => {
      step++; setCoffeeProgress(step / steps);
      if (step >= steps) {
        clearInterval(iv);
        setCoffeeSips(COFFEE_MAX_SIPS); setCoffeeWalking(false); setCoffeeEmpty(false); setCoffeeProgress(0);
      }
    }, walkMs / steps);
  }, [coffeeSips]);

  const useRedButton = useCallback(() => {
    if (redButtonUsed) return;
    setRedButtonUsed(true); setRedButtonActive(true); setDoorsClosed(true); setDoorsTimer(10000);
    setApplicants(prev => prev.map(a => a.roomId === HR_ROOM_ID ? { ...a, alive: false } : a));
  }, [redButtonUsed]);

  const gameHour = getGameHour(elapsed);
  const hrAlive = applicants.filter(a => a.alive && a.roomId === HR_ROOM_ID);
  const blurAmt = energy < 80 ? ((80 - energy) / 80) * 14 : 0;
  const bloodOpacity = energy < 80 ? ((80 - energy) / 80) * 0.85 : 0;

  if (gameState === 'menu') return <MenuScreen onStart={resetGame} showRecords={showRecords} setShowRecords={setShowRecords} records={records} />;
  if (gameState === 'gameover') return <GameOverScreen reason={deathReason} time={survivedTime} resumes={processedResumes} onRestart={resetGame} onMenu={() => setGameState('menu')} />;
  if (gameState === 'paused') return (
    <div className="pause-screen">
      <div className="pause-box">
        <div className="pause-icon">⏸</div>
        <h2>Пауза</h2>
        <button className="btn-primary" onClick={() => setGameState('playing')}>▶ Продолжить</button>
        <button className="btn-ghost" onClick={() => setGameState('menu')}>🏠 Главное меню</button>
      </div>
    </div>
  );

  return (
    <div className="game-root">
      {blurAmt > 0 && <div className="game-blur-overlay" style={{ backdropFilter: `blur(${blurAmt}px)`, WebkitBackdropFilter: `blur(${blurAmt}px)` }} />}
      {bloodOpacity > 0 && <div className="blood-vignette" style={{ opacity: bloodOpacity }} />}
      <HUD elapsed={elapsed} energy={energy} resumeCount={resumes.length} hrAlive={hrAlive.length} gameHour={gameHour} />
      <div className="game-scene">
        {view === 'left' && <LeftView applicants={applicants} selectedRoom={selectedRoom} setSelectedRoom={r => { setSelectedRoom(r); setShowMap(false); }} showMap={showMap} setShowMap={setShowMap} setView={setView} />}
        {view === 'center' && <CenterView resumes={resumes} dismissResume={dismissResume} redButtonUsed={redButtonUsed} redButtonActive={redButtonActive} useRedButton={useRedButton} doorsClosed={doorsClosed} doorsTimer={doorsTimer} hrAlive={hrAlive.length} setView={setView} />}
        {view === 'right' && <RightView coffeeSips={coffeeSips} coffeeWalking={coffeeWalking} coffeeProgress={coffeeProgress} coffeeEmpty={coffeeEmpty} drinkCoffee={drinkCoffee} goRefill={goRefill} setView={setView} energy={energy} />}
      </div>
      <div className="view-nav">
        <button className={`vnav-btn ${view === 'left' ? 'active' : ''}`} onClick={() => setView('left')}>◀ Камеры</button>
        <button className={`vnav-btn ${view === 'center' ? 'active' : ''}`} onClick={() => setView('center')}>Рабочий стол</button>
        <button className={`vnav-btn ${view === 'right' ? 'active' : ''}`} onClick={() => setView('right')}>Кофе ▶</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ HUD ═══════════════════════════════ */
function HUD({ elapsed, energy, resumeCount, hrAlive, gameHour }: { elapsed: number; energy: number; resumeCount: number; hrAlive: number; gameHour: number }) {
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-time">⏰ {formatGameTime(elapsed)}</div>
        <div className="hud-hour">Час {gameHour + 1} / {TOTAL_GAME_HOURS}</div>
      </div>
      <div className="hud-center">
        <div className={`hud-stat ${resumeCount > 80 ? 'danger' : resumeCount > 60 ? 'warn' : ''}`}>📄 {resumeCount}/100</div>
        <div className={`hud-stat ${hrAlive >= 1 ? 'danger' : ''}`}>😰 В кабинете: {hrAlive}/2</div>
      </div>
      <div className="hud-right">
        <span className="hud-energy-label">⚡ Энергия</span>
        <div className="energy-bar">
          <div className="energy-fill" style={{ width: `${energy}%`, background: energy > 60 ? '#eab308' : energy > 30 ? '#f97316' : '#ef4444' }} />
        </div>
        <span className={`energy-num ${energy < 30 ? 'danger' : ''}`}>{Math.round(energy)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ MENU ═══════════════════════════════ */
function MenuScreen({ onStart, showRecords, setShowRecords, records }: { onStart: () => void; showRecords: boolean; setShowRecords: (v: boolean) => void; records: GameRecord[] }) {
  return (
    <div className="menu-screen">
      <div className="menu-bg" />
      <div className="menu-content">
        <div className="menu-top">
          <div className="menu-badge">☕ Офисный хоррор</div>
          <h1 className="menu-title">Симулятор HRки</h1>
          <p className="menu-sub">Выживи с 09:00 до 18:00. Не дай им добраться.</p>
        </div>
        <div className="menu-btns">
          <button className="btn-primary" onClick={onStart}>▶ Новая игра</button>
          <button className="btn-ghost" onClick={() => setShowRecords(!showRecords)}>🏆 Рекорды</button>
        </div>
        {showRecords && (
          <div className="records-panel">
            <h3>Таблица рекордов (локальная)</h3>
            {records.length === 0 ? <p className="records-empty">Рекордов пока нет — дерзай!</p>
              : <table className="records-table">
                  <thead><tr><th>#</th><th>До скольки</th><th>Резюме отклонено</th><th>Дата</th></tr></thead>
                  <tbody>{records.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.survived}</td><td>{r.resumes}</td><td>{r.date}</td></tr>)}</tbody>
                </table>
            }
          </div>
        )}
        <div className="menu-controls">
          <span>← → Повернуть голову</span>
          <span>ESC Пауза</span>
          <span>🖱️ Мышь — всё управление</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ GAME OVER ═══════════════════════════════ */
function GameOverScreen({ reason, time, resumes, onRestart, onMenu }: { reason: DeathReason; time: string; resumes: number; onRestart: () => void; onMenu: () => void }) {
  const won = reason === 'win';
  const icon = won ? '🎉' : reason === 'resumes' ? '📄' : reason === 'applicants' ? '😱' : '💤';
  const reasonText: Record<string, string> = {
    resumes: 'Резюме переполнили весь экран (100 штук). HRка сдалась.',
    applicants: 'Два соискателя ворвались в кабинет. Собеседование не пережить.',
    energy: 'Энергия упала до нуля. HRка уснула прямо за ноутбуком.',
    win: 'Ты выжила! Рабочий день позади. Ты настоящий HR-герой!'
  };
  return (
    <div className={`gameover-screen ${won ? 'win' : ''}`}>
      <div className="gameover-box">
        <div className="gameover-icon">{icon}</div>
        <h1>{won ? 'ДЕНЬ ОКОНЧЕН!' : 'КОНЕЦ'}</h1>
        <p className="gameover-reason">{reasonText[reason] || ''}</p>
        <div className="gameover-stats">
          <div className="gstat"><div className="gstat-val">{time}</div><div className="gstat-label">Продержалась до</div></div>
          <div className="gstat"><div className="gstat-val">{resumes}</div><div className="gstat-label">Резюме отклонено</div></div>
        </div>
        <div className="gameover-btns">
          <button className="btn-primary" onClick={onRestart}>▶ Снова</button>
          <button className="btn-ghost" onClick={onMenu}>🏠 Меню</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ CENTER VIEW (объёмный стол) ═══════════════════════════════ */
function CenterView({ resumes, dismissResume, redButtonUsed, redButtonActive, useRedButton, doorsClosed, doorsTimer, hrAlive, setView }: {
  resumes: Resume[]; dismissResume: (id: number) => void; redButtonUsed: boolean; redButtonActive: boolean;
  useRedButton: () => void; doorsClosed: boolean; doorsTimer: number; hrAlive: number; setView: (v: ViewDir) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="center-view">
      {/* Комната — стены, окно, потолок */}
      <div className="room-3d">
        <div className="room-ceiling" />
        <div className="room-wall-back" />
        <div className="room-wall-left" />
        <div className="room-wall-right" />
        {/* Окно на задней стене */}
        <div className="room-window">
          <div className="window-sky" />
          <div className="window-frame-h" />
          <div className="window-frame-v" />
          <div className="window-blind-strip" style={{ top: '0%' }} />
          <div className="window-blind-strip" style={{ top: '18%' }} />
          <div className="window-blind-strip" style={{ top: '36%' }} />
          <div className="window-blind-strip" style={{ top: '54%' }} />
          <div className="window-blind-strip" style={{ top: '72%' }} />
        </div>
        {/* Плакат на стене */}
        <div className="room-poster">
          <div className="poster-text">Делай<br/>что любишь</div>
        </div>
        {/* Лампа */}
        <div className="room-lamp">
          <div className="lamp-arm" />
          <div className="lamp-head" />
          <div className="lamp-glow" />
        </div>
      </div>

      {/* СТОЛ с перспективой */}
      <div className="desk-3d">
        {/* Столешница (вид сверху) */}
        <div className="desk-tabletop">
          {/* Левый монитор — под углом влево */}
          <div className="monitor-left-wrap" onClick={() => setView('left')} title="Камеры">
            <div className="monitor-stand-l" />
            <div className="monitor-screen-l">
              <div className="mon-screen-content">
                <div className="cam-grid-preview">
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="cam-grid-cell">
                      <div className="cam-cell-inner">
                        <span className="cam-cell-num">CAM {String(i+1).padStart(2,'0')}</span>
                        <div className="cam-cell-scene">
                          <div className="cam-mini-floor" />
                          <div className="cam-mini-desk" />
                          <div className="cam-mini-person" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mon-hover-hint">📷 Нажми</div>
              </div>
            </div>
            <div className="monitor-bezel-l" />
          </div>

          {/* Ноутбук по центру */}
          <div className="laptop-3d">
            <div className="laptop-lid">
              <div className="laptop-screen-area">
                <div className="laptop-url-bar">
                  <span className="url-dot green" /><span className="url-dot yellow" /><span className="url-dot red" />
                  <span className="url-text">🌐 АйНаНэНаНэ.хрю — Поиск персонала</span>
                </div>
                <div
                  className="resume-list"
                  ref={listRef}
                  onWheel={e => { e.stopPropagation(); if (listRef.current) listRef.current.scrollTop += e.deltaY; }}
                >
                  {resumes.length === 0
                    ? <div className="resume-placeholder">📭 Пока тихо... но они уже едут</div>
                    : resumes.map(r => <ResumeCard key={r.id} resume={r} onDismiss={dismissResume} />)
                  }
                </div>
              </div>
            </div>
            <div className="laptop-body">
              <div className="laptop-keyboard">
                {[...Array(4)].map((_, row) => (
                  <div key={row} className="keyboard-row">
                    {[...Array(12 - row)].map((_, k) => <div key={k} className="key" />)}
                  </div>
                ))}
              </div>
              <div className="laptop-trackpad" />
            </div>
            <div className="laptop-stand-l" />
            <div className="laptop-stand-r" />
          </div>

          {/* Правый монитор — под углом вправо */}
          <div className="monitor-right-wrap" onClick={() => setView('right')} title="Кофе и отдых">
            <div className="monitor-stand-r" />
            <div className="monitor-screen-r">
              <div className="mon-screen-content dark-screen">
                <div className="coffee-preview-mon">
                  <div className="coffee-cup-icon">☕</div>
                  <div className="coffee-mon-label">Кофе</div>
                  <div className="coffee-mon-sips">готов</div>
                </div>
                <div className="mon-hover-hint">☕ Нажми</div>
              </div>
            </div>
            <div className="monitor-bezel-r" />
          </div>
        </div>

        {/* Передняя часть стола */}
        <div className="desk-front">
          {/* Клавиатура */}
          <div className="desk-keyboard-ext">
            <div className="keyboard-ext-body">
              {[...Array(3)].map((_, row) => (
                <div key={row} className="keyboard-row-ext">
                  {[...Array(14)].map((_, k) => <div key={k} className="key-ext" />)}
                </div>
              ))}
              <div className="keyboard-spacebar-row">
                <div className="key-ext small" /><div className="key-ext space" /><div className="key-ext small" />
              </div>
            </div>
          </div>
          {/* Мышь */}
          <div className="desk-mouse">
            <div className="mouse-body">
              <div className="mouse-button-l" />
              <div className="mouse-button-r" />
              <div className="mouse-wheel" />
            </div>
          </div>
          {/* Красная кнопка */}
          <div className={`red-btn-wrap ${redButtonActive ? 'btn-flashing' : ''} ${redButtonUsed && !redButtonActive ? 'btn-spent' : ''}`}
            onClick={useRedButton} title={redButtonUsed ? 'Использована' : 'Закрыть двери!'}>
            <div className="red-btn-cap" />
            <div className="red-btn-base" />
            <div className="red-btn-text">{redButtonUsed ? '✓' : '!'}</div>
          </div>
          {/* Блокнот */}
          <div className="desk-notepad">
            <div className="notepad-line" />
            <div className="notepad-line" />
            <div className="notepad-line short" />
          </div>
          {/* Ручка */}
          <div className="desk-pen" />
          {/* Стикеры */}
          <div className="sticker yellow">!</div>
        </div>

        {/* Ноги стола */}
        <div className="desk-leg left" />
        <div className="desk-leg right" />
      </div>

      {/* Руки HRки */}
      <div className="hr-hands">
        <div className="hand-left" />
        <div className="hand-right" />
      </div>

      {hrAlive > 0 && <div className="intruder-alert">⚠️ В КАБИНЕТЕ {hrAlive} СОИСКАТЕЛ{hrAlive === 1 ? 'Ь' : 'Я'}!</div>}
      {doorsClosed && <div className="doors-closed-banner">🚪 ДВЕРИ ЗАКРЫТЫ — {Math.ceil(doorsTimer / 1000)}с</div>}
    </div>
  );
}

/* ═══════════════════════════════ RESUME CARD ═══════════════════════════════ */
function ResumeCard({ resume, onDismiss }: { resume: Resume; onDismiss: (id: number) => void }) {
  const avatar = resume.gender === 'M' ? MALE_AVATARS[resume.avatarIndex] : FEMALE_AVATARS[resume.avatarIndex];
  return (
    <div className="resume-card">
      <img src={avatar} alt="" className="resume-avatar" />
      <div className="resume-body">
        <div className="resume-name">{resume.name}</div>
        <div className="resume-meta">{resume.age} лет · {resume.position}</div>
      </div>
      <button className="resume-x" onClick={() => onDismiss(resume.id)} title="Отклонить">✕</button>
    </div>
  );
}

/* ═══════════════════════════════ LEFT VIEW ═══════════════════════════════ */
function LeftView({ applicants, selectedRoom, setSelectedRoom, showMap, setShowMap, setView }: {
  applicants: Applicant[]; selectedRoom: number | null; setSelectedRoom: (r: number) => void;
  showMap: boolean; setShowMap: (v: boolean) => void; setView: (v: ViewDir) => void;
}) {
  return (
    <div className="left-view">
      <div className="side-monitor">
        <div className="side-mon-bezel">
          <div className="side-mon-header">
            <span>📷 ВИДЕОНАБЛЮДЕНИЕ</span>
            <button className="map-btn" onClick={() => setShowMap(!showMap)}>{showMap ? '📹 Камера' : '🗺️ План'}</button>
          </div>
          <div className="side-mon-content">
            {showMap
              ? <OfficeMap applicants={applicants} selected={selectedRoom} onSelect={setSelectedRoom} />
              : <CameraView applicants={applicants} room={selectedRoom} onPrev={() => setSelectedRoom(Math.max(0, (selectedRoom ?? 0) - 1))} onNext={() => setSelectedRoom(Math.min(9, (selectedRoom ?? 0) + 1))} />
            }
          </div>
        </div>
        <div className="side-mon-stand" />
      </div>
      <button className="back-to-center" onClick={() => setView('center')}>← Центр</button>
    </div>
  );
}

/* ═══════════════════════════════ OFFICE MAP ═══════════════════════════════ */
function OfficeMap({ applicants, selected, onSelect }: { applicants: Applicant[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="office-map">
      <div className="map-title">ПЛАН ОФИСА</div>
      <div className="map-grid">
        {ROOMS.map(r => {
          const cnt = applicants.filter(a => a.alive && a.roomId === r.id).length;
          return (
            <div key={r.id} className={`map-room ${selected === r.id ? 'map-room-sel' : ''} ${r.isHR ? 'map-hr' : ''} ${cnt > 0 ? 'map-alert' : ''}`} onClick={() => onSelect(r.id)}>
              <span className="map-room-icon">{ROOM_ICONS[r.id]}</span>
              <span className="map-room-name">{r.name}</span>
              {cnt > 0 && <span className="map-badge">⚠️{cnt}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ CAMERA VIEW (псевдо-3D) ═══════════════════════════════ */
function CameraView({ applicants, room, onPrev, onNext }: { applicants: Applicant[]; room: number | null; onPrev: () => void; onNext: () => void }) {
  if (room === null) return (
    <div className="cam-empty"><span>📷</span><p>Откройте план и выберите комнату</p></div>
  );
  const roomData = ROOMS[room];
  const roomApplicants = applicants.filter(a => a.alive && a.roomId === room);

  return (
    <div className="cam-view">
      <div className="cam-hud">
        <span>КАМ {room + 1} · {roomData.name}</span>
        <span className="cam-rec">● REC</span>
      </div>

      {/* Изометрическая комната */}
      <div className="cam-room-3d">
        {/* Стены */}
        <div className="cam-wall-back" />
        <div className="cam-wall-left" />
        <div className="cam-floor-iso" />

        {/* Окно */}
        <div className="cam-window">
          <div className="cam-window-sky" />
          <div className="cam-window-frame-h" />
        </div>

        {/* Плинтус и лампы */}
        <div className="cam-ceiling-light left" />
        <div className="cam-ceiling-light right" />

        {/* Рабочие столы с сотрудниками */}
        <div className="cam-desk-row">
          {[0,1,2].map(i => (
            <WorkerDesk key={i} xOffset={i} />
          ))}
        </div>

        {/* Растение */}
        <div className="cam-plant">
          <div className="plant-pot" />
          <div className="plant-leaf l1" />
          <div className="plant-leaf l2" />
          <div className="plant-leaf l3" />
        </div>

        {/* Соискатели */}
        {roomApplicants.map((a, i) => (
          <ApplicantFig key={a.id} applicant={a} xPos={15 + i * 32} watching={a.stopped || room === a.roomId} />
        ))}

        {/* CCTV эффекты */}
        <div className="cam-scanline" />
        <div className="cam-vignette" />
        <div className="cam-timestamp">{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      </div>

      <div className="cam-controls">
        <button onClick={onPrev}>◀</button>
        <span>{room + 1} / 10</span>
        <button onClick={onNext}>▶</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ WORKER DESK ═══════════════════════════════ */
function WorkerDesk({ xOffset }: { xOffset: number }) {
  const colors = ['#4a6fa5', '#5a8a5a', '#8a5a4a'];
  const color = colors[xOffset % colors.length];
  const animDelay = xOffset * 0.4;
  return (
    <div className="worker-desk-wrap" style={{ '--desk-x': xOffset } as React.CSSProperties}>
      {/* Стол */}
      <div className="w-desk-top" />
      <div className="w-desk-front" />
      <div className="w-desk-side" />
      {/* Монитор */}
      <div className="w-monitor">
        <div className="w-mon-screen" style={{ background: `linear-gradient(135deg, #0d1520, #1a2840)` }}>
          <div className="w-mon-glow" style={{ background: `${color}44` }} />
        </div>
        <div className="w-mon-stand" />
        <div className="w-mon-base" />
      </div>
      {/* Сотрудник */}
      <div className="worker-person" style={{ animationDelay: `${animDelay}s` }}>
        <div className="worker-head" style={{ background: xOffset === 1 ? '#D4956A' : '#FDBCB4' }} />
        <div className="worker-body" style={{ background: color }} />
        <div className="worker-arms" style={{ animationDelay: `${animDelay + 0.2}s` }}>
          <div className="worker-arm-l" style={{ background: xOffset === 1 ? '#D4956A' : '#FDBCB4' }} />
          <div className="worker-arm-r" style={{ background: xOffset === 1 ? '#D4956A' : '#FDBCB4' }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ APPLICANT FIGURE (псевдо-3D) ═══════════════════════════════ */
function ApplicantFig({ applicant, xPos, watching }: { applicant: Applicant; xPos: number; watching: boolean }) {
  const desc = APPLICANT_DESCRIPTIONS[applicant.descIndex];
  const tall = desc.height === 'высокий' || desc.height === 'высокая';
  const short = desc.height === 'низкий' || desc.height === 'низкая';
  const chubby = desc.build === 'полный' || desc.build === 'полная';

  const bodyH = tall ? 52 : short ? 34 : 42;
  const bodyW = chubby ? 24 : 16;
  const legH = tall ? 28 : short ? 18 : 22;

  return (
    <div className={`applicant-3d ${watching ? 'watching' : 'walking'}`} style={{ left: `${xPos}%`, bottom: '10%' }}>
      {/* Тень под персонажем */}
      <div className="appl-shadow" style={{ width: bodyW + 8 }} />

      {/* Голова */}
      <div className="appl-head-3d" style={{ background: desc.skinColor, width: bodyW - 2, height: bodyW - 2, borderRadius: '50% 50% 40% 40%' }}>
        {watching && <>
          <div className="eye left" />
          <div className="eye right" />
        </>}
        {/* Волосы */}
        <div className="appl-hair" style={{ background: desc.gender === 'F' ? '#8B4513' : '#2a1a0a' }} />
      </div>

      {/* Тело */}
      <div className="appl-body-3d" style={{ background: desc.color, width: bodyW, height: bodyH }}>
        {/* Руки */}
        <div className="appl-arm-l" style={{ background: desc.skinColor, height: bodyH * 0.6 }} />
        <div className="appl-arm-r" style={{ background: desc.skinColor, height: bodyH * 0.6 }} />
        {/* Бумага A4 */}
        <div className="appl-paper-3d">
          <div className="paper-lines" />
        </div>
      </div>

      {/* Ноги — CSS walk animation */}
      <div className={`appl-legs ${watching ? '' : 'legs-walking'}`}>
        <div className="appl-leg-l" style={{ height: legH, background: '#1a1a2e' }}>
          <div className="appl-shoe-l" />
        </div>
        <div className="appl-leg-r" style={{ height: legH, background: '#1a1a2e' }}>
          <div className="appl-shoe-r" />
        </div>
      </div>

      {/* Имя */}
      <div className="appl-nametag">{applicant.name.split(' ')[0]}</div>
    </div>
  );
}

/* ═══════════════════════════════ RIGHT VIEW ═══════════════════════════════ */
function RightView({ coffeeSips, coffeeWalking, coffeeProgress, coffeeEmpty, drinkCoffee, goRefill, setView, energy }: {
  coffeeSips: number; coffeeWalking: boolean; coffeeProgress: number; coffeeEmpty: boolean;
  drinkCoffee: () => void; goRefill: () => void; setView: (v: ViewDir) => void; energy: number;
}) {
  return (
    <div className="right-view">
      {/* Угол комнаты */}
      <div className="right-room-3d">
        <div className="rroom-wall-back" />
        <div className="rroom-wall-right" />
        <div className="rroom-floor" />

        {/* Кулер */}
        <div className="cooler-3d">
          <div className="cooler-tank" />
          <div className="cooler-body-3d" />
          <div className="cooler-tap" />
        </div>

        {/* Кофемашина */}
        <div className={`coffee-machine-3d ${coffeeWalking ? 'brewing' : ''}`} onClick={goRefill} title="Нажать — HRка пойдёт наливать">
          <div className="cm-top" />
          <div className="cm-body-3d">
            <div className="cm-display">☕</div>
            <div className="cm-buttons">
              <div className="cm-btn red" />
              <div className="cm-btn green" />
            </div>
            {coffeeWalking && (
              <div className="cm-progress-bar">
                <div className="cm-prog-fill" style={{ width: `${coffeeProgress * 100}%` }} />
              </div>
            )}
          </div>
          <div className="cm-side" />
          <div className="cm-front" />
          <div className="cm-label-3d">КОФЕМАШИНА</div>
        </div>
      </div>

      {/* Стол справа с кофе */}
      <div className="right-desk-3d">
        <div className="right-desk-top" />
        <div className="right-desk-front" />

        {/* Кофейная кружка (стеклянная, объёмная) */}
        <div className={`coffee-cup-3d ${coffeeEmpty ? 'empty' : ''}`} onClick={drinkCoffee} title="Сделать глоток">
          <div className="cup-body">
            <div className="cup-glass-side" />
            <div className="cup-glass-front">
              {!coffeeEmpty && (
                <div className="cup-coffee-liquid" style={{ height: `${(coffeeSips / COFFEE_MAX_SIPS) * 70}%` }} />
              )}
            </div>
            <div className="cup-handle-3d" />
          </div>
          <div className="cup-saucer" />
          <div className="cup-label-3d">{coffeeSips}/{COFFEE_MAX_SIPS} глотков</div>
        </div>

        {coffeeEmpty && !coffeeWalking && (
          <div className="refill-hint" onClick={goRefill}>→ Нажми на кофемашину!</div>
        )}
        {coffeeWalking && (
          <div className="walk-status">🚶‍♀️ Идёт... {Math.round(coffeeProgress * 100)}%</div>
        )}
      </div>

      <button className="back-to-center" onClick={() => setView('center')}>← Центр</button>
    </div>
  );
}
