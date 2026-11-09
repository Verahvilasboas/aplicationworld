

import { useState, useEffect, useRef } from 'react';
import './styles.css';

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

async function searchCities(query, signal) {
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=pt&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Não foi possível pesquisar cidades.');
  const data = await res.json();
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    region: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}

async function getWeather(city, units, signal) {
  const params = new URLSearchParams({
    latitude: city.lat,
    longitude: city.lon,
    timezone: 'auto',
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,precipitation,pressure_msl',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
    forecast_days: '7',
  });
  if (units === 'imperial') {
    params.set('temperature_unit', 'fahrenheit');
    params.set('wind_speed_unit', 'mph');
    params.set('precipitation_unit', 'inch');
  }
  const res = await fetch(`${WEATHER_URL}?${params}`, { signal });
  if (!res.ok) throw new Error('Não foi possível obter a previsão do tempo.');
  return res.json();
}

// Códigos WMO usados pela Open-Meteo → [descrição, tipo de céu]
const WMO = {
  0: ['Céu limpo', 'clear'], 1: ['Pouco nublado', 'clear'], 2: ['Parcialmente nublado', 'partly'],
  3: ['Nublado', 'cloud'], 45: ['Nevoeiro', 'fog'], 48: ['Nevoeiro com geada', 'fog'],
  51: ['Chuvisco fraco', 'rain'], 53: ['Chuvisco', 'rain'], 55: ['Chuvisco forte', 'rain'],
  56: ['Chuvisco gelado', 'rain'], 57: ['Chuvisco gelado forte', 'rain'],
  61: ['Chuva fraca', 'rain'], 63: ['Chuva', 'rain'], 65: ['Chuva forte', 'rain'],
  66: ['Chuva gelada', 'rain'], 67: ['Chuva gelada forte', 'rain'],
  71: ['Neve fraca', 'snow'], 73: ['Neve', 'snow'], 75: ['Neve forte', 'snow'], 77: ['Grãos de neve', 'snow'],
  80: ['Aguaceiros fracos', 'rain'], 81: ['Aguaceiros', 'rain'], 82: ['Aguaceiros fortes', 'rain'],
  85: ['Aguaceiros de neve', 'snow'], 86: ['Aguaceiros de neve fortes', 'snow'],
  95: ['Trovoada', 'storm'], 96: ['Trovoada com granizo', 'storm'], 99: ['Trovoada com granizo forte', 'storm'],
};
const describe = (code) => {
  const [label, sky] = WMO[code] || ['Desconhecido', 'cloud'];
  return { label, sky };
};
const windDir = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8];

/* ------------------------------------------------------------------ */
/* Horas e fusos                                                       */
/* ------------------------------------------------------------------ */

const myTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fmtTime = (date, timeZone, seconds = false) =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(date);

const fmtDate = (date, timeZone) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);

function offsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const fmtUtc = (mins) => {
  const a = Math.abs(mins);
  const m = a % 60;
  return `UTC${mins >= 0 ? '+' : '−'}${Math.floor(a / 60)}${m ? ':' + String(m).padStart(2, '0') : ''}`;
};
const fmtDiff = (mins) => {
  if (mins === 0) return 'mesma hora';
  const a = Math.abs(mins);
  const m = a % 60;
  return `${mins > 0 ? '+' : '−'}${Math.floor(a / 60)}h${m ? String(m).padStart(2, '0') : ''}`;
};
const hourIn = (date, timeZone) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date));

