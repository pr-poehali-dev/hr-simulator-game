// Фотореалистичные SVG-персонажи соискателей
// 10 уникальных типов: 5 мужчин + 5 женщин, разный рост/телосложение

export interface PersonStyle {
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
  hairStyle: 'short' | 'medium' | 'long' | 'bald' | 'ponytail';
  bodyType: 'slim' | 'average' | 'stocky';
  heightMult: number; // 0.8 = низкий, 1.0 = средний, 1.2 = высокий
  gender: 'M' | 'F';
  hasGlasses: boolean;
  hasTie: boolean;
  hasBeard: boolean;
}

export const PERSON_STYLES: PersonStyle[] = [
  // 0 — Деловой мужчина, высокий, светлый
  { skinColor: '#FDBCB4', hairColor: '#2a1a0a', shirtColor: '#1e3a5f', pantsColor: '#1a1a2e', shoeColor: '#0a0808', hairStyle: 'short', bodyType: 'average', heightMult: 1.2, gender: 'M', hasGlasses: false, hasTie: true, hasBeard: false },
  // 1 — Полный мужчина средних лет, тёмнокожий
  { skinColor: '#4a2512', hairColor: '#0a0808', shirtColor: '#8b4513', pantsColor: '#2d2d2d', shoeColor: '#1a0a0a', hairStyle: 'short', bodyType: 'stocky', heightMult: 0.95, gender: 'M', hasGlasses: false, hasTie: false, hasBeard: true },
  // 2 — Молодой парень, худой, рыжий
  { skinColor: '#F1C27D', hairColor: '#b45309', shirtColor: '#16a34a', pantsColor: '#1e3a5f', shoeColor: '#1a1a1a', hairStyle: 'medium', bodyType: 'slim', heightMult: 1.1, gender: 'M', hasGlasses: true, hasTie: false, hasBeard: false },
  // 3 — Пожилой мужчина с бородой, седой
  { skinColor: '#e8c4b8', hairColor: '#cccccc', shirtColor: '#334155', pantsColor: '#1e2937', shoeColor: '#0d0d0d', hairStyle: 'short', bodyType: 'average', heightMult: 0.9, gender: 'M', hasGlasses: true, hasTie: false, hasBeard: true },
  // 4 — Азиатский мужчина, спортивный
  { skinColor: '#e8c99a', hairColor: '#0a0808', shirtColor: '#dc2626', pantsColor: '#111827', shoeColor: '#1a1a1a', hairStyle: 'short', bodyType: 'slim', heightMult: 1.05, gender: 'M', hasGlasses: false, hasTie: false, hasBeard: false },
  // 5 — Деловая женщина, стройная, брюнетка
  { skinColor: '#FDBCB4', hairColor: '#1a0a0a', shirtColor: '#7c3aed', pantsColor: '#1e1e2e', shoeColor: '#0d0d0d', hairStyle: 'long', bodyType: 'slim', heightMult: 1.1, gender: 'F', hasGlasses: false, hasTie: false, hasBeard: false },
  // 6 — Рыжая женщина средних лет
  { skinColor: '#F1C27D', hairColor: '#c2410c', shirtColor: '#0891b2', pantsColor: '#1e3a5f', shoeColor: '#2d1a1a', hairStyle: 'medium', bodyType: 'average', heightMult: 0.95, gender: 'F', hasGlasses: true, hasTie: false, hasBeard: false },
  // 7 — Темнокожая женщина, высокая
  { skinColor: '#4a2512', hairColor: '#1a0a0a', shirtColor: '#be185d', pantsColor: '#111827', shoeColor: '#0a0808', hairStyle: 'ponytail', bodyType: 'slim', heightMult: 1.2, gender: 'F', hasGlasses: false, hasTie: false, hasBeard: false },
  // 8 — Полная женщина, блондинка
  { skinColor: '#FDBCB4', hairColor: '#f59e0b', shirtColor: '#059669', pantsColor: '#1e293b', shoeColor: '#1a1a1a', hairStyle: 'long', bodyType: 'stocky', heightMult: 0.88, gender: 'F', hasGlasses: false, hasTie: false, hasBeard: false },
  // 9 — Пожилая женщина, седая, в очках
  { skinColor: '#e8c4b8', hairColor: '#d1d5db', shirtColor: '#475569', pantsColor: '#2d3748', shoeColor: '#1a1a1a', hairStyle: 'short', bodyType: 'average', heightMult: 0.85, gender: 'F', hasGlasses: true, hasTie: false, hasBeard: false },
];

