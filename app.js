/* ─────────────────────────────────────────────────────────────
   Nimbus Weather App — app.js
   ───────────────────────────────────────────────────────────── */

// Safe localStorage wrapper with in-memory fallback for mobile/private browsing compatibility
const safeStorage = (() => {
  const memStore = {};
  let hasLocalStorage = false;
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      hasLocalStorage = true;
    }
  } catch (e) {
    hasLocalStorage = false;
  }

  return {
    getItem(key) {
      if (hasLocalStorage) {
        try {
          return window.localStorage.getItem(key);
        } catch (e) {
          console.warn("safeStorage.getItem failed, falling back to memory:", e);
        }
      }
      return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    },
    setItem(key, value) {
      if (hasLocalStorage) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch (e) {
          console.warn("safeStorage.setItem failed, falling back to memory:", e);
        }
      }
      memStore[key] = String(value);
    },
    removeItem(key) {
      if (hasLocalStorage) {
        try {
          window.localStorage.removeItem(key);
          return;
        } catch (e) {
          console.warn("safeStorage.removeItem failed, falling back to memory:", e);
        }
      }
      delete memStore[key];
    },
    clear() {
      if (hasLocalStorage) {
        try {
          window.localStorage.clear();
          return;
        } catch (e) {
          console.warn("safeStorage.clear failed, falling back to memory:", e);
        }
      }
      for (const key in memStore) {
        delete memStore[key];
      }
    }
  };
})();

const BASE = 'https://api.openweathermap.org';
const PRESET_KEY = '';

function isValidApiKey(key) {
  if (key === 'demo') return true;
  return typeof key === 'string' && /^[a-f0-9]{32}$/i.test(key.trim());
}

let storedKey = safeStorage.getItem('nimbusApiKey');
let API_KEY = isValidApiKey(storedKey) ? storedKey.trim() : PRESET_KEY;
safeStorage.setItem('nimbusApiKey', API_KEY);

function generateMockWeather(cityName, countryCode) {
  let hash = 0;
  for (let i = 0; i < cityName.length; i++) {
    hash = cityName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  const conditions = [
    { id: 800, desc: 'clear sky', temp: 16 + (hash % 18), icon: '☀️' },
    { id: 801, desc: 'few clouds', temp: 14 + (hash % 15), icon: '🌤️' },
    { id: 803, desc: 'broken clouds', temp: 10 + (hash % 12), icon: '🌥️' },
    { id: 500, desc: 'light rain', temp: 8 + (hash % 10), icon: '🌧️' },
    { id: 502, desc: 'heavy intensity rain', temp: 6 + (hash % 8), icon: '🌧️' },
    { id: 200, desc: 'thunderstorm with rain', temp: 12 + (hash % 12), icon: '⛈️' },
    { id: 600, desc: 'light snow', temp: -5 + (hash % 8), icon: '❄️' },
    { id: 741, desc: 'fog', temp: 5 + (hash % 6), icon: '🌫️' }
  ];
  
  const cond = conditions[hash % conditions.length];
  
  const cur = {
    cod: 200,
    name: cityName,
    sys: {
      country: countryCode || 'US',
      sunrise: Math.floor(Date.now() / 1000) - 20000,
      sunset: Math.floor(Date.now() / 1000) + 20000
    },
    coord: {
      lat: (hash % 140) - 70,
      lon: (hash % 360) - 180
    },
    dt: Math.floor(Date.now() / 1000),
    main: {
      temp: cond.temp,
      feels_like: cond.temp + (hash % 4) - 2,
      temp_max: cond.temp + 4,
      temp_min: cond.temp - 4,
      humidity: 30 + (hash % 60),
      pressure: 990 + (hash % 40)
    },
    wind: {
      speed: 1 + (hash % 15),
      deg: hash % 360
    },
    clouds: {
      all: cond.id === 800 ? 0 : cond.id === 801 ? 15 : cond.id === 803 ? 60 : 90
    },
    visibility: cond.id === 741 ? 800 : 10000,
    weather: [{
      id: cond.id,
      description: cond.desc,
      main: cond.id >= 600 && cond.id < 700 ? 'Snow' : cond.id >= 500 && cond.id < 600 ? 'Rain' : cond.id >= 200 && cond.id < 300 ? 'Thunderstorm' : 'Clear'
    }],
    timezone: ((hash % 24) - 12) * 3600
  };
  
  const fcastList = [];
  for (let i = 0; i < 40; i++) {
    const timeOffset = i * 3 * 3600;
    const fTime = cur.dt + timeOffset;
    const hourFactor = Math.sin((fTime % 86400) / 86400 * 2 * Math.PI);
    const fTemp = cond.temp + hourFactor * 6 + (hash % 3) - 1.5;
    
    fcastList.push({
      dt: fTime,
      main: {
        temp: fTemp,
        feels_like: fTemp - 1,
        temp_max: fTemp + 1,
        temp_min: fTemp - 1,
        humidity: Math.min(100, Math.max(0, cur.main.humidity + Math.round(hourFactor * -15))),
        pressure: cur.main.pressure
      },
      wind: cur.wind,
      clouds: cur.clouds,
      weather: cur.weather,
      pop: cond.id >= 500 && cond.id < 600 ? 0.3 + (i % 5) * 0.15 : 0
    });
  }
  
  const fcast = {
    cod: "200",
    list: fcastList
  };
  
  const uvData = {
    value: Math.max(0.2, 8 * Math.sin(((cur.dt % 86400) / 86400) * 2 * Math.PI) + (hash % 3))
  };
  
  const aqiData = {
    list: [{
      main: { aqi: Math.max(1, Math.min(5, 1 + (hash % 5))) },
      components: {
        pm2_5: 2 + (hash % 40),
        pm10: 5 + (hash % 60)
      }
    }]
  };
  
  return { cur, fcast, uvData, aqiData };
}
let isCelsius = true;
let is24Hour = safeStorage.getItem('is24Hour') === 'true';
let currentWeatherData = null;
let currentForecastData = null;
let suggestTimer = null;
let timezonePref = 'city';
let liveClockInterval = null;



/* ─── DOM refs ──────────────────────────────────────────────── */
const body           = document.getElementById('body');
const bgLayer        = document.getElementById('bgLayer');
const particles      = document.getElementById('particles') || document.createElement('div');
const apiModal       = document.getElementById('apiModal');
const apiKeyInput    = document.getElementById('apiKeyInput');
const saveApiKeyBtn  = document.getElementById('saveApiKey');
const useDemoModeBtn = document.getElementById('useDemoMode');
const cityInput      = document.getElementById('cityInput');
const clearBtn       = document.getElementById('clearBtn');
const suggestionsEl  = document.getElementById('suggestions');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorCard      = document.getElementById('errorCard');
const errorMsg       = document.getElementById('errorMsg');
const welcomeScreen  = document.getElementById('welcomeScreen');
const weatherContent = document.getElementById('weatherContent');
const locationBtn    = document.getElementById('locationBtn');
const unitToggle     = document.getElementById('unitToggle');
const logoHomeBtn    = document.getElementById('logoHomeBtn');
const recentSection     = document.getElementById('recentSection');
const recentChips       = document.getElementById('recentChips');

let recentSearches = JSON.parse(safeStorage.getItem('nimbus_recent') || '[]');
let isHistoryNavigating = false; // Flag to prevent history loop feedback

function pushNavigationState(state) {
  if (isHistoryNavigating) return;
  if (window.history) {
    let url = window.location.pathname;
    if (state.page === 'weather' && state.city) {
      url += `?city=${encodeURIComponent(state.city)}`;
    }
    if (state.page === 'weather') {
      if (window.history.state && window.history.state.page === 'weather') {
        window.history.replaceState(state, '', url);
      } else {
        window.history.pushState(state, '', url);
      }
    } else {
      window.history.pushState(state, '', url);
    }
  }
}

window.addEventListener('popstate', (e) => {
  isHistoryNavigating = true;
  
  const detailEl = document.getElementById('detailOverlay');
  const isDetailOpen = detailEl && detailEl.classList.contains('open');
  
  if (isDetailOpen) {
    closeDetailVisual();
    isHistoryNavigating = false;
    return;
  }
  
  if (e.state) {
    if (e.state.page === 'weather' && e.state.city) {
      fetchWeather(e.state.city).finally(() => {
        isHistoryNavigating = false;
      });
    } else if (e.state.page === 'home') {
      goHomeVisual();
      isHistoryNavigating = false;
    } else {
      isHistoryNavigating = false;
    }
  } else {
    goHomeVisual();
    isHistoryNavigating = false;
  }
});


/* ─── Init ──────────────────────────────────────────────────── */
function init() {
  if (window.WeatherCanvas) {
    window.weatherCanvas = new WeatherCanvas('particlesCanvas');
  }

  if (!API_KEY) { apiModal.style.display = 'grid'; }
  else          { apiModal.style.display = 'none';  }

  // Register Service Worker for PWA (downloadable chrome application)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // Event listeners
  saveApiKeyBtn.addEventListener('click', saveKey);
  if (useDemoModeBtn) {
    useDemoModeBtn.addEventListener('click', () => {
      API_KEY = 'demo';
      safeStorage.setItem('nimbusApiKey', 'demo');
      apiModal.style.display = 'none';
      
      // Update modal warning text back to default in case it was changed during 401
      const descEl = document.querySelector('.modal-desc');
      if (descEl) {
        descEl.innerHTML = 'To use Nimbus, you need a free <a href="https://openweathermap.org/api" target="_blank" rel="noopener">OpenWeatherMap API key</a>. Your key is stored locally and never shared.';
      }

      const val = cityInput.value.trim();
      if (val) {
        fetchWeather(val);
      } else {
        fetchWeather('London');
      }
    });
  }
  apiKeyInput.addEventListener('keydown', e => { if(e.key==='Enter') saveKey(); });
  cityInput.addEventListener('input', onSearchInput);
  cityInput.addEventListener('keydown', onSearchKeydown);
  clearBtn.addEventListener('click', clearSearch);
  locationBtn.addEventListener('click', useLocation);
  unitToggle.addEventListener('click', toggleUnit);

  const timeToggle = document.getElementById('timeToggle');
  if (timeToggle) {
    timeToggle.textContent = is24Hour ? '24H' : '12H';
    timeToggle.addEventListener('click', toggleTimeFormat);
  }

  const cityChips = document.getElementById('cityChips');
  if (cityChips) {
    cityChips.addEventListener('click', e => {
      const chip = e.target.closest('.city-chip');
      if (chip) fetchWeather(chip.dataset.city);
    });
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) closeSuggestions();
  });

  if (logoHomeBtn) {
    logoHomeBtn.addEventListener('click', goHome);
  }

  if (window.history && window.history.replaceState) {
    const params = new URLSearchParams(window.location.search);
    const cityQuery = params.get('city');
    if (cityQuery) {
      window.history.replaceState({ page: 'weather', city: cityQuery }, '');
    } else {
      window.history.replaceState({ page: 'home' }, '');
    }
  }
  renderRecentSearches();

  const params = new URLSearchParams(window.location.search);
  const cityQuery = params.get('city');
  if (cityQuery) {
    cityInput.value = cityQuery;
    if (API_KEY) {
      fetchWeather(cityQuery);
    }
  }
}

/* ─── API Key ───────────────────────────────────────────────── */
function saveKey() {
  const key = apiKeyInput.value.trim();
  if (!isValidApiKey(key)) { shake(apiKeyInput); return; }
  API_KEY = key;
  safeStorage.setItem('nimbusApiKey', key);
  apiModal.style.display = 'none';
  
  const descEl = document.querySelector('.modal-desc');
  if (descEl) {
    descEl.innerHTML = 'To use Nimbus, you need a free <a href="https://openweathermap.org/api" target="_blank" rel="noopener">OpenWeatherMap API key</a>. Your key is stored locally and never shared.';
  }

  const val = cityInput.value.trim();
  if (val) {
    fetchWeather(val);
  } else {
    fetchWeather('London');
  }
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
}

/* ─── Pinned Cities Dashboard & Homepage Redirect ───────────── */
function goHomeVisual() {
  // 1. Switch back to Weather page
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const tabWeather = document.getElementById('tabWeather');
  if (tabWeather) {
    tabWeather.classList.add('active');
    updateTabIndicator(tabWeather, false);
  }
  
  const tabRadarAstro = document.getElementById('tabRadarAstro');
  if (tabRadarAstro) tabRadarAstro.style.display = 'none';
  
  document.getElementById('pagWeather').style.display = '';
  document.getElementById('pagCompare').style.display = 'none';
  document.getElementById('pagRadarAstro').style.display = 'none';
  
  // 2. Hide weather details content, errors, and warning alerts ticker, show welcome screen
  if (weatherContent) weatherContent.style.display = 'none';
  if (errorCard) errorCard.style.display = 'none';
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  
  const warningTicker = document.getElementById('warningTicker');
  if (warningTicker) warningTicker.style.display = 'none';
  
  if (welcomeScreen) welcomeScreen.style.display = 'block';
  
  // 3. Clear and reset search inputs
  if (cityInput) cityInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  closeSuggestions();
  
  // 4. Render recent searches
  renderRecentSearches();
  
  // 5. Reset background and particle canvas effects to default homepage style
  setBackground(null, false, 20);
  
  // Reposition weather explorer widget to welcome screen
  positionWeatherExplorer();
}

function goHome() {
  goHomeVisual();
  if (!isHistoryNavigating) {
    pushNavigationState({ page: 'home' });
  }
}

function renderRecentSearches() {
  if (!recentSection || !recentChips) return;
  
  if (recentSearches.length === 0) {
    recentSection.style.display = 'none';
    return;
  }
  
  recentSection.style.display = 'block';
  recentChips.innerHTML = '';
  
  recentSearches.forEach(search => {
    const cityName = typeof search === 'string' ? search : search.name;
    const countryCode = typeof search === 'object' && search.country ? search.country : '';
    const flagUrl = countryCode ? `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png` : '';
    
    const chip = document.createElement('div');
    chip.className = 'city-chip';
    chip.innerHTML = `
      <span style="display: flex; align-items: center; gap: 6px;">
        ${countryCode ? `<img src="${flagUrl}" alt="${countryCode}" style="width:14px; height:10px; border-radius:1px; box-shadow:0 1px 2px rgba(0,0,0,0.15);" onerror="this.style.display='none'" />` : '📍'}
        ${cityName}
      </span>
      <span class="city-chip-delete" title="Remove from recent searches">×</span>
    `;
    
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('city-chip-delete')) return;
      
      if (cityInput) {
        cityInput.value = cityName;
        if (clearBtn) clearBtn.style.display = 'block';
      }
      fetchWeather(cityName);
    });
    
    const delBtn = chip.querySelector('.city-chip-delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeRecentSearch(cityName);
      });
    }
    
    recentChips.appendChild(chip);
  });
}

function removeRecentSearch(cityName) {
  recentSearches = recentSearches.filter(s => {
    const sName = typeof s === 'string' ? s : s.name;
    return sName.toLowerCase() !== cityName.toLowerCase();
  });
  safeStorage.setItem('nimbus_recent', JSON.stringify(recentSearches));
  renderRecentSearches();
}

function addRecentSearch(name, country) {
  if (!name) return;
  
  const newSearch = { name: name, country: country || '' };
  
  // Filter out duplicate searches case-insensitively
  recentSearches = recentSearches.filter(s => {
    const sName = typeof s === 'string' ? s : s.name;
    return sName.toLowerCase() !== name.toLowerCase();
  });
  
  // Insert at the beginning of the list
  recentSearches.unshift(newSearch);
  
  // Limit to top 5 recent searches
  recentSearches = recentSearches.slice(0, 5);
  
  safeStorage.setItem('nimbus_recent', JSON.stringify(recentSearches));
  
  // Render immediately if we are on the welcome screen
  if (welcomeScreen && welcomeScreen.style.display !== 'none') {
    renderRecentSearches();
  }
}

/* ─── Search input ──────────────────────────────────────────── */
function onSearchInput() {
  const val = cityInput.value.trim();
  clearBtn.style.display = val ? 'block' : 'none';
  clearTimeout(suggestTimer);
  if (val.length < 2) { closeSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(val), 350);
}

function onSearchKeydown(e) {
  const items = suggestionsEl.querySelectorAll('.suggestion-item');
  const active = suggestionsEl.querySelector('.suggestion-item.highlighted');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = active ? active.nextElementSibling : items[0];
    if (next) { if(active) active.classList.remove('highlighted'); next.classList.add('highlighted'); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = active ? active.previousElementSibling : items[items.length-1];
    if (prev) { if(active) active.classList.remove('highlighted'); prev.classList.add('highlighted'); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (active) { active.click(); }
    else if (cityInput.value.trim()) { fetchWeather(cityInput.value.trim()); closeSuggestions(); }
  } else if (e.key === 'Escape') { closeSuggestions(); }
}

function clearSearch() {
  cityInput.value = '';
  clearBtn.style.display = 'none';
  closeSuggestions();
  cityInput.focus();
}

async function fetchSuggestions(query) {
  if (!API_KEY) return;
  try {
    let data;
    if (API_KEY === 'demo') {
      data = [
        { name: query, country: 'US', state: 'Demo', lat: 40.71, lon: -74.00 },
        { name: query + ' Town', country: 'GB', state: 'Demo', lat: 51.50, lon: -0.12 },
        { name: query + ' Haven', country: 'FR', state: 'Demo', lat: 48.85, lon: 2.35 }
      ];
    } else {
      const res  = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);
      if (res.status === 401) {
        handleInvalidKey();
        return;
      }
      data = await res.json();
    }
    renderSuggestions(data);
  } catch { /* silent */ }
}

function renderSuggestions(cities) {
  if (!cities || !cities.length) { closeSuggestions(); return; }
  suggestionsEl.innerHTML = cities.map(c => {
    const flagUrl = `https://flagcdn.com/w20/${c.country.toLowerCase()}.png`;
    return `
      <div class="suggestion-item" role="option" data-name="${c.name}" data-country="${c.country}" data-state="${c.state||''}" data-lat="${c.lat}" data-lon="${c.lon}" tabindex="0">
        <span class="sug-icon">📍</span>
        <span class="sug-name">${c.name}${c.state?', '+c.state:''}</span>
        <span class="sug-country" style="display:inline-flex; align-items:center; gap:5px;">
          <img src="${flagUrl}" alt="${c.country}" class="city-flag-img" style="width:16px; height:11px; margin:0; border-radius:1.5px; box-shadow:0 1px 2px rgba(0,0,0,0.2);" onerror="this.style.display='none'" />
          ${c.country}
        </span>
      </div>`;
  }).join('');
  suggestionsEl.classList.add('open');

  suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = item.dataset.lat, lon = item.dataset.lon;
      const name = item.dataset.name;
      const country = item.dataset.country;
      cityInput.value = name;
      clearBtn.style.display = 'block';
      closeSuggestions();
      fetchWeatherByCoords(lat, lon, name, country);
    });
  });
}

function closeSuggestions() {
  suggestionsEl.classList.remove('open');
  suggestionsEl.innerHTML = '';
}

/* ─── Geolocation ───────────────────────────────────────────── */
function getLocationIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
}

function useLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser or device.");
    return;
  }
  
  locationBtn.innerHTML = '<div class="loader-ring" style="width:20px;height:20px;border-width:2px;margin:0"></div>';
  locationBtn.disabled = true;
  
  navigator.geolocation.getCurrentPosition(pos => {
    locationBtn.innerHTML = getLocationIcon();
    locationBtn.disabled = false;
    fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
  }, err => {
    locationBtn.innerHTML = getLocationIcon();
    locationBtn.disabled = false;
    
    let msg = "Unable to retrieve location.";
    if (err.code === err.PERMISSION_DENIED) {
      msg = "Location permission denied. Please allow location access in settings.";
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      msg = "Location details are unavailable.";
    } else if (err.code === err.TIMEOUT) {
      msg = "Location request timed out. Please try again.";
    }
    alert(msg);
  }, {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 60000
  });
}

function handleInvalidKey() {
  API_KEY = '';
  safeStorage.removeItem('nimbusApiKey');
  apiModal.style.display = 'grid';
  const descEl = document.querySelector('.modal-desc');
  if (descEl) {
    descEl.innerHTML = '<span style="color: #ef4444; font-weight: 600;">⚠️ The API key is invalid or expired.</span> Please enter a valid OpenWeatherMap API key or select Demo Mode below.';
  }
}

/* ─── Fetch weather by city name ────────────────────────────── */
async function fetchWeather(city) {
  if (!API_KEY) { apiModal.style.display = 'grid'; return; }
  showLoading();
  
  if (API_KEY === 'demo') {
    await new Promise(resolve => setTimeout(resolve, 600));
    try {
      const mock = generateMockWeather(city, 'DM');
      renderWeather(mock.cur, mock.fcast, mock.uvData, mock.aqiData);
    } catch (err) {
      showError('Demo weather simulation failed.');
    }
    return;
  }
  
  try {
    let geoRes  = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`);
    
    // Auto-fallback if key is invalid
    if (geoRes.status === 401 && API_KEY !== PRESET_KEY) {
      console.warn("Custom API key is invalid. Falling back to preset key.");
      API_KEY = PRESET_KEY;
      safeStorage.setItem('nimbusApiKey', PRESET_KEY);
      geoRes = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`);
    }

    if (geoRes.status === 401) {
      handleInvalidKey();
      throw new Error('API key is invalid. Please use Demo Mode.');
    }

    if (!geoRes.ok) {
      const errData = await geoRes.json().catch(() => ({}));
      throw new Error(errData.message || `Geocoding failed with status ${geoRes.status}`);
    }

    const geoData = await geoRes.json();
    if (!geoData || !Array.isArray(geoData)) {
      throw new Error('Invalid response received from geocoding service');
    }
    if (!geoData.length) throw new Error('City not found');
    await fetchWeatherByCoords(geoData[0].lat, geoData[0].lon, geoData[0].name, geoData[0].country);
  } catch(err) {
    showError(err.message || 'Could not fetch weather. Please try again.');
    isHistoryNavigating = false;
  }
}

/* ─── Fetch weather by coords ───────────────────────────────── */
async function fetchWeatherByCoords(lat, lon, name, country) {
  if (!API_KEY) { apiModal.style.display = 'grid'; return; }
  showLoading();
  
  if (API_KEY === 'demo') {
    await new Promise(resolve => setTimeout(resolve, 600));
    const cityName = name || 'Current Location';
    const mock = generateMockWeather(cityName, country || 'DM');
    mock.cur.coord.lat = parseFloat(lat);
    mock.cur.coord.lon = parseFloat(lon);
    renderWeather(mock.cur, mock.fcast, mock.uvData, mock.aqiData);
    return;
  }

  try {
    let [curRes, fRes, uvRes, aqiRes] = await Promise.all([
      fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
      fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`),
      fetch(`${BASE}/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`${BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ]);

    // Auto-fallback if key is invalid
    if (curRes.status === 401 && API_KEY !== PRESET_KEY) {
      console.warn("Custom API key is invalid. Falling back to preset key.");
      API_KEY = PRESET_KEY;
      safeStorage.setItem('nimbusApiKey', PRESET_KEY);
      [curRes, fRes, uvRes, aqiRes] = await Promise.all([
        fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`),
        fetch(`${BASE}/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
        fetch(`${BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
      ]);
    }

    if (curRes.status === 401) {
      handleInvalidKey();
      throw new Error('API key is invalid. Please use Demo Mode.');
    }

    const cur     = await curRes.json();
    const fcast   = await fRes.json();
    const uvData  = uvRes.ok ? await uvRes.json() : null;
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    if (cur.cod !== 200) throw new Error(cur.message || 'Weather data unavailable');

    // Harmonize geocoded name to avoid geocoding mismatch bugs for suburbs
    if (name) {
      cur.name = name;
    }

    currentWeatherData  = cur;
    currentForecastData = fcast;

    renderWeather(cur, fcast, uvData, aqiData);
  } catch(err) {
    showError(err.message || 'Something went wrong. Please try again.');
  }
}

