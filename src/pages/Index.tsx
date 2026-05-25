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
  id: number;
  name: string;
  age: number;
  position: string;
  gender: string;
  avatarIndex: number;
}

interface Applicant {
  id: number;
  roomId: number;
  descIndex: number;
  name: string;
  alive: boolean;
  stopped: boolean;
}

interface GameRecord {
  survived: string;
  resumes: number;
  date: string;
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
  try { return JSON.parse(localStorage.getItem('hr_records') || '[]'); }
  catch { return []; }
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
    setView('center');
    setResumes([]);
    setElapsed(0);
    setEnergy(100);
    setCoffeeSips(COFFEE_MAX_SIPS);
    setCoffeeWalking(false);
    setCoffeeProgress(0);
    setCoffeeEmpty(false);
    setApplicants([]);
    setSelectedRoom(null);
    setShowMap(true);
    setDeathReason('');
    setRedButtonUsed(false);
    setRedButtonActive(false);
    setDoorsClosed(false);
    setDoorsTimer(0);
    setProcessedResumes(0);
    resumeIdRef.current = 0;
    applicantIdRef.current = 0;
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
            for (let i = 0; i < count; i++) {
              resumeIdRef.current++;
              newOnes.push(generateResume(resumeIdRef.current));
            }
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
    setCoffeeWalking(true);
    setCoffeeProgress(0);
    const e = energyRef.current;
    const walkMs = Math.max(3000, 10000 - e * 70);
    let step = 0;
    const steps = 40;
    const iv = setInterval(() => {
      step++;
      setCoffeeProgress(step / steps);
      if (step >= steps) {
        clearInterval(iv);
        setCoffeeSips(COFFEE_MAX_SIPS);
        setCoffeeWalking(false);
        setCoffeeEmpty(false);
        setCoffeeProgress(0);
      }
    }, walkMs / steps);
  }, [coffeeSips]);

  const useRedButton = useCallback(() => {
    if (redButtonUsed) return;
    setRedButtonUsed(true);
    setRedButtonActive(true);
    setDoorsClosed(true);
    setDoorsTimer(10000);
    setApplicants(prev => prev.map(a => a.roomId === HR_ROOM_ID ? { ...a, alive: false } : a));
  }, [redButtonUsed]);

  const gameHour = getGameHour(elapsed);
  const hrAlive = applicants.filter(a => a.alive && a.roomId === HR_ROOM_ID);
  const blurAmt = energy < 80 ? ((80 - energy) / 80) * 14 : 0;
  const bloodOpacity = energy < 80 ? ((80 - energy) / 80) * 0.85 : 0;

  if (gameState === 'menu') return <MenuScreen onStart={resetGame} showRecords={showRecords} setShowRecords={setShowRecords} records={records} />;
  if (gameState === 'gameover') return <GameOverScreen reason={deathReason} time={survivedTime} resumes={processedResumes} onRestart={resetGame} onMenu={() => { setGameState('menu'); }} />;
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
        {view === 'left' && (
          <LeftView applicants={applicants} selectedRoom={selectedRoom} setSelectedRoom={r => { setSelectedRoom(r); setShowMap(false); }} showMap={showMap} setShowMap={setShowMap} setView={setView} />
        )}
        {view === 'center' && (
          <CenterView resumes={resumes} dismissResume={dismissResume} redButtonUsed={redButtonUsed} redButtonActive={redButtonActive} useRedButton={useRedButton} doorsClosed={doorsClosed} doorsTimer={doorsTimer} hrAlive={hrAlive.length} setView={setView} />
        )}
        {view === 'right' && (
          <RightView coffeeSips={coffeeSips} coffeeWalking={coffeeWalking} coffeeProgress={coffeeProgress} coffeeEmpty={coffeeEmpty} drinkCoffee={drinkCoffee} goRefill={goRefill} setView={setView} energy={energy} />
        )}
      </div>

      <div className="view-nav">
        <button className={`vnav-btn ${view === 'left' ? 'active' : ''}`} onClick={() => setView('left')}>◀ Камеры</button>
        <button className={`vnav-btn ${view === 'center' ? 'active' : ''}`} onClick={() => setView('center')}>Рабочий стол</button>
        <button className={`vnav-btn ${view === 'right' ? 'active' : ''}`} onClick={() => setView('right')}>Кофе ▶</button>
      </div>
    </div>
  );
}

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
            {records.length === 0
              ? <p className="records-empty">Рекордов пока нет — дерзай!</p>
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

function GameOverScreen({ reason, time, resumes, onRestart, onMenu }: { reason: DeathReason; time: string; resumes: number; onRestart: () => void; onMenu: () => void }) {
  const won = reason === 'win';
  const icon = won ? '🎉' : reason === 'resumes' ? '📄' : reason === 'applicants' ? '😱' : '💤';
  const reasonText: Record<string, string> = {
    resumes: 'Резюме переполнили весь экран (100 штук). HRка сдалась.',
    applicants: 'Два соискателя ворвались в кабинет. Собеседование не выжить.',
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

function CenterView({ resumes, dismissResume, redButtonUsed, redButtonActive, useRedButton, doorsClosed, doorsTimer, hrAlive, setView }: {
  resumes: Resume[]; dismissResume: (id: number) => void; redButtonUsed: boolean; redButtonActive: boolean;
  useRedButton: () => void; doorsClosed: boolean; doorsTimer: number; hrAlive: number; setView: (v: ViewDir) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <div className="center-view">
      <div className="office-room">
        <div className="back-wall" />
        <div className="office-window"><div className="window-light" /><div className="blinds" /></div>
        <div className="desk-area">
          <div className="desk-top">
            <div className="left-mon-preview" onClick={() => setView('left')} title="Перейти к камерам">
              <div className="lmon-screen">
                <div className="lmon-label">📷 Камеры</div>
                <div className="lmon-rooms">
                  {ROOMS.slice(0, 6).map(r => <div key={r.id} className="lmon-room">{ROOM_ICONS[r.id]}</div>)}
                </div>
              </div>
            </div>

            <div className="laptop-wrap">
              <div className="laptop-screen">
                <div className="laptop-url">🌐 АйНаНэНаНэ.хрю — Поиск персонала</div>
                <div
                  className="resume-list"
                  ref={listRef}
                  onWheel={e => { e.stopPropagation(); if (listRef.current) listRef.current.scrollTop += e.deltaY; }}
                >
                  {resumes.length === 0
                    ? <div className="resume-placeholder">📭 Пока тихо... но они едут</div>
                    : resumes.map(r => <ResumeCard key={r.id} resume={r} onDismiss={dismissResume} />)
                  }
                </div>
              </div>
              <div className="laptop-base" />
            </div>

            <div className="right-mon-preview" onClick={() => setView('right')} title="Перейти к кофе">
              <div className="rmon-screen">
                <div className="rmon-label">☕ Кофе</div>
                <div className="rmon-mug">☕</div>
              </div>
            </div>
          </div>

          <div className="desk-surface-items">
            <div
              className={`red-btn-wrap ${redButtonActive ? 'btn-flashing' : ''} ${redButtonUsed && !redButtonActive ? 'btn-spent' : ''}`}
              onClick={useRedButton}
              title={redButtonUsed ? 'Кнопка использована' : 'Красная кнопка — закрыть двери на 10 сек и вылить кофе на соискателя'}
            >
              <div className="red-btn-cap" />
              <div className="red-btn-base" />
              <div className="red-btn-text">{redButtonUsed ? '✓' : '!'}</div>
            </div>
            <div className="desk-notepad" />
            <div className="desk-plant">🌿</div>
          </div>
        </div>
      </div>

      {hrAlive > 0 && <div className="intruder-alert">⚠️ В КАБИНЕТЕ {hrAlive} СОИСКАТЕЛ{hrAlive === 1 ? 'Ь' : 'Я'}!</div>}
      {doorsClosed && <div className="doors-closed-banner">🚪 ДВЕРИ ЗАКРЫТЫ — {Math.ceil(doorsTimer / 1000)}с</div>}
    </div>
  );
}

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

function CameraView({ applicants, room, onPrev, onNext }: { applicants: Applicant[]; room: number | null; onPrev: () => void; onNext: () => void }) {
  if (room === null) return (
    <div className="cam-empty"><span>📷</span><p>Откройте план и выберите комнату</p></div>
  );
  const roomData = ROOMS[room];
  const roomApplicants = applicants.filter(a => a.alive && a.roomId === room);
  return (
    <div className="cam-view">
      <div className="cam-hud"><span>КАМ {room + 1} · {roomData.name}</span><span className="cam-rec">● REC</span></div>
      <div className="cam-scene">
        <div className="cam-bg" />
        <div className="cam-floor" />
        {[0, 1, 2].map(i => (
          <div key={i} className="cam-worker" style={{ left: `${10 + i * 30}%` }}>
            <div className="cam-worker-body" />
            <div className="cam-desk-mini" />
          </div>
        ))}
        {roomApplicants.map((a, i) => (
          <ApplicantFig key={a.id} applicant={a} xPos={20 + i * 35} watching={true} />
        ))}
        <div className="cam-noise" />
        <div className="cam-scanline" />
      </div>
      <div className="cam-controls">
        <button onClick={onPrev}>◀</button>
        <span>{room + 1} / 10</span>
        <button onClick={onNext}>▶</button>
      </div>
    </div>
  );
}

function ApplicantFig({ applicant, xPos, watching }: { applicant: Applicant; xPos: number; watching: boolean }) {
  const desc = APPLICANT_DESCRIPTIONS[applicant.descIndex];
  const tall = desc.height === 'высокий' || desc.height === 'высокая';
  const short = desc.height === 'низкий' || desc.height === 'низкая';
  const chubby = desc.build === 'полный' || desc.build === 'полная';
  const h = tall ? 54 : short ? 36 : 44;
  const w = chubby ? 22 : 15;
  return (
    <div className={`applicant-fig ${watching ? 'watching' : 'walking'}`} style={{ left: `${xPos}%`, bottom: '18%' }}>
      <div className="appl-head" style={{ background: desc.skinColor, width: w - 2, height: 12 }} />
      <div className="appl-body" style={{ background: desc.color, width: w, height: h }} />
      <div className="appl-paper">📄</div>
      {watching && <div className="appl-eyes">👀</div>}
      <div className="appl-name">{applicant.name.split(' ')[0]}</div>
    </div>
  );
}

function RightView({ coffeeSips, coffeeWalking, coffeeProgress, coffeeEmpty, drinkCoffee, goRefill, setView, energy }: {
  coffeeSips: number; coffeeWalking: boolean; coffeeProgress: number; coffeeEmpty: boolean;
  drinkCoffee: () => void; goRefill: () => void; setView: (v: ViewDir) => void; energy: number;
}) {
  return (
    <div className="right-view">
      <div className="right-room">
        <div className="right-wall-bg" />
        <div className="right-corner">
          <div className="cooler-unit">💧</div>
          <div className={`coffee-machine ${coffeeWalking ? 'brewing' : ''}`} onClick={goRefill} title="Нажать — HRка пойдёт наливать">
            <div className="cm-body-wrap">
              <div className="cm-face">☕</div>
              <div className="cm-label">КОФЕМАШИНА</div>
              {coffeeWalking && (
                <div className="cm-progress-bar"><div className="cm-prog-fill" style={{ width: `${coffeeProgress * 100}%` }} /></div>
              )}
            </div>
          </div>
        </div>
        <div className="right-desk-area">
          <div className={`coffee-cup ${coffeeEmpty ? 'empty' : ''}`} onClick={drinkCoffee} title="Сделать глоток">
            <div className="cup-glass">
              {!coffeeEmpty && <div className="cup-liquid" style={{ height: `${(coffeeSips / COFFEE_MAX_SIPS) * 65}%` }} />}
            </div>
            <div className="cup-handle" />
            <div className="cup-label">{coffeeSips}/{COFFEE_MAX_SIPS} глотков</div>
          </div>
          {coffeeEmpty && !coffeeWalking && (
            <div className="refill-hint" onClick={goRefill}>→ Нажми на кофемашину!</div>
          )}
          {coffeeWalking && (
            <div className="walk-status">🚶‍♀️ Идёт... {Math.round(coffeeProgress * 100)}%</div>
          )}
        </div>
      </div>
      <button className="back-to-center" onClick={() => setView('center')}>← Центр</button>
    </div>
  );
}