// Рисует SVG-персонажа как реалистичную фигуру с тенью
export function renderPersonSVG(style: PersonStyle, isWalking: boolean, frame: number): string {
  const H = Math.round(160 * style.heightMult);
  const W = style.bodyType === 'stocky' ? 56 : style.bodyType === 'slim' ? 40 : 48;
  const headR = Math.round(W * 0.38);
  const headCX = Math.round(W / 2);
  const headCY = headR + 4;
  const neckH = 8;
  const neckY = headCY + headR;
  const shoulderY = neckY + neckH;
  const torsoH = Math.round(H * 0.38);
  const legH = Math.round(H * 0.38);
  const footH = 10;
  const groundY = H - footH;

  // Анимация ходьбы
  const walkAngle = isWalking ? Math.sin(frame * 0.4) * 18 : 0;
  const legLA = isWalking ? walkAngle : 0;
  const legRA = isWalking ? -walkAngle : 0;
  const armLA = isWalking ? -walkAngle * 0.6 : 0;
  const armRA = isWalking ? walkAngle * 0.6 : 0;
  const bodyBob = isWalking ? Math.abs(Math.sin(frame * 0.4)) * 3 : 0;

  const s = style;
  const bodyTop = shoulderY + bodyBob;
  const bodyBot = bodyTop + torsoH;
  const legTopY = bodyBot;

  // Волосы
  const hair = (() => {
    if (s.hairStyle === 'bald') return '';
    const hy = headCY - headR;
    if (s.hairStyle === 'short') {
      return `<ellipse cx="${headCX}" cy="${headCY - headR * 0.2}" rx="${headR}" ry="${headR * 0.7}" fill="${s.hairColor}" opacity="0.95"/>`;
    }
    if (s.hairStyle === 'long' || s.hairStyle === 'ponytail') {
      const tail = s.hairStyle === 'ponytail'
        ? `<rect x="${headCX + headR - 4}" y="${headCY}" width="5" height="${headR * 1.8}" rx="2" fill="${s.hairColor}"/>`
        : `<rect x="${headCX - headR}" y="${headCY + headR * 0.3}" width="${headR * 2}" height="${headR * 2}" rx="${headR * 0.5}" fill="${s.hairColor}"/>`;
      return `<ellipse cx="${headCX}" cy="${headCY - headR * 0.15}" rx="${headR}" ry="${headR * 0.75}" fill="${s.hairColor}"/>${tail}`;
    }
    // medium
    return `<ellipse cx="${headCX}" cy="${headCY - headR * 0.1}" rx="${headR * 1.05}" ry="${headR * 0.72}" fill="${s.hairColor}"/>
            <rect x="${headCX - headR}" y="${headCY}" width="${headR * 2}" height="${headR * 1.2}" rx="${headR * 0.4}" fill="${s.hairColor}"/>`;
  })();

  // Очки
  const glasses = s.hasGlasses
    ? `<circle cx="${headCX - headR * 0.3}" cy="${headCY + headR * 0.05}" r="${headR * 0.22}" fill="none" stroke="#1a1a1a" stroke-width="1.5" opacity="0.7"/>
       <circle cx="${headCX + headR * 0.3}" cy="${headCY + headR * 0.05}" r="${headR * 0.22}" fill="none" stroke="#1a1a1a" stroke-width="1.5" opacity="0.7"/>
       <line x1="${headCX - headR * 0.52}" y1="${headCY + headR * 0.05}" x2="${headCX - headR}" y2="${headCY - headR * 0.05}" stroke="#1a1a1a" stroke-width="1.2" opacity="0.6"/>
       <line x1="${headCX + headR * 0.52}" y1="${headCY + headR * 0.05}" x2="${headCX + headR}" y2="${headCY - headR * 0.05}" stroke="#1a1a1a" stroke-width="1.2" opacity="0.6"/>
       <line x1="${headCX - headR * 0.08}" y1="${headCY + headR * 0.05}" x2="${headCX + headR * 0.08}" y2="${headCY + headR * 0.05}" stroke="#1a1a1a" stroke-width="1" opacity="0.6"/>`
    : '';

  // Борода
  const beard = s.hasBeard
    ? `<ellipse cx="${headCX}" cy="${headCY + headR * 0.6}" rx="${headR * 0.65}" ry="${headR * 0.35}" fill="${s.hairColor}" opacity="0.85"/>`
    : '';

  // Галстук
  const tie = s.hasTie
    ? `<polygon points="${headCX - 3},${shoulderY + 6} ${headCX + 3},${shoulderY + 6} ${headCX + 5},${bodyTop + torsoH * 0.55} ${headCX},${bodyTop + torsoH * 0.68} ${headCX - 5},${bodyTop + torsoH * 0.55}" fill="#dc2626"/>`
    : '';

  // Листок А4 в руке
  const paper = `<rect x="${W + 2}" y="${bodyTop + 10}" width="16" height="21" rx="1" fill="#f5f0e8" stroke="#c8c0b0" stroke-width="0.8"/>
    <line x1="${W + 5}" y1="${bodyTop + 15}" x2="${W + 15}" y2="${bodyTop + 15}" stroke="#6080b0" stroke-width="0.8" opacity="0.6"/>
    <line x1="${W + 5}" y1="${bodyTop + 18}" x2="${W + 15}" y2="${bodyTop + 18}" stroke="#6080b0" stroke-width="0.8" opacity="0.6"/>
    <line x1="${W + 5}" y1="${bodyTop + 21}" x2="${W + 12}" y2="${bodyTop + 21}" stroke="#6080b0" stroke-width="0.8" opacity="0.6"/>`;

  // Тень под персонажем
  const shadow = `<ellipse cx="${headCX}" cy="${groundY + footH}" rx="${W * 0.45}" ry="5" fill="rgba(0,0,0,0.35)" filter="url(#blur)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 20} ${H + 12}" width="${W + 20}" height="${H + 12}">
  <defs>
    <filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
  </defs>
  ${shadow}
  <g filter="url(#shadow)">

    <!-- Левая нога -->
    <g transform="rotate(${legLA}, ${headCX}, ${legTopY})">
      <rect x="${headCX - W * 0.22}" y="${legTopY}" width="${W * 0.2}" height="${legH}" rx="4" fill="${s.pantsColor}"/>
      <rect x="${headCX - W * 0.24}" y="${legTopY + legH - 3}" width="${W * 0.24}" height="${footH}" rx="3" fill="${s.shoeColor}"/>
    </g>

    <!-- Правая нога -->
    <g transform="rotate(${legRA}, ${headCX}, ${legTopY})">
      <rect x="${headCX + W * 0.02}" y="${legTopY}" width="${W * 0.2}" height="${legH}" rx="4" fill="${s.pantsColor}"/>
      <rect x="${headCX}" y="${legTopY + legH - 3}" width="${W * 0.24}" height="${footH}" rx="3" fill="${s.shoeColor}"/>
    </g>

    <!-- Тело (рубашка) -->
    <rect x="${headCX - W * 0.42}" y="${bodyTop}" width="${W * 0.84}" height="${torsoH}" rx="6" fill="${s.shirtColor}"/>
    <!-- Тень на теле -->
    <rect x="${headCX + W * 0.1}" y="${bodyTop}" width="${W * 0.32}" height="${torsoH}" rx="6" fill="rgba(0,0,0,0.12)"/>

    ${tie}

    <!-- Левая рука -->
    <g transform="rotate(${armLA}, ${headCX - W * 0.42}, ${bodyTop + 8})">
      <rect x="${headCX - W * 0.55}" y="${bodyTop + 6}" width="${W * 0.14}" height="${torsoH * 0.85}" rx="4" fill="${s.shirtColor}"/>
      <ellipse cx="${headCX - W * 0.48}" cy="${bodyTop + 6 + torsoH * 0.85}" rx="${W * 0.08}" ry="${W * 0.08}" fill="${s.skinColor}"/>
    </g>

    <!-- Правая рука (держит бумагу) -->
    <g transform="rotate(${armRA}, ${headCX + W * 0.42}, ${bodyTop + 8})">
      <rect x="${headCX + W * 0.41}" y="${bodyTop + 6}" width="${W * 0.14}" height="${torsoH * 0.85}" rx="4" fill="${s.shirtColor}"/>
      <ellipse cx="${headCX + W * 0.48}" cy="${bodyTop + 6 + torsoH * 0.85}" rx="${W * 0.08}" ry="${W * 0.08}" fill="${s.skinColor}"/>
    </g>

    ${paper}

    <!-- Шея -->
    <rect x="${headCX - W * 0.1}" y="${neckY}" width="${W * 0.2}" height="${neckH + 2}" rx="3" fill="${s.skinColor}"/>

    <!-- Голова -->
    <ellipse cx="${headCX}" cy="${headCY}" rx="${headR}" ry="${headR * 1.1}" fill="${s.skinColor}"/>
    <!-- Тень на голове -->
    <ellipse cx="${headCX + headR * 0.25}" cy="${headCY}" rx="${headR * 0.4}" ry="${headR * 0.9}" fill="rgba(0,0,0,0.08)"/>

    ${hair}

    <!-- Глаза -->
    <ellipse cx="${headCX - headR * 0.32}" cy="${headCY + headR * 0.05}" rx="${headR * 0.14}" ry="${headR * 0.16}" fill="#fff"/>
    <ellipse cx="${headCX + headR * 0.32}" cy="${headCY + headR * 0.05}" rx="${headR * 0.14}" ry="${headR * 0.16}" fill="#fff"/>
    <circle cx="${headCX - headR * 0.3}" cy="${headCY + headR * 0.07}" r="${headR * 0.09}" fill="#1a1a2e"/>
    <circle cx="${headCX + headR * 0.3}" cy="${headCY + headR * 0.07}" r="${headR * 0.09}" fill="#1a1a2e"/>
    <!-- Блик в глазах -->
    <circle cx="${headCX - headR * 0.27}" cy="${headCY + headR * 0.03}" r="${headR * 0.03}" fill="white"/>
    <circle cx="${headCX + headR * 0.33}" cy="${headCY + headR * 0.03}" r="${headR * 0.03}" fill="white"/>

    <!-- Рот -->
    <path d="M ${headCX - headR * 0.2} ${headCY + headR * 0.38} Q ${headCX} ${headCY + headR * 0.48} ${headCX + headR * 0.2} ${headCY + headR * 0.38}" stroke="#a06060" stroke-width="1.2" fill="none"/>

    <!-- Нос -->
    <path d="M ${headCX} ${headCY - headR * 0.05} L ${headCX - headR * 0.1} ${headCY + headR * 0.22} L ${headCX + headR * 0.1} ${headCY + headR * 0.22}" stroke="${s.skinColor === '#4a2512' ? '#2a1208' : '#c09090'}" stroke-width="1.2" fill="none" opacity="0.7"/>

    ${glasses}
    ${beard}
  </g>
</svg>`;
  return svg;
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