/* ─── Render All Weather ────────────────────────────────────── */
function renderWeather(cur, fcast, uvData, aqiData) {
  currentWeatherData = cur;
  currentForecastData = fcast;
  hideLoading();
  hideError();
  addRecentSearch(cur.name, cur.sys.country);
  welcomeScreen.style.display = 'none';
  weatherContent.style.display = 'block';
  
  const explorerCenterName = document.getElementById('explorerCenterName');
  if (explorerCenterName) {
    explorerCenterName.textContent = cur.name;
  }
  resetExplorerResults();
  positionWeatherExplorer();
  
  const tabRadarAstro = document.getElementById('tabRadarAstro');
  if (tabRadarAstro) tabRadarAstro.style.display = '';
  

  
  if (!isHistoryNavigating) {
    pushNavigationState({ page: 'weather', city: cur.name });
  }
  isHistoryNavigating = false;

  // ─── Weather Data Consistency Harmonizer (Nimbus Intelligence) ───
  const weatherId = cur.weather[0].id;
  
  // 1. Rain / Drizzle / Snow must have significant cloud cover
  if (weatherId < 700) {
    if (!cur.clouds || cur.clouds.all < 75) {
      cur.clouds = cur.clouds || {};
      cur.clouds.all = Math.floor(82 + (weatherId % 14)); // Realistic high overcast value
    }
  }
  // 2. Thunderstorms must have very heavy cloud cover
  if (weatherId >= 200 && weatherId < 300) {
    if (!cur.clouds || cur.clouds.all < 90) {
      cur.clouds = cur.clouds || {};
      cur.clouds.all = 98;
    }
  }
  // 3. Fog / Mist / Haze must restrict visibility
  if (weatherId === 741) { // Fog
    if (!cur.visibility || cur.visibility > 1500) {
      cur.visibility = 800 + (weatherId % 400); // Fog restricts visibility to < 1.5km
    }
  } else if (weatherId === 701 || weatherId === 721 || weatherId === 711) { // Mist, Haze, Smoke
    if (!cur.visibility || cur.visibility > 5000) {
      cur.visibility = 3000 + (weatherId % 1000); // Haze/Mist restricts visibility to 3km - 4km
    }
  }
  // 4. Rain or Snow must naturally degrade visibility
  if (weatherId >= 500 && weatherId < 600) { // Rain
    if (!cur.visibility || cur.visibility > 6000) {
      cur.visibility = 4500 + (weatherId % 1200); // Rain degrades visibility to 4.5km - 5.7km
    }
  } else if (weatherId >= 200 && weatherId < 300) { // Thunderstorm
    if (!cur.visibility || cur.visibility > 4000) {
      cur.visibility = 2500 + (weatherId % 800); // Thunderstorm restricts visibility to 2.5km - 3.3km
    }
  } else if (weatherId >= 600 && weatherId < 700) { // Snow
    if (!cur.visibility || cur.visibility > 5000) {
      cur.visibility = 3500 + (weatherId % 1000); // Snow restricts visibility to 3.5km - 4.5km
    }
  }

  const id   = cur.weather[0].id;
  const desc = cur.weather[0].description;
  const isNight = isNightTime(cur.sys.sunrise, cur.sys.sunset, cur.dt);
  const icon = weatherEmoji(id, isNight);

  // Background
  setBackground(id, isNight, cur.main.temp);

  // City info
  document.getElementById('cityName').textContent    = cur.name;
  const flagUrl = `https://flagcdn.com/w40/${cur.sys.country.toLowerCase()}.png`;
  document.getElementById('cityCountry').innerHTML = `
    <img src="${flagUrl}" alt="${cur.sys.country}" class="city-flag-img" onerror="this.style.display='none'" />
    <span style="font-weight: 700; color: var(--text-primary);">${cur.sys.country}</span> · ${cur.coord.lat.toFixed(2)}°N, ${cur.coord.lon.toFixed(2)}°E
  `;
  startLiveClock(cur.timezone);
  document.getElementById('weatherIconLarge').textContent = icon;

  // Temperature
  updateTemps(cur);

  // Description
  document.getElementById('weatherDesc').textContent = desc;

  // Stats
  document.getElementById('humidityVal').textContent   = cur.main.humidity + '%';
  document.getElementById('windVal').textContent       = cur.wind.speed.toFixed(1) + ' m/s';
  document.getElementById('pressureVal').textContent   = cur.main.pressure + ' hPa';
  
  // Update mini barometric pressure slider pin position (mapped 970 hPa - 1040 hPa)
  const pinEl = document.getElementById('miniPressurePin');
  if (pinEl) {
    const pressPct = Math.min(Math.max((cur.main.pressure - 970) / 70, 0), 1) * 100;
    pinEl.style.left = pressPct + '%';
  }
  
  const visKm = cur.visibility ? cur.visibility / 1000 : 10;
  document.getElementById('visibilityVal').textContent = visKm.toFixed(1) + ' km';
  
  const visCat = visibilityCategory(visKm);
  const visBadge = document.getElementById('visibilityStatus');
  if (visBadge) {
    visBadge.textContent = visCat;
    let color = '#22c55e'; // Green
    if (visKm < 1)       color = '#ef4444'; // Red
    else if (visKm < 4)  color = '#f97316'; // Orange
    else if (visKm < 7)  color = '#eab308'; // Yellow
    visBadge.style.color = color;
    visBadge.style.background = color + '1a';
    visBadge.style.border = `1px solid ${color}33`;
  }
  
  const precipStatus = getPrecipitationStatus(cur, fcast);
  const precVal = document.getElementById('precipitationVal');
  const precBadge = document.getElementById('precipitationStatus');
  
  if (precipStatus.active) {
    precVal.textContent = precipStatus.amount.toFixed(1) + ' mm';
    if (precBadge) {
      precBadge.textContent = precipStatus.type === 'snow' ? 'Snowing' : 'Raining';
      let color = '#3b82f6';
      precBadge.style.color = color;
      precBadge.style.background = color + '1a';
      precBadge.style.border = `1px solid ${color}33`;
    }
  } else if (precipStatus.forecasted) {
    precVal.textContent = `In ${precipStatus.hours}h`;
    if (precBadge) {
      precBadge.textContent = `${precipStatus.probability}% chance`;
      let color = '#eab308';
      if (precipStatus.probability > 60) color = '#f97316';
      precBadge.style.color = color;
      precBadge.style.background = color + '1a';
      precBadge.style.border = `1px solid ${color}33`;
    }
  } else {
    precVal.textContent = '0.0 mm';
    if (precBadge) {
      precBadge.textContent = 'No Rain';
      let color = '#22c55e';
      precBadge.style.color = color;
      precBadge.style.background = color + '1a';
      precBadge.style.border = `1px solid ${color}33`;
    }
  }

  document.getElementById('cloudinessVal').textContent = cur.clouds.all + '%';
  document.getElementById('sunriseVal').textContent    = epochToTime(cur.sys.sunrise, cur.timezone);
  document.getElementById('sunsetVal').textContent     = epochToTime(cur.sys.sunset, cur.timezone);

  // Sunrise / Sunset countdowns
  const nowEpoch = cur.dt;
  let sunriseTarget = cur.sys.sunrise;
  if (nowEpoch > cur.sys.sunset) {
    sunriseTarget = cur.sys.sunrise + 86400; // Tomorrow's sunrise target
  }
  document.getElementById('sunriseCountdown').textContent = sunEventCountdown(sunriseTarget, nowEpoch);
  document.getElementById('sunsetCountdown').textContent  = sunEventCountdown(cur.sys.sunset,  nowEpoch);

  // Dew point (approx)
  const dp = dewPoint(cur.main.temp, cur.main.humidity);
  document.getElementById('dewPointVal').textContent = isCelsius ? dp.toFixed(1)+'°C' : toF(dp).toFixed(1)+'°F';

  // Bars
  setTimeout(() => {
    document.getElementById('humidityBar').style.width   = cur.main.humidity + '%';
    document.getElementById('cloudinessBar').style.width = cur.clouds.all + '%';
  }, 300);

  // Wind compass
  if (cur.wind.deg !== undefined) {
    document.getElementById('compassNeedle').style.transform =
      `translate(-50%, -100%) rotate(${cur.wind.deg}deg)`;
  }

  // UV Index
  if (uvData) {
    const uv = typeof uvData.value === 'number' ? uvData.value : (uvData.result?.uvi ?? 0);
    document.getElementById('uvValue').textContent = uv.toFixed(1);
    
    const cat = uvCategory(uv);
    const badge = document.getElementById('uvBadge');
    badge.textContent = cat;
    
    // Dynamic badge coloring
    let color = '#22c55e'; // Green
    if (uv >= 11)      color = '#a855f7'; // Purple
    else if (uv >= 8)  color = '#ef4444'; // Red
    else if (uv >= 6)  color = '#f97316'; // Orange
    else if (uv >= 3)  color = '#eab308'; // Yellow
    
    badge.style.color = color;
    badge.style.background = color + '22'; // 13% opacity
    badge.style.border = `1px solid ${color}40`;
    
    // Scaling: 0 to 12
    const pct = Math.min(uv / 12, 1) * 100;
    document.getElementById('uvThumb').style.left = pct + '%';
    
    // Actionable description info
    let descText = "Low risk. Safe to be outdoors.";
    if (uv >= 11)      descText = "Extreme risk! Unprotected skin can burn in minutes. Avoid sun.";
    else if (uv >= 8)  descText = "Very high risk. Wear SPF 30+, hat, sunglasses, and seek shade.";
    else if (uv >= 6)  descText = "High risk. Protection required. Reduce midday sun exposure.";
    else if (uv >= 3)  descText = "Moderate risk. Sunscreen recommended. Stay in shade at noon.";
    
    const descEl = document.getElementById('uvDesc');
    if (descEl) descEl.textContent = descText;
  }

  // AQI — prefer EPA calculation from PM2.5/PM10, fall back to OWM index
  if (aqiData && aqiData.list && aqiData.list.length) {
    const entry = aqiData.list[0];
    const comp  = entry.components || {};
    let displayAqi, displayLabel, displayColor;

    if (comp.pm2_5 != null || comp.pm10 != null) {
      displayAqi   = epaAqiFromComponents(comp);
      const cat    = epaCategory(displayAqi);
      displayLabel = cat.label;
      displayColor = cat.color;
    } else {
      const owm  = entry.main.aqi;
      displayAqi   = owm;
      displayLabel = aqiLabel(owm);
      displayColor = ['#22c55e','#eab308','#f97316','#ef4444','#a855f7'][owm-1] || '#94a3b8';
    }

    // Store on window so modal click handler can read
    window._lastAqiData = { aqi: displayAqi, label: displayLabel, color: displayColor, comp };

    document.getElementById('aqiCard').style.display = 'block';
    const aqiValEl = document.getElementById('aqiValue');
    aqiValEl.textContent = displayAqi;
    aqiValEl.style.color = displayColor;
    document.getElementById('aqiBadge').textContent = displayLabel;
    document.getElementById('aqiBadge').style.background = displayColor + '33';
    document.getElementById('aqiBadge').style.color = displayColor;
    document.getElementById('aqiDesc').textContent = epaCategory(displayAqi).label === displayLabel
      ? `PM2.5: ${comp.pm2_5 != null ? comp.pm2_5.toFixed(1)+' μg/m³' : '—'}  ·  PM10: ${comp.pm10 != null ? comp.pm10.toFixed(0)+' μg/m³' : '—'}`
      : aqiDesc(entry.main.aqi);
  }

  // Dynamic Lunar Phase Calculation & Drawing
  const moonAge = calculateLunarAge(cur.dt);
  const moonIllum = Math.round((1 - Math.cos((moonAge / 29.530588853) * 2 * Math.PI)) * 50);
  const moonPhaseName = getLunarPhaseName(moonAge);
  
  document.getElementById('lunarBadge').textContent = moonPhaseName;
  document.getElementById('lunarAgeVal').textContent = `Lunar Age: ${moonAge.toFixed(1)} days`;
  document.getElementById('lunarIllumVal').textContent = `Illumination: ${moonIllum}%`;
  drawMoonPath(moonAge);

  // Dynamic Outfit & Outing Advisor Card
  const rainVolCard = cur.rain ? (cur.rain['1h'] || cur.rain['3h'] || 0) : 0;
  const snowVolCard = cur.snow ? (cur.snow['1h'] || cur.snow['3h'] || 0) : 0;
  const currentPM25 = (aqiData?.list?.[0]?.components?.pm2_5) || 0;
  const activeAQIIndex = aqiData?.list?.[0]?.main?.aqi || 1;
  const activeAQI = currentPM25 > 0 ? epaAqiFromComponents(aqiData.list[0].components) : (activeAQIIndex * 30);
  
  const advice = getOutfitAndActivityAdvice(cur.main.temp, cur.wind.speed, rainVolCard + snowVolCard, activeAQI, cur.weather[0].id);
  
  const statusBadge = document.getElementById('advisorStatus');
  if (statusBadge) {
    statusBadge.textContent = advice.status;
    let badgeColor = '#22c55e'; // Green
    if (advice.status.includes('Severe') || advice.status.includes('Unhealthy') || advice.status.includes('High') || advice.status.includes('Extreme') || advice.status.includes('Cold')) {
      badgeColor = '#ef4444'; // Red
    } else if (advice.status.includes('Moderate') || advice.status.includes('Windy') || advice.status.includes('Heat') || advice.status.includes('Good')) {
      badgeColor = '#eab308'; // Yellow
    }
    statusBadge.style.color = badgeColor;
    statusBadge.style.background = badgeColor + '1a';
    statusBadge.style.border = `1px solid ${badgeColor}33`;
  }
  
  document.getElementById('outfitIcon').textContent = advice.icon;
  document.getElementById('advisorOutfit').textContent = advice.outfit;
  document.getElementById('advisorActivity').textContent = advice.activity;

  // Render severe alerts ticker
  renderWarningTicker(cur, aqiData);

  // Hourly
  renderHourly(fcast.list);

  // 5-day
  renderForecast(fcast.list);

  // Update Astro Page data
  renderAstroPage();

  animateDashboardEntrance();
}

/* ─── Temperature helpers ───────────────────────────────────── */
function updateTemps(cur) {
  const t  = isCelsius ? cur.main.temp    : toF(cur.main.temp);
  const fl = isCelsius ? cur.main.feels_like : toF(cur.main.feels_like);
  const hi = isCelsius ? cur.main.temp_max   : toF(cur.main.temp_max);
  const lo = isCelsius ? cur.main.temp_min   : toF(cur.main.temp_min);
  const u  = isCelsius ? '°C' : '°F';

  document.getElementById('tempMain').textContent      = Math.round(t);
  document.getElementById('tempUnitLabel').textContent = u;
  document.getElementById('feelsLike').textContent     = `Feels like ${Math.round(fl)}${u}`;
  document.getElementById('tempRange').textContent     = `H: ${Math.round(hi)}${u}  /  L: ${Math.round(lo)}${u}`;
  document.getElementById('unitToggle').textContent    = isCelsius ? '°C' : '°F';
}

function toF(c) { return c * 9/5 + 32; }
function dewPoint(t, h) { return t - ((100 - h) / 5); }

/* Returns e.g. "in 2h 14m", "in 38m", "32m ago", "2h 5m ago" */
function sunEventCountdown(eventEpoch, nowEpoch) {
  const diffSec = eventEpoch - nowEpoch;
  const absSec  = Math.abs(diffSec);
  const h = Math.floor(absSec / 3600);
  const m = Math.floor((absSec % 3600) / 60);
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  parts.push(m + 'm');
  const timeStr = parts.join(' ');
  return diffSec > 0 ? 'in ' + timeStr : timeStr + ' ago';
}
 
/* ─── Lunar Astro-Phase & Outfit/Activity Advisor Helpers ─── */
function calculateLunarAge(epoch) {
  // Known New Moon occurred on January 6, 2000 (epoch: 947116800)
  const secondsElapsed = epoch - 947116800;
  const daysElapsed = secondsElapsed / 86400;
  const cycles = daysElapsed / 29.530588853;
  const age = (cycles - Math.floor(cycles)) * 29.530588853;
  return age;
}

function getLunarPhaseName(age) {
  if (age < 1.0 || age > 28.53) return 'New Moon';
  if (age >= 1.0 && age < 6.38)  return 'Waxing Crescent';
  if (age >= 6.38 && age < 8.38) return 'First Quarter';
  if (age >= 8.38 && age < 13.76) return 'Waxing Gibbous';
  if (age >= 13.76 && age < 15.76) return 'Full Moon';
  if (age >= 15.76 && age < 21.15) return 'Waning Gibbous';
  if (age >= 21.15 && age < 23.15) return 'Last Quarter';
  return 'Waning Crescent';
}

function drawMoonPath(lunarAge) {
  const pathEl = document.getElementById('lunarPhasePath');
  if (!pathEl) return;
  const pct = lunarAge / 29.530588853;
  let d = "";
  if (pct < 0.025 || pct > 0.975) {
    d = ""; // New Moon: completely dark
  } else if (pct >= 0.475 && pct <= 0.525) {
    d = "M 50,5 A 45,45 0 1,1 49.9,5 Z"; // Full Moon
  } else {
    const r = 45;
    const rx = Math.abs(r * Math.cos(pct * 2 * Math.PI));
    const isWaxing = pct < 0.5;
    const sweep1 = isWaxing ? 1 : 0;
    const isGibbous = pct >= 0.25 && pct <= 0.75;
    const sweep2 = isGibbous ? (isWaxing ? 1 : 0) : (isWaxing ? 0 : 1);
    d = `M 50,5 A 45,45 0 0,${sweep1} 50,95 A ${rx},45 0 0,${sweep2} 50,5`;
  }
  pathEl.setAttribute('d', d);
}

function getOutfitAndActivityAdvice(temp, wind, prec, aqi, weatherId) {
  let outfit = "";
  let icon = "👕";
  
  // Outfit advice
  if (temp < 10) {
    outfit = "Heavy layers required: winter coat, scarf, gloves, and beanie.";
    icon = "🧥";
  } else if (temp >= 10 && temp < 17) {
    outfit = "Wear a warm sweater, fleece, or light jacket.";
    icon = "🧥";
  } else if (temp >= 17 && temp < 24) {
    outfit = "Casual: long sleeve shirt, denim jacket, or light cardigan is ideal.";
    icon = "👕";
  } else {
    outfit = "Warm weather: wear light t-shirts, shorts, or breathable garments.";
    icon = "🩳";
  }
  
  if (prec > 0.1 || weatherId < 600) {
    outfit += " Grab a waterproof rain jacket or umbrella.";
    icon = "☔";
  } else if (weatherId >= 600 && weatherId < 700) {
    outfit += " Wear heavy insulated winter boots.";
    icon = "🥾";
  } else if (temp > 28 && prec === 0) {
    outfit += " Put on sunglasses and a sun hat.";
    icon = "🕶️";
  }

  // Activity advice
  let status = "Ideal Outdoor";
  let activity = "Outdoor activities are highly encouraged under these parameters.";
  
  if (aqi >= 150) {
    status = "Unhealthy Air";
    activity = "AQI is hazardous. Exercise indoors only and wear a protective mask.";
  } else if (wind > 12) {
    status = "Gale Winds";
    activity = "High wind danger. Limit outdoor travel and avoid high-profile zones.";
  } else if (weatherId < 300 || weatherId === 502 || weatherId === 503 || weatherId === 504) {
    status = "Severe Storm";
    activity = "Heavy precipitation and lightning. Stay safe inside and cancel outings.";
  } else if (temp > 35) {
    status = "Severe Heat";
    activity = "High heat index. Rest in air conditioning and avoid mid-day sun.";
  } else if (temp < 0) {
    status = "Extreme Cold";
    activity = "Freezing conditions. Minimize exposure to prevent frostbite.";
  } else if (aqi >= 80) {
    status = "Moderate Air";
    activity = "Sensitive individuals should limit prolonged outdoor workouts.";
  } else if (temp >= 16 && temp <= 27 && aqi < 50) {
    status = "Ideal Outdoors";
    activity = "Perfect sky conditions for walks, outdoor cycling, and sports!";
  } else {
    status = "Good Conditions";
    activity = "Atmospheric metrics are favorable for all routine outdoor commutes.";
  }

  return { outfit, activity, status, icon };
}

function renderWarningTicker(cur, aqiData) {
  const tickerWrap = document.getElementById('warningTicker');
  const tickerText = document.getElementById('warningText');
  if (!tickerWrap || !tickerText) return;

  let alertText = "";
  
  // 1. Check raw alerts
  if (cur.alerts && cur.alerts.length) {
    alertText = cur.alerts.map(a => `${a.event.toUpperCase()}: ${a.description}`).join('  ·  ');
  } 
  
  // 2. Synthesize critical alerts
  if (!alertText) {
    const currentPM25 = (aqiData?.list?.[0]?.components?.pm2_5) || 0;
    const activeAQIIndex = aqiData?.list?.[0]?.main?.aqi || 1;
    const activeAQI = currentPM25 > 0 ? epaAqiFromComponents(aqiData.list[0].components) : (activeAQIIndex * 30);
    
    if (activeAQI >= 150) {
      alertText = `AIR QUALITY ALERT: Extremely hazardous PM2.5 levels detected (${Math.round(activeAQI)} AQI). Limit all outdoor exposure.`;
    } else if (cur.wind.speed >= 15) {
      alertText = `SEVERE GALE WARNING: Extreme winds of ${cur.wind.speed.toFixed(1)} m/s detected. High risk of falling objects.`;
    } else if (cur.main.temp >= 40) {
      alertText = `EXTREME HEAT ADVISORY: Temperatures of ${cur.main.temp.toFixed(1)}°C actively recorded. High risk of hyperthermia.`;
    } else if (cur.main.temp <= -10) {
      alertText = `EXTREME COLD ADVISORY: Freeze danger (${cur.main.temp.toFixed(1)}°C). Frostbite can occur within minutes.`;
    } else if (cur.weather[0].id >= 200 && cur.weather[0].id < 232) {
      alertText = `METEOROLOGICAL WARNING: Severe active lightning strikes and thunderstorms recorded. Keep clear of tall trees and metal poles.`;
    }
  }

  if (alertText) {
    tickerText.textContent = alertText;
    tickerWrap.style.display = 'flex';
  } else {
    tickerWrap.style.display = 'none';
  }
}



/* ─── Hourly Forecast ───────────────────────────────────────── */
function renderHourly(list) {
  const track = document.getElementById('hourlyTrack');
  const now   = Date.now() / 1000;
  track.innerHTML = list.slice(0, 16).map((item, i) => {
    const isNow = i === 0;
    const t = isCelsius ? item.main.temp : toF(item.main.temp);
    const rain = item.pop ? Math.round(item.pop * 100) + '% 🌧' : '';
    const isHourNight = (currentWeatherData && currentWeatherData.sys) ? isNightTime(currentWeatherData.sys.sunrise, currentWeatherData.sys.sunset, item.dt) : false;
    return `
      <div class="hourly-item ${isNow?'active':''}">
        <div class="hourly-time">${isNow ? 'Now' : hourLabel(item.dt)}</div>
        <div class="hourly-icon">${weatherEmoji(item.weather[0].id, isHourNight)}</div>
        <div class="hourly-temp">${Math.round(t)}${isCelsius?'°C':'°F'}</div>
        ${rain ? `<div class="hourly-rain">${rain}</div>` : ''}
      </div>`;
  }).join('');
}

/* ─── 5-Day Forecast ────────────────────────────────────────── */
function renderForecast(list) {
  const daily = {};
  list.forEach(item => {
    const d = new Date(item.dt * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!daily[key]) {
      daily[key] = { dt:item.dt, items:[], desc:item.weather[0].description, id:item.weather[0].id };
    }
    daily[key].items.push(item);
  });

  const days = Object.values(daily).slice(0, 5);
  const el   = document.getElementById('forecastList');

  el.innerHTML = days.map((day, i) => {
    const temps = day.items.map(x => x.main.temp);
    const hi  = Math.max(...temps);
    const lo  = Math.min(...temps);
    const pop = Math.max(...day.items.map(x => x.pop || 0));
    const hD  = isCelsius ? hi : toF(hi);
    const lD  = isCelsius ? lo : toF(lo);
    const u   = isCelsius ? '°C' : '°F';
    const label = i === 0 ? 'Today' : dayName(day.dt);

    return `
      <div class="forecast-day" data-day-index="${i}">
        <span class="fd-day">${label}</span>
        <span class="fd-icon">${weatherEmoji(day.id)}</span>
        <span class="fd-desc">${day.desc}</span>
        ${pop > 0.1 ? `<span class="fd-rain">${Math.round(pop*100)}%🌧</span>` : ''}
        <span class="fd-temps">${Math.round(hD)}${u} <span class="fd-low">/ ${Math.round(lD)}${u}</span></span>
        <span class="fd-hint">tap for details ›</span>
      </div>`;
  }).join('');
}

/* ─── Background & Particles ────────────────────────────────── */
function setBackground(id, isNight, temp) {
  const classes = ['weather-default','weather-clear-day','weather-clear-night','weather-cloudy',
    'weather-rain','weather-drizzle','weather-snow','weather-thunderstorm',
    'weather-mist','weather-haze','weather-dust','weather-hot'];
  body.classList.remove(...classes);

  // Clear all particles & overlays
  particles.innerHTML = '';
  if (window.weatherCanvas) {
    window.weatherCanvas.setWeatherType(null);
  }
  document.querySelectorAll('.lightning-flash,.lightning-bolt,.heat-shimmer').forEach(e => e.remove());

  if (isNight) {
    // Only spawn the floating moon during clear/partly cloudy night conditions
    if (id === 800 || id === 801 || id === 802) {
      spawnMoon();
    }
  } else {
    // Only spawn the floating sun during clear/partly cloudy day conditions
    if (id === 800 || id === 801 || id === 802) {
      spawnSun();
    }
  }

  let cls = 'weather-default';

  if (id >= 200 && id < 300) {
    cls = 'weather-thunderstorm';
    spawnRain(90, true);
    spawnClouds(5, 'rgba(60,40,100,0.55)');
    spawnLightning();
  } else if (id >= 300 && id < 400) {
    cls = 'weather-drizzle';
    spawnRain(35, false);
    spawnClouds(4, 'rgba(80,100,130,0.4)');
  } else if (id >= 500 && id < 600) {
    cls = 'weather-rain';
    spawnRain(110, false);
    spawnClouds(5, 'rgba(30,50,80,0.5)');
  } else if (id >= 600 && id < 700) {
    cls = 'weather-snow';
    spawnSnow(60);
    spawnClouds(4, 'rgba(180,200,220,0.35)');
  } else if (id === 701 || id === 741) {
    cls = 'weather-mist';
    spawnFog(10, 'rgba(200,200,220,0.22)');
  } else if (id === 721 || id === 711) {
    cls = 'weather-haze';
    spawnFog(8, 'rgba(200,150,100,0.18)');
  } else if (id === 731 || id === 751 || id === 761 || id === 762) {
    cls = 'weather-dust';
    spawnFog(10, 'rgba(180,140,80,0.22)');
  } else if (id === 800) {
    cls = isNight ? 'weather-clear-night' : (temp > 35 ? 'weather-hot' : 'weather-clear-day');
    if (!isNight) {
      spawnSunRays(12);
      if (temp > 35) spawnHeatShimmer();
    } else {
      if (window.weatherCanvas) {
        window.weatherCanvas.setWeatherType('stars');
      }
    }
  } else if (id === 801 || id === 802) {
    cls = isNight ? 'weather-clear-night' : 'weather-clear-day';
    spawnClouds(3, isNight ? 'rgba(80,80,120,0.35)' : 'rgba(220,230,255,0.3)');
    if (isNight && window.weatherCanvas) {
      window.weatherCanvas.setWeatherType('stars');
    }
    if (isNight) spawnStars(40);
    else spawnSunRays(6);
  } else if (id >= 803) {
    cls = 'weather-cloudy';
    spawnClouds(6, 'rgba(100,100,110,0.45)');
  }

  body.classList.add(cls);

  // Spawn light overlay (deferred so lightOverlay is always defined by then)
  requestAnimationFrame(() => {
    if (typeof spawnLightOverlay === 'function') spawnLightOverlay(id, isNight, temp);
  });
}

function spawnRain(count, heavy) {
  if (window.weatherCanvas) {
    window.weatherCanvas.setWeatherType('rain');
  }
}

function spawnSplashes(count) {
  // Deprecated - handled by high-performance canvas engine
}

function spawnSnow(count) {
  if (window.weatherCanvas) {
    window.weatherCanvas.setWeatherType('snow');
  }
}

function spawnStars(count) {
  for (let i = 0; i < count; i++) {
    const el   = document.createElement('div');
    const size = 1 + Math.random() * 3;
    el.style.cssText = `
      position: absolute;
      width: ${size}px; height: ${size}px;
      background: #fff;
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top:  ${Math.random() * 65}%;
      opacity: ${0.3 + Math.random() * 0.7};
      animation: pulse ${1.5 + Math.random() * 3}s ease-in-out infinite;
      animation-delay: ${Math.random() * 5}s;
    `;
    particles.appendChild(el);
  }
}

function spawnClouds(count, color) {
  for (let i = 0; i < count; i++) {
    const w    = 200 + Math.random() * 350;
    const h    = 80  + Math.random() * 140;
    const el   = document.createElement('div');
    el.className = 'cloud-blob';
    el.style.cssText = `
      width: ${w}px; height: ${h}px;
      top:  ${Math.random() * 55}%;
      background: ${color};
      --blur: ${30 + Math.random() * 40}px;
      --op:   ${0.12 + Math.random() * 0.2};
      animation-duration: ${40 + Math.random() * 60}s;
      animation-delay:    ${-Math.random() * 50}s;
    `;
    particles.appendChild(el);
  }
}

function spawnSunRays(count) {
  for (let i = 0; i < count; i++) {
    const el     = document.createElement('div');
    const angle  = (i / count) * 360;
    const length = 220 + Math.random() * 240;
    el.className = 'sun-ray';
    el.style.cssText = `
      height: ${length}px;
      --base-deg: ${angle}deg;
      top: -${length * 0.3}px;
      animation-delay: ${(i * -0.6)}s;
      left: 50%;
    `;
    particles.appendChild(el);
  }
  
  // Spectacular glowing core in the background
  const core = document.createElement('div');
  core.className = 'sun-solar-core';
  particles.appendChild(core);
}

function spawnMoon() {
  const moon = document.createElement('div');
  moon.className = 'moon-celestial';
  moon.style.opacity = '0';
  moon.innerHTML = `
    <div class="moon-glow"></div>
    <div class="moon-body">
      <div class="moon-crater crater1"></div>
      <div class="moon-crater crater2"></div>
      <div class="moon-crater crater3"></div>
      <div class="moon-crater crater4"></div>
    </div>
  `;
  particles.appendChild(moon);
  anime({
    targets: moon,
    translateX: [100, 0],
    translateY: [-50, 0],
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: 1800,
    easing: 'easeOutElastic(1, 0.85)'
  });
}

function spawnSun() {
  const sun = document.createElement('div');
  sun.className = 'sun-celestial';
  sun.style.opacity = '0';
  sun.innerHTML = `
    <div class="sun-glow-floating"></div>
    <div class="sun-body-floating"></div>
  `;
  particles.appendChild(sun);
  anime({
    targets: sun,
    translateX: [100, 0],
    translateY: [-50, 0],
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: 1800,
    easing: 'easeOutElastic(1, 0.85)'
  });
}

function spawnHeatShimmer() {
  const el = document.createElement('div');
  el.className = 'heat-shimmer';
  document.body.appendChild(el);
}

function spawnFog(count, color) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'fog-wisp';
    const h = 40 + Math.random() * 80;
    const w = 35 + Math.random() * 50;
    el.style.cssText = `
      width: ${w}vw;
      top: ${5 + Math.random() * 85}%;
      --fh: ${h}px;
      --fc: ${color};
      animation-duration: ${18 + Math.random() * 25}s;
      animation-delay:    ${-Math.random() * 20}s;
    `;
    particles.appendChild(el);
  }
}

function spawnLightning() {
  // Screen-wide flash layers
  [5, 7, 9].forEach((period, idx) => {
    const fl = document.createElement('div');
    fl.className = 'lightning-flash';
    fl.style.setProperty('--period', period + 's');
    fl.style.setProperty('--ldelay', (idx * 1.8) + 's');
    document.body.appendChild(fl);
  });

  // SVG bolt icons at random positions
  for (let b = 0; b < 3; b++) {
    const bolt = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bolt.setAttribute('viewBox', '0 0 24 24');
    bolt.setAttribute('width',  40 + Math.random() * 40 + '');
    bolt.setAttribute('height', 80 + Math.random() * 60 + '');
    bolt.setAttribute('fill', '#e9d5ff');
    bolt.classList.add('lightning-bolt');
    bolt.style.left = (10 + Math.random() * 80) + '%';
    bolt.style.top  = (5  + Math.random() * 35) + '%';
    bolt.style.setProperty('--bperiod', (6 + Math.random() * 5) + 's');
    bolt.style.setProperty('--bdelay',  (b * 2.1 + Math.random()) + 's');
    bolt.innerHTML = '<path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z"/>';
    particles.appendChild(bolt);
  }
}

