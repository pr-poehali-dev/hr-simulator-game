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

interface Resume { id: number; name: string; age: number; position: string; gender: string; avatarIndex: number; }
interface Applicant { id: number; roomId: number; descIndex: number; name: string; alive: boolean; stopped: boolean; }
interface GameRecord { survived: string; resumes: number; date: string; }

const GAME_DURATION_MS = 30 * 60 * 1000;
const GAME_START_HOUR = 9;
const GAME_END_HOUR = 18;
const TOTAL_GAME_HOURS = GAME_END_HOUR - GAME_START_HOUR;
const HR_ROOM_ID = 0;
const COFFEE_MAX_SIPS = 5;
const ENERGY_DRAIN_BASE = 0.35;
const RESUME_LIMIT = 100;

// Фото главного экрана (фото стола из задания)
const DESK_PHOTO = 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/bucket/c2ed4224-ca6f-4e62-a947-1655ef7bf5c2.png';

// Фотографии комнат (CCTV-стиль, fish-eye)
const ROOM_PHOTOS: Record<number, string> = {
  0: DESK_PHOTO, // Кабинет HR — главное фото
  1: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/9d240944-322c-458d-945b-65588a2bfb5c.jpg', // Отдел разработки
  2: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/a34f21c5-566f-4ea1-8737-23fc29750402.jpg', // Переговорная
  3: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/4dcc0c21-0125-4d8d-b71d-fd14e8f15878.jpg', // Бухгалтерия
  4: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/9d240944-322c-458d-945b-65588a2bfb5c.jpg', // Отдел продаж
  5: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/197b345c-78a7-4562-af38-3ddfd815c97a.jpg', // Коридор А
  6: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/197b345c-78a7-4562-af38-3ddfd815c97a.jpg', // Коридор Б
  7: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/0f720868-5c9c-4b5f-982e-d82d375da33f.jpg', // Столовая
  8: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/a439c065-2c43-427a-8800-2b1fb71dbde4.jpg', // Туалет
  9: 'https://cdn.poehali.dev/projects/e0874469-9515-4729-83b9-a3bd812bdfd7/files/aebc9704-878e-4a16-adda-b5ad130f1bc9.jpg', // Парковка
};

// Области интерактивных элементов на фото стола (% от размера)
// Настроены под фото: ноутбук по центру, левый монитор слева, кофе справа
const LAPTOP_AREA   = { left: '30%', top: '14%', width: '40%', height: '55%' };
const LEFT_MON_AREA = { left: '1%',  top: '14%', width: '29%', height: '52%' };
const RIGHT_MON_AREA= { left: '71%', top: '14%', width: '28%', height: '52%' };
const COFFEE_AREA   = { left: '75%', top: '55%', width: '12%', height: '18%' };
const RED_BTN_AREA  = { left: '45%', top: '72%', width: '6%',  height: '8%'  };

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
  return Math.min(TOTAL_GAME_HOURS - 1, Math.floor((elapsed / GAME_DURATION_MS) * TOTAL_GAME_HOURS));
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
  const [seconds, setSeconds] = useState(0);

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
      setSeconds(s => s + 1);
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
  const blurAmt = energy < 80 ? ((80 - energy) / 80) * 12 : 0;
  const bloodOpacity = energy < 80 ? ((80 - energy) / 80) * 0.8 : 0;

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
        {view === 'center' && <CenterView resumes={resumes} dismissResume={dismissResume} redButtonUsed={redButtonUsed} redButtonActive={redButtonActive} useRedButton={useRedButton} doorsClosed={doorsClosed} doorsTimer={doorsTimer} hrAlive={hrAlive.length} setView={setView} coffeeSips={coffeeSips} coffeeEmpty={coffeeEmpty} drinkCoffee={drinkCoffee} goRefill={goRefill} coffeeWalking={coffeeWalking} coffeeProgress={coffeeProgress} />}
        {view === 'right' && <LeftView applicants={applicants} selectedRoom={selectedRoom} setSelectedRoom={r => { setSelectedRoom(r); setShowMap(false); }} showMap={showMap} setShowMap={setShowMap} setView={setView} />}
      </div>
      <div className="view-nav">
        <button className={`vnav-btn ${view === 'left' ? 'active' : ''}`} onClick={() => setView('left')}>◀ Камеры</button>
        <button className={`vnav-btn ${view === 'center' ? 'active' : ''}`} onClick={() => setView('center')}>Рабочий стол</button>
        <button className={`vnav-btn ${view === 'right' ? 'active' : ''}`} onClick={() => { setView('left'); }}>Камеры ▶</button>
      </div>
    </div>
  );
}

