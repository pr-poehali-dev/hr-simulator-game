// ═══════════════════════════════════════════════════════════
// ЗВУКОВАЯ СИСТЕМА — Web Audio API + Speech Synthesis
// ═══════════════════════════════════════════════════════════

let ctx: AudioContext | null = null;
let humNode: OscillatorNode | null = null;
let humGain: GainNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ─── ФОНОВЫЙ ЗВУК: ТОЛЬКО ЖУЖЖАНИЕ ЛЮМИНЕСЦЕНТНЫХ ЛАМП ──────
export function startOfficeAmbience() {
  try {
    const ac = getCtx();

    if (humNode) return; // уже запущено

    // Основная частота лампы — 100 Гц (пилообразник)
    humNode = ac.createOscillator();
    humNode.type = 'sawtooth';
    humNode.frequency.value = 100;

    // Вторая гармоника — 200 Гц, придаёт "электрический" характер
    const hum2 = ac.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 200;

    const gain2 = ac.createGain();
    gain2.gain.value = 0.003;

    // Лёгкое нерегулярное мерцание лампы
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.7; // ~раз в секунду
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.001;

    // Фильтр — убираем слишком высокие частоты
    const lpf = ac.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 600;

    humGain = ac.createGain();
    humGain.gain.value = 0;

    // Собираем граф: осцилляторы → фильтр → gain → output
    humNode.connect(lpf);
    hum2.connect(gain2);
    gain2.connect(lpf);
    lfo.connect(lfoGain);
    lfoGain.connect(humGain.gain); // LFO модулирует громкость
    lpf.connect(humGain);
    humGain.connect(ac.destination);

    humNode.start();
    hum2.start();
    lfo.start();

    // Плавный fade-in до хорошо слышимой громкости
    humGain.gain.linearRampToValueAtTime(0.022, ac.currentTime + 2.5);
  } catch (e) {
    // ignore
  }
}

export function stopOfficeAmbience() {
  try {
    if (humGain) {
      humGain.gain.linearRampToValueAtTime(0, (ctx?.currentTime ?? 0) + 1);
    }
    setTimeout(() => {
      try { humNode?.stop(); } catch (_) { /* ignore */ }
      humNode = null;
      humGain = null;
    }, 1200);
  } catch (e) {
    // ignore
  }
}

// ─── ЗВУК "ОТКАЗ!" (4 вариации через Speech Synthesis) ───────
const REJECT_PHRASES = ['Отказ!', 'Отказ.', 'Отказать!', 'Отказано.'];
let rejectIndex = 0;

export function playRejectSound() {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();
    const phrase = REJECT_PHRASES[rejectIndex % REJECT_PHRASES.length];
    rejectIndex++;

    const utt = new SpeechSynthesisUtterance(phrase);
    utt.lang = 'ru-RU';
    utt.volume = 0.85;

    // Ищем женский голос
    const voices = synth.getVoices();
    const femaleRu = voices.find(v =>
      v.lang.startsWith('ru') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('женщ') || v.name.toLowerCase().includes('alyona') || v.name.toLowerCase().includes('milena') || v.name.toLowerCase().includes('irina') || v.name.toLowerCase().includes('viktoria') || v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('oxana') || v.name.toLowerCase().includes('anna'))
    ) || voices.find(v => v.lang.startsWith('ru')) || null;

    if (femaleRu) utt.voice = femaleRu;

    // 4 вариации: разная скорость и тональность
    const variants = [
      { rate: 1.0,  pitch: 1.3 },
      { rate: 1.15, pitch: 1.2 },
      { rate: 0.92, pitch: 1.4 },
      { rate: 1.05, pitch: 1.25 },
    ];
    const v = variants[(rejectIndex - 1) % 4];
    utt.rate  = v.rate;
    utt.pitch = v.pitch;

    synth.speak(utt);
  } catch (e) {
    // ignore
  }
}