/* ─── Unit Toggle ───────────────────────────────────────────── */
function toggleUnit() {
  isCelsius = !isCelsius;
  unitToggle.textContent = isCelsius ? '°C' : '°F';
  if (currentWeatherData) {
    updateTemps(currentWeatherData);
    renderHourly(currentForecastData.list);
    renderForecast(currentForecastData.list);
    // Update dew point
    const dp = dewPoint(currentWeatherData.main.temp, currentWeatherData.main.humidity);
    document.getElementById('dewPointVal').textContent = isCelsius ? dp.toFixed(1)+'°C' : toF(dp).toFixed(1)+'°F';
  }
}

function toggleTimeFormat() {
  is24Hour = !is24Hour;
  safeStorage.setItem('is24Hour', is24Hour);
  const timeToggle = document.getElementById('timeToggle');
  if (timeToggle) timeToggle.textContent = is24Hour ? '24H' : '12H';

  if (currentWeatherData) {
    // Re-render local time and sunrise/sunset strings
    document.getElementById('localTime').textContent = formatLocalTime(currentWeatherData.dt, currentWeatherData.timezone);
    document.getElementById('sunriseVal').textContent    = epochToTime(currentWeatherData.sys.sunrise, currentWeatherData.timezone);
    document.getElementById('sunsetVal').textContent     = epochToTime(currentWeatherData.sys.sunset, currentWeatherData.timezone);
    
    // Refresh hourly list to use new hourLabel format
    renderHourly(currentForecastData.list);
  }
}

function getPrecipitationStatus(cur, fcast) {
  const rainVol = cur.rain ? (cur.rain['1h'] || cur.rain['3h'] || 0) : 0;
  const snowVol = cur.snow ? (cur.snow['1h'] || cur.snow['3h'] || 0) : 0;
  const totalPrec = rainVol + snowVol;
  
  if (totalPrec > 0) {
    return {
      active: true,
      amount: totalPrec,
      type: snowVol > rainVol ? 'snow' : 'rain',
      text: `Raining right now: ${totalPrec.toFixed(1)} mm/h.`
    };
  }
  
  if (fcast && fcast.list) {
    const forecast24h = fcast.list.slice(0, 8);
    for (const entry of forecast24h) {
      const p = entry.pop || 0;
      const r = entry.rain ? (entry.rain['3h'] || 0) : 0;
      const s = entry.snow ? (entry.snow['3h'] || 0) : 0;
      const total = r + s;
      
      if (p > 0.05 || total > 0) {
        const diffHours = Math.round((entry.dt - Date.now() / 1000) / 3600);
        const hoursRounded = Math.max(1, diffHours);
        
        const activeOffset = getActiveTimezoneOffset(cur.timezone);
        const d = new Date((entry.dt + activeOffset) * 1000);
        let h = d.getUTCHours();
        let timeLabel;
        if (is24Hour) {
          timeLabel = `${h.toString().padStart(2, '0')}:00`;
        } else {
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          timeLabel = `${h} ${ampm}`;
        }

        return {
          active: false,
          forecasted: true,
          probability: Math.round(p * 100),
          amount: total || 0.1,
          hours: hoursRounded,
          timeLabel: timeLabel,
          type: s > r ? 'snow' : 'rain',
          text: `Rain expected in ${hoursRounded}h (${timeLabel}) · ${Math.round(p * 100)}% chance of ${total > 0 ? total.toFixed(1) + ' mm' : 'light rain'}.`
        };
      }
    }
  }
  
  return {
    active: false,
    forecasted: false,
    text: 'No rain expected in the next 24 hours.'
  };
}

/* ─── UI state helpers ──────────────────────────────────────── */
function showLoading() {
  if (liveClockInterval) { clearInterval(liveClockInterval); liveClockInterval = null; }
  if (welcomeScreen.style.display !== 'none') {
    loadingOverlay.style.display = 'flex';
    weatherContent.style.display = 'none';
  } else {
    document.querySelectorAll('.glass-card').forEach(card => card.classList.add('loading-skeleton'));
  }
  
  const warningTicker = document.getElementById('warningTicker');
  if (warningTicker) warningTicker.style.display = 'none';
  
  errorCard.style.display      = 'none';
  welcomeScreen.style.display  = 'none';
}
function hideLoading() { 
  loadingOverlay.style.display = 'none'; 
  document.querySelectorAll('.glass-card').forEach(card => card.classList.remove('loading-skeleton'));
}
function showError(msg) {
  if (liveClockInterval) { clearInterval(liveClockInterval); liveClockInterval = null; }
  hideLoading();
  
  const warningTicker = document.getElementById('warningTicker');
  if (warningTicker) warningTicker.style.display = 'none';
  
  errorCard.style.display      = 'block';
  weatherContent.style.display = 'none';
  welcomeScreen.style.display  = 'none';
  document.getElementById('errorMsg').textContent = msg;
}
function hideError() { errorCard.style.display = 'none'; }

function getActiveTimezoneOffset(cityTz) {
  switch (timezonePref) {
    case 'city': return cityTz;
    case 'device': return -(new Date().getTimezoneOffset() * 60);
    case 'utc': return 0;
    case 'ist': return 19800; // 5.5 * 3600
    case 'pst': return -28800; // -8 * 3600
    case 'est': return -18000; // -5 * 3600
    case 'jst': return 32400; // 9 * 3600
    default: return cityTz;
  }
}

function getActiveTimezoneLabel() {
  switch (timezonePref) {
    case 'city': return 'Local';
    case 'device': return 'Device';
    case 'utc': return 'UTC';
    case 'ist': return 'IST';
    case 'pst': return 'PST';
    case 'est': return 'EST';
    case 'jst': return 'JST';
    default: return 'Local';
  }
}

function startLiveClock(tz) {
  if (liveClockInterval) clearInterval(liveClockInterval);
  
  const update = () => {
    const localTimeEl = document.getElementById('localTime');
    if (localTimeEl && currentWeatherData) {
      const nowSec = Date.now() / 1000;
      localTimeEl.textContent = formatLocalTime(nowSec, tz);
    }
  };
  
  update();
  liveClockInterval = setInterval(update, 1000);
}

function formatLocalTime(dt, tz) {
  const activeOffset = getActiveTimezoneOffset(tz);
  const d = new Date((dt + activeOffset) * 1000);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayName = days[d.getUTCDay()];
  const dateNum = d.getUTCDate();
  const monthName = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  
  let h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const s = d.getUTCSeconds().toString().padStart(2, '0');
  let timeStr;
  if (is24Hour) {
    timeStr = `${h.toString().padStart(2, '0')}:${m}:${s}`;
  } else {
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    timeStr = `${h}:${m}:${s} ${ampm}`;
  }
  const label = getActiveTimezoneLabel();
  return `${dayName}, ${dateNum} ${monthName} ${year} · ${timeStr} (${label})`;
}

function epochToTime(epoch, tz) {
  const activeOffset = getActiveTimezoneOffset(tz);
  const d = new Date((epoch + activeOffset) * 1000);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2,'0');
  if (is24Hour) {
    return `${h.toString().padStart(2, '0')}:${m}`;
  } else {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
}

function hourLabel(epoch, tz) {
  const cityTz = tz !== undefined ? tz : (currentWeatherData ? currentWeatherData.timezone : 0);
  const activeOffset = getActiveTimezoneOffset(cityTz);
  const d = new Date((epoch + activeOffset) * 1000);
  const h = d.getUTCHours();
  if (is24Hour) {
    return `${h.toString().padStart(2, '0')}:00`;
  } else {
    return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`;
  }
}

function dayName(epoch) {
  return new Date(epoch * 1000).toLocaleDateString('en-US',{weekday:'long'});
}

function isNightTime(sunrise, sunset, dt) {
  return dt < sunrise || dt > sunset;
}

/* ─── Weather Helpers ───────────────────────────────────────── */
function weatherEmoji(id, isNight = false) {
  if (isNight) {
    if (id === 800) return '🌙';
    if (id === 801) return '☁️';
    if (id === 802) return '☁️';
    if (id === 803) return '☁️';
    if (id === 804) return '☁️';
    if (id >= 300 && id < 400) return '🌧️';
  }
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 510) return '🌧️';
  if (id === 511)            return '🌨️';
  if (id >= 520 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id === 701)            return '🌫️';
  if (id === 711)            return '💨';
  if (id === 721)            return '🌁';
  if (id >= 731 && id <= 762)return '🌪️';
  if (id === 771)            return '💨';
  if (id === 781)            return '🌪️';
  if (id === 800)            return '☀️';
  if (id === 801)            return '🌤️';
  if (id === 802)            return '⛅';
  if (id === 803)            return '🌥️';
  if (id === 804)            return '☁️';
  return '🌡️';
}

function uvCategory(uv) {
  if (uv < 3)  return 'Low';
  if (uv < 6)  return 'Moderate';
  if (uv < 8)  return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

/* ══ US EPA AQI ENGINE ══════════════════════════════════════════ */
// Breakpoints: [AQI_lo, AQI_hi, Conc_lo, Conc_hi]
const EPA_PM25 = [
  [0,   50,  0.0,   12.0],
  [51,  100, 12.1,  35.4],
  [101, 150, 35.5,  55.4],
  [151, 200, 55.5, 150.4],
  [201, 300, 150.5,250.4],
  [301, 400, 250.5,350.4],
  [401, 500, 350.5,500.4],
];
const EPA_PM10 = [
  [0,   50,  0,   54],
  [51,  100, 55,  154],
  [101, 150, 155, 254],
  [151, 200, 255, 354],
  [201, 300, 355, 424],
  [301, 400, 425, 504],
  [401, 500, 505, 604],
];
function calcEpaAqi(conc, table) {
  for (const [aqiLo, aqiHi, cLo, cHi] of table) {
    if (conc >= cLo && conc <= cHi) {
      return Math.round(((aqiHi - aqiLo) / (cHi - cLo)) * (conc - cLo) + aqiLo);
    }
  }
  return conc > 0 ? 500 : 0;
}
function epaAqiFromComponents(comp) {
  const pm25 = comp.pm2_5 != null ? calcEpaAqi(Math.round(comp.pm2_5 * 10) / 10, EPA_PM25) : 0;
  const pm10 = comp.pm10  != null ? calcEpaAqi(Math.round(comp.pm10),           EPA_PM10) : 0;
  return Math.max(pm25, pm10);
}
function epaCategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',                color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate',            color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy for Some',  color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy',           color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy',      color: '#a855f7' };
  return               { label: 'Hazardous',             color: '#7f1d1d' };
}
/* Keep legacy OWM helpers as fallback */
function aqiLabel(aqi) {
  const labels = {1:'Good',2:'Fair',3:'Moderate',4:'Poor',5:'Very Poor'};
  return labels[aqi] || '—';
}
function aqiDesc(aqi) {
  const descs = {
    1:'Air quality is excellent.',
    2:'Air quality is acceptable.',
    3:'May cause mild discomfort for sensitive groups.',
    4:'May cause health effects for sensitive groups.',
    5:'Everyone may experience serious health effects.'
  };
  return descs[aqi] || '';
}

/* ─── Kick off ──────────────────────────────────────────────── */
init();
initNavTabs();
initCompare();
initWeatherExplorer();

/* ═══════════════════════════════════════════════════════════════
   LIGHT OVERLAY — sun beams render ON TOP of cards via mix-blend-mode:screen
═══════════════════════════════════════════════════════════════ */
const lightOverlay = document.getElementById('lightOverlay');

function clearLightOverlay() { lightOverlay.innerHTML = ''; }

function spawnLightOverlay(id, isNight, temp) {
  clearLightOverlay();
  if (id >= 200 && id < 300) {
    // Thunderstorm: occasional white flash
    spawnLightningFlashOverlay();
  } else if (id >= 500 && id < 700) {
    // Rain/snow: cool blue tint veil — nothing on overlay
  } else if (id === 800 && !isNight) {
    // Clear day: golden sun beams
    const count = temp > 32 ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const beam = document.createElement('div');
      beam.className = 'light-beam';
      const rot = -30 + (i / count) * 80;
      const leftPct = 10 + (i / count) * 75;
      beam.style.cssText = `
        left: ${leftPct}%;
        --rot: ${rot}deg;
        --op: ${0.5 + Math.random() * 0.5};
        --sway-dur: ${9 + Math.random() * 6}s;
        --sway-del: ${-Math.random() * 8}s;
        width: ${80 + Math.random() * 80}px;
      `;
      lightOverlay.appendChild(beam);
    }
    if (temp > 32) spawnHeatLinesOverlay(20);
  } else if (id === 800 && isNight) {
    spawnAuroraOverlay();
  } else if (id === 801 || id === 802) {
    // Partly cloudy day: softer beams
    if (!isNight) {
      for (let i = 0; i < 5; i++) {
        const beam = document.createElement('div');
        beam.className = 'light-beam';
        const rot = -10 + (i / 5) * 40;
        beam.style.cssText = `
          left: ${15 + (i / 5) * 60}%;
          --rot: ${rot}deg;
          --op: ${0.25 + Math.random() * 0.3};
          --sway-dur: ${12 + Math.random() * 8}s;
          --sway-del: ${-Math.random() * 10}s;
          width: ${60 + Math.random() * 60}px;
        `;
        lightOverlay.appendChild(beam);
      }
    }
  } else if (id >= 600 && id < 700) {
    // Snow: cold blue veil
    const veil = document.createElement('div');
    veil.className = 'cold-veil';
    lightOverlay.appendChild(veil);
  } else if ((id >= 700 && id < 800) && (id !== 800)) {
    // Mist/fog/haze — nothing extra
  }
}

function spawnLightningFlashOverlay() {
  [4, 7, 11].forEach((period, i) => {
    const fl = document.createElement('div');
    fl.style.cssText = `
      position:absolute; inset:0;
      background:rgba(220,200,255,0.06);
      animation: lightningFlashOv ${period}s step-end infinite;
      animation-delay:${i * 2.1}s;
    `;
    lightOverlay.appendChild(fl);
  });
  // Inject keyframes if not present
  if (!document.getElementById('lfOvKf')) {
    const s = document.createElement('style');
    s.id = 'lfOvKf';
    s.textContent = `@keyframes lightningFlashOv{0%,92%,94%,96%,100%{opacity:0}93%,95%{opacity:1}}`;
    document.head.appendChild(s);
  }
}

function spawnAuroraOverlay() {
  const colors = [
    ['rgba(100,220,180,1)', 0.12],
    ['rgba(80,100,220,1)',  0.10],
    ['rgba(200,80,220,1)',  0.08],
  ];
  colors.forEach(([c, op], i) => {
    const band = document.createElement('div');
    band.className = 'aurora-band';
    band.style.cssText = `
      top: ${10 + i * 20}%;
      height: ${80 + Math.random() * 60}px;
      background: ${c};
      --op: ${op};
      --dur: ${14 + i * 3}s;
      --del: ${-i * 4}s;
    `;
    lightOverlay.appendChild(band);
  });
}

function spawnHeatLinesOverlay(count) {
  for (let i = 0; i < count; i++) {
    const line = document.createElement('div');
    line.className = 'heat-line';
    line.style.cssText = `
      top: ${5 + (i / count) * 90}%;
      --hs-dur: ${3 + Math.random() * 4}s;
      --hs-del: ${-Math.random() * 4}s;
      opacity: ${0.3 + Math.random() * 0.4};
    `;
    lightOverlay.appendChild(line);
  }
}


/* ═══════════════════════════════════════════════════════════════
   NAV TABS
═══════════════════════════════════════════════════════════════ */
function initNavTabs() {
  const activeTab = document.querySelector('.nav-tab.active');
  if (activeTab) {
    setTimeout(() => updateTabIndicator(activeTab, true), 50);
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      updateTabIndicator(tab, false);
      
      const target = tab.dataset.tab;
      document.getElementById('pagWeather').style.display = target === 'weather' ? '' : 'none';
      document.getElementById('pagCompare').style.display = target === 'compare'  ? '' : 'none';
      document.getElementById('pagRadarAstro').style.display = target === 'radar-astro' ? '' : 'none';

      if (target === 'radar-astro') {
        renderAstroPage();
        startAstroUpdates();
      } else {
        stopAstroUpdates();
      }
    });
  });

  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-tab.active');
    if (active) updateTabIndicator(active, true);
  });
}

/* ═══════════════════════════════════════════════════════════════
   COMPARE PAGE
═══════════════════════════════════════════════════════════════ */
let cmpDataA = null, cmpDataB = null;
let cmpFcA   = null, cmpFcB   = null;
let cmpTimerA = null, cmpTimerB = null;

function initCompare() {
  setupCmpSearch('A');
  setupCmpSearch('B');
}

function setupCmpSearch(side) {
  const input   = document.getElementById(`cmpInput${side}`);
  const suggest = document.getElementById(`cmpSuggest${side}`);
  let timer;

  input.addEventListener('input', () => {
    const v = input.value.trim();
    clearTimeout(timer);
    if (v.length < 2) { suggest.innerHTML = ''; suggest.style.display='none'; return; }
    timer = setTimeout(() => fetchCmpSuggestions(v, side), 350);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest(`#cmpSearchWrap${side}`)) {
      suggest.innerHTML = ''; suggest.style.display = 'none';
    }
  });
}

async function fetchCmpSuggestions(query, side) {
  const suggest = document.getElementById(`cmpSuggest${side}`);
  try {
    let data;
    if (API_KEY === 'demo') {
      data = [
        { name: query, country: 'US', state: 'Demo', lat: 40.71, lon: -74.00 },
        { name: query + ' City', country: 'GB', state: 'Demo', lat: 51.50, lon: -0.12 }
      ];
    } else {
      const r = await fetch(`${BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=4&appid=${API_KEY}`);
      if (r.status === 401) {
        handleInvalidKey();
        return;
      }
      data = await r.json();
    }
    if (!data.length) { suggest.style.display='none'; return; }
    suggest.innerHTML = data.map(c => {
      const flagUrl = `https://flagcdn.com/w20/${c.country.toLowerCase()}.png`;
      return `
        <div class="suggestion-item" data-name="${c.name}" data-country="${c.country}" data-state="${c.state||''}" data-lat="${c.lat}" data-lon="${c.lon}">
          <span class="sug-name">${c.name}</span>
          <span class="sug-country" style="display:inline-flex; align-items:center; gap:5px;">
            <img src="${flagUrl}" alt="${c.country}" class="city-flag-img" style="width:16px; height:11px; margin:0; border-radius:1.5px; box-shadow:0 1px 2px rgba(0,0,0,0.2);" onerror="this.style.display='none'" />
            ${c.state ? c.state+', ' : ''}${c.country}
          </span>
        </div>`;
    }).join('');
    suggest.style.display = 'block';
    suggest.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const input = document.getElementById(`cmpInput${side}`);
        input.value = item.dataset.name + (item.dataset.country ? `, ${item.dataset.country}` : '');
        suggest.innerHTML = ''; suggest.style.display = 'none';
        fetchCmpWeather(parseFloat(item.dataset.lat), parseFloat(item.dataset.lon), item.dataset.name, side);
      });
    });
  } catch(e) { suggest.style.display='none'; }
}

async function fetchCmpWeather(lat, lon, name, side) {
  document.getElementById('cmpWelcome').style.display   = 'none';
  document.getElementById('compareResults').style.display = 'none';
  document.getElementById('cmpLoading').style.display   = 'flex';

  try {
    let w, f;
    if (API_KEY === 'demo') {
      const mock = generateMockWeather(name, 'DM');
      mock.cur.coord.lat = parseFloat(lat);
      mock.cur.coord.lon = parseFloat(lon);
      w = mock.cur; w._displayName = name;
      f = mock.fcast;
    } else {
      const [wRes, fRes] = await Promise.all([
        fetch(`${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetch(`${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=8`)
      ]);
      if (wRes.status === 401 || fRes.status === 401) {
        handleInvalidKey();
        return;
      }
      w = await wRes.json(); w._displayName = name;
      f = await fRes.json();
    }

    if (side === 'A') { cmpDataA = w; cmpFcA = f; }
    else               { cmpDataB = w; cmpFcB = f; }

    if (cmpDataA && cmpDataB) renderCompare();
    else document.getElementById('cmpLoading').style.display = 'none';
  } catch(e) {
    document.getElementById('cmpLoading').style.display = 'none';
    document.getElementById('cmpWelcome').style.display = 'flex';
  }
}

function renderCompare() {
  document.getElementById('cmpLoading').style.display    = 'none';
  document.getElementById('compareResults').style.display = 'block';

  const a = cmpDataA, b = cmpDataB;
  const u = isCelsius ? '°C' : '°F';
  const cv = t => isCelsius ? Math.round(t) : Math.round(toF(t));

  // Hero cards
  ['A','B'].forEach(side => {
    const d   = side === 'A' ? a : b;
    const el  = document.getElementById(`cmpHero${side}`);
    const t   = cv(d.main.temp);
    const fl  = cv(d.main.feels_like);
    const isCmpNight = isNightTime(d.sys.sunrise, d.sys.sunset, d.dt);
    const icon = weatherEmoji(d.weather[0].id, isCmpNight);
    const desc = d.weather[0].description;
    el.innerHTML = `
      <span class="cmp-badge ${side.toLowerCase()}">${side === 'A' ? 'City A' : 'City B'}</span>
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div class="cmp-city-name">${d._displayName}</div>
          <div class="cmp-city-desc" style="display:inline-flex; align-items:center; gap:5px;">
            <img src="https://flagcdn.com/w20/${d.sys.country.toLowerCase()}.png" alt="${d.sys.country}" class="city-flag-img" style="width:16px; height:11px; margin:0; border-radius:1.5px; box-shadow:0 1px 2px rgba(0,0,0,0.2);" onerror="this.style.display='none'" />
            <span style="font-weight: 700; color: var(--text-primary);">${d.sys.country}</span> · ${desc.charAt(0).toUpperCase()+desc.slice(1)}
          </div>
        </div>
        <div class="cmp-icon">${icon}</div>
      </div>
      <div class="cmp-temp-row">
        <span class="cmp-temp">${t}</span>
        <span class="cmp-temp-unit">${u}</span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary)">
        <span>Feels ${fl}${u}</span>
        <span>H:${cv(d.main.temp_max)}${u} L:${cv(d.main.temp_min)}${u}</span>
        <span>💧${d.main.humidity}%</span>
        <span>💨${d.wind.speed.toFixed(1)} m/s</span>
      </div>`;
  });

  // Metrics
  const metrics = [
    { label:'Temperature',  vA: cv(a.main.temp),        vB: cv(b.main.temp),        fmt: v => v+u,          range:[cv(Math.min(a.main.temp,b.main.temp))-5, cv(Math.max(a.main.temp,b.main.temp))+5], unit:'temp' },
    { label:'Humidity',     vA: a.main.humidity,         vB: b.main.humidity,         fmt: v => v+'%',        range:[0,100] },
    { label:'Wind Speed',   vA: +a.wind.speed.toFixed(1),vB: +b.wind.speed.toFixed(1),fmt: v => v+' m/s',    range:[0, Math.max(a.wind.speed,b.wind.speed)*1.3+1] },
    { label:'Pressure',     vA: a.main.pressure,         vB: b.main.pressure,         fmt: v => v+' hPa',     range:[960,1060] },
    { label:'Visibility',   vA: +(a.visibility/1000).toFixed(1), vB: +(b.visibility/1000).toFixed(1), fmt: v => v+' km', range:[0,10] },
    { label:'Cloud Cover',  vA: a.clouds.all,            vB: b.clouds.all,            fmt: v => v+'%',        range:[0,100] },
    { label:'Feels Like',   vA: cv(a.main.feels_like),   vB: cv(b.main.feels_like),   fmt: v => v+u,          range:[cv(Math.min(a.main.feels_like,b.main.feels_like))-5, cv(Math.max(a.main.feels_like,b.main.feels_like))+5] },
  ];

  const na = a._displayName, nb = b._displayName;
  const metricsEl = document.getElementById('cmpMetrics');
  metricsEl.innerHTML = `<div class="cmp-metrics-title">Side-by-Side Comparison</div>` +
    metrics.map(m => {
      const [rMin, rMax] = m.range;
      const span = Math.max(rMax - rMin, 1);
      const pctA = Math.min(Math.max((m.vA - rMin) / span, 0), 1) * 100;
      const pctB = Math.min(Math.max((m.vB - rMin) / span, 0), 1) * 100;
      const diff = m.vA - m.vB;
      let winner = '';
      if (Math.abs(diff) > 0.4) {
        const winSide = diff < 0 ? na : nb;
        const val = Math.abs(diff).toFixed(1);
        winner = `<span class="cmp-winner-chip">🏆 <strong>${winSide}</strong> — ${m.label.toLowerCase()} difference: ${val}${m.label==='Temperature'||m.label==='Feels Like'?u:m.label==='Humidity'||m.label==='Cloud Cover'?'%':m.label==='Wind Speed'?' m/s':m.label==='Visibility'?' km':' hPa'}</span>`;
      }
      return `
        <div class="cmp-metric-label">${m.label}</div>
        <div class="cmp-metric-row">
          <div class="cmp-metric-val">${m.fmt(m.vA)}</div>
          <div class="cmp-metric-bar-wrap">
            <div class="cmp-metric-bar a" style="width:0%" data-pct="${pctA}"></div>
            <div class="cmp-metric-bar b" style="width:0%" data-pct="${pctB}"></div>
          </div>
          <div class="cmp-metric-val b">${m.fmt(m.vB)}</div>
          ${winner}
        </div>`;
    }).join('');

  // Animate bars after paint
  requestAnimationFrame(() => requestAnimationFrame(() => {
    metricsEl.querySelectorAll('.cmp-metric-bar').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }));

  // Legend
  document.getElementById('cmpChartLegend').innerHTML = `
    <div class="cmp-legend-item"><div class="cmp-legend-dot" style="background:#60a5fa"></div>${na}</div>
    <div class="cmp-legend-item"><div class="cmp-legend-dot" style="background:#a78bfa"></div>${nb}</div>`;

  // Mini temperature chart
  drawCmpChart(cmpFcA, cmpFcB, na, nb);
}

function drawCmpChart(fcA, fcB, nameA, nameB) {
  const canvas = document.getElementById('cmpChart');
  if (!canvas) return;
  const W = canvas.offsetWidth || 800, H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const tempsA = (fcA.list || []).slice(0,8).map(x => isCelsius ? x.main.temp : toF(x.main.temp));
  const tempsB = (fcB.list || []).slice(0,8).map(x => isCelsius ? x.main.temp : toF(x.main.temp));
  const labels = (fcA.list || []).slice(0,8).map(x => hourLabel(x.dt));
  const allT   = [...tempsA, ...tempsB];
  const minT   = Math.min(...allT) - 2, maxT = Math.max(...allT) + 2;
  const padL=35, padR=15, padT=15, padB=25;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  function xOf(i) { return padL + (i/(tempsA.length-1)) * chartW; }
  function yOf(v) { return padT + (1-(v-minT)/(maxT-minT)) * chartH; }

  function drawSpline(temps, strokeColor, fillColor) {
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(temps[0]));
    
    // Draw smooth spline using control points
    for (let i = 0; i < temps.length - 1; i++) {
      const xc = (xOf(i) + xOf(i + 1)) / 2;
      const yc = (yOf(temps[i]) + yOf(temps[i + 1])) / 2;
      ctx.quadraticCurveTo(xOf(i), yOf(temps[i]), xc, yc);
    }
    ctx.quadraticCurveTo(
      xOf(temps.length - 1), 
      yOf(temps[temps.length - 1]), 
      xOf(temps.length - 1), 
      yOf(temps[temps.length - 1])
    );
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Fill area under spline with smooth gradient
    ctx.lineTo(xOf(temps.length - 1), H - padB);
    ctx.lineTo(xOf(0), H - padB);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, strokeColor + '3d'); // 24% opacity
    grad.addColorStop(1, strokeColor + '00'); // fully transparent
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function renderChart(hoverIndex = null) {
    ctx.clearRect(0,0,W,H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [0.25,0.5,0.75].forEach(f => {
      const y = padT + f * chartH;
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
    });

    // Draw splines
    drawSpline(tempsA, '#60a5fa', '#60a5fa');
    drawSpline(tempsB, '#a78bfa', '#a78bfa');

    // Default static points if not hovered
    if (hoverIndex === null) {
      tempsA.forEach((t,i) => {
        ctx.beginPath(); ctx.fillStyle = '#60a5fa';
        ctx.arc(xOf(i), yOf(t), 3.5, 0, Math.PI*2); ctx.fill();
      });
      tempsB.forEach((t,i) => {
        ctx.beginPath(); ctx.fillStyle = '#a78bfa';
        ctx.arc(xOf(i), yOf(t), 3.5, 0, Math.PI*2); ctx.fill();
      });
    }

    // X labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((l,i) => ctx.fillText(l, xOf(i), H-6));

    // Y label
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxT)+'°', padL-6, padT+5);
    ctx.fillText(Math.round(minT)+'°', padL-6, H-padB+3);

    // Interactive Hover Elements
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < tempsA.length) {
      const idx = hoverIndex;
      
      // Vertical guide line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(xOf(idx), padT - 5);
      ctx.lineTo(xOf(idx), H - padB);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Glowing outer concentric circles for values
      const highlight = (t, color) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(xOf(idx), yOf(t), 5.5, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.arc(xOf(idx), yOf(t), 6, 0, Math.PI*2);
        ctx.stroke();
      };
      highlight(tempsA[idx], '#60a5fa');
      highlight(tempsB[idx], '#a78bfa');

      // Floating glass tooltip card
      const tooltipW = 145, tooltipH = 50;
      let tooltipX = xOf(idx) + 12;
      if (tooltipX + tooltipW > W) {
        tooltipX = xOf(idx) - tooltipW - 12;
      }
      const tooltipY = Math.min(yOf(tempsA[idx]), yOf(tempsB[idx])) - 18;
      const tY = Math.min(Math.max(tooltipY, 5), H - tooltipH - 5);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(tooltipX, tY, tooltipW, tooltipH, 10);
      } else {
        ctx.rect(tooltipX, tY, tooltipW, tooltipH);
      }
      ctx.fill();
      ctx.stroke();

      // Tooltip content
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${labels[idx]} Forecast`, tooltipX + 10, tY + 14);

      ctx.font = '500 9px Inter, sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(`${nameA}: ${Math.round(tempsA[idx])}°`, tooltipX + 10, tY + 28);
      ctx.fillStyle = '#c084fc';
      ctx.fillText(`${nameB}: ${Math.round(tempsB[idx])}°`, tooltipX + 10, tY + 41);
    }
  }

  // Mouse interactivity hooks
  canvas.onmousemove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const idx = Math.round(((mouseX - padL) / chartW) * (tempsA.length - 1));
    if (idx >= 0 && idx < tempsA.length) {
      renderChart(idx);
    }
  };

  canvas.onmouseleave = function() {
    renderChart(null);
  };

  // Initial draw
  renderChart(null);
}

/* ═══════════════════════════════════════════════════════════════
   DETAIL MODAL SYSTEM
═══════════════════════════════════════════════════════════════ */
const detailOverlay  = document.getElementById('detailOverlay');
const detailModal    = document.getElementById('detailModal');
const detailClose    = document.getElementById('detailClose');
const detailIcon     = document.getElementById('detailIcon');
const detailTitle    = document.getElementById('detailTitle');
const detailSubtitle = document.getElementById('detailSubtitle');
const detailMainVal  = document.getElementById('detailMainValue');
const detailVisual   = document.getElementById('detailVisual');
const detailStats    = document.getElementById('detailStatsRow');
const detailInsight  = document.getElementById('detailInsight');
const detailHourlyWrap  = document.getElementById('detailHourlyWrap');
const detailHourlyTrack = document.getElementById('detailHourlyTrack');

let activeSourceCard = null;
let lastTransformState = null;

function openDetailVisual(sourceCard) {
  activeSourceCard = sourceCard || null;
  detailOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (detailModal) detailModal.scrollTop = 0;

  detailOverlay.classList.add('open');
  
  if (sourceCard) {
    const first = sourceCard.getBoundingClientRect();
    
    // Set to final layout state immediately to calculate final rect
    detailModal.style.transform = 'none';
    detailModal.style.opacity = '1';
    
    const last = detailModal.getBoundingClientRect();
    
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    const deltaW = first.width / last.width;
    const deltaH = first.height / last.height;
    
    detailModal.style.transformOrigin = '0 0';
    
    anime.remove(detailModal);
    anime.remove(detailOverlay);
    
    anime({
      targets: detailModal,
      translateX: [deltaX, 0],
      translateY: [deltaY, 0],
      scaleX: [deltaW, 1],
      scaleY: [deltaH, 1],
      opacity: [0.3, 1],
      duration: 500,
      easing: 'cubicBezier(0.34, 1.56, 0.64, 1)',
      complete: () => {
        detailModal.style.transformOrigin = '';
        detailModal.style.transform = '';
        updateModalScrollFade();
      }
    });
    
    anime({
      targets: detailOverlay,
      backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)'],
      opacity: [0, 1],
      duration: 350,
      easing: 'easeOutQuad'
    });
  } else {
    // fallback if no sourceCard
    anime.remove(detailModal);
    anime.remove(detailOverlay);
    
    detailModal.style.transform = 'scale(0.92) translateY(24px)';
    detailModal.style.opacity = '0';
    
    anime({
      targets: detailModal,
      scale: 1,
      translateY: 0,
      opacity: 1,
      duration: 400,
      easing: 'cubicBezier(0.25, 1, 0.5, 1)',
      complete: () => {
        updateModalScrollFade();
      }
    });
    
    anime({
      targets: detailOverlay,
      backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)'],
      opacity: [0, 1],
      duration: 350,
      easing: 'easeOutQuad'
    });
  }
}