/* ══ HUD ══ */
function HUD({ elapsed, energy, resumeCount, hrAlive, gameHour }: { elapsed: number; energy: number; resumeCount: number; hrAlive: number; gameHour: number }) {
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-time">⏰ {formatGameTime(elapsed)}</div>
        <div className="hud-hour">Час {gameHour + 1}/{TOTAL_GAME_HOURS}</div>
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

/* ══ MENU ══ */
function MenuScreen({ onStart, showRecords, setShowRecords, records }: { onStart: () => void; showRecords: boolean; setShowRecords: (v: boolean) => void; records: GameRecord[] }) {
  return (
    <div className="menu-screen">
      <div className="menu-bg" />
      <div className="menu-content">
        <div className="menu-badge">☕ Офисный хоррор</div>
        <h1 className="menu-title">Симулятор HRки</h1>
        <p className="menu-sub">Выживи с 09:00 до 18:00. Не дай им добраться.</p>
        <div className="menu-btns">
          <button className="btn-primary" onClick={onStart}>▶ Новая игра</button>
          <button className="btn-ghost" onClick={() => setShowRecords(!showRecords)}>🏆 Рекорды</button>
        </div>
        {showRecords && (
          <div className="records-panel">
            <h3>Таблица рекордов</h3>
            {records.length === 0 ? <p className="records-empty">Рекордов пока нет!</p>
              : <table className="records-table">
                  <thead><tr><th>#</th><th>До скольки</th><th>Резюме</th><th>Дата</th></tr></thead>
                  <tbody>{records.map((r, i) => <tr key={i}><td>{i+1}</td><td>{r.survived}</td><td>{r.resumes}</td><td>{r.date}</td></tr>)}</tbody>
                </table>
            }
          </div>
        )}
        <div className="menu-controls"><span>← → Камера</span><span>ESC Пауза</span><span>🖱️ Мышь</span></div>
      </div>
    </div>
  );
}

/* ══ GAME OVER ══ */
function GameOverScreen({ reason, time, resumes, onRestart, onMenu }: { reason: DeathReason; time: string; resumes: number; onRestart: () => void; onMenu: () => void }) {
  const won = reason === 'win';
  const icons: Record<string, string> = { resumes: '📄', applicants: '😱', energy: '💤', win: '🎉' };
  const texts: Record<string, string> = {
    resumes: 'Резюме переполнили экран (100 штук). HRка сдалась.',
    applicants: 'Два соискателя ворвались в кабинет.',
    energy: 'Энергия на нуле. HRка уснула.',
    win: 'Ты выжила! Настоящий HR-герой!'
  };
  return (
    <div className={`gameover-screen ${won ? 'win' : ''}`}>
      <div className="gameover-box">
        <div className="gameover-icon">{icons[reason] || '💀'}</div>
        <h1>{won ? 'ДЕНЬ ОКОНЧЕН!' : 'КОНЕЦ'}</h1>
        <p className="gameover-reason">{texts[reason] || ''}</p>
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

/* ══════════════════════════════════════════════════════
   CENTER VIEW — ФОТО РАБОЧЕГО СТОЛА С ИНТЕРАКТИВОМ
══════════════════════════════════════════════════════ */
function CenterView({ resumes, dismissResume, redButtonUsed, redButtonActive, useRedButton,
  doorsClosed, doorsTimer, hrAlive, setView, coffeeSips, coffeeEmpty, drinkCoffee, goRefill, coffeeWalking, coffeeProgress }: {
  resumes: Resume[]; dismissResume: (id: number) => void; redButtonUsed: boolean; redButtonActive: boolean;
  useRedButton: () => void; doorsClosed: boolean; doorsTimer: number; hrAlive: number; setView: (v: ViewDir) => void;
  coffeeSips: number; coffeeEmpty: boolean; drinkCoffee: () => void; goRefill: () => void;
  coffeeWalking: boolean; coffeeProgress: number;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="photo-desk-scene">
      {/* Фото стола как фон */}
      <img src={DESK_PHOTO} className="desk-photo-bg" alt="desk" draggable={false} />

      {/* ── ЛЕВЫЙ МОНИТОР — кликабельный, ведёт на камеры ── */}
      <div className="desk-overlay" style={LEFT_MON_AREA} onClick={() => setView('left')} title="Открыть камеры">
        <div className="monitor-overlay-screen cameras-overlay">
          <div className="cam-grid-over">
            {[0,1,2,3,4,5,6,7,8,9].map(i => (
              <div key={i} className="cam-over-cell">
                <img src={ROOM_PHOTOS[i]} alt="" className="cam-over-img" />
                <span className="cam-over-label">CAM {String(i+1).padStart(2,'0')}</span>
              </div>
            ))}
          </div>
          <div className="monitor-click-hint">📷 Нажми для просмотра</div>
        </div>
      </div>

      {/* ── НОУТБУК — сайт с резюме ── */}
      <div className="desk-overlay laptop-overlay" style={LAPTOP_AREA}>
        <div className="laptop-inner-screen">
          <div className="laptop-url-bar">
            <span className="url-dot green" /><span className="url-dot yellow" /><span className="url-dot red" />
            <span className="url-text">🌐 АйНаНэНаНэ.хрю — Поиск персонала</span>
          </div>
          <div className="resume-list" ref={listRef}
            onWheel={e => { e.stopPropagation(); if (listRef.current) listRef.current.scrollTop += e.deltaY; }}>
            {resumes.length === 0
              ? <div className="resume-placeholder">📭 Пока тихо...</div>
              : resumes.map(r => <ResumeCard key={r.id} resume={r} onDismiss={dismissResume} />)
            }
          </div>
        </div>
      </div>

      {/* ── ПРАВЫЙ МОНИТОР — кофе и кофемашина ── */}
      <div className="desk-overlay" style={RIGHT_MON_AREA} onClick={() => !coffeeEmpty ? drinkCoffee() : goRefill()} title={coffeeEmpty ? 'Идти за кофе' : 'Сделать глоток'}>
        <div className="monitor-overlay-screen coffee-overlay">
          <div className="coffee-mon-inner">
            <div className="coffee-glass-visual">
              <div className="coffee-glass-body">
                {!coffeeEmpty && <div className="coffee-glass-liquid" style={{ height: `${(coffeeSips / COFFEE_MAX_SIPS) * 68}%` }} />}
                <div className="coffee-steam" style={{ opacity: coffeeEmpty ? 0 : 1 }}>
                  <span>〜</span><span style={{ animationDelay: '0.3s' }}>〜</span>
                </div>
              </div>
              <div className="coffee-glass-handle" />
            </div>
            <div className="coffee-mon-info">
              <div className="coffee-sips-count">{coffeeEmpty ? '💧 Пусто' : `☕ ${coffeeSips}/${COFFEE_MAX_SIPS}`}</div>
              {coffeeWalking && <div className="coffee-walking-bar"><div className="cwb-fill" style={{ width: `${coffeeProgress * 100}%` }} /></div>}
              {coffeeWalking && <div className="coffee-walking-text">🚶‍♀️ {Math.round(coffeeProgress * 100)}%</div>}
              {coffeeEmpty && !coffeeWalking && <div className="coffee-refill-hint">Нажми!</div>}
            </div>
          </div>
          <div className="monitor-click-hint">{coffeeEmpty ? '🚶 Налить кофе' : '☕ Выпить глоток'}</div>
        </div>
      </div>

      {/* ── КОФЕЙНАЯ КРУЖКА на столе (отдельный клик) ── */}
      <div className="desk-overlay coffee-cup-hotspot" style={COFFEE_AREA}
        onClick={() => !coffeeEmpty ? drinkCoffee() : goRefill()}
        title={coffeeEmpty ? 'Пусто — иди к кофемашине' : 'Выпить глоток'}>
        <div className={`cup-hotspot-indicator ${coffeeEmpty ? 'empty' : ''}`}>
          <div className="cup-fill-bar" style={{ height: `${(coffeeSips / COFFEE_MAX_SIPS) * 100}%` }} />
        </div>
      </div>

      {/* ── КРАСНАЯ КНОПКА ── */}
      <div className="desk-overlay red-btn-hotspot" style={RED_BTN_AREA}
        onClick={useRedButton}
        title={redButtonUsed ? 'Использована' : '🔴 Закрыть двери!'}>
        <div className={`photo-red-btn ${redButtonActive ? 'flashing' : ''} ${redButtonUsed && !redButtonActive ? 'spent' : ''}`}>
          <div className="photo-red-btn-cap" />
        </div>
      </div>

      {/* Алерты поверх фото */}
      {hrAlive > 0 && <div className="intruder-alert">⚠️ В КАБИНЕТЕ {hrAlive} СОИСКАТЕЛ{hrAlive === 1 ? 'Ь' : 'Я'}!</div>}
      {doorsClosed && <div className="doors-closed-banner">🚪 ДВЕРИ ЗАКРЫТЫ — {Math.ceil(doorsTimer / 1000)}с</div>}
    </div>
  );
}

/* ══ RESUME CARD ══ */
function ResumeCard({ resume, onDismiss }: { resume: Resume; onDismiss: (id: number) => void }) {
  const avatar = resume.gender === 'M' ? MALE_AVATARS[resume.avatarIndex] : FEMALE_AVATARS[resume.avatarIndex];
  return (
    <div className="resume-card">
      <img src={avatar} alt="" className="resume-avatar" />
      <div className="resume-body">
        <div className="resume-name">{resume.name}</div>
        <div className="resume-meta">{resume.age} лет · {resume.position}</div>
      </div>
      <button className="resume-x" onClick={() => onDismiss(resume.id)}>✕</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LEFT VIEW — МОНИТОР С КАМЕРАМИ (CCTV СТИЛЬ)
══════════════════════════════════════════════════════ */
function LeftView({ applicants, selectedRoom, setSelectedRoom, showMap, setShowMap, setView }: {
  applicants: Applicant[]; selectedRoom: number | null; setSelectedRoom: (r: number) => void;
  showMap: boolean; setShowMap: (v: boolean) => void; setView: (v: ViewDir) => void;
}) {
  return (
    <div className="left-view">
      <div className="cctv-monitor-frame">
        <div className="cctv-top-bar">
          <span className="cctv-title">◉ ВИДЕОНАБЛЮДЕНИЕ</span>
          <div className="cctv-top-right">
            <span className="cctv-live">● LIVE</span>
            <button className="map-btn" onClick={() => setShowMap(!showMap)}>{showMap ? '📹 Камера' : '🗺️ План'}</button>
          </div>
        </div>
        <div className="cctv-content">
          {showMap
            ? <OfficeMap applicants={applicants} selected={selectedRoom} onSelect={setSelectedRoom} />
            : <CameraView applicants={applicants} room={selectedRoom}
                onPrev={() => setSelectedRoom(Math.max(0, (selectedRoom ?? 0) - 1))}
                onNext={() => setSelectedRoom(Math.min(9, (selectedRoom ?? 0) + 1))} />
          }
        </div>
      </div>
      <button className="back-to-center" onClick={() => setView('center')}>← Рабочий стол</button>
    </div>
  );
}

/* ══ OFFICE MAP ══ */
function OfficeMap({ applicants, selected, onSelect }: { applicants: Applicant[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="office-map">
      <div className="map-title">ПЛАН ОФИСА — ЭТАЖ 3</div>
      <div className="map-grid">
        {ROOMS.map(r => {
          const cnt = applicants.filter(a => a.alive && a.roomId === r.id).length;
          return (
            <div key={r.id} className={`map-room ${selected === r.id ? 'map-room-sel' : ''} ${r.isHR ? 'map-hr' : ''} ${cnt > 0 ? 'map-alert' : ''}`} onClick={() => onSelect(r.id)}>
              <div className="map-room-thumb">
                <img src={ROOM_PHOTOS[r.id]} alt="" className="map-room-photo" />
                {cnt > 0 && <div className="map-room-overlay-alert" />}
              </div>
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

/* ══════════════════════════════════════════════════════
   CAMERA VIEW — ФОТОРЕАЛИСТИЧНЫЙ CCTV С FISH-EYE
══════════════════════════════════════════════════════ */
function CameraView({ applicants, room, onPrev, onNext }: { applicants: Applicant[]; room: number | null; onPrev: () => void; onNext: () => void }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (room === null) return (
    <div className="cam-empty">
      <span>📷</span>
      <p>Выберите комнату на плане</p>
    </div>
  );

  const roomData = ROOMS[room];
  const roomApplicants = applicants.filter(a => a.alive && a.roomId === room);
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  return (
    <div className="cctv-cam-view">
      {/* Фото комнаты с fish-eye эффектом */}
      <div className="cctv-fisheye-wrap">
        <img src={ROOM_PHOTOS[room]} alt="" className="cctv-room-photo" draggable={false} />

        {/* Тёмная vignette по краям (fish-eye эффект) */}
        <div className="cctv-fisheye-overlay" />

        {/* Сканлайны */}
        <div className="cctv-scanlines" />

        {/* Шум */}
        <div className="cctv-noise" />

        {/* CSS-персонажи поверх фото */}
        <div className="cctv-characters-layer">
          {roomApplicants.map((a, i) => (
            <CctvApplicant key={a.id} applicant={a} index={i} watching={a.stopped} />
          ))}
        </div>

        {/* HUD поверх камеры */}
        <div className="cctv-hud-top">
          <span className="cctv-cam-label">КАМ {String(room+1).padStart(2,'0')} · {roomData.name.toUpperCase()}</span>
          <span className="cctv-timestamp">{timestamp}</span>
        </div>
        <div className="cctv-hud-bottom">
          <span className="cctv-rec">● REC</span>
          <span className="cctv-cam-id">CAM-{String(room+1).padStart(2,'0')}</span>
          <span className="cctv-resolution">1080P</span>
        </div>

        {/* Красный алерт если есть соискатели */}
        {roomApplicants.length > 0 && (
          <div className="cctv-motion-alert">⚠ ДВИЖЕНИЕ</div>
        )}
      </div>

      <div className="cam-controls">
        <button onClick={onPrev}>◀</button>
        <span>{room + 1} / 10 · {roomData.name}</span>
        <button onClick={onNext}>▶</button>
      </div>
    </div>
  );
}

/* ══ CCTV APPLICANT (CSS персонаж поверх фото камеры) ══ */
function CctvApplicant({ applicant, index, watching }: { applicant: Applicant; index: number; watching: boolean }) {
  const desc = APPLICANT_DESCRIPTIONS[applicant.descIndex];
  const tall = desc.height === 'высокий' || desc.height === 'высокая';
  const short = desc.height === 'низкий' || desc.height === 'низкая';
  const chubby = desc.build === 'полный' || desc.build === 'полная';

  const bodyH = tall ? 70 : short ? 46 : 58;
  const bodyW = chubby ? 26 : 18;
  const legH = tall ? 34 : short ? 22 : 28;
  const xPos = 12 + index * 28;
  const yPos = 38 + (index % 2) * 8;

  return (
    <div className={`cctv-applicant ${watching ? 'watching' : 'walking'}`}
      style={{ left: `${xPos}%`, bottom: `${yPos}%` }}>
      {/* Тень */}
      <div className="ca-shadow" style={{ width: bodyW + 10 }} />
      {/* Голова */}
      <div className="ca-head" style={{ background: desc.skinColor, width: bodyW - 2, height: bodyW }}>
        <div className="ca-hair" style={{ background: desc.gender === 'F' ? '#6b3a1f' : '#1a1a1a' }} />
        {watching && <><div className="ca-eye l" /><div className="ca-eye r" /></>}
      </div>
      {/* Тело */}
      <div className="ca-body" style={{ background: desc.color, width: bodyW, height: bodyH }}>
        <div className="ca-arm left" style={{ background: desc.skinColor, height: bodyH * 0.55 }} />
        <div className="ca-arm right" style={{ background: desc.skinColor, height: bodyH * 0.55 }} />
        {/* Листок резюме */}
        <div className="ca-paper">
          <div className="ca-paper-lines" />
        </div>
      </div>
      {/* Ноги */}
      <div className={`ca-legs ${watching ? '' : 'walking'}`}>
        <div className="ca-leg l" style={{ height: legH, background: '#1a1a2e' }}>
          <div className="ca-shoe" />
        </div>
        <div className="ca-leg r" style={{ height: legH, background: '#1a1a2e' }}>
          <div className="ca-shoe" />
        </div>
      </div>
      {/* Имя */}
      <div className="ca-name">{applicant.name.split(' ')[0]}</div>
    </div>
  );
}