function phaseOf(hour) {
  if (hour >= 6 && hour < 12) return ['Manhã', 'day'];
  if (hour >= 12 && hour < 18) return ['Tarde', 'day'];
  if (hour >= 18 && hour < 21) return ['Fim de tarde', 'dusk'];
  return ['Noite', 'night'];
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

/* ------------------------------------------------------------------ */
/* Dados iniciais                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_CLOCKS = [
  { id: 2267057, name: 'Lisboa', country: 'Portugal', lat: 38.7167, lon: -9.1333, timezone: 'Europe/Lisbon' },
  { id: 3448439, name: 'São Paulo', country: 'Brasil', lat: -23.5475, lon: -46.6361, timezone: 'America/Sao_Paulo' },
  { id: 5128581, name: 'Nova Iorque', country: 'Estados Unidos', lat: 40.7143, lon: -74.006, timezone: 'America/New_York' },
  { id: 2643743, name: 'Londres', country: 'Reino Unido', lat: 51.5085, lon: -0.1257, timezone: 'Europe/London' },
  { id: 1850147, name: 'Tóquio', country: 'Japão', lat: 35.6895, lon: 139.6917, timezone: 'Asia/Tokyo' },
];

const VIEWS = [
  { id: 'tempo', label: 'Tempo' },
  { id: 'relogio', label: 'Relógio mundial' },
  { id: 'sobre', label: 'Sobre' },
];

/* ------------------------------------------------------------------ */
/* Ilustração: a janela mostra o céu da cidade escolhida               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Pesquisa de cidades                                                 */
/* ------------------------------------------------------------------ */

function CitySearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setStatus('idle'); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        const r = await searchCities(q, ctrl.signal);
        setResults(r);
        setActive(r.length ? 0 : -1);
        setStatus(r.length ? 'idle' : 'empty');
        setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') { setStatus('error'); setOpen(true); }
      }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (c) => { onSelect(c); setQuery(''); setResults([]); setOpen(false); };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="search" ref={boxRef}>
      <label htmlFor="city-search" className="sr-only">Pesquisar cidade</label>
      <div className="search__field">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="city-search" type="search" autoComplete="off"
          placeholder="Pesquisar cidade… ex.: Lisboa, Tóquio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox" aria-expanded={open} aria-controls="city-results"
        />
        {status === 'loading' && <span className="spinner" aria-label="A pesquisar" />}
      </div>
      {open && (results.length > 0 || status === 'empty' || status === 'error') && (
        <ul id="city-results" className="search__results" role="listbox">
          {status === 'empty' && <li className="search__msg">Nenhuma cidade encontrada para “{query}”.</li>}
          {status === 'error' && <li className="search__msg">Sem ligação ao serviço de pesquisa. Tente de novo.</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(c); }}>
              <span className="search__name">{c.name}</span>
              <span className="search__meta">{[c.region, c.country].filter(Boolean).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista: Tempo                                                        */
/* ------------------------------------------------------------------ */

function WeatherView({ city, now, units, onAddClock, inClocks }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    getWeather(city, units, ctrl.signal)
      .then(setData)
      .catch((e) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [city, units]);

  const tz = data?.timezone || city.timezone;
  const cur = data?.current;
  const daily = data?.daily;
  const d = cur ? describe(cur.weather_code) : { label: '', sky: 'clear' };
  const isDay = cur ? !!cur.is_day : phaseOf(hourIn(now, tz))[1] !== 'night';
  const tU = units === 'imperial' ? '°F' : '°C';
  const wU = units === 'imperial' ? 'mph' : 'km/h';
  const pU = units === 'imperial' ? 'in' : 'mm';

  return (
    <div className="weather">
      <div className="weather__art">
        <WindowScene sky={d.sky} isDay={isDay} />
      </div>

      <div className="weather__info">
        <p className="eyebrow">{[city.region, city.country].filter(Boolean).join(' · ')}</p>
        <h1 className="weather__city">{city.name}</h1>
        <p className="weather__local">
          <span className="mono">{fmtTime(now, tz)}</span> · {fmtDate(now, tz)}
        </p>

        {error && <p className="notice">{error} Verifique a ligação à internet.</p>}
        {loading && !cur && <p className="muted">A carregar previsão…</p>}

        {cur && (
          <>
            <div className="now">
              <span className="now__temp">{Math.round(cur.temperature_2m)}<sup>{tU}</sup></span>
              <div>
                <p className="now__desc">{d.label}</p>
                <p className="muted">Sensação de {Math.round(cur.apparent_temperature)}{tU}</p>
              </div>
            </div>
            <dl className="stats">
              <div><dt>Humidade</dt><dd>{cur.relative_humidity_2m}%</dd></div>
              <div><dt>Vento</dt><dd>{Math.round(cur.wind_speed_10m)} {wU} {windDir(cur.wind_direction_10m)}</dd></div>
              <div><dt>Precipitação</dt><dd>{cur.precipitation} {pU}</dd></div>
              <div><dt>Pressão</dt><dd>{Math.round(cur.pressure_msl)} hPa</dd></div>
              {daily && <div><dt>Nascer do sol</dt><dd>{daily.sunrise[0].slice(11, 16)}</dd></div>}
              {daily && <div><dt>Pôr do sol</dt><dd>{daily.sunset[0].slice(11, 16)}</dd></div>}
            </dl>
          </>
        )}

        <button className="btn" onClick={() => onAddClock(city)} disabled={inClocks}>
          {inClocks ? '✓ Está no relógio mundial' : '+ Adicionar ao relógio mundial'}
        </button>
      </div>

      {daily && <Forecast daily={daily} />}
    </div>
  );
}

function Forecast({ daily }) {
  const lo = Math.min(...daily.temperature_2m_min);
  const hi = Math.max(...daily.temperature_2m_max);
  const span = hi - lo || 1;
  return (
    <section className="forecast">
      <h2 className="section-title">Próximos 7 dias</h2>
      <ol className="forecast__list">
        {daily.time.map((day, i) => {
          const min = daily.temperature_2m_min[i];
          const max = daily.temperature_2m_max[i];
          const label = i === 0 ? 'Hoje'
            : new Intl.DateTimeFormat('pt-PT', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
          return (
            <li key={day} className="forecast__row">
              <span className="forecast__day">{label}</span>
              <span className="forecast__desc">{describe(daily.weather_code[i]).label}</span>
              <span className="forecast__rain" title="Probabilidade de chuva">☂ {daily.precipitation_probability_max[i] ?? 0}%</span>
              <span className="forecast__min">{Math.round(min)}°</span>
              <span className="forecast__bar" aria-hidden="true">
                <span style={{ left: `${((min - lo) / span) * 100}%`, right: `${100 - ((max - lo) / span) * 100}%` }} />
              </span>
              <span className="forecast__max">{Math.round(max)}°</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Vista: Relógio mundial                                              */
/* ------------------------------------------------------------------ */

function ClockView({ clocks, now, onRemove, onSelect }) {
  const mine = offsetMinutes(now, myTimeZone);
  return (
    <section className="clocks">
      <header className="clocks__head">
        <h1 className="page-title">Relógio mundial</h1>
        <p className="muted">
          O seu fuso: {myTimeZone.replace(/_/g, ' ')} ({fmtUtc(mine)}) · <span className="mono">{fmtTime(now, myTimeZone, true)}</span>
        </p>
      </header>
      {clocks.length === 0 && (
        <p className="notice">Ainda não há cidades. Pesquise uma cidade e carregue em “Adicionar ao relógio mundial”.</p>
      )}
      <ul className="clocks__list">
        {clocks.map((c) => {
          const off = offsetMinutes(now, c.timezone);
          const h = hourIn(now, c.timezone);
          const [phase, tone] = phaseOf(h);
          const t = fmtTime(now, c.timezone, true);
          const minsOfDay = h * 60 + Number(fmtTime(now, c.timezone).slice(3, 5));
          return (
            <li key={c.id} className={`clock tone-${tone}`}>
              <button className="clock__main" onClick={() => onSelect(c)} title={`Ver o tempo em ${c.name}`}>
                <span className="clock__city">{c.name}</span>
                <span className="clock__meta">{c.country} · {fmtDate(now, c.timezone)}</span>
                <span className="clock__time mono">{t.slice(0, 5)}<small>{t.slice(5)}</small></span>
                <span className="clock__tags">
                  <span className={`chip chip--${tone}`}>{phase}</span>
                  <span className="chip">{fmtUtc(off)}</span>
                  <span className="chip">{fmtDiff(off - mine)}</span>
                </span>
                <span className="clock__day" aria-hidden="true">
                  <span style={{ left: `${(minsOfDay / 1440) * 100}%` }} />
                </span>
              </button>
              <button className="clock__remove" onClick={() => onRemove(c.id)} aria-label={`Remover ${c.name}`}>×</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Vista: Sobre                                                        */
/* ------------------------------------------------------------------ */

function AboutView() {
  return (
    <section className="about">
      <h1 className="page-title">Sobre</h1>
      <p>
        <strong>Tempo e Horas</strong> mostra o tempo atual e a previsão de 7 dias de qualquer cidade,
        e um relógio mundial com as cidades que escolher.
      </p>
      <p>
        A janela da ilustração mostra o céu da cidade escolhida: azul de dia, escuro à noite, com chuva,
        neve ou nevoeiro conforme o tempo lá fora.
      </p>
      <p className="muted">
        Previsão e pesquisa de cidades: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.
        As horas são calculadas no navegador com a base de fusos horários IANA.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Gaveta inferior (abre com o botão ︿)                               */
/* ------------------------------------------------------------------ */

function Drawer({ open, onClose, clocks, now, units, setUnits, recent, onPick, goTo }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside id="drawer" className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Mais opções">
        <div className="drawer__inner">
          <section>
            <h2 className="section-title">Agora no mundo</h2>
            <ul className="mini-clocks">
              {clocks.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <button onClick={() => { onPick(c); goTo('tempo'); }} tabIndex={open ? 0 : -1}>
                    <span>{c.name}</span>
                    <span className="mono">{fmtTime(now, c.timezone)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="section-title">Pesquisas recentes</h2>
            {recent.length === 0
              ? <p className="muted">As cidades que pesquisar aparecem aqui.</p>
              : (
                <div className="pills">
                  {recent.map((c) => (
                    <button key={c.id} className="pill" tabIndex={open ? 0 : -1}
                      onClick={() => { onPick(c); goTo('tempo'); }}>{c.name}</button>
                  ))}
                </div>
              )}
          </section>

          <section>
            <h2 className="section-title">Unidades</h2>
            <div className="segmented" role="radiogroup" aria-label="Unidades">
              <button role="radio" aria-checked={units === 'metric'} tabIndex={open ? 0 : -1}
                onClick={() => setUnits('metric')}>°C · km/h</button>
              <button role="radio" aria-checked={units === 'imperial'} tabIndex={open ? 0 : -1}
                onClick={() => setUnits('imperial')}>°F · mph</button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const initialView = () => {
  const h = window.location.hash.replace('#', '');
  return VIEWS.some((v) => v.id === h) ? h : 'tempo';
};

export default function App() {
  const now = useNow(1000);
  const [view, setView] = useState(initialView);
  const [clocks, setClocks] = useStored('teh:clocks', DEFAULT_CLOCKS);
  const [recent, setRecent] = useStored('teh:recent', []);
  const [units, setUnits] = useStored('teh:units', 'metric');
  const [city, setCity] = useStored('teh:city', DEFAULT_CLOCKS[0]);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setView(initialView());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTo = (id) => {
    setView(id);
    setMenuOpen(false);
    setDrawer(false);
    window.history.replaceState(null, '', '#' + id);
  };

  const pickCity = (c) => {
    setCity(c);
    setRecent((list) => [c, ...list.filter((x) => x.id !== c.id)].slice(0, 8));
    goTo('tempo');
  };

  const addClock = (c) => setClocks((l) => (l.some((x) => x.id === c.id) ? l : [...l, c]));
  const removeClock = (id) => setClocks((l) => l.filter((x) => x.id !== id));

  return (
    <div className="app">
      {/* Menus em cima */}
      <header className="topbar">
        <a className="brand" href="#tempo" onClick={(e) => { e.preventDefault(); goTo('tempo'); }}>
          <span className="brand__mark" aria-hidden="true" />
          Tempo e Horas
        </a>
        <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav"
          onClick={() => setMenuOpen((o) => !o)}>
          Menu
        </button>
        <nav id="main-nav" className={`nav ${menuOpen ? 'is-open' : ''}`} aria-label="Principal">
          {VIEWS.map((v) => (
            <a key={v.id} href={'#' + v.id} aria-current={view === v.id ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); goTo(v.id); }}>
              {v.label}
            </a>
          ))}
        </nav>
        <CitySearch onSelect={pickCity} />
      </header>

      <main className="main">
        {view === 'tempo' && (
          <WeatherView city={city} now={now} units={units} onAddClock={addClock}
            inClocks={clocks.some((c) => c.id === city.id)} />
        )}
        {view === 'relogio' && (
          <ClockView clocks={clocks} now={now} onRemove={removeClock} onSelect={pickCity} />
        )}
        {view === 'sobre' && <AboutView />}
      </main>

      <Drawer open={drawer} onClose={() => setDrawer(false)} clocks={clocks} now={now}
        units={units} setUnits={setUnits} recent={recent} onPick={pickCity} goTo={goTo} />

      {/* Barra em baixo: GitHub à esquerda, botão ︿ ao centro */}
      <footer className="bottombar">
        <a className="gh" href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 16 16" width="34" height="34" aria-hidden="true">
            <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <button className={`chevron ${drawer ? 'is-open' : ''}`} onClick={() => setDrawer((o) => !o)}
          aria-expanded={drawer} aria-controls="drawer" aria-label={drawer ? 'Fechar mais opções' : 'Ver mais opções'}>
          <svg viewBox="0 0 60 20" width="60" height="20" aria-hidden="true">
            <path d="M4 16 L30 5 L56 16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="bottombar__spacer" aria-hidden="true" />
      </footer>
    </div>
  );
}