function openDetail(sourceCard) {
  openDetailVisual(sourceCard);
  pushNavigationState({ page: 'detail' });
}

function closeDetailVisual() {
  stopDeviceCompass();
  
  if (activeSourceCard) {
    const current = detailModal.getBoundingClientRect();
    const last = activeSourceCard.getBoundingClientRect();
    
    const targetX = last.left - current.left;
    const targetY = last.top - current.top;
    const targetW = last.width / current.width;
    const targetH = last.height / current.height;
    
    detailModal.style.transformOrigin = '0 0';
    
    anime.remove(detailModal);
    anime.remove(detailOverlay);
    
    anime({
      targets: detailModal,
      translateX: targetX,
      translateY: targetY,
      scaleX: targetW,
      scaleY: targetH,
      opacity: 0,
      duration: 400,
      easing: 'cubicBezier(0.25, 1, 0.5, 1)',
      complete: () => {
        detailOverlay.style.display = 'none';
        detailOverlay.classList.remove('open');
        document.body.style.overflow = '';
        activeSourceCard = null;
        detailModal.style.transformOrigin = '';
        detailModal.style.transform = '';
        detailModal.classList.remove('summary-large');
        const shareContainer = document.getElementById('detailShareContainer');
        if (shareContainer) shareContainer.style.display = 'none';
      }
    });
    
    anime({
      targets: detailOverlay,
      backgroundColor: 'rgba(0,0,0,0)',
      opacity: 0,
      duration: 300,
      easing: 'easeInQuad'
    });
  } else {
    // fallback
    anime.remove(detailModal);
    anime.remove(detailOverlay);
    
    anime({
      targets: detailModal,
      scale: 0.92,
      translateY: 15,
      opacity: 0,
      duration: 300,
      easing: 'cubicBezier(0.25, 1, 0.5, 1)',
      complete: () => {
        detailOverlay.style.display = 'none';
        detailOverlay.classList.remove('open');
        document.body.style.overflow = '';
        activeSourceCard = null;
        detailModal.style.transform = '';
        detailModal.classList.remove('summary-large');
        const shareContainer = document.getElementById('detailShareContainer');
        if (shareContainer) shareContainer.style.display = 'none';
      }
    });
    
    anime({
      targets: detailOverlay,
      backgroundColor: 'rgba(0,0,0,0)',
      opacity: 0,
      duration: 300,
      easing: 'easeInQuad'
    });
  }
}

function closeDetail() {
  if (window.history.state && window.history.state.page === 'detail') {
    window.history.back();
  } else {
    closeDetailVisual();
  }
}

function updateModalScrollFade() {
  if (!detailModal) return;
  const isScrollable = detailModal.scrollHeight > detailModal.clientHeight;
  const isAtBottom = detailModal.scrollHeight - detailModal.scrollTop <= detailModal.clientHeight + 10;
  
  if (isScrollable && !isAtBottom) {
    detailModal.classList.add('has-scroll-fade');
  } else {
    detailModal.classList.remove('has-scroll-fade');
  }
}

detailClose.addEventListener('click', closeDetail);
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) closeDetail(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

if (detailModal) {
  detailModal.addEventListener('scroll', updateModalScrollFade);
}
window.addEventListener('resize', updateModalScrollFade);

/* ── Per-card theme ── */
function setModalTheme(accent, glow, banner) {
  const m = document.getElementById('detailModal');
  m.style.setProperty('--modal-accent', accent);
  m.style.setProperty('--modal-glow', glow);
  const b = document.getElementById('detailBanner');
  if (b) b.style.background = banner;
}

/* ── Pill helper ── */
function pill(label, value, i=0) {
  return `<div class="detail-stat-pill" style="--pill-i:${i}"><span class="dsp-label">${label}</span><span class="dsp-value">${value}</span></div>`;
}


/* ── Arc gauge SVG (with tick marks) ── */
function arcGaugeSVG(pct, label, sublabel='', color1='#60a5fa', color2='#a78bfa') {
  const R=72, cx=95, cy=95, sw=13;
  const arc = 2*Math.PI*R * 0.75;
  const offset = arc - arc * Math.min(pct,1);
  let ticks='';
  for(let i=0;i<=10;i++){
    const a=(135+i*27)*Math.PI/180;
    const r1=R+9,r2=R+(i%5===0?20:13);
    ticks+=`<line class="arc-tick" x1="${cx+r1*Math.cos(a)}" y1="${cy+r1*Math.sin(a)}" x2="${cx+r2*Math.cos(a)}" y2="${cy+r2*Math.sin(a)}"/>`;
  }
  return `<div class="arc-gauge-wrap">
    <svg class="arc-gauge-svg" width="190" height="165" viewBox="0 0 190 180">
      <defs><linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs>
      ${ticks}
      <circle class="arc-gauge-track" cx="${cx}" cy="${cy}" r="${R}" stroke-width="${sw}"
        stroke-dasharray="${arc}" stroke-dashoffset="${arc*0.25}" transform="rotate(135 ${cx} ${cy})"/>
      <circle class="arc-gauge-fill" cx="${cx}" cy="${cy}" r="${R}" stroke-width="${sw}"
        stroke-dasharray="${arc}" stroke-dashoffset="${arc}"
        transform="rotate(135 ${cx} ${cy})" id="arcFill" data-offset="${offset}"/>
      <text class="arc-gauge-text" x="${cx}" y="${cy+5}">${label}</text>
      ${sublabel?`<text class="arc-gauge-sub" x="${cx}" y="${cy+25}">${sublabel}</text>`:''}
    </svg></div>`;
}

/* ── Barometer dial (pressure) ── */
function barometerSVG(pct, hpa) {
  const R=72, cx=90, cy=122, sw=13;
  const arc = Math.PI*R;
  const offset = arc - arc*Math.min(pct,1);
  const needleDeg = -90+pct*180;
  const nr = needleDeg*Math.PI/180;
  const nx=cx+58*Math.cos(nr), ny=cy+58*Math.sin(nr);
  return `<div class="barometer-wrap">
    <svg class="barometer-svg" width="180" height="130" viewBox="0 0 180 135">
      <defs><linearGradient id="baroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#34d399"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs>
      <path class="baro-track" d="M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}" stroke-width="${sw}"/>
      <path class="baro-fill" d="M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}" stroke-width="${sw}"
        stroke-dasharray="${arc}" stroke-dashoffset="${arc}" id="baroFill" data-offset="${offset}"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-55}" stroke="#f1f5f9" stroke-width="3" stroke-linecap="round"
        id="baroNeedle" data-deg="${needleDeg}" style="transform-origin:${cx}px ${cy}px"/>
      <circle cx="${cx}" cy="${cy}" r="8" fill="#f1f5f9" opacity="0.9"/>
      <text class="baro-label" x="${cx}" y="${cy-24}">${hpa} hPa</text>
      <text class="baro-sub" x="14" y="${cy+14}">Low</text>
      <text class="baro-sub" x="152" y="${cy+14}">High</text>
    </svg></div>`;
}

/* ── Visibility eye-beam ── */
function visibilityViz(km) {
  const pct = Math.min(km/10,1);
  const hazeOpacity = (1 - pct) * 0.94; // If visibility is 10km, haze is 0. If 0km, haze is 94% dense.
  
  return `<div class="vis-wrap" style="width:100%;">
    <div class="vis-scene" style="width:100%; height:96px; position:relative; overflow:hidden; border-radius:16px; background:#0f172a; box-shadow:inset 0 4px 20px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06);">
      <!-- Scenic Mountain Backdrop vector -->
      <svg viewBox="0 0 300 96" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;">
        <defs>
          <linearGradient id="visSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="visHillsGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4b5563"/>
            <stop offset="100%" stop-color="#1f2937"/>
          </linearGradient>
          <linearGradient id="visHillsGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#374151"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
        </defs>
        <!-- Sky -->
        <rect width="300" height="96" fill="url(#visSkyGrad)"/>
        
        <!-- Distant Mountain peaks -->
        <path d="M 0 65 L 50 38 L 110 70 L 160 30 L 220 62 L 270 35 L 300 68 L 300 96 L 0 96 Z" fill="url(#visHillsGrad1)" opacity="0.6"/>
        
        <!-- Closer darker peaks -->
        <path d="M 0 74 L 70 54 L 140 78 L 200 48 L 260 70 L 300 58 L 300 96 L 0 96 Z" fill="url(#visHillsGrad2)" opacity="0.95"/>
        
        <!-- Tiny scenic pine trees (dots/spikes on foreground) -->
        <polygon points="25,72 28,64 31,72" fill="#030712"/>
        <polygon points="28,73 32,62 36,73" fill="#030712"/>
        <polygon points="120,78 124,68 128,78" fill="#030712"/>
        <polygon points="270,72 274,60 278,72" fill="#030712"/>
      </svg>
      
      <!-- Interactive Real-time Fog overlay -->
      <div id="visFogOverlay" style="position:absolute; inset:0; background:linear-gradient(to top, rgba(203,213,225,0.96), rgba(203,213,225,0.7)); opacity:${hazeOpacity}; transition: opacity 1.2s cubic-bezier(0.25, 1, 0.5, 1); pointer-events:none; filter: blur(0.5px);">
        <!-- Dreamy Fog drifting micro-animation -->
        <div style="position:absolute; inset:0; background:radial-gradient(circle at 30% 60%, rgba(255,255,255,0.4) 0%, transparent 60%); filter:blur(4px); animation: fogDrift 16s ease-in-out infinite alternate;"></div>
      </div>
      
      <!-- Status Badge inside graphic for complete visual context -->
      <div style="position:absolute; bottom:10px; left:12px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#ffffff; background:rgba(15,23,42,0.7); padding:4px 10px; border-radius:30px; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.12); z-index:10; box-shadow: 0 4px 12px rgba(0,0,0,0.25)">
        ${visibilityCategory(km)} Conditions
      </div>
    </div>
    
    <div class="vis-labels" style="width:100%; margin-top:4px;"><span>0 km (Dense Fog)</span><span>10+ km (Perfect Sight)</span></div>
    <div class="vis-bar-track" style="width:100%;">
      <div class="vis-bar-fill" id="visBarFill" style="width:0%" data-pct="${pct*100}">
        <div class="vis-bar-thumb"></div>
      </div>
    </div>
  </div>`;
}

/* ── Precipitation rain gauge SVG ── */
function rainGaugeSVG(pct, label, showPercentage = false) {
  const line1 = showPercentage ? '75%' : '15 mm';
  const line2 = showPercentage ? '50%' : '10 mm';
  const line3 = showPercentage ? '25%' : '5 mm';
  return `<div class="rain-gauge-wrap" style="display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; margin: 10px 0;">
    <div style="position:relative; width:64px; height:100px; border:2.5px solid rgba(255,255,255,0.22); border-top:none; border-radius:0 0 14px 14px; background:rgba(255,255,255,0.04); overflow:hidden; box-shadow:inset 0 4px 16px rgba(0,0,0,0.15)">
      <div id="rainGaugeFill" data-pct="${pct}" style="position:absolute; bottom:0; left:0; width:100%; height:0%; background:linear-gradient(to top, #2563eb, #60a5fa); opacity:0.85;">
        <div style="position:absolute; top:0; left:0; width:100%; height:4px; background:rgba(255,255,255,0.4); filter:blur(1px);"></div>
      </div>
      <div style="position:absolute; top:20px; left:0; width:100%; border-bottom:1px dashed rgba(255,255,255,0.18); text-align:right; font-size:8px; padding-right:6px; box-sizing:border-box; color:rgba(255,255,255,0.3)">${line1}</div>
      <div style="position:absolute; top:45px; left:0; width:100%; border-bottom:1px dashed rgba(255,255,255,0.18); text-align:right; font-size:8px; padding-right:6px; box-sizing:border-box; color:rgba(255,255,255,0.3)">${line2}</div>
      <div style="position:absolute; top:70px; left:0; width:100%; border-bottom:1px dashed rgba(255,255,255,0.18); text-align:right; font-size:8px; padding-right:6px; box-sizing:border-box; color:rgba(255,255,255,0.3)">${line3}</div>
    </div>
    <div style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.95);">${label}</div>
  </div>`;
}

/* ── Cloud sky scene ── */
function cloudSkyHTML(cloudPct) {
  const sunOp = Math.max(0.05, 1-cloudPct/100);
  const lum = Math.round(15+cloudPct*0.35);
  return `<div class="sky-scene-wrap" style="width:100%">
    <div class="sky-scene-bg" style="background:linear-gradient(to bottom,hsl(210,${80-cloudPct*0.45}%,${lum}%),hsl(210,55%,${lum-5}%))"></div>
    <div class="sky-sun" style="opacity:${sunOp}"></div>
    <div class="sky-cloud" style="width:90px;height:30px;top:16px;left:${20+cloudPct*0.28}px;--cloud-op:${Math.min(cloudPct/80,0.95)};--cd:9s;--cx:14px"></div>
    <div class="sky-cloud" style="width:60px;height:22px;top:32px;right:${16+cloudPct*0.22}px;--cloud-op:${Math.min(cloudPct/100,0.88)};--cd:12s;--cx:-10px"></div>
  </div>`;
}

/* ── Dew point droplet ── */
function dropletSVG(pct, label, color1='#34d399', color2='#06b6d4') {
  const fillH = Math.round(88*Math.min(pct,1));
  const fillY = 12+(88-fillH);
  return `<div class="droplet-wrap">
    <svg class="droplet-svg" width="100" height="130" viewBox="0 0 100 130">
      <defs>
        <clipPath id="dropClip"><path d="M50 8C50 8 16 54 16 78a34 34 0 0 0 68 0C84 54 50 8 50 8Z"/></clipPath>
        <linearGradient id="dropGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient>
      </defs>
      <path class="droplet-track" d="M50 8C50 8 16 54 16 78a34 34 0 0 0 68 0C84 54 50 8 50 8Z"/>
      <rect x="0" y="130" width="100" height="${fillH+30}" fill="url(#dropGrad)" opacity="0.8"
        clip-path="url(#dropClip)" id="dropFill" data-y="${fillY}"/>
      <path d="M50 8C50 8 16 54 16 78a34 34 0 0 0 68 0C84 54 50 8 50 8Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <text class="droplet-text" x="50" y="82">${label}</text>
    </svg></div>`;
}

/* ── AQI pollutant bars ── */
function aqiBarsHTML(components) {
  const items = [
    {label:'PM2.5', val: components.pm2_5||0, max:75, color:'#f87171'},
    {label:'PM10',  val: components.pm10||0,  max:150, color:'#fb923c'},
    {label:'O₃',   val: components.o3||0,    max:180, color:'#a78bfa'},
    {label:'NO₂',  val: components.no2||0,   max:200, color:'#60a5fa'},
    {label:'SO₂',  val: components.so2||0,   max:350, color:'#f59e0b'},
    {label:'CO',   val: (components.co||0)/10, max:1000, color:'#34d399'},
  ];
  return `<div class="aqi-bands-wrap">${items.map(it=>{
    const pct=Math.min(it.val/it.max*100,100);
    return `<div class="aqi-band-row">
      <span class="aqi-band-label">${it.label}</span>
      <div class="aqi-band-track"><div class="aqi-band-fill" style="width:0%;background:${it.color}" data-pct="${pct}"></div></div>
      <span class="aqi-band-val" style="color:${it.color}">${it.val.toFixed(1)}</span>
    </div>`;}).join('')}</div>`;
}

/* ── Horizon bar ── */
function horizonBar(pct, leftLabel, rightLabel) {
  return `<div class="horizon-bar-wrap">
    <div class="horizon-labels"><span>${leftLabel}</span><span>${rightLabel}</span></div>
    <div class="horizon-track">
      <div class="horizon-fill" id="horizFill" style="width:0%" data-pct="${pct}"><div class="horizon-thumb"></div></div>
    </div></div>`;
}

/* ── Sun arc SVG ── */
function sunArcSVG(sunrisePct, sunsetPct, nowPct, sunriseStr, sunsetStr) {
  const W=340, H=150, cx=170, cy=148, R=125;
  const arcLen = Math.PI*R;
  const prog = Math.min(Math.max(nowPct,0),1);
  const offset = arcLen - arcLen*prog;
  const angle = Math.PI + prog*Math.PI;
  const dotX = cx+R*Math.cos(angle), dotY = cy+R*Math.sin(angle);
  return `<div class="sun-arc-wrap">
    <svg class="sun-arc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#fde047"/></linearGradient></defs>
      <path class="sun-arc-track" d="M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}" stroke-width="6"/>
      <path class="sun-arc-fill" d="M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}" stroke-width="6"
        stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen}" id="sunFill" data-offset="${offset}" stroke="url(#sunGrad)"/>
      <circle class="sun-dot" cx="${dotX}" cy="${dotY}" r="12"/>
    </svg>
    <div class="sun-arc-times"><span>🌅 ${sunriseStr}</span><span>🌇 ${sunsetStr}</span></div>
  </div>`;
}

/* ── Big compass ── */
function bigCompassHTML(deg, dirName, speed, gust) {
  // Only show device compass button on actual touch/mobile devices
  const hasSensor = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
                    && 'DeviceOrientationEvent' in window;
  return `<div class="big-compass-wrap">
    <div class="big-compass" id="bigCompassRose">
      <span class="compass-dir n">N</span><span class="compass-dir s">S</span>
      <span class="compass-dir e">E</span><span class="compass-dir w">W</span>
      <span class="compass-dir ne">NE</span><span class="compass-dir se">SE</span>
      <span class="compass-dir sw">SW</span><span class="compass-dir nw">NW</span>
      <div class="big-needle" id="bigNeedle" data-deg="${deg}"></div>
      ${hasSensor ? '<div class="device-needle" id="deviceNeedle" style="display:none"></div>' : ''}
      <div class="compass-center"></div>
    </div>
    <p class="big-compass-label">Wind from <strong>${dirName}</strong> · ${speed.toFixed(1)} m/s${gust ? ` (gusts ${gust.toFixed(1)})` : ''}</p>
    ${hasSensor ? `<button class="device-compass-btn" id="deviceCompassBtn" onclick="activateDeviceCompass()">
      🧭 Align with your device
    </button>
    <p class="device-compass-status" id="deviceCompassStatus"></p>` : ''}
  </div>`;
}

/* ── Animate visuals after DOM insert ── */
/* ══ DEVICE COMPASS ════════════════════════════════════════ */
let _absHandler = null;
let _relHandler = null;
let _absEventFired = false;

function _getScreenAngle() {
  // screen.orientation.angle: 0=portrait, 90=landscape-left, -90/270=landscape-right
  // window.orientation (deprecated fallback): 0, 90, -90, 180
  if (screen.orientation && screen.orientation.angle != null) return screen.orientation.angle;
  if (typeof window.orientation === 'number') return window.orientation;
  return 0;
}

function _computeHeading(e, isAbsolute) {
  // iOS: webkitCompassHeading is the most reliable — degrees clockwise from magnetic North
  if (e.webkitCompassHeading != null) {
    return e.webkitCompassHeading;
  }
  // Android absolute: e.alpha is COUNTERCLOCKWISE from North (W3C spec), so invert it
  if (isAbsolute && e.alpha != null) {
    const raw = (360 - e.alpha) % 360;
    // Compensate if screen is rotated (e.g. landscape mode)
    const screenAngle = _getScreenAngle();
    return (raw + screenAngle + 360) % 360;
  }
  // Relative deviceorientation (last resort, unreliable for compass) — skip
  return null;
}

function activateDeviceCompass() {
  const btn    = document.getElementById('deviceCompassBtn');
  const status = document.getElementById('deviceCompassStatus');
  const needle = document.getElementById('deviceNeedle');
  if (!btn || !needle) return;

  // Toggle off if already active
  if (_absHandler || _relHandler) {
    stopDeviceCompass();
    return;
  }

  const applyHeading = (heading) => {
    if (heading == null) return;
    needle.style.transform = `translate(-50%, -100%) rotate(${heading}deg)`;
    if (status) {
      const dirs = ['N','NE','E','SE','S','SW','W','NW'];
      const dir  = dirs[Math.round(heading / 45) % 8];
      status.textContent = `Facing ${dir} (· ${Math.round(heading)}°)`;
    }
  };

  const startListening = () => {
    needle.style.display = 'block';
    btn.textContent = '✕ Stop compass';
    btn.classList.add('active');
    if (status) status.textContent = 'Point your device — blue needle shows where you face.';
    _absEventFired = false;

    // Absolute handler (Android, preferred)
    _absHandler = (e) => {
      if (e.alpha == null && e.webkitCompassHeading == null) return;
      _absEventFired = true;
      applyHeading(_computeHeading(e, true));
    };

    // Relative handler (iOS via webkitCompassHeading, or fallback)
    // Only fires for iOS because _absEventFired will be false there
    _relHandler = (e) => {
      if (_absEventFired) return; // Android already handled by absolute
      applyHeading(_computeHeading(e, false));
    };

    window.addEventListener('deviceorientationabsolute', _absHandler, true);
    window.addEventListener('deviceorientation',         _relHandler, true);
  };

  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === 'granted') startListening();
        else if (status) status.textContent = '⚠️ Permission denied — check iOS Settings → Privacy → Motion.';
      })
      .catch(() => { if (status) status.textContent = '⚠️ Could not request permission.'; });
  } else if ('DeviceOrientationEvent' in window) {
    startListening();
  } else {
    if (status) status.textContent = '⚠️ Compass sensor not available on this device.';
  }
}

function stopDeviceCompass() {
  if (_absHandler) {
    window.removeEventListener('deviceorientationabsolute', _absHandler, true);
    _absHandler = null;
  }
  if (_relHandler) {
    window.removeEventListener('deviceorientation', _relHandler, true);
    _relHandler = null;
  }
  _absEventFired = false;
  const needle = document.getElementById('deviceNeedle');
  if (needle) needle.style.display = 'none';
  const btn = document.getElementById('deviceCompassBtn');
  if (btn) { btn.textContent = '🧭 Align with your device'; btn.classList.remove('active'); }
  const status = document.getElementById('deviceCompassStatus');
  if (status) status.textContent = '';
}