// ─── ГОЛОСА СОИСКАТЕЛЕЙ ───────────────────────────────────────
// 10 разных конфигураций голоса — каждый соискатель звучит уникально
const APPLICANT_VOICE_CONFIGS = [
  { pitch: 0.8,  rate: 0.9,  volume: 0.7  }, // низкий мужской
  { pitch: 1.5,  rate: 1.1,  volume: 0.75 }, // высокий женский
  { pitch: 0.95, rate: 1.2,  volume: 0.65 }, // быстрый мужской
  { pitch: 1.3,  rate: 0.85, volume: 0.8  }, // медленный женский
  { pitch: 0.7,  rate: 0.95, volume: 0.7  }, // очень низкий
  { pitch: 1.2,  rate: 1.0,  volume: 0.75 }, // средний женский
  { pitch: 1.0,  rate: 1.3,  volume: 0.6  }, // нервный быстрый
  { pitch: 0.85, rate: 0.8,  volume: 0.8  }, // медленный пожилой
  { pitch: 1.4,  rate: 1.15, volume: 0.7  }, // молодой женский
  { pitch: 0.9,  rate: 1.05, volume: 0.65 }, // средний мужской
];

const APPLICANT_PHRASES = [
  'Возьмите меня!',
  'Мне нужна работа!',
  'Ну пожалуйста...',
  'Вот моё резюме!',
  'Я очень хочу работать!',
  'Рассмотрите меня!',
  'Пожалуйста, возьмите!',
  'Я отлично подхожу!',
];

// Текущие utterance соискателей: id → utterance interval
const applicantSpeechIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

export function startApplicantSpeech(applicantId: number, descIndex: number) {
  stopApplicantSpeech(applicantId);

  const cfg = APPLICANT_VOICE_CONFIGS[descIndex % APPLICANT_VOICE_CONFIGS.length];

  const speak = () => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;

      // Случайная реплика из массива — может повторяться, полностью случайно
      const phrase = APPLICANT_PHRASES[Math.floor(Math.random() * APPLICANT_PHRASES.length)];

      const utt = new SpeechSynthesisUtterance(phrase);
      utt.lang = 'ru-RU';
      utt.volume = cfg.volume;
      utt.pitch  = cfg.pitch;
      utt.rate   = cfg.rate;

      const voices = synth.getVoices();
      const ruVoice = voices.find(v => v.lang.startsWith('ru'));
      if (ruVoice) utt.voice = ruVoice;

      synth.speak(utt);
    } catch (e) {
      // ignore
    }
  };

  // Говорим сразу и потом каждые 3.5 сек
  speak();
  const iv = setInterval(speak, 3500);
  applicantSpeechIntervals.set(applicantId, iv);
}

export function stopApplicantSpeech(applicantId: number) {
  const iv = applicantSpeechIntervals.get(applicantId);
  if (iv !== undefined) {
    clearInterval(iv);
    applicantSpeechIntervals.delete(applicantId);
  }
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {
    // ignore
  }
}

export function stopAllApplicantSpeech() {
  applicantSpeechIntervals.forEach((iv) => clearInterval(iv));
  applicantSpeechIntervals.clear();
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {
    // ignore
  }
}

// ─── ЗВУК POP при взрыве соискателя ─────────────────────────
export function playPopSound() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    // Удар + затухание
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.35);

    // Шуршание
    const bufSize = Math.floor(ac.sampleRate * 0.15);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const ns = ac.createBufferSource();
    const ng = ac.createGain();
    ng.gain.value = 0.2;
    ns.buffer = buf;
    ns.connect(ng);
    ng.connect(ac.destination);
    ns.start(t);
  } catch (e) {
    // ignore
  }
}

// ─── ИНИЦИАЛИЗАЦИЯ при первом взаимодействии ─────────────────
export function initAudio() {
  try {
    getCtx();
    // Загружаем голоса (нужно вызвать до использования)
    window.speechSynthesis?.getVoices();
    // Повторный вызов через паузу — Chrome загружает голоса асинхронно
    setTimeout(() => window.speechSynthesis?.getVoices(), 500);
  } catch (e) {
    // ignore
  }
}