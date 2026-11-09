
import React from 'react';
/* ------------------------------------------------------------------ */
/* Ilustração: a janela mostra o céu da cidade escolhida               */
/* ------------------------------------------------------------------ */
export default
function WindowScene({ sky = 'clear', isDay = true }) {
  const night = !isDay;
  const glass = night
    ? '#14121a'
    : { clear: '#9fd2ee', partly: '#b5d7ea', cloud: '#c9ccd6', fog: '#d8d6dc', rain: '#8f9bb0', snow: '#dfe4ec', storm: '#5e6475' }[sky];
  const showSun = !night && (sky === 'clear' || sky === 'partly');
  const showClouds = sky !== 'clear';
  const showRain = sky === 'rain' || sky === 'storm';

  return (
    <svg className="scene" viewBox="0 0 420 360" role="img"
      aria-label={night ? 'Janela com o céu noturno' : 'Janela com o céu de dia'}>
      {/* feixe de luz no chão */}
      <path d="M118 262 L210 230 L420 330 L420 360 L190 360 Z" fill={night ? '#efe8ec' : '#ffffff'} />
      {/* parede da janela */}
      <g transform="rotate(-8 140 140)">
        <rect x="64" y="70" width="150" height="160" fill="var(--curtain)" opacity=".55" rx="3" />
        <clipPath id="glass"><rect x="74" y="80" width="130" height="140" /></clipPath>
        <rect x="74" y="80" width="130" height="140" fill={glass} />
        <g clipPath="url(#glass)">
          {night && (
            <g fill="#f4efe6">
              <circle cx="168" cy="108" r="12" />
              <circle cx="174" cy="104" r="11" fill={glass} />
              {[[95, 100], [120, 130], [150, 160], [100, 180], [185, 150], [130, 95]].map(([x, y]) => (
                <circle key={x + '-' + y} cx={x} cy={y} r="1.6" />
              ))}
            </g>
          )}
          {showSun && <circle cx="165" cy="112" r="16" fill="var(--mustard)" />}
          {showClouds && (
            <g fill={night ? '#3a3644' : '#f6f4f7'}>
              <ellipse cx="110" cy="125" rx="30" ry="12" />
              <ellipse cx="125" cy="116" rx="18" ry="12" />
              {sky !== 'partly' && <ellipse cx="170" cy="150" rx="34" ry="12" />}
            </g>
          )}
          {showRain && (
            <g stroke={night ? '#8d93a8' : '#e8eef6'} strokeWidth="2" strokeLinecap="round">
              {Array.from({ length: 14 }).map((_, i) => (
                <line key={i} className="drop" x1={80 + i * 9} y1={140 + (i % 3) * 12}
                  x2={76 + i * 9} y2={152 + (i % 3) * 12} style={{ animationDelay: `${(i % 5) * 0.15}s` }} />
              ))}
            </g>
          )}
          {sky === 'snow' && (
            <g fill="#fff">
              {Array.from({ length: 12 }).map((_, i) => (
                <circle key={i} className="flake" cx={82 + i * 10} cy={150 + (i % 4) * 14} r="2.2"
                  style={{ animationDelay: `${(i % 4) * 0.4}s` }} />
              ))}
            </g>
          )}
          {sky === 'storm' && <path d="M140 120 l-10 22 h10 l-6 20 l18 -28 h-10 l6 -14z" fill="var(--mustard)" />}
          {sky === 'fog' && (
            <g stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".8">
              <line x1="80" y1="140" x2="190" y2="140" /><line x1="90" y1="160" x2="200" y2="160" />
              <line x1="76" y1="180" x2="170" y2="180" />
            </g>
          )}
        </g>
        {/* caixilho e parapeito */}
        <rect x="74" y="80" width="130" height="140" fill="none" stroke="var(--curtain-deep)" strokeWidth="5" />
        <line x1="74" y1="200" x2="204" y2="200" stroke="#cfc7cc" strokeWidth="3" />
        <rect x="64" y="222" width="152" height="10" rx="2" fill="var(--curtain-deep)" />
        {/* varão e cortinas */}
        <line x1="44" y1="58" x2="236" y2="58" stroke="#a8999f" strokeWidth="4" strokeLinecap="round" />
        <circle cx="236" cy="58" r="5" fill="#a8999f" />
        <path d="M48 58 h28 v176 q-8 6 -14 0 q-8 6 -14 0 z" fill="var(--curtain)" />
        <path d="M200 58 h28 v176 q-8 6 -14 0 q-8 6 -14 0 z" fill="var(--curtain)" />
        {[52, 62, 72, 204, 214, 224].map((x) => (
          <rect key={x} x={x - 3} y="52" width="6" height="12" rx="3" fill="var(--curtain-deep)" />
        ))}
      </g>
      {/* pufe e personagem a olhar pela janela */}
      <ellipse cx="320" cy="300" rx="62" ry="40" fill="var(--curtain)" />
      <ellipse cx="300" cy="268" rx="40" ry="28" fill="var(--curtain)" />
      <g>
        <path d="M296 230 q22 -10 34 8 l6 40 q-22 10 -44 0z" fill="#fff" />
        <circle cx="296" cy="214" r="15" fill="var(--mustard)" />
        <path d="M282 206 q14 -16 30 -2 q-6 -2 -10 4 q-10 -6 -20 -2z" fill="#1d1a20" />
        <path d="M282 214 l-10 3 l10 2z" fill="var(--curtain-deep)" />
        <path d="M300 262 q-30 0 -48 22 l8 6 q16 -14 40 -12z" fill="var(--mustard)" />
        <rect x="262" y="250" width="22" height="12" rx="3" transform="rotate(-20 273 256)" fill="#2a262c" />
        <path d="M252 284 l-16 10 l4 6 l18 -8z" fill="#8a8590" />
      </g>
    </svg>
  );
}