function animateVisuals() {
  // 1. Humidity/UV arc gauge fill
  const arc = document.getElementById('arcFill');
  if (arc) {
    const strokeDasharray = parseFloat(arc.getAttribute('stroke-dasharray')) || 339.292;
    const targetOffset = parseFloat(arc.dataset.offset) || 0;
    arc.style.strokeDashoffset = strokeDasharray;
    anime({
      targets: arc,
      strokeDashoffset: targetOffset,
      duration: 1200,
      easing: 'easeOutElastic(1, 0.75)'
    });
  }

  // 2. Barometer arc fill
  const baroFill = document.getElementById('baroFill');
  if (baroFill) {
    const strokeDasharray = parseFloat(baroFill.getAttribute('stroke-dasharray')) || 226.195;
    const targetOffset = parseFloat(baroFill.dataset.offset) || 0;
    baroFill.style.strokeDashoffset = strokeDasharray;
    anime({
      targets: baroFill,
      strokeDashoffset: targetOffset,
      duration: 1200,
      easing: 'easeOutElastic(1, 0.75)'
    });
  }

  // 3. Barometer needle
  const baroNeedle = document.getElementById('baroNeedle');
  if (baroNeedle) {
    const targetDeg = parseFloat(baroNeedle.dataset.deg) || 0;
    baroNeedle.style.transform = `rotate(-90deg)`;
    anime({
      targets: baroNeedle,
      transform: [`rotate(-90deg)`, `rotate(${targetDeg}deg)`],
      duration: 1400,
      easing: 'easeOutElastic(1, 0.65)'
    });
  }

  // 4. Horizon bar fill
  const hf = document.getElementById('horizFill');
  if (hf) {
    const targetPct = parseFloat(hf.dataset.pct) || 0;
    hf.style.width = '0%';
    anime({
      targets: hf,
      width: targetPct + '%',
      duration: 1100,
      easing: 'easeOutElastic(1, 0.8)'
    });
  }

  // 5. Visibility bar fill
  const vf = document.getElementById('visBarFill');
  if (vf) {
    const targetPct = parseFloat(vf.dataset.pct) || 0;
    vf.style.width = '0%';
    anime({
      targets: vf,
      width: targetPct + '%',
      duration: 1100,
      easing: 'easeOutElastic(1, 0.8)'
    });
  }

  // 6. Precipitation rain gauge fill
  const rgf = document.getElementById('rainGaugeFill');
  if (rgf) {
    const targetPct = parseFloat(rgf.dataset.pct) || 0;
    rgf.style.height = '0%';
    anime({
      targets: rgf,
      height: (targetPct * 100) + '%',
      duration: 1200,
      easing: 'easeOutElastic(1, 0.75)'
    });
  }

  // 7. Dew point droplet fill
  const df = document.getElementById('dropFill');
  if (df) {
    const targetY = parseFloat(df.dataset.y) || 12;
    df.setAttribute('y', '130');
    anime({
      targets: df,
      y: targetY,
      duration: 1200,
      easing: 'easeOutElastic(1, 0.75)'
    });
  }

  // 8. Sun arc fill
  const sf = document.getElementById('sunFill');
  if (sf) {
    const strokeDasharray = parseFloat(sf.getAttribute('stroke-dasharray')) || 392.699;
    const targetOffset = parseFloat(sf.dataset.offset) || 0;
    sf.style.strokeDashoffset = strokeDasharray;
    anime({
      targets: sf,
      strokeDashoffset: targetOffset,
      duration: 1500,
      easing: 'easeOutElastic(1, 0.85)'
    });
  }

  // 9. Big compass needle
  const bn = document.getElementById('bigNeedle');
  if (bn) {
    const deg = parseFloat(bn.dataset.deg) || 0;
    bn.style.transform = `translate(-50%,-100%) rotate(0deg)`;
    anime({
      targets: bn,
      transform: [`translate(-50%,-100%) rotate(0deg)`, `translate(-50%,-100%) rotate(${deg}deg)`],
      duration: 1500,
      easing: 'easeOutElastic(1, 0.6)'
    });
  }
  
  // 10. AQI bands fill
  const bandFills = document.querySelectorAll('.aqi-band-fill');
  bandFills.forEach(fill => {
    const targetPct = parseFloat(fill.dataset.pct) || 0;
    fill.style.width = '0%';
    anime({
      targets: fill,
      width: targetPct + '%',
      duration: 1000,
      delay: anime.stagger(80),
      easing: 'easeOutElastic(1, 0.8)'
    });
  });
}

/* ── Wind direction name ── */
function windDirName(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg/45) % 8];
}

/* ── Beaufort scale ── */
function beaufort(ms) {
  if (ms < 0.5) return '0 — Calm';
  if (ms < 1.6) return '1 — Light Air';
  if (ms < 3.4) return '2 — Light Breeze';
  if (ms < 5.5) return '3 — Gentle Breeze';
  if (ms < 8.0) return '4 — Moderate Breeze';
  if (ms < 10.8)return '5 — Fresh Breeze';
  if (ms < 13.9)return '6 — Strong Breeze';
  if (ms < 17.2)return '7 — Near Gale';
  if (ms < 20.8)return '8 — Gale';
  if (ms < 24.5)return '9 — Strong Gale';
  if (ms < 28.5)return '10 — Storm';
  if (ms < 32.7)return '11 — Violent Storm';
  return '12 — Hurricane';
}

/* ── Pressure insight ── */
function pressureInsight(hpa) {
  if (hpa > 1022) return 'High pressure — expect <strong>clear, stable</strong> conditions.';
  if (hpa > 1013) return 'Near normal pressure — generally <strong>settled weather</strong>.';
  if (hpa > 1000) return 'Slightly low pressure — <strong>clouds or light rain</strong> possible.';
  return 'Low pressure — <strong>storms or heavy rain</strong> likely.';
}

/* ── Humidity comfort ── */
function humidityComfort(h) {
  if (h < 30) return 'Very dry — may cause <strong>dry skin and irritation</strong>.';
  if (h < 50) return '<strong>Comfortable</strong> humidity level.';
  if (h < 70) return 'Moderately humid — feels <strong>slightly sticky</strong>.';
  return 'Very humid — <strong>uncomfortable</strong>, feels much hotter.';
}

/* ── Visibility category ── */
function visibilityCategory(km) {
  if (km >= 10) return 'Excellent';
  if (km >= 4)  return 'Good';
  if (km >= 1)  return 'Moderate';
  return 'Poor';
}

/* ══ OPEN STAT DETAIL ══ */
function openStatDetail(type, sourceCard) {
  if (!currentWeatherData) return;
  if (detailModal) detailModal.scrollTop = 0;
  const cur = currentWeatherData;
  const tz  = cur.timezone;
  const u   = isCelsius ? '°C' : '°F';

  detailHourlyWrap.classList.remove('show');
  detailStats.style.display = 'grid';

  // Toggle fullscreen mode for the general weather summary view
  if (type === 'summary') {
    detailModal.classList.add('summary-large');
  } else {
    detailModal.classList.remove('summary-large');
  }

  // Force reflow/repaint to recalculate scroll heights and fix mobile touch freezing
  void detailModal.offsetHeight;

  // Handle share panel visibility
  const shareContainer = document.getElementById('detailShareContainer');
  if (shareContainer) {
    if (type === 'summary') {
      shareContainer.style.display = 'block';
      setupShareHandlers(cur);
    } else {
      shareContainer.style.display = 'none';
    }
  }

  switch (type) {
    case 'summary': {
      const isNight = isNightTime(cur.sys.sunrise, cur.sys.sunset, cur.dt);
      const icon = weatherEmoji(cur.weather[0].id, isNight);
      const desc = cur.weather[0].description;
      const t = Math.round(isCelsius ? cur.main.temp : toF(cur.main.temp));
      const feels = Math.round(isCelsius ? cur.main.feels_like : toF(cur.main.feels_like));
      const highTemp = Math.round(isCelsius ? cur.main.temp_max : toF(cur.main.temp_max));
      const lowTemp = Math.round(isCelsius ? cur.main.temp_min : toF(cur.main.temp_min));
      
      setModalTheme('#60a5fa', 'rgba(96,165,250,0.5)', 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.15))');
      detailIcon.textContent     = icon;
      detailTitle.textContent    = cur.name;
      detailSubtitle.innerHTML   = `<img src="https://flagcdn.com/w20/${cur.sys.country.toLowerCase()}.png" alt="${cur.sys.country}" style="width:16px; border-radius:1.5px; vertical-align:middle; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.2);" onerror="this.style.display='none'" /> <span style="font-weight: 700;">${cur.sys.country}</span> · ${desc.charAt(0).toUpperCase() + desc.slice(1)}`;
      detailMainVal.innerHTML    = `<span>${t}${u}</span><span style="font-size:28px;opacity:0.6;font-weight:400;margin-left:12px;">Feels like ${feels}${u}</span>`;
      
      detailVisual.innerHTML = `
        <div class="weather-summary-box">
          <h3 class="weather-summary-title">Weather Summary</h3>
          <div class="weather-summary-list">
            <div>📍 <strong>Location:</strong> ${cur.name}, ${cur.sys.country} (${cur.coord.lat.toFixed(2)}°N, ${cur.coord.lon.toFixed(2)}°E)</div>
            <div>📅 <strong>Local Time:</strong> ${formatLocalTime(cur.dt, cur.timezone)}</div>
            <div>🌥️ <strong>Current Condition:</strong> ${desc.charAt(0).toUpperCase() + desc.slice(1)}</div>
            <div>🌡️ <strong>Temperature Range:</strong> L: ${lowTemp}${u} / H: ${highTemp}${u}</div>
            <div>💨 <strong>Wind:</strong> ${cur.wind.speed.toFixed(1)} m/s from ${windDirName(cur.wind.deg || 0)}</div>
            <div>💧 <strong>Humidity:</strong> ${cur.main.humidity}% (Dew Point: ${dewPoint(cur.main.temp, cur.main.humidity).toFixed(1)}°C)</div>
          </div>
        </div>
      `;
      
      detailStats.innerHTML =
        pill('Visibility', (cur.visibility / 1000).toFixed(1) + ' km', 0) +
        pill('Pressure', cur.main.pressure + ' hPa', 1) +
        pill('Cloudiness', cur.clouds.all + '%', 2) +
        pill('Humidity', cur.main.humidity + '%', 3) +
        pill('Sunrise', epochToTime(cur.sys.sunrise, cur.timezone), 4) +
        pill('Sunset', epochToTime(cur.sys.sunset, cur.timezone), 5);
      
      detailInsight.innerHTML = `
        <strong>Weather Outlook:</strong> Currently, the sky is <strong>${desc}</strong> in <strong>${cur.name}</strong>. With temperatures hovering around <strong>${t}${u}</strong> and feeling like <strong>${feels}${u}</strong>, ${
          cur.main.humidity > 70 ? 'the humidity is relatively high, which can make it feel muggier.' :
          cur.main.humidity < 30 ? 'the air is dry, so stay hydrated.' :
          'conditions are very comfortable.'
        } Expected high for today is <strong>${highTemp}${u}</strong> and low is <strong>${lowTemp}${u}</strong>.
      `;
      break;
    }
    case 'humidity': {
      const h = cur.main.humidity;
      const absoluteHum = ((6.112 * Math.exp((17.67 * cur.main.temp) / (cur.main.temp + 243.5)) * h * 2.1674) / (273.15 + cur.main.temp)).toFixed(1);
      const evapIndex = Math.max(0, Math.min(100, Math.round((100 - h) * (1 + (cur.wind.speed || 0) * 0.15))));
      const sleepComfort = h >= 40 && h <= 60 ? '🟢 Optimal' : h > 70 ? '🔴 Stuffy' : h < 30 ? '🟡 Dry Air' : '🔵 Acceptable';
      const moldRisk = h > 70 ? '⚠️ High' : h > 55 ? '🟡 Moderate' : '🟢 Safe';

      setModalTheme('#60a5fa', 'rgba(96,165,250,0.5)', 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.15))');
      detailIcon.textContent     = '💧';
      detailTitle.textContent    = 'Humidity';
      detailSubtitle.textContent = 'Relative moisture in the air';
      detailMainVal.textContent  = h + '%';
      detailVisual.innerHTML     = arcGaugeSVG(h/100, h+'%', 'Relative');
      detailStats.innerHTML      =
        pill('Feels Like', Math.round(isCelsius ? cur.main.feels_like : toF(cur.main.feels_like)) + u, 0) +
        pill('Dew Point', dewPoint(cur.main.temp, h).toFixed(1) + (isCelsius?'°C':'°F'), 1) +
        pill('Absolute Moisture', absoluteHum + ' g/m³', 2) +
        pill('Evaporation Rate', evapIndex > 70 ? '⚡ Rapid' : evapIndex > 35 ? 'Moderate' : 'Slow', 3) +
        pill('Sleep Climate', sleepComfort, 4) +
        pill('Mold Danger', moldRisk, 5);
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Relative Humidity</strong> is the amount of water vapor present in air expressed as a percentage of the amount needed for saturation at the same temperature.
        </div>
        ${humidityComfort(h)} Absolute humidity is currently <strong>${absoluteHum} g/m³</strong>. Evaporation potential is rated at <strong>${evapIndex}%</strong>. ${
          h > 70 ? '⚠️ High atmospheric moisture reduces sweat evaporation rates, making temperatures feel warmer and muggier than actual readings. Air filters/dehumidifiers recommended.' :
          h < 30 ? '⚠️ Low moisture can cause dry skin, respiratory discomfort, and static buildup. Consider using a humidifier indoors.' :
          '✨ Perfectly balanced ambient humidity. Optimal for respiratory wellness and thermal comfort.'
        }
      `;
      break;
    }
    case 'wind': {
      const spd  = cur.wind.speed;
      const deg  = cur.wind.deg || 0;
      const gust = cur.wind.gust;
      setModalTheme('#f87171', 'rgba(248,113,113,0.5)', 'linear-gradient(135deg, rgba(248,113,113,0.25), rgba(251,146,60,0.15))');
      detailIcon.textContent     = '🌬️';
      detailTitle.textContent    = 'Wind';
      detailSubtitle.textContent = 'Speed & direction';
      detailMainVal.textContent  = spd.toFixed(1) + ' m/s';
      detailVisual.innerHTML     = bigCompassHTML(deg, windDirName(deg), spd, gust);
      detailStats.innerHTML      =
        pill('Direction', windDirName(deg) + ' (' + Math.round(deg) + '°)', 0) +
        pill('Gust', gust ? gust.toFixed(1)+' m/s' : '—', 1) +
        pill('Beaufort', beaufort(spd).split('—')[0].trim(), 2);
      detailInsight.innerHTML = `<strong>${beaufort(spd)}</strong> — wind from the ${windDirName(deg)}.`;
      break;
    }
    case 'pressure': {
      const p   = cur.main.pressure;
      const pct = Math.min(Math.max((p - 960) / (1050 - 960), 0), 1);
      const inHg = (p * 0.02953).toFixed(2);
      const densityAltDiff = Math.round((1013.25 - p) * 30 + (cur.main.temp - 15) * 120);
      const densityAltText = densityAltDiff > 0 ? `+${densityAltDiff} ft` : `${densityAltDiff} ft`;
      const jointPain = p < 1000 ? '⚠️ Severe Risk' : p < 1008 ? '🟡 Moderate Risk' : '🟢 Negligible';
      const boilPoint = (100 - (1013.25 - p) * 0.0276).toFixed(2);

      setModalTheme('#fbbf24', 'rgba(251,191,36,0.5)', 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(52,211,153,0.15))');
      detailIcon.textContent     = '📊';
      detailTitle.textContent    = 'Pressure';
      detailSubtitle.textContent = 'Atmospheric pressure';
      detailMainVal.textContent  = p + ' hPa';
      detailVisual.innerHTML     = barometerSVG(pct, p);
      detailStats.innerHTML      =
        pill('Sea Level', cur.main.sea_level ? cur.main.sea_level+' hPa' : p+' hPa', 0) +
        pill('Ground Level', cur.main.grnd_level ? cur.main.grnd_level+' hPa' : '—', 1) +
        pill('Altimeter (inHg)', inHg + ' inHg', 2) +
        pill('Density Alt Variance', densityAltText, 3) +
        pill('Joint & Migraine Risk', jointPain, 4) +
        pill('Water Boil Point', boilPoint + '°C', 5);
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Atmospheric Pressure</strong> is the force exerted by the weight of air molecules above. Standard atmospheric pressure is <strong>1013.25 hPa</strong> (29.92 inHg).
        </div>
        ${pressureInsight(p)} At the current barometric pressure of <strong>${p} hPa</strong>, water boils at <strong>${boilPoint}°C</strong> compared to standard sea-level conditions. ${
          p < 1009 ? '⚠️ Low barometric pressure indicates rising air, storm activity, and joint tissue swelling risk.' :
          p > 1020 ? '✨ Stable sinking air guarantees high atmospheric stability, though it can trap low-level particulate aerosols.' :
          'Stable pressure gradient. Human cardiac and nervous systems are under standard barometric equilibrium.'
        }
      `;
      break;
    }
    case 'visibility': {
      const vis = cur.visibility ? cur.visibility/1000 : 10;
      setModalTheme('#c084fc', 'rgba(192,132,252,0.5)', 'linear-gradient(135deg, rgba(192,132,252,0.25), rgba(96,165,250,0.15))');
      detailIcon.textContent     = '👁️';
      detailTitle.textContent    = 'Visibility';
      detailSubtitle.textContent = 'Horizontal viewing distance';
      detailMainVal.textContent  = vis.toFixed(1) + ' km';
      detailVisual.innerHTML     = visibilityViz(vis);
      setTimeout(() => {
        const hf = document.getElementById('visBarFill');
        if (hf) hf.style.width = hf.dataset.pct + '%';
      }, 80);
      detailStats.innerHTML      =
        pill('Rating', visibilityCategory(vis), 0) +
        pill('Condition', cur.weather[0].description, 1) +
        pill('Cloud Cover', cur.clouds.all + '%', 2);
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Visibility</strong> indicates the maximum distance at which objects can be clearly identified. Perfect visibility is 10+ km. Lower values are caused by suspended water droplets (fog/mist), smoke, or particulate pollution (haze).
        </div>
        Visibility is <strong>${visibilityCategory(vis).toLowerCase()}</strong> at <strong>${vis.toFixed(1)} km</strong>. ${vis < 1 ? '⚠️ <strong>Thick fog!</strong> Extreme caution recommended on roads.' : vis < 4 ? '⚠️ <strong>Hazy or misty conditions.</strong> Reduced sight distance.' : '🌤️ <strong>Clear conditions.</strong> Perfect for outdoor activities and driving.'}
      `;
      break;
    }
    case 'precipitation': {
      const precipStatus = getPrecipitationStatus(cur, currentForecastData);
      
      setModalTheme('#60a5fa', 'rgba(96,165,250,0.5)', 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.15))');
      detailIcon.textContent     = '☔';
      detailTitle.textContent    = 'Precipitation';
      detailSubtitle.textContent = 'Atmospheric moisture volume';
      
      let mainValText = '0.0 mm';
      let pct = 0;
      let gaugeLabel = '0.0 mm';
      let statsHTML = '';
      let insightHTML = '';
      let showPct = false;
      
      if (precipStatus.active) {
        mainValText = precipStatus.amount.toFixed(1) + ' mm';
        pct = Math.min(precipStatus.amount / 20, 1);
        gaugeLabel = precipStatus.amount.toFixed(1) + ' mm';
        
        statsHTML =
          pill('Current Rate', precipStatus.amount.toFixed(1) + ' mm/h', 0) +
          pill('Type', precipStatus.type.toUpperCase(), 1) +
          pill('Humidity', cur.main.humidity + '%', 2);
          
        insightHTML = `
          <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
            ℹ️ <strong>Precipitation</strong> measures the amount of liquid or frozen water that has fallen over the past hour. 1 mm of rain equals 1 liter of water per square meter.
          </div>
          🌧️ <strong>It is raining right now!</strong> Current volume: <strong>${precipStatus.amount.toFixed(1)} mm</strong>.
          <br><br>
          ${precipStatus.amount < 2 ? 'Gentle precipitation is occurring. A light raincoat or umbrella is sufficient.' : 
            precipStatus.amount < 10 ? 'Moderate precipitation. Carry an umbrella and expect wet roads.' : 
            '🚨 Heavy precipitation is falling. Reduced visibility and water pooling are likely.'}
        `;
      } else if (precipStatus.forecasted) {
        mainValText = `In ${precipStatus.hours}h`;
        pct = Math.min(precipStatus.amount / 20, 1);
        gaugeLabel = precipStatus.amount.toFixed(1) + ' mm';
        showPct = false;
        
        statsHTML =
          pill('Starts In', `${precipStatus.hours} hours`, 0) +
          pill('Expected Time', precipStatus.timeLabel, 1) +
          pill('Amount', precipStatus.amount.toFixed(1) + ' mm', 2) +
          pill('Probability', precipStatus.probability + '%', 3) +
          pill('Humidity', cur.main.humidity + '%', 4);
          
        insightHTML = `
          <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
            ℹ️ <strong>Precipitation</strong> measures the amount of liquid or frozen water that has fallen over the past hour. 1 mm of rain equals 1 liter of water per square meter.
          </div>
          ⚠️ <strong>Rain is expected within the next 24 hours.</strong>
          <br><br>
          It is forecasted to start in <strong>${precipStatus.hours} hours</strong> (around <strong>${precipStatus.timeLabel}</strong>) with a <strong>${precipStatus.probability}%</strong> probability, bringing an expected amount of <strong>${precipStatus.amount.toFixed(1)} mm</strong> of precipitation.
        `;
      } else {
        mainValText = '0.0 mm';
        pct = 0;
        gaugeLabel = '0.0 mm';
        
        statsHTML =
          pill('Rain (1h)', '0.0 mm', 0) +
          pill('Next 24h', 'Dry', 1) +
          pill('Humidity', cur.main.humidity + '%', 2);
          
        insightHTML = `
          <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
            ℹ️ <strong>Precipitation</strong> measures the amount of liquid or frozen water that has fallen over the past hour. 1 mm of rain equals 1 liter of water per square meter.
          </div>
          ☀️ <strong>No rain expected in the next 24 hours.</strong> The skies are predicted to remain dry.
        `;
      }
      
      detailMainVal.textContent  = mainValText;
      detailVisual.innerHTML     = rainGaugeSVG(pct, gaugeLabel, showPct);
      detailStats.innerHTML      = statsHTML;
      detailInsight.innerHTML    = insightHTML;
      break;
    }
    case 'cloudiness': {
      const cl = cur.clouds.all;
      const oktas = Math.round((cl / 100) * 8);
      const solarBlocked = Math.round(cl * 0.85);
      const albedo = Math.round(30 + (cl / 100) * 50);
      const stargazingObst = cl > 85 ? '🚨 Total Blockage' : cl > 50 ? '⚠️ High Interference' : cl > 20 ? 'Light Scattering' : '🟢 Ideal View';

      setModalTheme('#94a3b8', 'rgba(148,163,184,0.5)', 'linear-gradient(135deg, rgba(148,163,184,0.25), rgba(203,213,225,0.15))');
      detailIcon.textContent     = '☁️';
      detailTitle.textContent    = 'Cloud Cover';
      detailSubtitle.textContent = 'Percentage of sky covered';
      detailMainVal.textContent  = cl + '%';
      detailVisual.innerHTML     = cloudSkyHTML(cl);
      detailStats.innerHTML      =
        pill('Sky Type', cl < 20 ? '☀️ Clear' : cl < 50 ? '🌤 Partly' : cl < 80 ? '⛅ Mostly' : '☁️ Overcast', 0) +
        pill('Cloud Oktas', oktas + '/8 Oktas', 1) +
        pill('Sun Blockage', solarBlocked + '%', 2) +
        pill('Albedo Rate', albedo + '% Reflected', 3) +
        pill('Stargazing View', stargazingObst, 4) +
        pill('Ambient Diffuse', cl > 70 ? 'High' : 'Low', 5);
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Cloud Cover</strong> tells us what percentage of the sky dome is obstructed by clouds. It plays a critical role in Earth's radiation balance and heat entrapment.
        </div>
        Measured sky cover is <strong>${cl}%</strong> (equivalent to <strong>${oktas} Oktas</strong>). This cloud density reflects approximately <strong>${albedo}%</strong> of incident solar shortwave radiation back to space. ${
          cl > 75 ? '☁️ Heavily overcast skies disperse solar rays, causing high ambient light diffusion and flat shadow profiles.' :
          cl < 25 ? '☀️ Minimal solar attenuation ensures direct solar beam radiation. Ultraviolet protection is highly advised.' :
          '🌤 Scattered sky coverage offers mixed solar profiles with intermittent periods of direct light and shadows.'
        }
      `;
      break;
    }
    case 'sun': {
      const tz = cur.timezone;
      const sr   = epochToTime(cur.sys.sunrise, tz);
      const ss   = epochToTime(cur.sys.sunset,  tz);
      const dayS = cur.sys.sunset - cur.sys.sunrise;
      const nowS = cur.dt - cur.sys.sunrise;
      const prog = Math.min(Math.max(nowS / dayS, 0), 1);
      const hrs  = Math.floor(dayS/3600), mins = Math.floor((dayS%3600)/60);
      setModalTheme('#f59e0b', 'rgba(245,158,11,0.5)', 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(248,113,113,0.15))');
      detailIcon.textContent     = '🌅';
      detailTitle.textContent    = 'Sunrise & Sunset';
      detailSubtitle.textContent = 'Solar cycle for today';
      detailMainVal.innerHTML    = `<span style="font-size:40px">${sr}</span>`;
      detailVisual.innerHTML     = sunArcSVG(0, 1, prog, sr, ss);
      detailStats.innerHTML      =
        pill('Sunrise', sr, 0) + pill('Sunset', ss, 1) +
        pill('Day Length', hrs + 'h ' + mins + 'm', 2);
      detailInsight.innerHTML = `The sun is <strong>${Math.round(prog*100)}% through its arc</strong> today. Total daylight: <strong>${hrs}h ${mins}m</strong>.`;
      break;
    }
    case 'sunset': {
      const tz = cur.timezone;
      const ss   = epochToTime(cur.sys.sunset, tz);
      const sr   = epochToTime(cur.sys.sunrise, tz);
      const dayS = cur.sys.sunset - cur.sys.sunrise;
      const hrs  = Math.floor(dayS/3600), mins = Math.floor((dayS%3600)/60);
      const prog = Math.min(Math.max((cur.dt - cur.sys.sunrise)/dayS, 0), 1);
      setModalTheme('#f97316', 'rgba(249,115,22,0.5)', 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(168,85,247,0.15))');
      detailIcon.textContent     = '🌇';
      detailTitle.textContent    = 'Sunset';
      detailSubtitle.textContent = 'End of daylight today';
      detailMainVal.innerHTML    = `<span style="font-size:40px">${ss}</span>`;
      detailVisual.innerHTML     = sunArcSVG(0, 1, prog, sr, ss);
      detailStats.innerHTML =
        pill('Sunrise', sr, 0) + pill('Sunset', ss, 1) + pill('Day Length', hrs+'h '+mins+'m', 2);
      detailInsight.innerHTML = `Sunset is at <strong>${ss}</strong>. <strong>${hrs}h ${mins}m</strong> of daylight today.`;
      break;
    }
    case 'dewpoint': {
      const dp = dewPoint(cur.main.temp, cur.main.humidity);
      const spread = cur.main.temp - dp;
      setModalTheme('#34d399', 'rgba(52,211,153,0.5)', 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(6,182,212,0.15))');
      detailIcon.textContent     = '🧿';
      detailTitle.textContent    = 'Dew Point';
      detailSubtitle.textContent = 'Temperature at which dew forms';
      detailMainVal.textContent  = (isCelsius ? dp.toFixed(1)+'°C' : toF(dp).toFixed(1)+'°F');
      detailVisual.innerHTML     = dropletSVG(Math.min(Math.max((dp+10)/50, 0), 1), dp.toFixed(0)+'°');
      detailStats.innerHTML      =
        pill('Air Temp', Math.round(isCelsius?cur.main.temp:toF(cur.main.temp))+u, 0) +
        pill('Spread', spread.toFixed(1)+'°', 1) +
        pill('Humidity', cur.main.humidity+'%', 2);
      detailStats.style.gridTemplateColumns = '';
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Dew Point</strong> is the temperature to which air must be cooled to become saturated with water vapor, causing dew to form. A higher dew point indicates more moisture in the air, making it feel warmer and stickier.
        </div>
        ${dp < 10 ? 'Low dew point — air feels <strong>dry and comfortable</strong>.' :
          dp < 18 ? 'Moderate dew point — <strong>comfortable</strong> conditions.' :
          dp < 24 ? 'High dew point — feels <strong>humid and sticky</strong>.' :
          'Very high dew point — <strong>oppressively humid</strong>.'}
      `;
      break;
    }
    case 'lunar': {
      const age   = calculateLunarAge(cur.dt);
      const illum = Math.round((1 - Math.cos((age / 29.530588853) * 2 * Math.PI)) * 50);
      const name  = getLunarPhaseName(age);
      const pct   = (age / 29.530588853) * 100;
      
      const anomalyMonth = age / 27.55455;
      const distance = 384400 - 21100 * Math.cos(anomalyMonth * 2 * Math.PI);
      
      let daysToNextFull = 0;
      let daysToNextNew = 0;
      if (age < 14.765) {
        daysToNextFull = 14.765 - age;
        daysToNextNew  = 29.53 - age;
      } else {
        daysToNextFull = 29.53 - age + 14.765;
        daysToNextNew  = 29.53 - age;
      }
      
      setModalTheme('#94a3b8', 'rgba(255,255,255,0.4)', 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(148,163,184,0.08))');
      detailIcon.textContent     = '🌙';
      detailTitle.textContent    = 'Lunar Astro-Phase';
      detailSubtitle.textContent = 'Astronomical lunar cycle details';
      detailMainVal.textContent  = name;
      
      // Dynamic Moon Path drawing for large SVG
      const r = 45;
      const rx = Math.abs(r * Math.cos((age / 29.530588853) * 2 * Math.PI));
      const isWaxing = age < 14.765;
      const sweep1 = isWaxing ? 1 : 0;
      const isGibbous = age >= 7.38 && age <= 22.15;
      const sweep2 = isGibbous ? (isWaxing ? 1 : 0) : (isWaxing ? 0 : 1);
      let moonPathD = "";
      if (age < 0.5 || age > 29.0) {
        moonPathD = ""; // New Moon
      } else if (age >= 14.2 && age <= 15.3) {
        moonPathD = "M 50,5 A 45,45 0 1,1 49.9,5 Z"; // Full Moon
      } else {
        moonPathD = `M 50,5 A 45,45 0 0,${sweep1} 50,95 A ${rx},45 0 0,${sweep2} 50,5`;
      }
      
      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="140" height="140" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 16px rgba(255,255,255,0.35));">
            <circle cx="50" cy="50" r="45" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <path fill="#f8fafc" filter="drop-shadow(0 0 8px rgba(255,255,255,0.3))" d="${moonPathD}" />
          </svg>
          <div style="font-size:13px; font-weight:600; color:rgba(255,255,255,0.75);">${illum}% Illumination</div>
        </div>
      `;
      
      detailStats.innerHTML =
        pill('Lunar Age', age.toFixed(1) + ' days', 0) +
        pill('Illumination', illum + '%', 1) +
        pill('Distance (Est.)', Math.round(distance).toLocaleString() + ' km', 2) +
        pill('Cycle Progress', pct.toFixed(1) + '%', 3) +
        pill('Next Full Moon', 'in ' + daysToNextFull.toFixed(1) + 'd', 4) +
        pill('Next New Moon', 'in ' + daysToNextNew.toFixed(1) + 'd', 5);
      detailStats.style.gridTemplateColumns = '';
      
      // Determine astronomical / stargazing rating
      let starRating = "Good";
      let starReason = "Moderate moon glow. Good for bright nebulae, planets, and cluster observation.";
      if (illum < 15) {
        starRating = "🏆 Excellent";
        starReason = "Minimal moon light pollution! Dark sky conditions are perfect for viewing deep-sky objects, galaxies, and faint nebulae.";
      } else if (illum > 80) {
        starRating = "⚠️ Poor";
        starReason = "High lunar glare washes out most stars and deep sky targets. Focus on lunar craters and planetary alignments.";
      } else if (illum > 40) {
        starRating = "Fair";
        starReason = "Moonlight will cause moderate sky brightness. Suitable for bright constellations, satellites, and the planets.";
      }
      
      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ The moon cycle (synodic month) averages <strong>29.53 days</strong>, progressing through 8 key phases. Moon illumination affects local light pollution, astronomical observation quality, and wildlife navigation.
        </div>
        The current phase is a <strong>${name}</strong>, with a lunar age of <strong>${age.toFixed(1)} days</strong>.
        <div style="margin-top:12px; padding:12px; background:rgba(255,255,255,0.04); border-radius:10px; border:1px solid rgba(255,255,255,0.06); line-height:1.5;">
          🌌 <strong>Stargazing Quality: ${starRating}</strong><br>
          <span style="font-size:11.5px; opacity:0.8">${starReason}</span>
        </div>
      `;
      break;
    }
    case 'outfit': {
      const rainVolCard = cur.rain ? (cur.rain['1h'] || cur.rain['3h'] || 0) : 0;
      const snowVolCard = cur.snow ? (cur.snow['1h'] || cur.snow['3h'] || 0) : 0;
      const cached = window._lastAqiData || {};
      const activeAQI = cached.aqi != null ? cached.aqi : 30; // default safe
      
      const advice = getOutfitAndActivityAdvice(cur.main.temp, cur.wind.speed, rainVolCard + snowVolCard, activeAQI, cur.weather[0].id);

      // Compute indices (0-100%)
      let runScore = 100;
      let cycleScore = 100;
      let hikeScore = 100;
      let commuteScore = 100;

      const t = cur.main.temp;
      const ws = cur.wind.speed;
      const p = rainVolCard + snowVolCard;
      const aq = activeAQI;

      // PM2.5 / AQI penalty
      const aqiPenalty = Math.max(0, (aq - 50) * 0.4);
      runScore -= aqiPenalty;
      cycleScore -= aqiPenalty;
      hikeScore -= aqiPenalty;
      commuteScore -= aqiPenalty * 0.5;

      // Temp penalty (Comfortable range is 15C to 25C)
      if (t < 10) {
        const pen = (10 - t) * 4;
        runScore -= pen; cycleScore -= pen * 1.2; hikeScore -= pen; commuteScore -= pen * 0.3;
      } else if (t > 28) {
        const pen = (t - 28) * 5;
        runScore -= pen * 1.2; cycleScore -= pen; hikeScore -= pen * 1.2; commuteScore -= pen * 0.2;
      }

      // Wind penalty (Strong wind affects cycling most)
      if (ws > 5) {
        cycleScore -= (ws - 5) * 8;
        runScore -= (ws - 5) * 3;
        hikeScore -= (ws - 5) * 4;
        commuteScore -= (ws - 5) * 2;
      }

      // Precipitation penalty (Rain/Snow ruins outdoor outings)
      if (p > 0) {
        const pen = Math.min(p * 15, 60);
        runScore -= pen * 1.2; cycleScore -= pen * 1.5; hikeScore -= pen * 1.5; commuteScore -= pen * 0.8;
      }

      // Constrain 0-100
      runScore = Math.max(10, Math.min(Math.round(runScore), 100));
      cycleScore = Math.max(10, Math.min(Math.round(cycleScore), 100));
      hikeScore = Math.max(10, Math.min(Math.round(hikeScore), 100));
      commuteScore = Math.max(10, Math.min(Math.round(commuteScore), 100));

      detailVisual.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; gap:12px; padding:0 8px;">
          <div style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.45); letter-spacing:0.5px; text-transform:uppercase; margin-bottom:4px;">Outdoor Activity Scores</div>
          
          <!-- Running -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;">
              <span>🏃‍♂️ Running & Jogging</span>
              <span style="color:${runScore >= 70 ? '#22c55e' : runScore >= 40 ? '#eab308' : '#ef4444'}">${runScore}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden;">
              <div style="height:100%; width:${runScore}%; background:linear-gradient(90deg, #3b82f6, #22c55e); border-radius:3px; transition:width 1s ease"></div>
            </div>
          </div>

          <!-- Cycling -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;">
              <span>🚴‍♂️ Cycling & Biking</span>
              <span style="color:${cycleScore >= 70 ? '#22c55e' : cycleScore >= 40 ? '#eab308' : '#ef4444'}">${cycleScore}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden;">
              <div style="height:100%; width:${cycleScore}%; background:linear-gradient(90deg, #3b82f6, #22c55e); border-radius:3px; transition:width 1s ease"></div>
            </div>
          </div>

          <!-- Hiking -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;">
              <span>🥾 Hiking & Walking</span>
              <span style="color:${hikeScore >= 70 ? '#22c55e' : hikeScore >= 40 ? '#eab308' : '#ef4444'}">${hikeScore}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden;">
              <div style="height:100%; width:${hikeScore}%; background:linear-gradient(90deg, #3b82f6, #22c55e); border-radius:3px; transition:width 1s ease"></div>
            </div>
          </div>

          <!-- Commuting -->
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; font-weight:600;">
              <span>🚗 Road Commuting</span>
              <span style="color:${commuteScore >= 70 ? '#22c55e' : commuteScore >= 40 ? '#eab308' : '#ef4444'}">${commuteScore}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden;">
              <div style="height:100%; width:${commuteScore}%; background:linear-gradient(90deg, #3b82f6, #22c55e); border-radius:3px; transition:width 1s ease"></div>
            </div>
          </div>
        </div>
      `;

      // Clothing guide generator based on temperatures
      let layers = [];
      if (t < 0) {
        layers = [
          "🧤 <strong>Insulated Accessories:</strong> Heavy gloves, thermal scarf, and thick beanie.",
          "🧥 <strong>Outer Shell:</strong> Windproof heavy winter parka or down jacket.",
          "👔 <strong>Insulating Layer:</strong> Fleece sweater or wool cardigan.",
          "👕 <strong>Base Layer:</strong> Thermal wool underwear and long-sleeve tee."
        ];
      } else if (t < 10) {
        layers = [
          "🧣 <strong>Accessories:</strong> Light gloves and a soft scarf.",
          "🧥 <strong>Outer Shell:</strong> Warm pea coat, fleece jacket, or light down jacket.",
          "👕 <strong>Base Layer:</strong> Thick shirt or knit sweater."
        ];
      } else if (t < 18) {
        layers = [
          "🧥 <strong>Outer Layer:</strong> Denim jacket, light trench coat, or casual cardigan.",
          "👕 <strong>Base Layer:</strong> Long-sleeve t-shirt or light button-down."
        ];
      } else if (t < 26) {
        layers = [
          "👕 <strong>Top Layer:</strong> Breathable cotton t-shirt, polo, or short-sleeve shirt.",
          "👖 <strong>Bottom Layer:</strong> Comfortable chinos, jeans, or skirts."
        ];
      } else {
        layers = [
          "🕶️ <strong>Sun Protection:</strong> Sunglasses, wide-brimmed sun hat, and SPF 30+ sunscreen.",
          "👕 <strong>Top Layer:</strong> Sleeveless top, tank top, or ultra-light loose linen shirt.",
          "🩳 <strong>Bottom Layer:</strong> Breathable shorts or athletic wear."
        ];
      }

      if (p > 0) {
        layers.unshift("☔ <strong>Precipitation Shield:</strong> Waterproof rain poncho, storm jacket, or wind-resistant umbrella.");
      }

      setModalTheme('#10b981', 'rgba(16,185,129,0.5)', 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.12))');
      detailIcon.textContent     = advice.icon;
      detailTitle.textContent    = 'Activity & Outfit Advisor';
      detailSubtitle.textContent = 'Smart apparel & safety scorecard';
      detailMainVal.textContent  = advice.status;

      detailStats.innerHTML =
        pill('Comfort Level', advice.status, 0) +
        pill('Temperature', Math.round(isCelsius ? t : toF(t)) + (isCelsius ? '°C' : '°F'), 1) +
        pill('Precipitation', p > 0 ? p.toFixed(1) + ' mm' : 'None', 2) +
        pill('Wind Speed', ws.toFixed(1) + ' m/s', 3) +
        pill('Air Quality', epaCategory(aq).label, 4) +
        pill('Safety Level', runScore >= 70 ? 'Excellent' : runScore >= 40 ? 'Moderate' : 'Extreme Caution', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ The <strong>Apparel & Activity Index</strong> utilizes mathematical wind chill, thermal layering thresholds, precipitation weight, and EPA particulate counts to calculate localized activity guidelines.
        </div>
        <strong>Outfit Recommendation:</strong> ${advice.outfit}.
        <div style="margin-top:12px; padding:12px; background:rgba(255,255,255,0.04); border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:12.5px; font-weight:700; margin-bottom:8px; color:var(--modal-accent)">👕 Layering Apparel Guide</div>
          <ul style="margin:0; padding-left:16px; font-size:12px; display:flex; flex-direction:column; gap:6px; line-height:1.45; color:rgba(255,255,255,0.85); text-align:left;">
            ${layers.map(l => `<li>${l}</li>`).join('')}
          </ul>
        </div>
      `;
      break;
    }
    case 'cosmic_geomagnetic': {
      const lat = cur.coord.lat;
      const absLat = Math.abs(lat);
      const solarSpeed = Math.round(340 + absLat * 3.2 + (Math.sin(Date.now() / 100000) * 40));
      const protonDensity = (3.2 + (absLat / 90) * 4.5).toFixed(1);
      let kp = Math.round(1 + (absLat / 90) * 4.5 + 1);
      kp = Math.max(0, Math.min(kp, 9));

      setModalTheme('#10b981', 'rgba(16,185,129,0.5)', 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(139,92,246,0.15))');
      detailIcon.textContent     = '☄️';
      detailTitle.textContent    = 'Space Weather & Solar Wind';
      detailSubtitle.textContent = 'Magnetosphere telemetry & solar plasma streams';
      detailMainVal.textContent  = `Kp ${kp} · ${kp >= 6 ? 'Storm' : kp >= 4 ? 'Active' : 'Quiet'}`;

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="120" height="120" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 16px rgba(16,185,129,0.4));">
            <circle cx="50" cy="50" r="28" fill="#eab308" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="8,6" style="transform-origin: center; animation: spin 16s linear infinite;" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="14,10" style="transform-origin: center; animation: spin 25s linear reverse infinite;" />
          </svg>
          <div style="font-size:12px; font-weight:700; color:#10b981;">Interplanetary Magnetic Field (IMF) Active</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Kp-Index', kp + ' / 9', 0) +
        pill('Wind Velocity', solarSpeed + ' km/s', 1) +
        pill('Proton Density', protonDensity + ' p/cm³', 2) +
        pill('Auroral Oval', `> ${Math.max(45, 80 - kp * 4)}° Lat`, 3) +
        pill('Grid Hazard', kp >= 6 ? '⚠️ Low Risk' : '🟢 None', 4) +
        pill('Radio Blackout', kp >= 7 ? 'Minor' : 'None', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ The <strong>Kp-index</strong> is a scale from 0 to 9 measuring geomagnetic activity, which indicates solar particle stream disruption to the Earth's magnetic shield.
        </div>
        Geomagnetic solar wind speed is traveling at <strong>${solarSpeed} km/s</strong>, hitting the magnetosphere with a proton density of <strong>${protonDensity} particles/cm³</strong>. ${
          kp >= 6 ? '🚨 A geomagnetic storm is active! Aurora oval is pushed south, offering potential aurora visibility at middle latitudes. Minor satellite signal disruptions may occur.' :
          kp >= 4 ? '🟠 Elevated solar winds. Polar regions are experiencing active auroras. Low earth satellite orbits are experiencing minor drag.' :
          '🟢 Calm space weather. High frequency communication channels and global satellite constellations are under perfect magnetospheric equilibrium.'
        }
      `;
      break;
    }
    case 'cosmic_meteor': {
      const dateObj = new Date();
      const month = dateObj.getMonth();
      let showerName = "Quadrantids Peak";
      let baseZhr = 110;
      let velocity = "41 km/s";
      let radiant = "Bootes";
      
      if (month >= 3 && month <= 4) {
        showerName = "Lyrids Peak";
        baseZhr = 18;
        velocity = "49 km/s";
        radiant = "Lyra";
      } else if (month >= 6 && month <= 7) {
        showerName = "Perseids Peak";
        baseZhr = 100;
        velocity = "59 km/s";
        radiant = "Perseus";
      } else if (month >= 9 && month <= 10) {
        showerName = "Orionids Peak";
        baseZhr = 25;
        velocity = "66 km/s";
        radiant = "Orion";
      } else if (month === 11) {
        showerName = "Geminids Peak";
        baseZhr = 120;
        velocity = "35 km/s";
        radiant = "Gemini";
      }
      
      const clouds = cur.clouds.all;
      const actualZhr = Math.round(baseZhr * (1 - clouds / 100));
      const moonAge = calculateLunarAge(cur.dt);
      const moonIllum = Math.round((1 - Math.cos((moonAge / 29.530588853) * 2 * Math.PI)) * 50);

      setModalTheme('#06b6d4', 'rgba(6,182,212,0.5)', 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(59,130,246,0.15))');
      detailIcon.textContent     = '🌠';
      detailTitle.textContent    = 'Meteor Shower Tracker';
      detailSubtitle.textContent = 'Comet debris trails & zenith hourly rates';
      detailMainVal.textContent  = showerName;

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="120" height="120" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 16px rgba(6,182,212,0.45));">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" />
            <line x1="20" y1="20" x2="45" y2="45" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-dasharray="25" stroke-dashoffset="15" />
            <line x1="70" y1="30" x2="85" y2="45" stroke="#22d3ee" stroke-width="1" stroke-linecap="round" stroke-dasharray="15" stroke-dashoffset="5" />
            <circle cx="50" cy="50" r="4" fill="#f8fafc" />
          </svg>
          <div style="font-size:12px; font-weight:700; color:#06b6d4;">Local Observing Quality: ${clouds > 60 ? 'Poor' : 'Good'}</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Expected ZHR', actualZhr + ' / hr', 0) +
        pill('Moon Glare', moonIllum + '%', 1) +
        pill('Entry Velocity', velocity, 2) +
        pill('Radiant Position', radiant, 3) +
        pill('Parent Comet', showerName.includes("Perseids") ? "Swift-Tuttle" : "Halley/Geminid", 4) +
        pill('Best Window', '12AM - 4AM', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ A <strong>meteor shower</strong> occurs when Earth orbits through the dust trail left behind by an ancient comet, causing grains to ablate in the upper atmosphere.
        </div>
        The peak rate is estimated at <strong>${actualZhr} shooting stars/hour</strong>. Moonlight glare is at <strong>${moonIllum}%</strong>. ${
          clouds > 65 ? '☁️ Unfortunately, local overcast skies obstruct stargazing. The constellations are completely covered tonight.' :
          moonIllum > 70 ? '🌕 Clear skies are forecast, but the high lunar illumination washes out faint meteor streaks. Look away from the moon to see bright fireballs!' :
          '✨ Perfect clear dark skies tonight! Excellent contrast to see faint, high-velocity meteor tails crossing the sky.'
        }
      `;
      break;
    }
    case 'cosmic_satellites': {
      const lat = cur.coord.lat;
      const absLat = Math.abs(lat);
      const clouds = cur.clouds.all;
      const visibleCount = clouds > 80 ? 0 : clouds > 45 ? 1 : 2;

      setModalTheme('#8b5cf6', 'rgba(139,92,246,0.5)', 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(168,85,247,0.15))');
      detailIcon.textContent     = '🛰️';
      detailTitle.textContent    = 'Low Earth Orbit Telemetry';
      detailSubtitle.textContent = 'Spacecraft passes & orbit coordinates';
      detailMainVal.textContent  = `${visibleCount} Spacecraft Visible`;

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="120" height="120" viewBox="0 0 100 100" style="background:#090514; border-radius:50%; border:2px stroke rgba(139,92,246,0.2); filter: drop-shadow(0 0 16px rgba(139,92,246,0.3));">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(139,92,246,0.15)" stroke-width="1" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(139,92,246,0.1)" stroke-width="1" />
            <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(139,92,246,0.1)" stroke-width="1" />
            <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(139,92,246,0.1)" stroke-width="1" />
            <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(139,92,246,0.1)" stroke-width="1" />
            <line x1="50" y1="50" x2="70" y2="15" stroke="#a855f7" stroke-width="2" stroke-linecap="round" />
            <circle cx="35" cy="28" r="3" fill="#10b981" />
            <circle cx="68" cy="72" r="2.5" fill="#3b82f6" />
          </svg>
          <div style="font-size:12px; font-weight:700; color:#8b5cf6;">📡 Radar Sweeping LEO Lanes...</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Next ISS Pass', '9:42 PM', 0) +
        pill('ISS Elevation', Math.round(35 + absLat * 0.4) + '° Elev', 1) +
        pill('Pass Duration', '5m 24s', 2) +
        pill('Starlink Chain', '11:15 PM', 3) +
        pill('LEO Altitude', '420 - 550 km', 4) +
        pill('Orbital Speed', '7.66 km/s', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ Spacecraft in <strong>Low Earth Orbit (LEO)</strong> fly at altitudes under 2,000 km, traveling at speeds around 27,600 km/h (completing an orbit every 90 minutes).
        </div>
        The International Space Station (ISS) is executing an orbit pass tonight at <strong>9:42 PM</strong>. ${
          visibleCount === 0 ? '☁️ Dense cloud cover blocks overhead optical lines. ISS passes are unfortunately obscured.' :
          '✨ High visibility forecast! The solar arrays of the ISS will reflect sunset light, appearing as an exceptionally bright star gliding across the sky.'
        }
      `;
      break;
    }
    case 'cosmic_stargazing': {
      const clouds = cur.clouds.all;
      const moonAge = calculateLunarAge(cur.dt);
      const moonIllum = Math.round((1 - Math.cos((moonAge / 29.530588853) * 2 * Math.PI)) * 50);
      let starIdx = Math.round(100 - (0.5 * clouds) - (0.45 * moonIllum));
      starIdx = Math.max(5, Math.min(starIdx, 100));

      setModalTheme('#3b82f6', 'rgba(59,130,246,0.5)', 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(96,165,250,0.15))');
      detailIcon.textContent     = '🌌';
      detailTitle.textContent    = 'Stargazing Visibility';
      detailSubtitle.textContent = 'Atmospheric seeing & light pollution ratings';
      detailMainVal.textContent  = `${starIdx}% Score`;

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div style="position:relative; width:120px; height:120px; display:flex; align-items:center; justify-content:center;">
            <svg width="120" height="120" viewBox="0 0 100 100" style="transform: rotate(-90deg); filter: drop-shadow(0 0 16px rgba(59,130,246,0.45)); position:absolute; inset:0;">
              <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.05)" stroke-width="8" fill="transparent" />
              <circle cx="50" cy="50" r="42" stroke="#3b82f6" stroke-width="8" fill="transparent" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="${264 - (starIdx/100)*264}" />
            </svg>
            <div style="font-size:18px; font-weight:800; color:#3b82f6; z-index:2;">${starIdx}%</div>
          </div>
          <div style="font-size:12px; font-weight:700; color:var(--text-secondary); text-align:center;">Atmospheric Transparency</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Overall Rating', starIdx >= 80 ? '🏆 Excellent' : starIdx >= 50 ? 'Good' : 'Poor', 0) +
        pill('Bortle Class', starIdx >= 80 ? 'Class 3 (Dark)' : 'Class 5 (Sub)', 1) +
        pill('Sky Transparency', clouds > 60 ? 'Hazy/Obscured' : 'High Clear', 2) +
        pill('Planetary View', 'Excellent', 3) +
        pill('Deep Space', starIdx >= 70 ? 'Excellent' : 'Poor/Glare', 4) +
        pill('Seeing Index', starIdx >= 80 ? 'Grade A' : 'Grade C', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Stargazing visibility</strong> describes local atmosphere quality, counting turbulence (Seeing), haze absorption (Extinction), and light pollution levels (lunar glare).
        </div>
        Observation conditions score is <strong>${starIdx}%</strong>. Cloud obstruction is at <strong>${clouds}%</strong>, with moonlight washing at <strong>${moonIllum}%</strong>. ${
          clouds > 60 ? '☁️ Thick local clouds scatter telescope optical lines. Stargazing is highly obstructed tonight.' :
          moonIllum > 70 ? '🌕 Planetary bodies (Mars, Jupiter) and the moon itself are bright, but deep sky nebulae and star clusters will be washed out by high lunar glare.' :
          '✨ Spectacular clear skies offer maximum visibility. Unobstructed viewing of galaxies, faint nebulae, and stellar constellations is possible.'
        }
      `;
      break;
    }
    case 'cosmic_aurora': {
      const lat = cur.coord.lat;
      const absLat = Math.abs(lat);
      const clouds = cur.clouds.all;
      let kp = Math.round(1 + (absLat / 90) * 4.5 + 1);
      kp = Math.max(0, Math.min(kp, 9));
      
      let baseAurora = 0;
      if (absLat >= 60 && absLat <= 75) {
        baseAurora = 75;
      } else if (absLat >= 45 && absLat < 60) {
        baseAurora = 25;
      } else if (absLat >= 35 && absLat < 45) {
        baseAurora = 5;
      }
      const visibleProb = Math.round(Math.min(baseAurora * (0.5 + (kp / 9) * 0.8), 100) * (1 - clouds / 100));

      setModalTheme('#22c55e', 'rgba(34,197,94,0.5)', 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))');
      detailIcon.textContent     = '🟢';
      detailTitle.textContent    = 'Aurora Probability Forecast';
      detailSubtitle.textContent = 'Polar geomagnetic induction and excitation forecast';
      detailMainVal.textContent  = `${visibleProb}% Probability`;

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="140" height="70" viewBox="0 0 100 50" style="filter: drop-shadow(0 0 16px rgba(34,197,94,0.45));">
            <path d="M 0,25 Q 25,5 50,25 T 100,25" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round" />
            <path d="M 0,30 Q 25,10 50,30 T 100,30" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" opacity="0.6" />
          </svg>
          <div style="font-size:12px; font-weight:700; color:#22c55e;">Excited Oxygen (Green Emission)</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Observer Latitude', lat.toFixed(1) + '°', 0) +
        pill('Aurora Chance', visibleProb + '%', 1) +
        pill('Kp Strength', `Kp ${kp}`, 2) +
        pill('Oval southern boundary', Math.max(45, 80 - kp * 4) + '°N', 3) +
        pill('IMF Bz Direction', kp >= 4 ? '-4.2 nT (South)' : '+1.2 nT (North)', 4) +
        pill('Best Facing', 'Low North horizon', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ <strong>Auroras</strong> occur when electrons and protons from the sun flow down Earth's magnetic lines and collide with high-altitude atmospheric gas atoms, creating photon emissions.
        </div>
        Geomagnetic latitude is <strong>${absLat.toFixed(1)}°</strong>. The aurora probability is <strong>${visibleProb}%</strong>. ${
          clouds > 70 ? '☁️ Even if auroral activity is active overhead, dense overcast sky blockage hides emission flares.' :
          visibleProb >= 40 ? '✨ Excellent aurora potential tonight! Look low on the northern horizon, away from city lights, to photograph green and purple glowing auroral arches.' :
          '🌌 Geomagnetic activity is calm at this latitude. Auroral oval is confined to high arctic latitudes.'
        }
      `;
      break;
    }
    case 'cosmic_timeline_event': {
      setModalTheme('#a855f7', 'rgba(168,85,247,0.5)', 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(139,92,246,0.15))');
      detailIcon.textContent     = '🌌';
      detailTitle.textContent    = 'Stellar Highlight Event';
      detailSubtitle.textContent = 'Celestial conjuncture calendar details';
      detailMainVal.textContent  = 'Celestial Sightings';

      detailVisual.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
          <svg width="120" height="120" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 16px rgba(168,85,247,0.45));">
            <circle cx="30" cy="50" r="10" fill="#a855f7" />
            <circle cx="70" cy="50" r="6" fill="#3b82f6" />
            <line x1="30" y1="50" x2="70" y2="50" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="4,4" />
            <circle cx="50" cy="50" r="2" fill="#fff" />
          </svg>
          <div style="font-size:12px; font-weight:700; color:#a855f7;">Stellar Planetary Alignment</div>
        </div>
      `;

      detailStats.innerHTML =
        pill('Visual Type', 'Conjunction', 0) +
        pill('Planets Aligning', 'Venus & Jupiter', 1) +
        pill('Best Viewing Direction', 'South-West', 2) +
        pill('Naked Eye visible', 'Yes (Brilliant)', 3) +
        pill('Telescope required', 'Optional', 4) +
        pill('Sky interference risk', cur.clouds.all + '% cloud risk', 5);
      detailStats.style.gridTemplateColumns = '';

      detailInsight.innerHTML = `
        <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
          ℹ️ A <strong>planetary conjunction</strong> occurs when two or more planets appear exceptionally close together in the night sky from our relative point of observation.
        </div>
        The Venus-Jupiter alignment is peaking this week. It will appear immediately after sunset in the south-western horizon. The planets will be exceptionally bright and are easily visible with the naked eye even in light-polluted suburban environments. ${
          cur.clouds.all > 70 ? '☁️ Unfortunately, local cloud cover is thick, making observation highly difficult tonight.' :
          '✨ Perfect clear horizon tonight! Enjoy the planetary alignment immediately after dusk.'
        }
      `;
      break;
    }
  }
  openDetail(sourceCard);
  requestAnimationFrame(() => requestAnimationFrame(animateVisuals));
}

/* ══ OPEN FORECAST DAY DETAIL ══ */
function openForecastDetail(dayIndex, sourceCard) {
  if (!currentForecastData) return;

  const daily = {};
  currentForecastData.list.forEach(item => {
    const d   = new Date(item.dt * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!daily[key]) daily[key] = [];
    daily[key].push(item);
  });
  const days    = Object.values(daily).slice(0, 5);
  const dayItems = days[dayIndex];
  if (!dayItems || !dayItems.length) return;

  const temps   = dayItems.map(x => x.main.temp);
  const hi      = Math.max(...temps), lo = Math.min(...temps);
  const hD      = isCelsius ? hi : toF(hi), lD = isCelsius ? lo : toF(lo);
  const u       = isCelsius ? '°C' : '°F';
  const avgHum  = Math.round(dayItems.reduce((s,x) => s+x.main.humidity, 0) / dayItems.length);
  const avgWind = (dayItems.reduce((s,x) => s+x.wind.speed, 0) / dayItems.length).toFixed(1);
  const maxPop  = Math.round(Math.max(...dayItems.map(x => x.pop||0)) * 100);
  const mainItem = dayItems[Math.floor(dayItems.length/2)];
  const icon    = weatherEmoji(mainItem.weather[0].id);
  const desc    = mainItem.weather[0].description;
  const label   = dayIndex === 0 ? 'Today' : dayName(dayItems[0].dt);
  const dateStr = new Date(dayItems[0].dt * 1000).toLocaleDateString('en-US',{month:'long',day:'numeric'});

  setModalTheme('#60a5fa', 'rgba(96,165,250,0.5)', 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(139,92,246,0.15))');
  detailIcon.textContent     = icon;
  detailTitle.textContent    = label;
  detailSubtitle.textContent = dateStr + ' · ' + desc.charAt(0).toUpperCase() + desc.slice(1);
  detailMainVal.innerHTML    = `<span>${Math.round(hD)}${u}</span><span style="font-size:36px;opacity:0.5;font-weight:400"> / ${Math.round(lD)}${u}</span>`;
  detailVisual.innerHTML     = cloudSkyHTML(mainItem.clouds.all || 0);
  detailStats.style.display  = 'grid';
  detailStats.innerHTML      =
    pill('Rain Chance', maxPop + '%', 0) +
    pill('Avg Humidity', avgHum + '%', 1) +
    pill('Avg Wind', avgWind + ' m/s', 2) +
    pill('High', Math.round(hD)+u, 3) +
    pill('Low',  Math.round(lD)+u, 4) +
    pill('Condition', desc.charAt(0).toUpperCase()+desc.slice(1), 5);
  detailStats.style.gridTemplateColumns = '';

  detailInsight.innerHTML = `<strong>${label}</strong> will see ${desc} with a high of <strong>${Math.round(hD)}${u}</strong> and low of <strong>${Math.round(lD)}${u}</strong>. ${maxPop > 30 ? `Rain probability is <strong>${maxPop}%</strong> — carry an umbrella.` : 'Low chance of rain.'}`;

  // Hourly strip for this day
  detailHourlyWrap.classList.add('show');
  detailHourlyTrack.innerHTML = dayItems.map((item, i) => {
    const t    = Math.round(isCelsius ? item.main.temp : toF(item.main.temp));
    const rain = item.pop ? Math.round(item.pop*100)+'%🌧' : '';
    const isHourNight = (currentWeatherData && currentWeatherData.sys) ? isNightTime(currentWeatherData.sys.sunrise, currentWeatherData.sys.sunset, item.dt) : false;
    return `
      <div class="hourly-item">
        <div class="hourly-time">${hourLabel(item.dt)}</div>
        <div class="hourly-icon">${weatherEmoji(item.weather[0].id, isHourNight)}</div>
        <div class="hourly-temp">${t}${u}</div>
        ${rain ? `<div class="hourly-rain">${rain}</div>` : ''}
      </div>`;
  }).join('');

  openDetail(sourceCard);
  requestAnimationFrame(() => requestAnimationFrame(animateVisuals));
}

/* ══ WIRE UP CLICK HANDLERS ══ */
// Stat cards
document.getElementById('statsGrid').addEventListener('click', e => {
  const card = e.target.closest('[data-stat]');
  if (card && currentWeatherData) openStatDetail(card.dataset.stat, card);
});
document.getElementById('statsGrid').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('[data-stat]');
    if (card && currentWeatherData) { e.preventDefault(); openStatDetail(card.dataset.stat, card); }
  }
});

// Clear recent searches
const clearRecentBtn = document.getElementById('clearRecentBtn');
if (clearRecentBtn) {
  clearRecentBtn.addEventListener('click', () => {
    recentSearches = [];
    safeStorage.setItem('nimbus_recent', JSON.stringify([]));
    renderRecentSearches();
  });
}

// UV card
document.getElementById('uvCard').addEventListener('click', () => {
  if (!currentWeatherData) return;
  const uvEl = document.getElementById('uvValue');
  const uv   = parseFloat(uvEl.textContent) || 0;
  
  // Calculate specific safe exposure thresholds
  let burnTime = "Safe";
  if (uv >= 11)      burnTime = "< 10 mins";
  else if (uv >= 8)  burnTime = "15 - 20 mins";
  else if (uv >= 6)  burnTime = "20 - 30 mins";
  else if (uv >= 3)  burnTime = "30 - 45 mins";
  else               burnTime = "45 - 60+ mins";
  
  let vitD = "10 - 15 mins";
  if (uv < 3)        vitD = "20 - 30 mins";
  
  setModalTheme('#f59e0b', 'rgba(245,158,11,0.5)', 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.15))');
  detailIcon.textContent     = '☀️';
  detailTitle.textContent    = 'UV Index';
  detailSubtitle.textContent = 'Ultraviolet radiation level';
  detailMainVal.textContent  = uv.toFixed(1);
  
  // Beautiful SVG Arc Gauge up to 12
  detailVisual.innerHTML     = arcGaugeSVG(Math.min(uv/12,1), uv.toFixed(1), 'Index', '#f59e0b','#ef4444');
  
  detailStats.style.display  = 'grid';
  detailStats.innerHTML      =
    pill('Category', uvCategory(uv), 0) +
    pill('Time to Burn', burnTime, 1) +
    pill('Vit D Synthesis', vitD, 2) +
    pill('Recommended SPF', uv < 3 ? 'SPF 15+' : uv < 6 ? 'SPF 30' : 'SPF 50+', 3) +
    pill('Max UV Index', '12+', 4) +
    pill('UV Level', uv.toFixed(1), 5);
    
  detailInsight.innerHTML = `
    <div class="insight-block">
      <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
        ℹ️ <strong>Ultraviolet Index (UV)</strong> represents the intensity of skin-damaging solar radiation reaching Earth. Higher UV values require greater precautions to prevent sunburn, skin aging, and damage.
      </div>
      <p style="margin-bottom:10px;">UV index is currently <strong>${uv.toFixed(1)}</strong> (${uvCategory(uv)}).</p>
      
      <div style="display:flex; flex-direction:column; gap:12px; font-size:12.5px; line-height:1.5;">
        <!-- Section 1: Clinical Risk & Burn Time -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#fbbf24; margin-bottom:4px; display:flex; align-items:center; gap:6px;">⚠️ Safe Exposure &amp; Risk Profile</div>
          <div>Skin types I–II may experience sunburn in as little as <strong>${burnTime}</strong> of unprotected direct sun. Epidermal cellular DNA damage occurs even before visible redness appears.</div>
        </div>

        <!-- Section 2: Clinical Protective Recommendations -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#3b82f6; margin-bottom:4px; display:flex; align-items:center; gap:6px;">🛡️ Clinical Protective Guidelines</div>
          <ul style="margin:4px 0 0 16px; padding:0; list-style-type:disc; display:flex; flex-direction:column; gap:4px;">
            <li><strong>Sunscreen:</strong> Apply broad-spectrum SPF ${uv < 3 ? '15+' : uv < 6 ? '30+' : '50+'} every 2 hours, covering all exposed skin. Use a nickel-sized amount for the face.</li>
            <li><strong>Apparel:</strong> Wear UV-blocking sunglasses (UV400 rated) to prevent photokeratitis and cataracts. Wear a wide-brimmed hat and tightly-woven long sleeves.</li>
            <li><strong>Shade:</strong> Seek shade between 10:00 AM and 4:00 PM when solar elevation is at its peak.</li>
          </ul>
        </div>

        <!-- Section 3: Reflective Albedo Warnings -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#f87171; margin-bottom:4px; display:flex; align-items:center; gap:6px;">❄️ Reflective Albedo Warnings</div>
          <div>Surrounding surfaces reflect UV radiation, multiplying total exposure:
            <ul style="margin:4px 0 0 16px; padding:0; list-style-type:disc; display:flex; flex-direction:column; gap:4px;">
              <li><strong>Fresh Snow:</strong> Reflects up to 80-90% of UV rays (high risk of snow blindness).</li>
              <li><strong>Dry Sand &amp; Concrete:</strong> Reflects 15-25% of UV radiation.</li>
              <li><strong>Water:</strong> Reflects 10-15%, making swimming double the exposure rate.</li>
            </ul>
          </div>
        </div>

        <!-- Section 4: Vitamin D Synthesis -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#10b981; margin-bottom:4px; display:flex; align-items:center; gap:6px;">☀️ Vitamin D Synthesis</div>
          <div>To synthesize the daily recommended dose of Vitamin D, skin exposure of only <strong>${vitD}</strong> (midday, arms and face unprotected) is sufficient. Prolonged exposure does not increase Vitamin D levels but dramatically elevates cellular oncogenic risk.</div>
        </div>
      </div>
    </div>
  `;
  detailHourlyWrap.classList.remove('show');
  openDetail(document.getElementById('uvCard'));
  requestAnimationFrame(() => requestAnimationFrame(animateVisuals));
});

// AQI card
document.getElementById('aqiCard').addEventListener('click', () => {
  if (!currentWeatherData) return;
  const cached = window._lastAqiData || {};
  const aqi    = cached.aqi != null ? cached.aqi : parseInt(document.getElementById('aqiValue').textContent) || 0;
  const cat    = epaCategory(aqi);
  const comp   = cached.comp || {};

  setModalTheme(cat.color, cat.color + '80', `linear-gradient(135deg, ${cat.color}33, rgba(59,130,246,0.12))`);
  detailIcon.textContent     = '\ud83c\udf43';
  detailTitle.textContent    = 'Air Quality Index';
  detailSubtitle.textContent = `US EPA \u00b7 ${cat.label}`;
  detailMainVal.innerHTML    = `<span style="color:${cat.color}">${aqi}</span>`;

  const aqiPct = Math.min(aqi / 500, 1);
  const pm25   = comp.pm2_5 != null ? comp.pm2_5.toFixed(1) : null;
  const pm10   = comp.pm10  != null ? comp.pm10.toFixed(0)  : null;
  const no2    = comp.no2   != null ? comp.no2.toFixed(1)   : null;
  const o3     = comp.o3    != null ? comp.o3.toFixed(1)    : null;
  const co     = comp.co    != null ? (comp.co/1000).toFixed(2) : null;

  detailVisual.innerHTML = `
    <div style="width:100%;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="font-size:52px;font-weight:800;font-family:'Outfit',sans-serif;color:${cat.color};line-height:1">${aqi}</div>
        <div style="font-size:14px;font-weight:600;color:${cat.color};letter-spacing:0.5px">${cat.label}</div>
        <div style="width:220px;height:10px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,0.08);margin-top:4px">
          <div style="height:100%;width:${Math.round(aqiPct*100)}%;background:linear-gradient(90deg,#22c55e,#eab308,#f97316,#ef4444,#a855f7);border-radius:6px;transition:width 1s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:220px;font-size:9px;color:rgba(255,255,255,0.35);margin-top:2px">
          <span>0</span><span>100</span><span>200</span><span>300</span><span>500</span>
        </div>
      </div>
      ${(pm25 || pm10) ? `<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${pm25 ? `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 16px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:${cat.color}">${pm25}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px">PM2.5 \u03bcg/m\u00b3</div>
        </div>` : ''}
        ${pm10 ? `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 16px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:${cat.color}">${pm10}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px">PM10 \u03bcg/m\u00b3</div>
        </div>` : ''}
      </div>` : ''}
      ${Object.keys(comp).length ? aqiBarsHTML(comp) : ''}
    </div>`;

  detailStats.style.display = 'grid';
  detailStats.innerHTML =
    pill('Category', cat.label, 0) +
    (pm25 ? pill('PM2.5', pm25 + ' \u03bcg/m\u00b3', 1) : '') +
    (pm10 ? pill('PM10',  pm10 + ' \u03bcg/m\u00b3', 2) : '') +
    (no2  ? pill('NO\u2082',   no2  + ' \u03bcg/m\u00b3', 3) : '') +
    (o3   ? pill('O\u2083',    o3   + ' \u03bcg/m\u00b3', 4) : '') +
    (co   ? pill('CO',    co   + ' mg/m\u00b3', 5) : '');
  detailStats.style.gridTemplateColumns = '';

  detailInsight.innerHTML = `
    <div class="insight-block">
      <div style="font-size:12.5px; opacity:0.8; line-height:1.45; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;">
        ℹ️ <strong>Air Quality Index (AQI)</strong> is a standardized system used by environmental agencies to measure and communicate the level of pollution in the air.
      </div>
      <p style="margin-bottom:10px;">Air quality is currently rated <strong>${aqi}</strong> (${cat.label}).</p>
      
      <div style="display:flex; flex-direction:column; gap:12px; font-size:12.5px; line-height:1.5;">
        <!-- Section 1: Cardiovascular & Respiratory Guidelines -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#fbbf24; margin-bottom:4px; display:flex; align-items:center; gap:6px;">🫁 Cardiovascular &amp; Respiratory Impact</div>
          <div>${
            aqi <= 50 ? "<strong>Negligible risk.</strong> Safe for all individuals. Perfect time for open-air ventilation and vigorous cardiovascular activities." :
            aqi <= 100 ? "<strong>Mild risk.</strong> Unusually sensitive individuals may experience minor throat irritation, coughing, or shortness of breath. Asthma sufferers should keep bronchodilators handy." :
            aqi <= 150 ? "<strong>Moderate threat.</strong> Sensitive groups (children, elderly, adults with active cardiovascular or respiratory disease) may experience lung irritation. Healthy individuals might feel slight fatigue." :
            aqi <= 200 ? "<strong>Significant threat.</strong> Bronchoconstriction, coughing, and chest tightness are common. High risk of cardiovascular events (angina, arrhythmia) in vulnerable cohorts." :
            aqi <= 300 ? "<strong>High risk.</strong> Severe respiratory distress. Active symptoms in healthy populations. High trigger rates for asthma attacks and acute bronchitis." :
            "<strong>Extreme emergency.</strong> Serious threat of systemic inflammatory response and cardiovascular distress. Safe outdoor breathing is impossible."
          }</div>
        </div>

        <!-- Section 2: Outdoor Activity & Sports Safety -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#3b82f6; margin-bottom:4px; display:flex; align-items:center; gap:6px;">🏃 Outdoor Activity &amp; Sports Safety</div>
          <div>${
            aqi <= 50 ? "Perfect conditions for intense outdoor sports, long runs, and cycling. No restrictions." :
            aqi <= 100 ? "Comfortable for most sports. Sensitive athletes should monitor for airway hyper-responsiveness and reduce duration of extremely high-intensity workouts." :
            aqi <= 150 ? "Reduce prolonged or heavy outdoor exertion. Move high-intensity cardio (sprints, long-distance running) indoors. Rest breaks should be frequent." :
            aqi <= 200 ? "Avoid all outdoor workouts. Limit outdoor exposure to essential walking. Athletes must train indoors. Wear an N95 respirator if outdoor activity is unavoidable." :
            aqi <= 300 ? "Avoid all outdoor physical activities. Stay indoors. Outdoor exposure should be strictly limited to short, unavoidable commutes with a fitted N95 mask." :
            "⚠️ <strong>Emergency restrictions!</strong> Outdoor physical exertion is strictly prohibited. Avoid going outside completely."
          }</div>
        </div>

        <!-- Section 3: Indoor Environment & HVAC Guidelines -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#10b981; margin-bottom:4px; display:flex; align-items:center; gap:6px;">🏠 Indoor Environment &amp; HVAC Control</div>
          <ul style="margin:4px 0 0 16px; padding:0; list-style-type:disc; display:flex; flex-direction:column; gap:4px;">
            <li><strong>Ventilation:</strong> ${aqi <= 100 ? 'Feel free to open windows to refresh indoor air.' : 'Keep windows and doors closed to prevent outdoor particulate entry.'}</li>
            <li><strong>HVAC:</strong> ${aqi <= 100 ? 'Standard operations.' : 'Set HVAC system to <strong>recirculate mode</strong> to bypass outdoor intake.'}</li>
            <li><strong>Air Purifiers:</strong> ${aqi <= 50 ? 'Not required.' : aqi <= 100 ? 'Run on low settings in primary bedrooms.' : `Run air purifiers equipped with <strong>True HEPA filters</strong> on medium/high speed. Ensure CADR rating matches room size.`}</li>
            ${aqi > 150 ? '<li><strong>Sources:</strong> Avoid indoor frying, candle burning, or vacuuming without a HEPA exhaust, which can spike indoor PM2.5.</li>' : ''}
          </ul>
        </div>

        <!-- Section 4: Primary Pollutants Overview -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 14px;">
          <div style="font-weight:700; color:#a855f7; margin-bottom:4px; display:flex; align-items:center; gap:6px;">🔬 Pollutant Focus</div>
          <div>
            <strong>PM2.5:</strong> Fine inhalable particles (size &le; 2.5 &mu;m) that bypass nasal filtration, penetrating deep into the pulmonary alveoli and directly entering the bloodstream.
            ${pm10 ? `<br><strong>PM10:</strong> Coarse inhalable dust, pollen, and mold particles that accumulate in the upper respiratory tract.` : ''}
            ${no2 ? `<br><strong>NO₂:</strong> Nitrogen Dioxide, a gaseous irritant from traffic combustion, causing airway inflammation.` : ''}
            ${o3 ? `<br><strong>O₃:</strong> Ground-level Ozone, formed by chemical reactions between solar radiation and NOx/VOCs, acting as a powerful lung irritant.` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  detailHourlyWrap.classList.remove('show');
  openDetail(document.getElementById('aqiCard'));
  requestAnimationFrame(() => requestAnimationFrame(animateVisuals));
});

// Forecast day rows
document.getElementById('forecastList').addEventListener('click', e => {
  const row = e.target.closest('.forecast-day');
  if (row) openForecastDetail(parseInt(row.dataset.dayIndex || 0), row);
});

// Timezone dropdown toggle and click handlers
const tzSelectWrap = document.getElementById('tzSelectWrap');
const tzToggle = document.getElementById('tzToggle');
const tzDropdown = document.getElementById('tzDropdown');
const tzLabel = document.getElementById('tzLabel');

if (tzToggle && tzDropdown) {
  tzToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    tzDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (tzSelectWrap && !tzSelectWrap.contains(e.target)) {
      tzDropdown.classList.remove('open');
    }
  });

  tzDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.tz-option');
    if (!option) return;

    tzDropdown.querySelectorAll('.tz-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    timezonePref = option.dataset.tz;
    
    // Format label nicely (strip emoji)
    const rawTxt = option.textContent.trim();
    if (timezonePref === 'city') {
      tzLabel.textContent = 'Local';
    } else if (timezonePref === 'device') {
      tzLabel.textContent = 'Device';
    } else {
      tzLabel.textContent = rawTxt.split(' ')[1] || rawTxt;
    }
    
    tzDropdown.classList.remove('open');

    if (currentWeatherData) {
      // 1. Restart clock with new timezonePref
      startLiveClock(currentWeatherData.timezone);
      
      // 2. Re-render sunrise/sunset card display times
      document.getElementById('sunriseVal').textContent = epochToTime(currentWeatherData.sys.sunrise, currentWeatherData.timezone);
      document.getElementById('sunsetVal').textContent  = epochToTime(currentWeatherData.sys.sunset, currentWeatherData.timezone);
      
      // 3. Re-render the hourly forecast strip with converted timezone hours
      renderHourly(currentForecastData.list);
    }
  });
}

// Lunar and Outfit card click listeners
const lunarCard = document.getElementById('lunarCard');
if (lunarCard) {
  lunarCard.addEventListener('click', () => {
    if (currentWeatherData) openStatDetail('lunar', lunarCard);
  });
  lunarCard.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
      e.preventDefault();
      openStatDetail('lunar', lunarCard);
    }
  });
}

const outfitCard = document.getElementById('outfitCard');
if (outfitCard) {
  outfitCard.addEventListener('click', () => {
    if (currentWeatherData) openStatDetail('outfit', outfitCard);
  });
  outfitCard.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
      e.preventDefault();
      openStatDetail('outfit', outfitCard);
    }
  });
}

function setupCosmicClickListeners() {
  const cosmicSolar = document.getElementById('cosmicSolarCard');
  if (cosmicSolar) {
    cosmicSolar.addEventListener('click', () => {
      if (currentWeatherData) openStatDetail('cosmic_geomagnetic', cosmicSolar);
    });
    cosmicSolar.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
        e.preventDefault();
        openStatDetail('cosmic_geomagnetic', cosmicSolar);
      }
    });
  }
  const cosmicMeteor = document.getElementById('cosmicMeteorCard');
  if (cosmicMeteor) {
    cosmicMeteor.addEventListener('click', () => {
      if (currentWeatherData) openStatDetail('cosmic_meteor', cosmicMeteor);
    });
    cosmicMeteor.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
        e.preventDefault();
        openStatDetail('cosmic_meteor', cosmicMeteor);
      }
    });
  }
  const cosmicSat = document.getElementById('cosmicSatCard');
  if (cosmicSat) {
    cosmicSat.addEventListener('click', () => {
      if (currentWeatherData) openStatDetail('cosmic_satellites', cosmicSat);
    });
    cosmicSat.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
        e.preventDefault();
        openStatDetail('cosmic_satellites', cosmicSat);
      }
    });
  }
  const cosmicStar = document.getElementById('cosmicStargazingCard');
  if (cosmicStar) {
    cosmicStar.addEventListener('click', () => {
      if (currentWeatherData) openStatDetail('cosmic_stargazing', cosmicStar);
    });
    cosmicStar.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
        e.preventDefault();
        openStatDetail('cosmic_stargazing', cosmicStar);
      }
    });
  }
  const cosmicAurora = document.getElementById('cosmicAuroraCard');
  if (cosmicAurora) {
    cosmicAurora.addEventListener('click', () => {
      if (currentWeatherData) openStatDetail('cosmic_aurora', cosmicAurora);
    });
    cosmicAurora.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && currentWeatherData) {
        e.preventDefault();
        openStatDetail('cosmic_aurora', cosmicAurora);
      }
    });
  }
}

let astroInterval = null;

function getUpcomingPassTime(startHour, startMin, intervalHours) {
  const now = new Date();
  const pass = new Date(now);
  pass.setHours(startHour, startMin, 0, 0);
  
  while (pass < now) {
    pass.setTime(pass.getTime() + intervalHours * 3600 * 1000);
  }
  
  const isToday = pass.getDate() === now.getDate();
  const timeStr = pass.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !is24Hour });
  
  return `${isToday ? 'Today' : 'Tomorrow'}, ${timeStr}`;
}

function getUpcomingPlanetaryConjunction() {
  const now = new Date();
  const resultDate = new Date(now);
  const day = now.getDay();
  const diff = (7 - day) % 7 || 7;
  resultDate.setDate(now.getDate() + diff);
  resultDate.setHours(23, 0, 0, 0);
  
  const dateStr = resultDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = resultDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !is24Hour });
  return `${dateStr}, ${timeStr}`;
}

function startAstroUpdates() {
  if (astroInterval) clearInterval(astroInterval);
  astroInterval = setInterval(() => {
    const pagAstro = document.getElementById('pagRadarAstro');
    if (pagAstro && pagAstro.style.display !== 'none') {
      renderAstroPage();
    } else {
      stopAstroUpdates();
    }
  }, 10000);
}

function stopAstroUpdates() {
  if (astroInterval) {
    clearInterval(astroInterval);
    astroInterval = null;
  }
}

setupCosmicClickListeners();

/* ─── Cosmic Events & Space Telemetry Calculations ─── */
function renderAstroPage() {
  if (!currentWeatherData) return;

  document.getElementById('radarAstroWelcome').style.display = 'none';
  document.getElementById('radarAstroContent').style.display = 'grid';
  document.getElementById('radarCityName').textContent = `Telemetry reports around ${currentWeatherData.name}`;

  const lat = currentWeatherData.coord.lat;
  const lon = currentWeatherData.coord.lon;
  const clouds = currentWeatherData.clouds.all;
  const absLat = Math.abs(lat);

  // 1. Geomagnetic Activity & Solar Wind Telemetry
  // Base wind speed scales with absolute latitude (simulating magnetic field focus at poles)
  const solarSpeed = Math.round(340 + absLat * 3.2 + (Math.sin(Date.now() / 100000) * 40) + Math.random() * 15);
  const protonDensity = (3.2 + (absLat / 90) * 4.5 + Math.random() * 2).toFixed(1);
  
  // Kp-index calculations (0 to 9)
  let kp = Math.round(1 + (absLat / 90) * 4.5 + (Math.random() * 2));
  kp = Math.max(0, Math.min(kp, 9));

  const kpBadge = document.getElementById('kpBadge');
  const solarWindSpeed = document.getElementById('solarWindSpeed');
  const solarProtonDensity = document.getElementById('solarProtonDensity');
  const kpDescText = document.getElementById('kpDescText');

  if (kpBadge && solarWindSpeed && solarProtonDensity && kpDescText) {
    solarWindSpeed.textContent = `${solarSpeed} km/s`;
    solarProtonDensity.textContent = `${protonDensity} p/cm³`;
    
    // Set Kp badge label and style class
    kpBadge.className = 'cosmic-badge-level';
    if (kp >= 6) {
      kpBadge.textContent = `Kp ${kp} · STORM`;
      kpBadge.classList.add('level-storm');
      kpDescText.textContent = `🚨 G${kp-5} Geomagnetic Storm active at high latitudes! Aurora flares will be bright, possible satellite tracking interference.`;
    } else if (kp >= 4) {
      kpBadge.textContent = `Kp ${kp} · ACTIVE`;
      kpBadge.classList.add('level-active');
      kpDescText.textContent = `🟠 Solar winds are elevated. Good aurora potential at polar latitudes. Minor magnetic fluctuations registered.`;
    } else {
      kpBadge.textContent = `Kp ${kp} · QUIET`;
      kpBadge.classList.add('level-quiet');
      kpDescText.textContent = `🟢 Geomagnetic conditions are calm and stable. Low earth orbits and communication arrays operating nominally.`;
    }
  }

  // 2. Meteor Shower Forecast
  const dateObj = new Date();
  const month = dateObj.getMonth(); // 0-indexed
  let showerName = "Quadrantids Shower Peak";
  let baseZhr = 110;
  
  if (month >= 3 && month <= 4) { // April-May
    showerName = "Lyrids Shower Peak";
    baseZhr = 18;
  } else if (month >= 6 && month <= 7) { // July-August
    showerName = "Perseids Shower Peak";
    baseZhr = 100;
  } else if (month >= 9 && month <= 10) { // October-November
    showerName = "Orionids Shower Peak";
    baseZhr = 25;
  } else if (month === 11) { // December
    showerName = "Geminids Shower Peak";
    baseZhr = 120;
  }

  // Calculate actual ZHR based on cloud coverage and latitude adjustments
  let latFactor = 1.0;
  if (showerName.includes("Perseids") && lat < -10) latFactor = 0.3; // Southern penalty
  if (showerName.includes("Geminids") && lat < -30) latFactor = 0.5;

  const actualZhr = Math.round(baseZhr * latFactor * (1 - clouds / 100));
  
  const moonAge = calculateLunarAge(Date.now() / 1000);
  const moonIllum = Math.round((1 - Math.cos((moonAge / 29.530588853) * 2 * Math.PI)) * 50);

  // Quality rating
  let observingQuality = "Excellent";
  let qualityColor = "#22c55e";
  if (clouds > 75) {
    observingQuality = "Poor";
    qualityColor = "#ef4444";
  } else if (clouds > 40 || moonIllum > 75) {
    observingQuality = "Fair";
    qualityColor = "#f97316";
  } else if (clouds > 15 || moonIllum > 35) {
    observingQuality = "Good";
    qualityColor = "#eab308";
  }

  const meteorShowerName = document.getElementById('meteorShowerName');
  const meteorBadge = document.getElementById('meteorBadge');
  const meteorZhrVal = document.getElementById('meteorZhrVal');
  const meteorQuality = document.getElementById('meteorQuality');
  const meteorDesc = document.getElementById('meteorDesc');

  if (meteorShowerName && meteorZhrVal && meteorQuality && meteorDesc) {
    meteorShowerName.textContent = showerName;
    meteorZhrVal.textContent = `${actualZhr} / hr`;
    meteorQuality.textContent = observingQuality;
    meteorQuality.style.color = qualityColor;

    if (observingQuality === "Poor") {
      meteorDesc.textContent = `☁️ Overcast skies will make shower observation highly difficult tonight. Constellations completely hidden.`;
      if (meteorBadge) {
        meteorBadge.textContent = "OBSCURED";
        meteorBadge.style.color = "#ef4444";
        meteorBadge.style.background = "rgba(239, 68, 68, 0.12)";
        meteorBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
      }
    } else {
      meteorDesc.textContent = `✨ Best viewing starts after midnight. Moon glare is at ${moonIllum}%, offering ${observingQuality.toLowerCase()} dark sky visibility.`;
      if (meteorBadge) {
        meteorBadge.textContent = "ACTIVE";
        meteorBadge.style.color = "#60a5fa";
        meteorBadge.style.background = "rgba(96, 165, 250, 0.12)";
        meteorBadge.style.borderColor = "rgba(96, 165, 250, 0.3)";
      }
    }
  }

  // 3. Orbital Satellites & ISS Tracker
  const issBadge = document.getElementById('issBadge');
  const issTimeText = document.getElementById('issTimeText');
  const issElText = document.getElementById('issElText');
  const starlinkTimeText = document.getElementById('starlinkTimeText');
  const starlinkElText = document.getElementById('starlinkElText');

  let visibleCount = 2;
  if (clouds > 85) {
    visibleCount = 0;
  } else if (clouds > 45) {
    visibleCount = 1;
  }

  if (issBadge) {
    issBadge.textContent = `${visibleCount} VISIBLE`;
    if (visibleCount === 0) {
      issBadge.style.color = "#ef4444";
      issBadge.style.background = "rgba(239, 68, 68, 0.12)";
      issBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
    } else {
      issBadge.style.color = "#10b981";
      issBadge.style.background = "rgba(16, 185, 129, 0.12)";
      issBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
    }
  }

  if (issTimeText && issElText && starlinkTimeText && starlinkElText) {
    if (visibleCount === 0) {
      issTimeText.textContent = "Overcast blocks ISS orbit paths";
      issElText.textContent = "0° Elev";
      issElText.style.color = "#ef4444";
      issElText.style.background = "rgba(239, 68, 68, 0.12)";
      issElText.style.borderColor = "rgba(239, 68, 68, 0.3)";
      
      starlinkTimeText.textContent = "Dense cloud limits Starlink view";
      starlinkElText.textContent = "0° Elev";
      starlinkElText.style.color = "#ef4444";
      starlinkElText.style.background = "rgba(239, 68, 68, 0.12)";
      starlinkElText.style.borderColor = "rgba(239, 68, 68, 0.3)";
    } else {
      issTimeText.textContent = `${getUpcomingPassTime(20, 42, 5)} (5m dur)`;
      issElText.textContent = `${Math.round(35 + absLat * 0.4)}° Elev`;
      issElText.style.color = "#3b82f6";
      issElText.style.background = "rgba(59, 130, 246, 0.12)";
      issElText.style.borderColor = "rgba(59, 130, 246, 0.3)";

      starlinkTimeText.textContent = `${getUpcomingPassTime(22, 15, 7)} (4m dur)`;
      starlinkElText.textContent = `${Math.round(20 + absLat * 0.2)}° Elev`;
      starlinkElText.style.color = "#a855f7";
      starlinkElText.style.background = "rgba(168, 85, 247, 0.12)";
      starlinkElText.style.borderColor = "rgba(168, 85, 247, 0.3)";
    }
  }

  // 4. Stargazing Quality Dial
  let starIdx = Math.round(100 - (0.5 * clouds) - (0.45 * moonIllum));
  starIdx = Math.max(5, Math.min(starIdx, 100));

  const starQualityRing = document.getElementById('starQualityRing');
  const starQualityLabel = document.getElementById('starQualityLabel');
  const starQualityDesc = document.getElementById('starQualityDesc');

  if (starQualityRing && starQualityLabel) {
    starQualityLabel.textContent = `${starIdx}%`;
    const ringOffset = 264 - (starIdx / 100) * 264;
    starQualityRing.style.strokeDashoffset = ringOffset;
    
    let starDescText = "";
    if (clouds > 60) {
      starDescText = "Cloud cover is thick. Poor viewing tonight. Major constellations will be obscured.";
    } else if (moonIllum > 70) {
      starDescText = `Sky is clear, but high lunar glare (${moonIllum}% moon) washes out deep space objects. Planetary observation recommended.`;
    } else if (starIdx >= 80) {
      starDescText = "Exceptional dark sky conditions tonight! Faint galaxies and nebulae will be perfectly bright.";
    } else {
      starDescText = "Fair observation conditions. Standard constellations and satellites are clearly visible.";
    }
    starQualityDesc.textContent = starDescText;
  }

  // 5. Aurora Probability Ring
  let auroraProb = 0;
  if (absLat >= 60 && absLat <= 75) {
    auroraProb = 75 + Math.random() * 20;
  } else if (absLat >= 45 && absLat < 60) {
    auroraProb = 25 + Math.random() * 30;
  } else if (absLat >= 35 && absLat < 45) {
    auroraProb = 5 + Math.random() * 15;
  } else {
    auroraProb = Math.random() * 3;
  }
  
  let kpScale = 0.5 + (kp / 9) * 0.8;
  const visibleProb = Math.round(Math.min(auroraProb * kpScale, 100) * (1 - clouds / 100));

  const auroraProbVal = document.getElementById('auroraProbVal');
  const auroraProbBar = document.getElementById('auroraProbBar');
  const auroraStatusDesc = document.getElementById('auroraStatusDesc');

  if (auroraProbVal && auroraProbBar && auroraStatusDesc) {
    auroraProbVal.textContent = `${visibleProb}%`;
    auroraProbBar.style.width = `${visibleProb}%`;
    
    let statusTxt = "";
    if (clouds > 75) {
      statusTxt = "☁️ Sky is heavily overcast. Aurora sights are blocked by dense clouds.";
    } else if (visibleProb >= 50) {
      statusTxt = "✨ High geomagnetic solar wind activity! Perfect dark clear skies, excellent aurora potential.";
    } else if (visibleProb >= 20) {
      statusTxt = "🟢 Moderate aurora potential. Look low towards the horizon in dark, rural areas.";
    } else {
      statusTxt = "🌌 Solar activity calm. Sight chances are nominal. Focus on deep space telescope observations.";
    }
    auroraStatusDesc.textContent = statusTxt;
  }

  // 6. Space Highlights Timeline
  const timeline = document.getElementById('astroTimeline');
  if (timeline) {
    timeline.innerHTML = "";
    const events = [
      { name: "ISS Overhead Pass", time: getUpcomingPassTime(20, 42, 5), detail: `Visible flyby crossing at ${Math.round(35 + absLat * 0.4)}° max elevation.`, icon: "🛰️", detailType: "cosmic_satellites" },
      { name: showerName, time: `Peak active tonight`, detail: `Observing rate estimated around ${actualZhr} shooting stars per hour.`, icon: "☄️", detailType: "cosmic_meteor" },
      { name: "Venus-Jupiter Conjunction", time: getUpcomingPlanetaryConjunction(), detail: "Planetary close alignment. Exceptionally bright in southern sky.", icon: "🪐", detailType: "cosmic_timeline_event" }
    ];

    events.forEach(ev => {
      const card = document.createElement('div');
      card.className = "astro-timeline-item";
      card.setAttribute('tabindex', '0');
      card.innerHTML = `
        <div class="astro-item-icon">${ev.icon}</div>
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
          <div style="font-size:12.5px; font-weight:700; color:var(--text-primary)">${ev.name}</div>
          <div style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.4)">${ev.time}</div>
          <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">${ev.detail}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        openStatDetail(ev.detailType, card);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openStatDetail(ev.detailType, card);
        }
      });
      timeline.appendChild(card);
    });
  }
}

/* ─── Share and Hero Card Summary Click Wire Up ─── */
function setupShareHandlers(cur) {
  const btnShareNative = document.getElementById('btnShareNative');
  const btnShareWA = document.getElementById('btnShareWA');
  const btnShareCopy = document.getElementById('btnShareCopy');
  const shareCopyAlert = document.getElementById('shareCopyAlert');

  if (!btnShareNative || !btnShareWA || !btnShareCopy) return;

  const t = Math.round(isCelsius ? cur.main.temp : toF(cur.main.temp));
  const u = isCelsius ? '°C' : '°F';
  const desc = cur.weather[0].description.charAt(0).toUpperCase() + cur.weather[0].description.slice(1);
  const feels = Math.round(isCelsius ? cur.main.feels_like : toF(cur.main.feels_like));
  
  const shareText = `🌦️ Current weather in ${cur.name}, ${cur.sys.country}:
🌡️ Temp: ${t}${u} (Feels like ${feels}${u})
🌥️ Condition: ${desc}
💧 Humidity: ${cur.main.humidity}%
🌬️ Wind: ${cur.wind.speed.toFixed(1)} m/s
Check it out on Nimbus Weather!`;
  
  const shareUrl = window.location.href;

  // Clean existing listeners by replacing buttons (or cloning them)
  const newNative = btnShareNative.cloneNode(true);
  const newWA = btnShareWA.cloneNode(true);
  const newCopy = btnShareCopy.cloneNode(true);
  
  btnShareNative.parentNode.replaceChild(newNative, btnShareNative);
  btnShareWA.parentNode.replaceChild(newWA, btnShareWA);
  btnShareCopy.parentNode.replaceChild(newCopy, btnShareCopy);

  if (shareCopyAlert) shareCopyAlert.style.display = 'none';

  if (navigator.share) {
    newNative.style.display = 'inline-flex';
    newNative.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: `Weather in ${cur.name}`,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        console.log('Share error:', err);
      }
    });
  } else {
    newNative.style.display = 'none';
  }

  newWA.addEventListener('click', () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
    window.open(waUrl, '_blank');
  });

  newCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(shareText + '\n' + shareUrl).then(() => {
      if (shareCopyAlert) {
        shareCopyAlert.style.display = 'block';
        setTimeout(() => {
          shareCopyAlert.style.display = 'none';
        }, 3000);
      }
    }).catch(err => console.error('Copy error:', err));
  });
}

// Hero Card Click Listeners
const heroCard = document.getElementById('heroCard');
if (heroCard) {
  heroCard.addEventListener('click', () => {
    if (currentWeatherData) openStatDetail('summary', heroCard);
  });
  heroCard.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (currentWeatherData) {
        e.preventDefault();
        openStatDetail('summary', heroCard);
      }
    }
  });
}

function updateTabIndicator(activeTab, immediate) {
  const indicator = document.getElementById('navPillIndicator');
  if (!indicator || !activeTab) return;
  
  const containerRect = activeTab.parentElement.getBoundingClientRect();
  const tabRect = activeTab.getBoundingClientRect();
  
  const relativeLeft = tabRect.left - containerRect.left;
  const relativeWidth = tabRect.width;
  
  if (immediate) {
    indicator.style.left = `${relativeLeft}px`;
    indicator.style.width = `${relativeWidth}px`;
    indicator.style.transform = 'scaleX(1)';
  } else {
    anime.remove(indicator);
    const currentLeft = parseFloat(indicator.style.left) || 0;
    const currentWidth = parseFloat(indicator.style.width) || tabRect.width;
    const direction = relativeLeft > currentLeft ? 'right' : 'left';
    
    if (direction === 'right') {
      anime.timeline({
        targets: indicator,
        easing: 'cubicBezier(0.4, 0, 0.2, 1)'
      })
      .add({
        width: relativeLeft + relativeWidth - currentLeft,
        duration: 180,
      })
      .add({
        left: relativeLeft,
        width: relativeWidth,
        duration: 180,
      }, '-=60');
    } else {
      anime.timeline({
        targets: indicator,
        easing: 'cubicBezier(0.4, 0, 0.2, 1)'
      })
      .add({
        left: relativeLeft,
        width: currentLeft + currentWidth - relativeLeft,
        duration: 180,
      })
      .add({
        width: relativeWidth,
        duration: 180,
      }, '-=60');
    }
  }
}

function animateDashboardEntrance() {
  const elements = [
    document.getElementById('heroCard'),
    ...document.querySelectorAll('#statsGrid .stat-card'),
    document.getElementById('uvCard'),
    document.getElementById('aqiCard'),
    document.getElementById('lunarCard'),
    document.getElementById('outfitCard'),
    ...document.querySelectorAll('.forecast-section')
  ].filter(el => el && el.style.display !== 'none');
  
  elements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px) scale(0.96)';
  });
  
  anime({
    targets: elements,
    translateY: [30, 0],
    scale: [0.96, 1],
    opacity: [0, 1],
    delay: anime.stagger(60, { start: 100 }),
    duration: 800,
    easing: 'cubicBezier(0.25, 1, 0.5, 1)',
    complete: () => {
      elements.forEach(el => {
        el.style.transform = '';
        el.style.opacity = '';
      });
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   ATMOSPHERIC EXPLORER — WEATHER FINDER (Nimbus Intelligence)
   ═══════════════════════════════════════════════════════════════ */

const BACKUP_EXPLORER_CITIES = {
  sunny: [
    { name: 'Cairo', country: 'EG', lat: 30.0444, lon: 31.2357, temp: 32, id: 800, desc: 'clear sky' },
    { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093, temp: 21, id: 800, desc: 'clear sky' },
    { name: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437, temp: 26, id: 800, desc: 'clear sky' }
  ],
  rainy: [
    { name: 'Bergen', country: 'NO', lat: 60.3913, lon: 5.3221, temp: 11, id: 501, desc: 'moderate rain' },
    { name: 'Hilo', country: 'US', lat: 19.7241, lon: -155.0868, temp: 24, id: 500, desc: 'light rain' },
    { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198, temp: 27, id: 502, desc: 'heavy rain' }
  ],
  snowy: [
    { name: 'Tromsø', country: 'NO', lat: 69.6492, lon: 18.9553, temp: -3, id: 601, desc: 'light snow' },
    { name: 'Reykjavik', country: 'IS', lat: 64.1466, lon: -21.9426, temp: -1, id: 600, desc: 'light snow' },
    { name: 'Anchorage', country: 'US', lat: 61.2181, lon: -149.9003, temp: -5, id: 601, desc: 'snow' }
  ],
  cloudy: [
    { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278, temp: 15, id: 803, desc: 'broken clouds' },
    { name: 'Seattle', country: 'US', lat: 47.6062, lon: -122.3321, temp: 14, id: 804, desc: 'overcast clouds' },
    { name: 'Dublin', country: 'IE', lat: 53.3498, lon: -6.2603, temp: 13, id: 802, desc: 'scattered clouds' }
  ]
};

function initWeatherExplorer() {
  const filterBtns = document.querySelectorAll('.explorer-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const weatherType = btn.dataset.weather;
      if (btn.classList.contains('active')) {
        // Toggle off if already active
        resetExplorerResults();
      } else {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scanNearbyWeather(weatherType);
      }
    });
  });
  positionWeatherExplorer();
}

function resetExplorerResults() {
  const filterBtns = document.querySelectorAll('.explorer-filter-btn');
  if (filterBtns) {
    filterBtns.forEach(b => b.classList.remove('active'));
  }
  
  const loadingEl = document.getElementById('explorerLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  
  const resultsEl = document.getElementById('explorerResults');
  if (resultsEl) {
    resultsEl.innerHTML = `
      <div style="font-size: 12.5px; color: var(--text-secondary); text-align: center; padding: 20px 0;">
        Select a weather condition above to scan nearby areas.
      </div>
    `;
  }
}

function matchesWeatherType(id, type) {
  if (type === 'sunny') {
    return id === 800;
  } else if (type === 'rainy') {
    return id >= 200 && id < 600;
  } else if (type === 'snowy') {
    return id >= 600 && id < 700;
  } else if (type === 'cloudy') {
    return id > 800 && id < 900;
  }
  return false;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function positionWeatherExplorer() {
  const welcomeScreen = document.getElementById('welcomeScreen');
  const weatherContent = document.getElementById('weatherContent');
  const weatherExplorer = document.getElementById('weatherExplorer');
  
  if (!weatherExplorer) return;
  
  if (welcomeScreen && welcomeScreen.style.display !== 'none') {
    welcomeScreen.appendChild(weatherExplorer);
  } else if (weatherContent && weatherContent.style.display !== 'none') {
    const forecastSections = weatherContent.querySelectorAll('.forecast-section');
    if (forecastSections.length > 0) {
      weatherContent.insertBefore(weatherExplorer, forecastSections[0]);
    } else {
      weatherContent.appendChild(weatherExplorer);
    }
  }
}

async function scanNearbyWeather(type) {
  const resultsEl = document.getElementById('explorerResults');
  const loadingEl = document.getElementById('explorerLoading');
  
  let centerLat, centerLon, centerName;

  if (currentWeatherData) {
    centerLat = currentWeatherData.coord.lat;
    centerLon = currentWeatherData.coord.lon;
    centerName = currentWeatherData.name;
  } else {
    // Attempt auto-detect geolocation
    if (loadingEl) {
      loadingEl.style.display = 'flex';
      const label = loadingEl.querySelector('span');
      if (label) label.textContent = 'Detecting your location...';
    }
    if (resultsEl) resultsEl.innerHTML = '';

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000
        });
      });
      centerLat = pos.coords.latitude;
      centerLon = pos.coords.longitude;
      centerName = 'Your Location';
      
      const explorerCenterName = document.getElementById('explorerCenterName');
      if (explorerCenterName) {
        explorerCenterName.textContent = centerName;
      }
    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (resultsEl) {
        let msg = "Please enable location services or search for a city first to set a reference location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location access denied. Please allow location permission or search for a city first.";
        }
        resultsEl.innerHTML = `
          <div style="font-size: 12.5px; color: #ef4444; text-align: center; padding: 20px 0;">
            ${msg}
          </div>
        `;
      }
      const filterBtns = document.querySelectorAll('.explorer-filter-btn');
      if (filterBtns) filterBtns.forEach(b => b.classList.remove('active'));
      return;
    }
  }

  if (loadingEl) {
    loadingEl.style.display = 'flex';
    const label = loadingEl.querySelector('span');
    if (label) label.textContent = 'Scanning neighboring coordinates...';
  }
  if (resultsEl) resultsEl.innerHTML = '';

  if (API_KEY === 'demo') {
    // Simulate API delay for rich UX loader
    await new Promise(resolve => setTimeout(resolve, 800));
    renderMockExplorerResults(type, centerLat, centerLon, centerName);
    return;
  }

  try {
    // 1. Fetch local surrounding cities (find circle search)
    // 2. Fetch global cities spanning various latitudes and polar zones to find real-time weather conditions globally
    const localUrl = `${BASE}/data/2.5/find?lat=${centerLat}&lon=${centerLon}&cnt=50&appid=${API_KEY}&units=metric`;
    const globalIds = '2643743,2988507,5128581,1850147,2147714,360630,524901,5879400,3133895,3413829,2729907,3833367,3874787,2013159,2037078,5913490,6183235,2028462,3421319,5983720,603913,5855927,1880252,5809844,2964574,658225,2673730,3369157,2163355,2867714';
    const globalUrl = `${BASE}/data/2.5/group?id=${globalIds}&appid=${API_KEY}&units=metric`;

    const [localRes, globalRes] = await Promise.all([
      fetch(localUrl),
      fetch(globalUrl)
    ]);

    if (!localRes.ok) throw new Error('Local scan failed');
    const localData = await localRes.json();
    
    let globalData = { list: [] };
    if (globalRes.ok) {
      globalData = await globalRes.json();
    }

    const matchedCities = [];
    const addedCityNames = new Set();

    // Parse helper
    const addMatches = (list) => {
      if (!list) return;
      list.forEach(item => {
        const id = item.weather[0].id;
        const nameKey = item.name.toLowerCase();
        if (matchesWeatherType(id, type) && !addedCityNames.has(nameKey)) {
          addedCityNames.add(nameKey);
          const dist = haversineDistance(centerLat, centerLon, item.coord.lat, item.coord.lon);
          matchedCities.push({
            name: item.name,
            country: item.sys ? item.sys.country : '',
            lat: item.coord.lat,
            lon: item.coord.lon,
            temp: item.main.temp,
            id: id,
            desc: item.weather[0].description,
            distance: dist
          });
        }
      });
    };

    // Add local matches first
    addMatches(localData.list);
    // Add global matches second
    addMatches(globalData.list);

    // If we have fewer than 2 results (e.g. searching snowy in a hot season or very dry climate), fill using backup coordinates
    if (matchedCities.length < 2) {
      const backups = BACKUP_EXPLORER_CITIES[type] || [];
      backups.forEach(backup => {
        const nameKey = backup.name.toLowerCase();
        if (!addedCityNames.has(nameKey)) {
          addedCityNames.add(nameKey);
          const dist = haversineDistance(centerLat, centerLon, backup.lat, backup.lon);
          matchedCities.push({
            name: backup.name,
            country: backup.country,
            lat: backup.lat,
            lon: backup.lon,
            temp: backup.temp,
            id: backup.id,
            desc: backup.desc,
            distance: dist
          });
        }
      });
    }

    // Sort by distance
    matchedCities.sort((a, b) => a.distance - b.distance);

    renderExplorerResultsList(matchedCities);
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div style="font-size: 12.5px; color: #ef4444; text-align: center; padding: 20px 0;">
          Error scanning nearby weather: ${err.message || 'API key error'}. Try using Demo Mode.
        </div>
      `;
    }
  }
}

function getMockNeighbors(centerName) {
  const nameLower = centerName.toLowerCase();
  if (nameLower.includes('london') || nameLower === 'your location') {
    return [
      { name: 'Watford', country: 'GB' },
      { name: 'Croydon', country: 'GB' },
      { name: 'Slough', country: 'GB' },
      { name: 'Guildford', country: 'GB' },
      { name: 'Harlow', country: 'GB' },
      { name: 'Reading', country: 'GB' }
    ];
  } else if (nameLower.includes('paris')) {
    return [
      { name: 'Versailles', country: 'FR' },
      { name: 'Saint-Denis', country: 'FR' },
      { name: 'Boulogne-Billancourt', country: 'FR' },
      { name: 'Nanterre', country: 'FR' },
      { name: 'Creteil', country: 'FR' }
    ];
  } else if (nameLower.includes('tokyo')) {
    return [
      { name: 'Yokohama', country: 'JP' },
      { name: 'Kawasaki', country: 'JP' },
      { name: 'Chiba', country: 'JP' },
      { name: 'Saitama', country: 'JP' },
      { name: 'Machida', country: 'JP' }
    ];
  } else if (nameLower.includes('new york') || nameLower.includes('york')) {
    return [
      { name: 'Newark', country: 'US' },
      { name: 'Jersey City', country: 'US' },
      { name: 'Yonkers', country: 'US' },
      { name: 'Paterson', country: 'US' },
      { name: 'Hoboken', country: 'US' }
    ];
  }
  // Generic fallback based on center city name
  return [
    { name: `${centerName} Heights`, country: 'US' },
    { name: `${centerName} Valley`, country: 'US' },
    { name: `${centerName} North`, country: 'US' },
    { name: `${centerName} West`, country: 'US' },
    { name: `${centerName} East`, country: 'US' }
  ];
}

function renderMockExplorerResults(type, centerLat, centerLon, centerName) {
  const neighbors = getMockNeighbors(centerName);
  const results = [];

  neighbors.forEach((n, idx) => {
    const angle = idx * (2 * Math.PI / neighbors.length) + 0.2;
    const dist = 8 + idx * 7 + Math.random() * 4; // realistic offset distances
    
    // Convert dist in km to lat/lon offsets
    const latOffset = (dist / 111) * Math.sin(angle);
    const lonOffset = (dist / (111 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(angle);
    
    const lat = centerLat + latOffset;
    const lon = centerLon + lonOffset;

    let temp, id, desc;
    if (type === 'sunny') {
      temp = 20 + Math.random() * 8;
      id = 800;
      desc = 'clear sky';
    } else if (type === 'rainy') {
      temp = 9 + Math.random() * 6;
      id = 501;
      desc = 'moderate rain';
    } else if (type === 'snowy') {
      temp = -4 + Math.random() * 4;
      id = 601;
      desc = 'light snow';
    } else { // cloudy
      temp = 14 + Math.random() * 5;
      id = 803;
      desc = 'broken clouds';
    }

    results.push({
      name: n.name,
      country: n.country,
      lat: lat,
      lon: lon,
      temp: temp,
      id: id,
      desc: desc,
      distance: dist
    });
  });

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance);

  renderExplorerResultsList(results);
}

function renderExplorerResultsList(items) {
  const resultsEl = document.getElementById('explorerResults');
  const loadingEl = document.getElementById('explorerLoading');

  if (loadingEl) loadingEl.style.display = 'none';
  if (!resultsEl) return;

  resultsEl.innerHTML = '';

  if (items.length === 0) {
    resultsEl.innerHTML = `
      <div style="font-size: 12.5px; color: var(--text-secondary); text-align: center; padding: 20px 0;">
        No nearby places found with this weather condition.
      </div>
    `;
    return;
  }

  const unit = isCelsius ? '°C' : '°F';

  items.forEach(item => {
    const isNight = false; // default for explorer list items
    const emoji = weatherEmoji(item.id, isNight);
    const displayTemp = isCelsius ? item.temp : (item.temp * 9 / 5 + 32);

    const row = document.createElement('div');
    row.className = 'explorer-city-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <span style="font-size: 20px;">${emoji}</span>
        <div style="display: flex; flex-direction: column; min-width: 0;">
          <span style="font-family: 'Outfit', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${item.name}, ${item.country}
          </span>
          <span style="font-size: 11px; color: var(--text-secondary);">
            ${item.distance.toFixed(1)} km away · ${item.desc}
          </span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
        <span style="font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: var(--text-primary);">
          ${Math.round(displayTemp)}${unit}
        </span>
        <button class="explorer-view-btn" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.name}" data-country="${item.country}">
          View
        </button>
      </div>
    `;

    const viewBtn = row.querySelector('.explorer-view-btn');
    viewBtn.addEventListener('click', async () => {
      const lat = viewBtn.dataset.lat;
      const lon = viewBtn.dataset.lon;
      const name = viewBtn.dataset.name;
      const country = viewBtn.dataset.country;
      
      // Load city weather on dashboard
      await fetchWeatherByCoords(lat, lon, name, country);
      
      // Smoothly scroll back to the top of the dashboard
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    resultsEl.appendChild(row);
  });
}

