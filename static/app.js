/**
 * Eliana - App Principal ELIANA
 * Chat con voz y transiciones
 */

// Configuración del mood
const MOOD_CONFIG = {
    labels: [
        { min: 0,  max: 30,  label: 'MAL',         category: 'sad' },
        { min: 31, max: 65,  label: 'NO MUY BIEN',  category: 'neutral' },
        { min: 66, max: 100, label: 'BIEN',          category: 'happy' }
    ],
    reactions: {
        sad:     'Lamento que no te encuentres bien. Estoy aquí para ayudarte en lo que necesites.',
        neutral: 'Gracias por compartirlo. Vamos a hacer que tu día mejore.',
        happy:   'Me alegra saber que estás bien. Sigamos con energía.'
    },
    orbPresets: {
        sad: 'a',
        neutral: 'b',
        happy: 'c'
    },
    // Colores dinámicos del overlay — bg (fondo) y fg (textos/iconos)
    // Tres stops: 0 = sad, 50 = neutral, 100 = happy
    colors: {
        stops: [
            { at: 0,   bg: [235, 168, 157], fg: [120, 40, 30]  },   // Salmón / coral
            { at: 50,  bg: [245, 215, 140], fg: [100, 75, 20]  },   // Dorado / ámbar
            { at: 100, bg: [220, 200, 240], fg: [60, 10, 55]   }    // Lavanda cálido
        ]
    }
};

// Track si el usuario ya interactuó (click/touch) — necesario para reproducir audio
let _userHasInteracted = false;
const _markInteracted = () => {
    _userHasInteracted = true;
    document.removeEventListener('click', _markInteracted, true);
    document.removeEventListener('touchstart', _markInteracted, true);
};
document.addEventListener('click', _markInteracted, true);
document.addEventListener('touchstart', _markInteracted, true);

// Estado global
const state = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    websocket: null,
    currentMessage: '',
    orbMode: 'minimize', // Opción fija: orb minimizado flotante en chat
    audioStream: null,
    cachedMicStream: null,  // Cached mic stream to avoid repeated permission prompts
    // Silence detection
    audioContext: null,
    analyser: null,
    silenceTimer: null,
    // Wake word
    wakeWordEnabled: false,
    wakeWordRecognition: null,
    wakeWordActive: false, // true while SpeechRecognition is running
    // Voice interaction flow
    voiceTriggered: false,      // true when interaction was initiated by voice
    awaitingVoiceMode: null,    // pending message waiting for mode selection by voice
    voiceModeTimeout: null,     // timeout for auto-sending if no voice response
    voiceModeRecording: false,  // true when recording mode answer (longer silence detection)
    // iOS audio unlock
    iosAudioElement: null,      // pre-created Audio element for iOS
    // Streaming markdown parser (smd)
    _smdParser: null,
    // Mood
    mood: {
        value: 100,
        label: 'BIEN',
        category: 'happy',
        submitted: false,
        timestamp: null
    },
    // Activity / Conoce mode
    activityMode: null,        // 'yo_nunca_nunca' | 'dime_algo' | 'pregunta_ia' | null
    activityMessageCount: 0,
    profileGenerated: false,
    // Blinda tu Prompt
    blindaCards: [],            // all fetched cards (cached)
    blindaRound: [],           // 5 cards for current round
    blindaIndex: 0,            // current card (0-4)
    blindaScore: 0,            // correct answers
    blindaAnswers: [],         // [{card, chosen, correct}]
    _blindaContextSent: false, // prior_context sent flag
    demoStep: 0,               // demo visual step (0-3)
    // Juego (diapo 4)
    juegoRound: [],
    juegoIndex: 0,
    juegoScore: 0,
    juegoAnswers: [],
    // Diapo 5 — Agentes
    diapo5Step: 0,
    _diapo5Ws: null,
    _diapo5ContextSent: false,
    _diapo5SmdParser: null,
    // Diapo 6 — MIAU
    _diapo6Ws: null,
    _diapo6ContextSent: false,
    _diapo6SmdParser: null,
    // Diapo 7 — Plataforma
    _diapo7Ws: null,
    _diapo7ContextSent: false,
    _diapo7SmdParser: null,
    _diapo7CurrentMsg: ''
};

// Elementos
const elements = {
    // Login screen
    loginScreen: document.getElementById('login-screen'),
    loginUser: document.getElementById('login-user'),
    loginPassword: document.getElementById('login-password'),
    loginBtn: document.getElementById('login-btn'),
    faceidBtn: document.getElementById('faceid-btn'),
    loginOrbContainer: document.getElementById('login-orb-container'),

    // Welcome screen
    welcomeScreen: document.getElementById('welcome-screen'),
    profileBtn: document.getElementById('profile-btn'),
    messageInput: document.getElementById('message-input'),
    // Bento cards
    orbCard: document.getElementById('orb-card'),
    moodCard: document.getElementById('mood-card'),
    planCard: document.getElementById('plan-card'),
    faqSection: document.getElementById('faq-section'),

    // Chat screen
    chatScreen: document.getElementById('chat-screen'),
    backBtn: document.getElementById('back-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    chatPhotoBtn: document.getElementById('chat-photo-btn'),
    chatMicBtn: document.getElementById('chat-mic-btn'),
    chatSendBtn: document.getElementById('chat-send-btn'),
    chatStatus: document.getElementById('chat-status'),

    // Conoce screen
    conoceScreen: document.getElementById('conoce-screen'),

    // Profile screen
    profileScreen: document.getElementById('profile-screen'),

    // Blinda screen
    blindaScreen: document.getElementById('blinda-screen'),

    // Juego screen (diapo 4)
    juegoScreen: document.getElementById('juego-screen'),

    // Diapo 5 screen
    diapo5Screen: document.getElementById('diapo5-screen'),

    // Diapo 6 screen
    diapo6Screen: document.getElementById('diapo6-screen'),

    // Diapo 7 screen
    diapo7Screen: document.getElementById('diapo7-screen'),

    // Plan screen
    planScreen: document.getElementById('plan-screen'),
    planBackBtn: document.getElementById('plan-back-btn'),
    planOverviewChips: document.querySelectorAll('.plan-filter-chip'),
    navChatBtn: document.getElementById('nav-chat-btn'),
    navOrb: document.getElementById('nav-orb'),

    // Logout buttons (all screens)
    logoutBtn: document.getElementById('logout-btn'),
    chatLogoutBtn: document.getElementById('chat-logout-btn'),
    planLogoutBtn: document.getElementById('plan-logout-btn'),

    // Mood overlay
    moodOverlay: document.getElementById('mood-overlay'),
    moodCloseBtn: document.getElementById('mood-close-btn'),
    moodInfoBtn: document.getElementById('mood-info-btn'),
    moodSlider: document.getElementById('mood-slider'),
    moodLabel: document.getElementById('mood-label'),
    moodSubmitBtn: document.getElementById('mood-submit-btn'),
    moodReaction: document.getElementById('mood-reaction'),
    moodEyeLeft: document.getElementById('mood-eye-left'),
    moodEyeRight: document.getElementById('mood-eye-right'),
    moodMouth: document.getElementById('mood-mouth')
};

// ============================================
// Sistema de Mood
// ============================================
function lerpChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
}

function getMoodColors(value) {
    const stops = MOOD_CONFIG.colors.stops;
    // Encontrar entre qué dos stops estamos
    let lower = stops[0], upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (value >= stops[i].at && value <= stops[i + 1].at) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }
    const range = upper.at - lower.at || 1;
    const t = (value - lower.at) / range;
    const bg = [
        lerpChannel(lower.bg[0], upper.bg[0], t),
        lerpChannel(lower.bg[1], upper.bg[1], t),
        lerpChannel(lower.bg[2], upper.bg[2], t)
    ];
    const fg = [
        lerpChannel(lower.fg[0], upper.fg[0], t),
        lerpChannel(lower.fg[1], upper.fg[1], t),
        lerpChannel(lower.fg[2], upper.fg[2], t)
    ];
    return {
        bg: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
        fg: `rgb(${fg[0]}, ${fg[1]}, ${fg[2]})`
    };
}

function applyMoodColors(value) {
    if (!elements.moodOverlay) return;
    const colors = getMoodColors(value);
    elements.moodOverlay.style.setProperty('--mood-bg', colors.bg);
    elements.moodOverlay.style.setProperty('--mood-fg', colors.fg);
}

// Tintado sutil global — aplica una capa muy tenue del mood a toda la app
function applyGlobalMoodTint(value) {
    const stops = MOOD_CONFIG.colors.stops;
    let lower = stops[0], upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (value >= stops[i].at && value <= stops[i + 1].at) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }
    const range = upper.at - lower.at || 1;
    const t = (value - lower.at) / range;
    const r = lerpChannel(lower.bg[0], upper.bg[0], t);
    const g = lerpChannel(lower.bg[1], upper.bg[1], t);
    const b = lerpChannel(lower.bg[2], upper.bg[2], t);

    document.body.style.setProperty('--mood-tint', `${r}, ${g}, ${b}`);
    document.body.style.setProperty('--mood-tint-strength', '0.07'); // 7% — apenas perceptible
    document.body.setAttribute('data-mood-active', '');

    // Propagar al orb si la API existe
    if (window.orbSetMoodTint) {
        window.orbSetMoodTint(r, g, b);
    }
}

function getMoodCategory(value) {
    for (const cfg of MOOD_CONFIG.labels) {
        if (value >= cfg.min && value <= cfg.max) {
            return { label: cfg.label, category: cfg.category };
        }
    }
    return { label: 'BIEN', category: 'happy' };
}

function updateMoodFace(value) {
    const t = value / 100; // 0 = sad, 1 = happy

    // Ojos redondos: rx=12 siempre, ry varía poco (14 sad → 11 happy squint suave)
    const eyeRx = 12;
    const eyeRy = 14 - 3 * t;    // 14 → 11 (sutil, siempre redondos)
    const eyeCy = 40 + 2 * t;    // 40 → 42 (movimiento mínimo)

    if (elements.moodEyeLeft) {
        elements.moodEyeLeft.setAttribute('rx', eyeRx);
        elements.moodEyeLeft.setAttribute('ry', eyeRy);
        elements.moodEyeLeft.setAttribute('cy', eyeCy);
    }
    if (elements.moodEyeRight) {
        elements.moodEyeRight.setAttribute('rx', eyeRx);
        elements.moodEyeRight.setAttribute('ry', eyeRy);
        elements.moodEyeRight.setAttribute('cy', eyeCy);
    }

    // Boca: controlY de 58 (frown suave) a 78 (smile)
    const controlY = 58 + 20 * t;
    if (elements.moodMouth) {
        elements.moodMouth.setAttribute('d', `M42 68 Q50 ${controlY} 58 68`);
    }
}

function updateCardFace(value) {
    const t = value / 100;
    const eyeRx = 12;
    const eyeRy = 14 - 3 * t;
    const eyeCy = 40 + 2 * t;
    const controlY = 58 + 20 * t;

    // Actualizar la cara en la tarjeta del bento grid
    const card = elements.moodCard;
    if (!card) return;

    const eyeL = card.querySelector('ellipse:first-of-type');
    const eyeR = card.querySelector('ellipse:last-of-type');
    const mouth = card.querySelector('path');

    if (eyeL) { eyeL.setAttribute('rx', eyeRx); eyeL.setAttribute('ry', eyeRy); eyeL.setAttribute('cy', eyeCy); }
    if (eyeR) { eyeR.setAttribute('rx', eyeRx); eyeR.setAttribute('ry', eyeRy); eyeR.setAttribute('cy', eyeCy); }
    if (mouth) { mouth.setAttribute('d', `M42 68 Q50 ${controlY} 58 68`); }
}

function updateMoodLabel(value) {
    const { label } = getMoodCategory(value);
    if (elements.moodLabel) {
        elements.moodLabel.textContent = label;
    }
}

function openMoodOverlay() {
    if (!elements.moodOverlay) return;

    // Resetear estado visual
    elements.moodReaction.textContent = '';
    elements.moodReaction.classList.remove('visible');
    elements.moodSubmitBtn.disabled = false;
    elements.moodSubmitBtn.textContent = state.mood.submitted ? 'Actualizar' : 'Enviar';

    // Poner slider en el valor actual
    elements.moodSlider.value = state.mood.value;
    updateMoodFace(state.mood.value);
    updateMoodLabel(state.mood.value);
    applyMoodColors(state.mood.value);

    // Mostrar overlay con animación
    elements.moodOverlay.classList.remove('hidden');
    elements.moodOverlay.style.animation = 'moodOverlayEnter 0.4s var(--md-sys-motion-easing-emphasized-decelerate) forwards';
}

function closeMoodOverlay() {
    if (!elements.moodOverlay) return;

    elements.moodOverlay.style.animation = 'moodOverlayExit 0.3s var(--md-sys-motion-easing-emphasized-accelerate) forwards';
    elements.moodOverlay.addEventListener('animationend', function handler() {
        elements.moodOverlay.classList.add('hidden');
        elements.moodOverlay.style.animation = '';
        elements.moodOverlay.removeEventListener('animationend', handler);
    });
}

function onMoodSliderInput(e) {
    const value = parseInt(e.target.value, 10);
    updateMoodFace(value);
    updateMoodLabel(value);
    applyMoodColors(value);
}

function submitMood() {
    const value = parseInt(elements.moodSlider.value, 10);
    const { label, category } = getMoodCategory(value);
    const wasAlreadySubmitted = state.mood.submitted;

    // Actualizar estado
    state.mood.value = value;
    state.mood.label = label;
    state.mood.category = category;
    state.mood.submitted = true;
    state.mood.timestamp = Date.now();

    // Propagar a la tarjeta
    updateCardFace(value);
    const cardTitle = elements.moodCard?.querySelector('.bento-card__title');
    if (cardTitle) {
        cardTitle.textContent = `Hoy: ${label}`;
    }

    // Propagar al orb
    const orbPreset = MOOD_CONFIG.orbPresets[category];
    if (window.orbSetMoodPreset) window.orbSetMoodPreset(orbPreset);

    // Aplicar tintado global sutil
    applyGlobalMoodTint(value);

    // Guardar en localStorage
    saveMoodToStorage();

    // Mostrar reacción AI
    const reaction = wasAlreadySubmitted
        ? 'Actualizado. ' + MOOD_CONFIG.reactions[category]
        : MOOD_CONFIG.reactions[category];
    elements.moodReaction.textContent = reaction;
    elements.moodReaction.classList.add('visible');
    elements.moodSubmitBtn.disabled = true;

    // Cerrar overlay tras 2 segundos
    setTimeout(() => {
        closeMoodOverlay();
    }, 2000);
}

// Fecha local YYYY-MM-DD (sin depender de UTC)
function getLocalDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function saveMoodToStorage() {
    const data = {
        value: state.mood.value,
        label: state.mood.label,
        category: state.mood.category,
        date: getLocalDateStr(),
        timestamp: state.mood.timestamp
    };
    localStorage.setItem('eliana_mood', JSON.stringify(data));
}

function loadMoodFromStorage() {
    try {
        const raw = localStorage.getItem('eliana_mood');
        if (!raw) return;

        const data = JSON.parse(raw);
        const today = getLocalDateStr();

        // Reset diario: si es otro día, borrar y empezar de cero
        if (data.date !== today) {
            const utcToday = new Date().toISOString().slice(0, 10);
            if (data.date !== utcToday) {
                localStorage.removeItem('eliana_mood');
                return;
            }
        }

        // Solo restaurar estado interno (para enviar mood en WebSocket)
        // La UI siempre arranca limpia con la pregunta "¿Cómo te encuentras hoy?"
        state.mood.value = data.value;
        state.mood.label = data.label;
        state.mood.category = data.category;
        state.mood.submitted = true;
        state.mood.timestamp = data.timestamp;

    } catch (e) {
        console.error('Error cargando mood:', e);
    }
}

// ============================================
// Búsquedas Recientes
// ============================================
const RECENT_SEARCHES_KEY = 'eliana_recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Iconos según tipo de búsqueda
const SEARCH_ICONS = {
    product:   'package',
    objection: 'shield',
    argument:  'trend-up',
    voice:     'microphone',
    default:   'clock'
};

function classifySearchIcon(query) {
    const q = query.toLowerCase();
    if (/producto|eliana|biopro|fbio|dvs|hialuronic|relleno/i.test(q)) return 'product';
    if (/objeción|objecion|caro|no funciona|otra marca|profhilo/i.test(q)) return 'objection';
    if (/argumento|venta|presentar|dermatólogo|cirujano|perfil|ventaja/i.test(q)) return 'argument';
    return 'default';
}

function getSearchDescription(query) {
    const type = classifySearchIcon(query);
    switch (type) {
        case 'product':   return 'Consulta sobre recursos ELE';
        case 'objection': return 'Manejo de objeciones médicas';
        case 'argument':  return 'Estrategia de argumentación comercial';
        default:          return 'Conversación con el asistente';
    }
}

function loadRecentSearches() {
    try {
        const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Sincroniza el historial con el servidor (carga desde servidor si hay datos más recientes)
 */
async function syncSearchHistory() {
    const username = localStorage.getItem('eliana_user');
    if (!username) return;

    try {
        const response = await fetch('/api/history/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.searches && data.searches.length > 0) {
                const localSearches = loadRecentSearches();
                const localTimestamp = localSearches.length > 0
                    ? Math.max(...localSearches.map(s => s.timestamp || 0))
                    : 0;

                // Si el servidor tiene datos más recientes, usarlos
                if (data.last_sync > localTimestamp) {
                    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(data.searches));
                    console.log('[Sync] Loaded', data.searches.length, 'searches from server');
                    renderRecentSearches();
                } else {
                    // Local es más reciente, subir al servidor
                    await pushSearchHistory();
                }
            }
        }
    } catch (e) {
        console.log('[Sync] Could not sync with server:', e.message);
    }
}

/**
 * Sube el historial local al servidor
 */
async function pushSearchHistory() {
    const username = localStorage.getItem('eliana_user');
    if (!username) return;

    const searches = loadRecentSearches();
    if (searches.length === 0) return;

    try {
        await fetch('/api/history/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, searches })
        });
        console.log('[Sync] Pushed', searches.length, 'searches to server');
    } catch (e) {
        console.log('[Sync] Could not push to server:', e.message);
    }
}

function saveRecentSearch(query, isVoice = false) {
    const searches = loadRecentSearches();

    // No duplicar la misma consulta (case-insensitive)
    const idx = searches.findIndex(s => s.query.toLowerCase() === query.toLowerCase());
    if (idx !== -1) {
        searches.splice(idx, 1);
    }

    const icon = isVoice ? 'voice' : classifySearchIcon(query);
    const desc = getSearchDescription(query);

    searches.unshift({
        query,
        icon,
        desc,
        timestamp: Date.now()
    });

    // Limitar a MAX
    if (searches.length > MAX_RECENT_SEARCHES) {
        searches.length = MAX_RECENT_SEARCHES;
    }

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    renderRecentSearches();

    // Sincronizar con servidor (async, no bloqueante)
    pushSearchHistory();
}

/**
 * Actualiza la búsqueda reciente más reciente que coincida con la query,
 * añadiendo la respuesta completa del agente para persistencia.
 */
function updateRecentSearchAnswer(query, answer) {
    const searches = loadRecentSearches();
    const idx = searches.findIndex(s => s.query.toLowerCase() === query.toLowerCase());
    if (idx !== -1) {
        searches[idx].answer = answer;
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
        // Sincronizar con servidor
        pushSearchHistory();
    }
}

function renderRecentSearches() {
    const container = document.getElementById('recent-searches-list');
    const section = document.getElementById('recent-searches');
    const emptyMsg = document.getElementById('recent-searches-empty');
    if (!container || !section) return;

    const searches = loadRecentSearches();

    if (searches.length === 0) {
        section.classList.add('recent-searches--empty');
        if (emptyMsg) emptyMsg.style.display = '';
        container.innerHTML = '';
        return;
    }

    section.classList.remove('recent-searches--empty');
    if (emptyMsg) emptyMsg.style.display = 'none';
    container.innerHTML = '';

    // Mostrar hasta 5 en la pantalla principal
    const visible = searches.slice(0, 5);

    for (const item of visible) {
        const iconName = SEARCH_ICONS[item.icon] || SEARCH_ICONS.default;

        const el = document.createElement('button');
        el.className = 'recent-search-item';
        el.innerHTML = `
            <div class="recent-search-item__icon">
                <i class="ph ph-${iconName}"></i>
            </div>
            <div class="recent-search-item__text">
                <span class="recent-search-item__query">${escapeHtml(item.query)}</span>
                <span class="recent-search-item__desc">${escapeHtml(item.desc)}</span>
            </div>
            <div class="recent-search-item__arrow">
                <i class="ph ph-arrow-right"></i>
            </div>
        `;
        el.addEventListener('click', () => {
            if (item.answer) {
                showChatScreenWithAnswer(item.query, item.answer);
            } else {
                showChatScreen(item.query, isActionableQuery(item.query));
            }
        });
        container.appendChild(el);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// Sistema de Plan — Datos y renderizado
// ============================================

// Tareas mock con fechas reales relativas a hoy (27 enero 2026)
const PLAN_TASKS = [
    // --- En proceso (fecha de hoy) ---
    { id: 1, title: 'Visita Dra. García — Dermatología', date: '2026-01-27', project: 'visitas', status: 'in_progress', tasks: 2, subtasks: 1 },
    { id: 2, title: 'Estudiar ficha BioPRO', date: '2026-01-27', project: 'formacion', status: 'in_progress', tasks: 1, subtasks: 0 },
    { id: 3, title: 'Preparar argumentario Cirugía Plástica', date: '2026-01-27', project: 'visitas', status: 'in_progress', tasks: 3, subtasks: 2 },
    // --- Por hacer (futuro cercano) ---
    { id: 4, title: 'Visita Dra. López — Pediatría', date: '2026-01-28', project: 'visitas', status: 'todo', tasks: 2, subtasks: 0 },
    { id: 5, title: 'Informe semanal de ventas', date: '2026-01-29', project: 'admin', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 6, title: 'Llamada farmacia central', date: '2026-01-30', project: 'visitas', status: 'todo', tasks: 1, subtasks: 1 },
    { id: 7, title: 'Revisar catálogo FBio DVS', date: '2026-01-31', project: 'formacion', status: 'todo', tasks: 2, subtasks: 0 },
    { id: 8, title: 'Reunión equipo zona norte', date: '2026-02-02', project: 'admin', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 9, title: 'Visita Dr. Fernández — Dermatología', date: '2026-02-03', project: 'visitas', status: 'todo', tasks: 2, subtasks: 1 },
    { id: 10, title: 'Actualizar CRM contactos', date: '2026-02-05', project: 'admin', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 11, title: 'Preparar presentación BioPRO', date: '2026-02-07', project: 'formacion', status: 'todo', tasks: 3, subtasks: 2 },
    // --- Retrasadas (antes de hoy) ---
    { id: 12, title: 'Seguimiento Dr. Martínez', date: '2026-01-26', project: 'visitas', status: 'overdue', tasks: 1, subtasks: 1 },
    { id: 13, title: 'Completar módulo tecnología DVS', date: '2026-01-25', project: 'formacion', status: 'overdue', tasks: 2, subtasks: 0 },
    { id: 14, title: 'Enviar muestras Hospital Clínic', date: '2026-01-24', project: 'visitas', status: 'overdue', tasks: 1, subtasks: 0 },
    // --- Completadas ---
    { id: 15, title: 'Visita Dra. Ruiz — Cirugía Plástica', date: '2026-01-23', project: 'visitas', status: 'done', tasks: 2, subtasks: 1 },
    { id: 16, title: 'Curso online DVS vs BDDE', date: '2026-01-22', project: 'formacion', status: 'done', tasks: 1, subtasks: 0 },
];

// Proyectos con sus colores
const PLAN_PROJECTS = {
    visitas:   { label: 'Visitas médicas', color: 'var(--md-sys-color-primary)' },
    formacion: { label: 'Formación',       color: 'var(--md-sys-color-secondary)' },
    admin:     { label: 'Administración',  color: 'var(--md-sys-color-tertiary)' }
};

// Grupos de estado con config visual
const STATUS_GROUPS = [
    { key: 'in_progress', label: 'En proceso', dotClass: 'plan-task-group__dot--in-progress' },
    { key: 'todo',        label: 'Por hacer',  dotClass: 'plan-task-group__dot--todo' },
    { key: 'overdue',     label: 'Retrasadas', dotClass: 'plan-task-group__dot--overdue' },
    { key: 'done',        label: 'Completadas', dotClass: 'plan-task-group__dot--done' }
];

// Estado actual del filtro overview
let currentOverview = 'hoy';

// Nombres de meses en español
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatTaskDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

// Calcular rango de fechas según overview
function getOverviewRange(overview) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(today);

    switch (overview) {
        case 'hoy':
            end.setHours(23, 59, 59, 999);
            break;
        case 'semana':
            // Lunes a domingo de esta semana
            const dayOfWeek = today.getDay(); // 0=dom, 1=lun...
            const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
            end.setDate(today.getDate() + daysToSunday);
            end.setHours(23, 59, 59, 999);
            break;
        case 'quincena':
            end.setDate(today.getDate() + 14);
            end.setHours(23, 59, 59, 999);
            break;
    }

    return { today, end };
}

// Clasificar tareas según el overview seleccionado
// SOLO incluye tareas cuya fecha cae dentro del rango (o retrasadas/completadas relevantes)
function classifyTasks(overview) {
    const { today, end } = getOverviewRange(overview);

    const result = {
        in_progress: [],
        todo: [],
        overdue: [],
        done: []
    };

    for (const task of PLAN_TASKS) {
        const taskDate = new Date(task.date + 'T00:00:00');

        // Completadas: solo mostrar si su fecha cae dentro del rango
        if (task.status === 'done') {
            if (taskDate >= today && taskDate <= end) {
                result.done.push(task);
            }
            continue;
        }

        // Retrasadas: fecha anterior a hoy — siempre se muestran (son pendientes atrasadas)
        if (taskDate < today) {
            result.overdue.push(task);
            continue;
        }

        // Fuera del rango del overview: no mostrar
        if (taskDate > end) {
            continue;
        }

        // Dentro del rango: clasificar según su status original
        if (task.status === 'in_progress') {
            result.in_progress.push(task);
        } else {
            result.todo.push(task);
        }
    }

    return result;
}

// Aplicar filtros de la sección de tareas
function applyTaskFilters(classified) {
    const projectFilter = document.getElementById('filter-project')?.value || 'all';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';

    const filtered = {};
    for (const [status, tasks] of Object.entries(classified)) {
        filtered[status] = tasks.filter(t => {
            if (projectFilter !== 'all' && t.project !== projectFilter) return false;
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            return true;
        });
    }
    return filtered;
}

// Actualizar contadores de stat cards (solo tareas visibles en el overview)
function updatePlanStats(classified) {
    const el = (id) => document.getElementById(id);

    // Reunir todas las tareas visibles
    const allVisible = [
        ...classified.in_progress,
        ...classified.todo,
        ...classified.overdue,
        ...classified.done
    ];
    const visibleProjects = new Set(allVisible.map(t => t.project));

    if (el('stat-in-progress')) el('stat-in-progress').textContent = classified.in_progress.length;
    if (el('stat-todo'))        el('stat-todo').textContent = classified.todo.length;
    if (el('stat-overdue'))     el('stat-overdue').textContent = classified.overdue.length;
    if (el('stat-projects'))    el('stat-projects').textContent = visibleProjects.size;
    if (el('stat-total'))       el('stat-total').textContent = allVisible.length;
}

// Renderizar la lista de tareas agrupadas
function renderPlanTasks() {
    const container = document.getElementById('plan-tasks-list');
    if (!container) return;

    const classified = classifyTasks(currentOverview);

    // Actualizar stats
    updatePlanStats(classified);

    // Aplicar filtros de sección
    const filtered = applyTaskFilters(classified);

    // Limpiar
    container.innerHTML = '';

    // Renderizar cada grupo que tenga tareas
    for (const group of STATUS_GROUPS) {
        const tasks = filtered[group.key];
        if (!tasks || tasks.length === 0) continue;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'plan-task-group';

        // Label del grupo
        const label = document.createElement('h3');
        label.className = 'plan-task-group__label';
        label.innerHTML = `<span class="plan-task-group__dot ${group.dotClass}"></span> ${group.label}`;
        groupDiv.appendChild(label);

        // Task cards
        for (const task of tasks) {
            const card = document.createElement('div');
            card.className = 'plan-task-card' + (group.key === 'overdue' ? ' plan-task-card--overdue' : '') + (group.key === 'done' ? ' plan-task-card--done' : '');
            card.dataset.status = group.key;
            card.dataset.project = task.project;

            const metaParts = [];
            if (task.tasks > 0) metaParts.push(`${task.tasks} tarea${task.tasks > 1 ? 's' : ''}`);
            if (task.subtasks > 0) metaParts.push(`${task.subtasks} sub-tarea${task.subtasks > 1 ? 's' : ''}`);

            card.innerHTML = `
                <div class="plan-task-card__left">
                    <span class="plan-task-card__date">${formatTaskDate(task.date)}</span>
                    <span class="plan-task-card__title">${task.title}</span>
                    <span class="plan-task-card__meta">
                        <i class="ph ph-check-circle"></i> ${metaParts.join(' · ')}
                    </span>
                </div>
                <button class="plan-task-card__menu" title="Opciones">
                    <i class="ph ph-dots-three-vertical"></i>
                </button>
            `;
            groupDiv.appendChild(card);
        }

        container.appendChild(groupDiv);
    }

    // Si no hay tareas
    if (container.children.length === 0) {
        container.innerHTML = '<p class="plan-tasks-empty">No hay tareas para este filtro</p>';
    }
}

// ============================================
// Navegación entre pantallas
// ============================================
function showChatScreen(initialMessage, showSelector = false, skipSend = false) {
    // Fade out welcome
    elements.welcomeScreen.classList.add('fade-out');

    setTimeout(() => {
        elements.welcomeScreen.classList.add('hidden');
        elements.welcomeScreen.classList.remove('fade-out');
        elements.chatScreen.classList.remove('hidden');

        // Crear orb en el header del chat
        if (window.orbCreateChatHeader) window.orbCreateChatHeader();

        // Añadir mensaje del usuario
        if (initialMessage) {
            addMessage(initialMessage, 'user');
            if (skipSend) {
                // Voice mode: ask mode by TTS after transition
                askResponseModeByVoice(initialMessage);
            } else if (showSelector) {
                showResponseModeSelector(initialMessage);
            } else {
                sendToWebSocket(initialMessage);
            }
        }

        // Focus en input
        elements.chatInput.focus();
    }, 300);
}

function showChatScreenWithAnswer(question, answer) {
    elements.welcomeScreen.classList.add('fade-out');

    // Guardar contexto previo para que el próximo mensaje lo envíe al backend
    state.priorContext = { question, answer };

    setTimeout(() => {
        elements.welcomeScreen.classList.add('hidden');
        elements.welcomeScreen.classList.remove('fade-out');
        elements.chatScreen.classList.remove('hidden');

        // Crear orb en el header del chat
        if (window.orbCreateChatHeader) window.orbCreateChatHeader();

        // Mostrar pregunta y respuesta hardcodeadas
        addMessage(question, 'user');
        addMessage(answer, 'assistant');

        elements.chatInput.focus();
    }, 300);
}

function showWelcomeScreen() {
    // Detener TTS inmediatamente al navegar atrás
    stopTTS();

    elements.chatScreen.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.welcomeScreen.classList.remove('hidden');

    // Limpiar chat
    elements.chatMessages.innerHTML = '';

    // Cerrar WebSocket si existe
    if (state.websocket) {
        state.websocket.close();
        state.websocket = null;
    }

    // Limpiar contexto previo
    state.priorContext = null;

    // Reset activity state
    state.activityMode = null;
    state.activityMessageCount = 0;
    state.profileGenerated = false;

    // Actualizar búsquedas recientes
    renderRecentSearches();
}

function showPlanScreen() {
    // Fade out welcome
    elements.welcomeScreen.classList.add('fade-out');

    setTimeout(() => {
        elements.welcomeScreen.classList.add('hidden');
        elements.welcomeScreen.classList.remove('fade-out');
        elements.planScreen.classList.remove('hidden');

        // Renderizar tareas con el overview actual
        renderPlanTasks();

        // Crear orb en el nav
        if (window.orbCreateNav) window.orbCreateNav();
    }, 300);
}

function showWelcomeFromPlan() {
    stopTTS();
    elements.planScreen.classList.add('hidden');
    elements.welcomeScreen.classList.remove('hidden');
    renderRecentSearches();
}

function showChatFromPlan() {
    elements.planScreen.classList.add('hidden');
    elements.chatScreen.classList.remove('hidden');
    // Crear orb en el header del chat
    if (window.orbCreateChatHeader) window.orbCreateChatHeader();
}

// ============================================
// Markdown rendering + Phosphor icon enrichment
// ============================================

// Map of keywords to Phosphor icon names for semantic enrichment
const ICON_MAP_HEADERS = {
    // Product-related
    'producto':     'package',
    'productos':    'package',
    'eliana':    'chalkboard-teacher',
    'biopro':       'drop',
    'bio pro':      'drop',
    'fbio':         'syringe',
    'dvs':          'drop',
    'hialuronico':  'drop',
    'composición':  'flask',
    'composicion':  'flask',
    'ingrediente':  'flask',
    'formulación':  'flask',
    'formulacion':  'flask',
    // Clinical / medical
    'indicación':   'heartbeat',
    'indicacion':   'heartbeat',
    'indicaciones': 'heartbeat',
    'clínic':       'heartbeat',
    'clinic':       'heartbeat',
    'dosis':        'eyedropper',
    'dosificación': 'eyedropper',
    'posología':    'eyedropper',
    'beneficio':    'star',
    'beneficios':   'star',
    'ventaja':      'star',
    'ventajas':     'star',
    // Quality & tech
    'calidad':      'seal-check',
    'certificación':'seal-check',
    'certificacion':'seal-check',
    'tecnología':   'gear',
    'tecnologia':   'gear',
    'rtg':          'gear',
    'pureza':       'shield-check',
    'seguridad':    'shield-check',
    // Sales
    'argumento':    'megaphone',
    'argumentos':   'megaphone',
    'venta':        'trend-up',
    'ventas':       'trend-up',
    'estrategia':   'strategy',
    'presentación': 'presentation-chart',
    'presentacion': 'presentation-chart',
    // Objections
    'objeción':     'shield',
    'objecion':     'shield',
    'objeciones':   'shield',
    'precio':       'currency-circle-dollar',
    'costo':        'currency-circle-dollar',
    'coste':        'currency-circle-dollar',
    'eficacia':     'chart-line-up',
    'resultado':    'chart-line-up',
    'resultados':   'chart-line-up',
    // Medical specialties
    'cardio':       'heart',
    'cardiología':  'heart',
    'cardiologia':  'heart',
    'ginecología':  'gender-female',
    'ginecologia':  'gender-female',
    'neurología':   'brain',
    'neurologia':   'brain',
    'pediatría':    'baby',
    'pediatria':    'baby',
    'psiquiatría':  'brain',
    'psiquiatria':  'brain',
    'reumatología': 'bone',
    'reumatologia': 'bone',
    // Specialist
    'especialista': 'user-circle',
    'médico':       'stethoscope',
    'medico':       'stethoscope',
    'doctor':       'stethoscope',
    'paciente':     'user',
    'perfil':       'user-focus',
    // Sections
    'reconocimiento': 'handshake',
    'reencuadre':     'arrows-clockwise',
    'guion':          'quotes',
    'guión':          'quotes',
    'script':         'quotes',
    'datos clave':    'chart-bar',
    'evidencia':      'article',
    'estudio':        'book-open-text',
    'estudios':       'book-open-text',
    'referencia':     'book-open-text',
    'comparativa':    'scales',
    'comparación':    'scales',
    'comparacion':    'scales',
    'diferencia':     'scales',
    'diferenciación': 'star-four',
    'diferenciacion': 'star-four',
    'conclusión':     'check-circle',
    'conclusion':     'check-circle',
    'resumen':        'list-bullets',
    'recomendación':  'lightbulb',
    'recomendacion':  'lightbulb',
    'tip':            'lightbulb',
    'nota':           'note',
    'importante':     'warning-circle',
    'advertencia':    'warning',
    'interacción':    'warning',
    'interaccion':    'warning',
    'contraindicación': 'prohibit'
};

// Icon for table header cells based on content
const ICON_MAP_TABLE = {
    'producto':       'package',
    'nombre':         'tag',
    'composición':    'flask',
    'composicion':    'flask',
    'dosis':          'eyedropper',
    'concentración':  'flask',
    'concentracion':  'flask',
    'indicación':     'heartbeat',
    'indicacion':     'heartbeat',
    'presentación':   'pill',
    'presentacion':   'pill',
    'precio':         'currency-circle-dollar',
    'beneficio':      'star',
    'ventaja':        'star',
    'característica': 'check-circle',
    'caracteristica': 'check-circle',
    'aspecto':        'list-bullets',
    'dato':           'chart-bar',
    'detalle':        'info',
    'componente':     'flask',
    'vlift':          'activity',
    'dlift':          'activity',
    'forma':          'shapes',
    'certificación':  'seal-check',
    'certificacion':  'seal-check',
    'paso':           'number-circle-one',
    'acción':         'lightning',
    'accion':         'lightning',
    'argumento':      'megaphone',
    'objeción':       'shield',
    'objecion':       'shield',
    'respuesta':      'chat-circle-text'
};

/**
 * Find the best matching Phosphor icon for a text string.
 */
function findIconForText(text, iconMap) {
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lowerOriginal = text.toLowerCase();

    // Try exact or partial match
    for (const [keyword, icon] of Object.entries(iconMap)) {
        const kwNorm = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lowerOriginal.includes(keyword) || lower.includes(kwNorm)) {
            return icon;
        }
    }
    return null;
}

/**
 * Post-process rendered HTML to inject Phosphor icons at semantic points.
 * - Before h2/h3 headings
 * - In table header cells
 * - Before blockquotes (as a quote icon)
 * - Before list items (subtle icon for key terms)
 */
function enrichWithIcons(html) {
    const container = document.createElement('div');
    container.innerHTML = html;

    // 1. Headings — inject icon before text
    container.querySelectorAll('h2, h3').forEach(heading => {
        const text = heading.textContent;
        const icon = findIconForText(text, ICON_MAP_HEADERS);
        if (icon) {
            const iconEl = document.createElement('i');
            iconEl.className = `ph ph-${icon} md-icon-heading`;
            heading.insertBefore(iconEl, heading.firstChild);
            // Add a space after icon
            heading.insertBefore(document.createTextNode(' '), iconEl.nextSibling);
        }
    });

    // 2. Table header cells — inject icon before text
    container.querySelectorAll('thead th').forEach(th => {
        const text = th.textContent;
        const icon = findIconForText(text, ICON_MAP_TABLE);
        if (icon) {
            const iconEl = document.createElement('i');
            iconEl.className = `ph ph-${icon} md-icon-th`;
            th.insertBefore(iconEl, th.firstChild);
            th.insertBefore(document.createTextNode(' '), iconEl.nextSibling);
        }
    });

    // 3. Blockquotes — add quote icon at the start
    container.querySelectorAll('blockquote').forEach(bq => {
        const firstP = bq.querySelector('p') || bq;
        if (!firstP.querySelector('.md-icon-bq')) {
            const iconEl = document.createElement('i');
            iconEl.className = 'ph ph-quotes md-icon-bq';
            firstP.insertBefore(iconEl, firstP.firstChild);
            firstP.insertBefore(document.createTextNode(' '), iconEl.nextSibling);
        }
    });

    // 4. Strong text inside list items — add contextual icon
    container.querySelectorAll('li').forEach(li => {
        const strong = li.querySelector('strong');
        if (strong) {
            const icon = findIconForText(strong.textContent, ICON_MAP_HEADERS);
            if (icon) {
                const iconEl = document.createElement('i');
                iconEl.className = `ph ph-${icon} md-icon-li`;
                li.insertBefore(iconEl, li.firstChild);
                li.insertBefore(document.createTextNode(' '), iconEl.nextSibling);
            }
        }
    });

    // 5. Source badge — replace external source markers with visual badge
    const GENERAL_MARKERS = [
        '(fuente externa no empresarial)',
        '(fuente externa no empresarial)',
        '*(fuente externa no empresarial)*',
        // Legacy markers (backward compat)
        '(información de la web)',
        '(informacion de la web)',
        '*(información de la web)*',
        '*(informacion de la web)*',
        '(conocimiento científico general)',
        '(conocimiento cientifico general)',
        '*(conocimiento científico general)*',
        '*(conocimiento cientifico general)*'
    ];
    const badgeHTML = '<span class="source-badge-general" tabindex="0"><i class="ph ph-warning-circle"></i> Fuente externa</span>';

    let finalHTML = container.innerHTML;
    for (const marker of GENERAL_MARKERS) {
        // Replace both the <em> wrapped version and raw text version
        const emWrapped = `<em>${marker.replace(/^\*|\*$/g, '')}</em>`;
        if (finalHTML.includes(emWrapped)) {
            finalHTML = finalHTML.split(emWrapped).join(badgeHTML);
        }
        if (finalHTML.includes(marker)) {
            finalHTML = finalHTML.split(marker).join(badgeHTML);
        }
    }

    // 6. Wrap tables in responsive scroll container
    finalHTML = finalHTML.replace(/<table([\s\S]*?)<\/table>/gi, (match) => {
        return `<div class="table-responsive">${match}</div>`;
    });

    // 7. Wrap "Ficha Técnica" section in a card div
    // Detects any <h3> containing "Ficha Técnica" — wraps from that h3 to the next <h2>/<h3> or end
    finalHTML = finalHTML.replace(
        /(<h3[^>]*>(?:[^<]*(?:<[^>]*>)*)*?[Ff]icha\s+[Tt][eé]cnica[\s\S]*?)(?=<h[23][^>]*>|$)/i,
        (fichaBlock) => {
            return `<div class="ficha-tecnica">${fichaBlock}</div>`;
        }
    );

    return finalHTML;
}

/**
 * Render markdown to HTML.
 * @param {string} text - raw markdown
 * @param {boolean} enrich - if true, inject Phosphor icons (use false during streaming for performance)
 */
function renderMarkdown(text, enrich = true) {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        const html = marked.parse(text);
        const clean = DOMPurify.sanitize(html);
        return enrich ? enrichWithIcons(clean) : clean;
    }
    // Fallback: escape HTML
    return escapeHtml(text);
}

function stripMarkdown(text) {
    return text
        .replace(/#{1,6}\s+/g, '')           // headers
        .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
        .replace(/\*(.+?)\*/g, '$1')         // italic
        .replace(/_(.+?)_/g, '$1')           // italic alt
        .replace(/~~(.+?)~~/g, '$1')         // strikethrough
        .replace(/`(.+?)`/g, '$1')           // inline code
        .replace(/```[\s\S]*?```/g, '')      // code blocks
        .replace(/>\s+/g, '')                // blockquotes
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
        .replace(/\|[^\n]+\|/g, '')          // table rows
        .replace(/[-|]+\s*/g, '')            // table separators
        .replace(/[-*+]\s+/g, '')            // unordered lists
        .replace(/\d+\.\s+/g, '')            // ordered lists
        .replace(/\n{2,}/g, '. ')            // double newlines to period
        .replace(/\n/g, ' ')                 // single newlines to space
        .replace(/\s{2,}/g, ' ')             // collapse spaces
        .trim();
}

// ============================================
// Responsive tables — scroll hints
// ============================================
/**
 * Initialise scroll-hint classes on .table-responsive wrappers
 * inside a given container (message element).
 */
function initResponsiveTables(container) {
    if (!container) return;
    container.querySelectorAll('.table-responsive').forEach(wrapper => {
        const update = () => {
            const { scrollLeft, scrollWidth, clientWidth } = wrapper;
            const scrollable = scrollWidth > clientWidth + 1;
            wrapper.classList.toggle('is-scrollable', scrollable && scrollLeft < 4);
            wrapper.classList.toggle('scrolled-mid', scrollable && scrollLeft >= 4 && scrollLeft + clientWidth < scrollWidth - 4);
            wrapper.classList.toggle('scrolled-end', scrollable && scrollLeft + clientWidth >= scrollWidth - 4);
        };
        wrapper.addEventListener('scroll', update, { passive: true });
        // Initial check (schedule to run after layout)
        requestAnimationFrame(update);
    });
}

// ============================================
// Mensajes del chat
// ============================================
function addMessage(text, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    if (role === 'assistant' && text) {
        messageDiv.innerHTML = renderMarkdown(text);
    } else {
        messageDiv.textContent = text;
    }

    if (role === 'assistant') {
        // Wrapper: orb arriba + burbuja abajo
        const row = document.createElement('div');
        row.className = 'message-row assistant';
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        // Crear orb animado real dentro del avatar (140 = 200 partículas, CSS lo escala)
        if (window.orbCreateInElement) {
            window.orbCreateInElement(avatar, 140);
        }
        row.appendChild(avatar);
        row.appendChild(messageDiv);
        elements.chatMessages.appendChild(row);
    } else {
        elements.chatMessages.appendChild(messageDiv);
    }

    // Init responsive table wrappers
    initResponsiveTables(messageDiv);

    // Scroll al final
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    return messageDiv;
}

/**
 * Inserta un banner de advertencia cuando la cobertura RAG es baja o media.
 * Se muestra antes de la respuesta del asistente.
 */
function insertRagCoverageWarning(coverage, maxScore) {
    const warning = document.createElement('div');
    const isLow = coverage === 'low';

    warning.className = `rag-coverage-warning ${isLow ? 'rag-coverage-warning--low' : 'rag-coverage-warning--medium'}`;

    if (isLow) {
        warning.innerHTML = `
            <div class="rag-coverage-warning__icon">
                <i class="ph ph-warning-circle"></i>
            </div>
            <div class="rag-coverage-warning__content">
                <strong>Fuentes externas</strong>
                <span>Esta consulta no está cubierta en la base de conocimiento de Eliana. La respuesta usa información externa general.</span>
            </div>
        `;
    } else {
        warning.innerHTML = `
            <div class="rag-coverage-warning__icon">
                <i class="ph ph-info"></i>
            </div>
            <div class="rag-coverage-warning__content">
                <strong>Cobertura parcial</strong>
                <span>Parte de esta respuesta puede incluir información de fuentes externas, marcada con el indicador correspondiente.</span>
            </div>
        `;
    }

    elements.chatMessages.appendChild(warning);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = 'typing-indicator';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (window.orbCreateInElement) {
        window.orbCreateInElement(avatar, 140);
    }
    const indicator = document.createElement('div');
    indicator.className = 'message assistant typing';
    indicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    row.appendChild(avatar);
    row.appendChild(indicator);
    elements.chatMessages.appendChild(row);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    return indicator;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// ============================================
// WebSocket
// ============================================
function sendToWebSocket(message, responseMode = 'full') {
    // Mostrar indicador de escritura
    addTypingIndicator();
    elements.chatStatus.textContent = 'Escribiendo...';

    state.currentMessage = '';
    state.currentQuery = message; // Guardar query para persistencia

    // Variable local para rastrear el mensaje del asistente de esta solicitud
    let assistantMessage = null;

    // Función para enviar el mensaje
    const sendMessage = () => {
        const payload = { message, response_mode: responseMode };
        // Añadir activity_mode si estamos en modo actividad
        if (state.activityMode) {
            payload.activity_mode = state.activityMode;
        }
        if (state.mood.submitted) {
            payload.mood = {
                value: state.mood.value,
                label: state.mood.label,
                category: state.mood.category
            };
        }
        // Enviar contexto previo (chat guardado) para que el backend tenga historial
        if (state.priorContext) {
            payload.prior_context = state.priorContext;
            console.log('[WS] Enviando prior_context:', state.priorContext.question?.substring(0, 50));
            state.priorContext = null; // Solo enviar una vez
        }
        console.log('[WS] Payload keys:', Object.keys(payload).join(', '));
        state.websocket.send(JSON.stringify(payload));
    };

    // Función para manejar mensajes entrantes
    const handleMessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
            // Quitar indicador de escritura en el primer token
            if (!assistantMessage) {
                removeTypingIndicator();
                if (state.pendingRagCoverage && state.pendingRagCoverage !== 'high') {
                    insertRagCoverageWarning(state.pendingRagCoverage, state.pendingRagScore);
                }
                assistantMessage = addMessage('', 'assistant');
                // Inicializar streaming-markdown parser para este mensaje
                if (window.smd) {
                    const renderer = window.smd.default_renderer(assistantMessage);
                    state._smdParser = window.smd.parser(renderer);
                } else {
                    state._smdParser = null;
                }
            }

            state.currentMessage += data.content;

            // Usar streaming-markdown: solo append al DOM, O(1) por token
            if (state._smdParser) {
                window.smd.parser_write(state._smdParser, data.content);
            } else {
                // Fallback: marked.parse (puede congelar en respuestas largas)
                assistantMessage.innerHTML = renderMarkdown(state.currentMessage, false);
            }
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        }
        else if (data.type === 'end') {
            console.log('[WS] END recibido — finalizando respuesta');

            // Cambiar status INMEDIATAMENTE
            elements.chatStatus.textContent = 'En línea';
            state.pendingRagCoverage = null;
            state.pendingRagScore = 0;

            // Finalizar streaming-markdown parser (flush remaining)
            if (state._smdParser) {
                window.smd.parser_end(state._smdParser);
                state._smdParser = null;
            }

            // Post-procesamiento (tablas responsive, speaker, TTS)
            if (assistantMessage && state.currentMessage) {
                initResponsiveTables(assistantMessage);
                elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

                if (state.currentQuery) {
                    updateRecentSearchAnswer(state.currentQuery, state.currentMessage);
                }
                addSpeakerButton(assistantMessage, state.currentMessage);

                if (state.ttsEnabled || state.voiceTriggered) {
                    // Actividades: skip_summary (texto ya es conversacional, evita latencia)
                    // Chat normal: pasar por tts_summary para versión hablada
                    playTTS(state.currentMessage, !!state.activityMode);
                }
            }

            // Contar mensajes de actividad y cerrar con despedida + botón perfil
            if (state.activityMode) {
                state.activityMessageCount += 2; // user + assistant
                if (state.activityMessageCount >= 8 && !state.profileGenerated) {
                    // Esperar a que termine el TTS de la respuesta antes del cierre
                    const waitAndClose = () => {
                        if (!state.ttsPlaying) {
                            setTimeout(() => showActivityClosing(), 600);
                        } else {
                            setTimeout(waitAndClose, 200);
                        }
                    };
                    waitAndClose();
                }
            }

            assistantMessage = null;
        }
        else if (data.type === 'profile_card') {
            removeTypingIndicator();
            elements.chatStatus.textContent = 'En línea';
            showProfileScreen(data.data);
        }
        else if (data.type === 'agent_info') {
            console.log('Agente:', data.agent, '- Documentos:', data.context_docs, '- Cobertura RAG:', data.rag_coverage);
            // Guardar cobertura RAG para mostrar warning cuando llegue la respuesta
            state.pendingRagCoverage = data.rag_coverage || 'high';
            state.pendingRagScore = data.max_score || 0;
        }
        else if (data.type === 'error') {
            removeTypingIndicator();
            addMessage('Error: ' + data.message, 'assistant');
            elements.chatStatus.textContent = 'En línea';
            assistantMessage = null;
        }
    };

    // Reutilizar WebSocket existente si está abierto
    if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
        console.log('[WS] Reutilizando conexión existente');
        // Actualizar handler para que use el nuevo closure (assistantMessage, etc.)
        state.websocket.onmessage = handleMessage;
        sendMessage();
        return;
    }
    console.log('[WS] Creando nueva conexión WebSocket');

    // Cerrar WebSocket anterior si existe pero no está abierto
    if (state.websocket) {
        state.websocket.close();
        state.websocket = null;
    }

    // Crear nuevo WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.websocket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);

    state.websocket.onopen = () => {
        sendMessage();
    };

    state.websocket.onmessage = handleMessage;

    state.websocket.onerror = () => {
        removeTypingIndicator();
        addMessage('Error de conexión', 'assistant');
        elements.chatStatus.textContent = 'Desconectado';
        state.websocket = null;
    };

    state.websocket.onclose = (event) => {
        console.log('[WS] Connection closed — code:', event.code, 'reason:', event.reason, 'wasClean:', event.wasClean);
        elements.chatStatus.textContent = 'En línea';
        state.websocket = null;
    };
}

// ============================================
// Grabación de voz
// ============================================
async function startRecording() {
    const currentScreen = !elements.loginScreen.classList.contains('hidden') ? 'login' :
        (elements.blindaScreen && !elements.blindaScreen.classList.contains('hidden')) ? 'blinda' :
        (elements.conoceScreen && !elements.conoceScreen.classList.contains('hidden')) ? 'conoce' : 'other';
    console.log('[MIC-DEBUG] startRecording() called — screen:', currentScreen, 'voiceTriggered:', state.voiceTriggered, 'stack:', new Error().stack.split('\n').slice(1,4).join(' < '));

    // Prevent starting a new recording if one is already in progress
    if (state.isRecording) {
        console.log('[Recording] Already recording, ignoring startRecording()');
        return;
    }

    try {
        // iOS Safari: getUserMedia MUST be first async call in user gesture chain
        // Any other async operation before this breaks the gesture context
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioStream = stream;

        // Now safe to do other operations
        stopTTS();
        warmupIOSAudio();

        // Pause wake word listening while recording
        if (state.wakeWordActive) {
            stopWakeWordListening();
        }

        // Detect supported mimeType (webm for desktop, mp4 for iOS)
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            // iOS doesn't support webm — use mp4
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                mimeType = 'audio/aac';
            } else {
                // Fallback: let browser choose
                mimeType = '';
            }
        }
        console.log('[Recording] Using mimeType:', mimeType || 'browser default');

        const recorderOptions = mimeType ? { mimeType } : {};
        state.mediaRecorder = new MediaRecorder(stream, recorderOptions);
        state.recordingMimeType = mimeType; // Save for blob creation

        state.audioChunks = [];

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.mediaRecorder.onstop = async () => {
            // Close tracks after each recording (iOS needs fresh stream each time)
            stream.getTracks().forEach(track => track.stop());

            // Si no hubo habla, descartar sin enviar
            if (state._discardRecording) {
                state._discardRecording = false;
                console.log('[Recording] Discarded — no speech detected');
                // Reanudar wake word
                resumeWakeWordAfterRecording();
                return;
            }

            // Use the actual mimeType that was recorded
            const blobType = state.recordingMimeType || 'audio/webm';
            const extension = blobType.includes('mp4') ? 'mp4' : blobType.includes('aac') ? 'aac' : 'webm';
            const audioBlob = new Blob(state.audioChunks, { type: blobType });
            console.log('[Recording] Created blob:', blobType, 'size:', audioBlob.size);
            await transcribeAudio(audioBlob, extension);
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        state._recordingStartTime = Date.now();
        state._discardRecording = false;

        // Start silence detection (auto-stop after 5s silence)
        startSilenceDetection(stream);

        updateRecordingUI(true);

    } catch (error) {
        console.error('Error micrófono:', error);
        if (elements.voiceStatus) {
            elements.voiceStatus.textContent = 'Error: No se pudo acceder al micrófono';
        }
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        stopSilenceDetection();
        // Si la grabación duró menos de 800ms, descartar (pulsación accidental / apagar mic)
        const elapsed = Date.now() - (state._recordingStartTime || 0);
        if (elapsed < 800) {
            state._discardRecording = true;
        }
        state.mediaRecorder.stop();
        state.isRecording = false;
        updateRecordingUI(false, !state._discardRecording); // processing solo si no descartamos
    }
}

// ============================================
// Detección automática de silencio (pausa prudencial)
// Usa getFloatFrequencyData en banda de voz humana (85-3000 Hz)
// ============================================
function startSilenceDetection(stream) {
    if (state.audioContext) {
        state.audioContext.close().catch(() => {});
        state.audioContext = null;
        state.analyser = null;
    }
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    source.connect(analyser);

    state.audioContext = audioContext;
    state.analyser = analyser;

    const dataArray = new Float32Array(analyser.frequencyBinCount);

    // Rango de frecuencias de voz humana
    const binHz = audioContext.sampleRate / analyser.fftSize;
    const lowBin = Math.floor(85 / binHz);
    const highBin = Math.ceil(3000 / binHz);

    // Umbrales en dB
    const SPEECH_THRESHOLD_DB = -50;
    const SILENCE_THRESHOLD_DB = -65;

    const isVoiceMode = state.voiceModeRecording;
    const SILENCE_DURATION = isVoiceMode ? 1000 : 2000;
    const MIN_RECORDING = isVoiceMode ? 1000 : 1500;
    const MAX_RECORDING = 120000;
    const NO_SPEECH_TIMEOUT = 8000;

    let silenceStart = null;
    let speechDetected = false;
    let speechFrames = 0;
    let totalFrames = 0;
    const recordStart = Date.now();
    // Grace period: si es auto-record tras TTS, no contar los primeros 1.5s en speechRatio
    const isAutoRecord = !!state._autoRecordAfterTTS;
    const GRACE_PERIOD = isAutoRecord ? 1500 : 0;
    state._autoRecordAfterTTS = false;
    let graceFrames = 0; // frames durante el grace period (se restan del total)

    let _dbLogCounter = 0;
    function checkSilence() {
        if (!state.isRecording) return;

        const elapsed = Date.now() - recordStart;

        if (elapsed > MAX_RECORDING) {
            console.log('[Silence] Max recording time reached');
            stopRecording();
            return;
        }

        // Analizar solo banda de voz humana (85-3000 Hz)
        analyser.getFloatFrequencyData(dataArray);
        let sumSq = 0;
        let count = 0;
        for (let i = lowBin; i <= highBin && i < dataArray.length; i++) {
            const linear = Math.pow(10, dataArray[i] / 20);
            sumSq += linear * linear;
            count++;
        }
        const rmsDb = 20 * Math.log10(Math.sqrt(sumSq / count) + 1e-10);

        totalFrames++;

        // Durante grace period, contar frames pero no sumarlos al denominador del ratio
        if (elapsed < GRACE_PERIOD) {
            graceFrames++;
        }

        // LOG cada 500ms (cada 5 frames) para ver los niveles de dB en tiempo real
        _dbLogCounter++;
        if (_dbLogCounter % 5 === 0) {
            const effectiveTotal = totalFrames - graceFrames;
            const ratio = effectiveTotal > 0 ? (speechFrames / effectiveTotal * 100).toFixed(1) : '0.0';
            console.log('[AUDIO-LEVEL] rmsDb:', rmsDb.toFixed(1), '| threshold:', SPEECH_THRESHOLD_DB, '| isSpeech:', rmsDb > SPEECH_THRESHOLD_DB, '| speechFrames:', speechFrames + '/' + effectiveTotal, '(' + ratio + '%)', '| elapsed:', (elapsed/1000).toFixed(1) + 's', '| grace:', elapsed < GRACE_PERIOD, '| autoRec:', isAutoRecord);
        }

        if (rmsDb > SPEECH_THRESHOLD_DB) {
            speechDetected = true;
            speechFrames++;
            silenceStart = null;
        }

        // Sin habla en 8s → descartar solo auto-records; manuales: enviar a Whisper
        if (!speechDetected && elapsed > NO_SPEECH_TIMEOUT) {
            if (isAutoRecord) {
                console.log('[Silence] No speech in 8s (auto-record), discarding');
                state._discardRecording = true;
            } else {
                console.log('[Silence] No speech in 8s (manual click) — sending to Whisper anyway');
            }
            stopRecording();
            return;
        }

        // Silencio después de habla → auto-parar
        if (rmsDb < SILENCE_THRESHOLD_DB && elapsed > MIN_RECORDING && speechDetected) {
            if (!silenceStart) {
                silenceStart = Date.now();
            } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                // Verificar que hubo habla real (>5% de los frames efectivos)
                const effectiveTotal = totalFrames - graceFrames;
                const speechRatio = effectiveTotal > 0 ? speechFrames / effectiveTotal : 0;
                if (speechRatio < 0.05 && isAutoRecord) {
                    console.log('[Silence] Speech ratio too low (' + (speechRatio * 100).toFixed(1) + '%), discarding AUTO-record (graceFrames:', graceFrames, 'effectiveTotal:', effectiveTotal + ')');
                    state._discardRecording = true;
                } else if (speechRatio < 0.05) {
                    console.log('[Silence] Speech ratio low (' + (speechRatio * 100).toFixed(1) + '%) but MANUAL click — sending to Whisper');
                }
                console.log('[Silence] Auto-stop after ' + SILENCE_DURATION + 'ms silence (speechRatio=' + (speechRatio * 100).toFixed(1) + '%, graceFrames=' + graceFrames + ')');
                stopRecording();
                return;
            }
        } else if (rmsDb >= SILENCE_THRESHOLD_DB) {
            silenceStart = null;
        }

        state.silenceTimer = setTimeout(checkSilence, 100);
    }

    checkSilence();
}

function stopSilenceDetection() {
    if (state.silenceTimer) {
        clearTimeout(state.silenceTimer);
        state.silenceTimer = null;
    }
    if (state.audioContext) {
        state.audioContext.close().catch(() => {});
        state.audioContext = null;
    }
    state.analyser = null;
}

function updateRecordingUI(recording, processing = false) {
    // Welcome screen — toggle class + update text
    if (elements.orbCard) {
        elements.orbCard.classList.toggle('listening', recording);
        const orbTitle = elements.orbCard.querySelector('.bento-card__title');
        if (orbTitle) {
            orbTitle.textContent = recording ? 'Toca para parar' : (processing ? 'Procesando...' : 'Habla conmigo');
        }
    }

    // Chat screen — toggle recording class + swap icon
    if (elements.chatMicBtn) {
        elements.chatMicBtn.classList.toggle('recording', recording);
        const icon = elements.chatMicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        elements.chatMicBtn.title = recording ? 'Parar grabación' : 'Micrófono';
    }

    // Blinda screen — same toggle for blinda mic button
    const blindaMicBtn = document.getElementById('blinda-mic-btn');
    if (blindaMicBtn) {
        blindaMicBtn.classList.toggle('recording', recording);
        const icon = blindaMicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        blindaMicBtn.title = recording ? 'Parar grabación' : 'Grabar voz';
    }

    // Juego modal — same toggle for juego mic button
    const juegoMicBtn = document.getElementById('juego-mic-btn');
    if (juegoMicBtn) {
        juegoMicBtn.classList.toggle('recording', recording);
        const icon = juegoMicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        juegoMicBtn.title = recording ? 'Parar grabación' : 'Grabar voz';
    }

    // Diapo5 screen — same toggle for diapo5 mic button
    const diapo5MicBtn = document.getElementById('diapo5-mic-btn');
    if (diapo5MicBtn) {
        diapo5MicBtn.classList.toggle('recording', recording);
        const icon = diapo5MicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        diapo5MicBtn.title = recording ? 'Parar grabación' : 'Grabar voz';
    }

    // Diapo6 screen
    const diapo6MicBtn = document.getElementById('diapo6-mic-btn');
    if (diapo6MicBtn) {
        diapo6MicBtn.classList.toggle('recording', recording);
        const icon = diapo6MicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        diapo6MicBtn.title = recording ? 'Parar grabación' : 'Grabar voz';
    }

    // Diapo7 screen
    const diapo7MicBtn = document.getElementById('diapo7-mic-btn');
    if (diapo7MicBtn) {
        diapo7MicBtn.classList.toggle('recording', recording);
        const icon = diapo7MicBtn.querySelector('.ph');
        if (icon) {
            icon.className = recording ? 'ph ph-stop-circle' : 'ph ph-microphone';
        }
        diapo7MicBtn.title = recording ? 'Parar grabación' : 'Grabar voz';
    }

    // Orb 3D
    if (window.orbSetListening) window.orbSetListening(recording);

    // Textos
    if (elements.voiceStatus) {
        elements.voiceStatus.textContent = recording ? 'Grabando...' : (processing ? 'Procesando...' : '');
        elements.voiceStatus.classList.toggle('active', recording);
    }
}

async function transcribeAudio(audioBlob, extension = 'webm') {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${extension}`);

        const response = await fetch('/api/voice', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success && data.text) {
            // Strip wake word from transcription so "Hola Bellia, ..." becomes just "..."
            const cleanText = stripWakeWord(data.text);


            // If the transcription was ONLY a wake word (nothing else), skip sending
            if (!cleanText) {
                console.log('[Voice] Transcription was only a wake word, ignoring');
                // If awaiting voice mode, fallback to 'full' silently
                if (state.awaitingVoiceMode) {
                    const pendingMessage = state.awaitingVoiceMode;
                    state.awaitingVoiceMode = null;
                    state.voiceModeRecording = false;
                    if (state.voiceModeTimeout) { clearTimeout(state.voiceModeTimeout); state.voiceModeTimeout = null; }
                    const asking = document.querySelector('.voice-mode-asking');
                    if (asking) asking.remove();
                    sendToWebSocket(pendingMessage, 'full');
                }
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Check if we're awaiting voice mode selection (user answering "resumida" or "extendida")
            if (state.awaitingVoiceMode) {
                if (state.voiceModeTimeout) {
                    clearTimeout(state.voiceModeTimeout);
                    state.voiceModeTimeout = null;
                }
                state.voiceModeRecording = false;
                const pendingMessage = state.awaitingVoiceMode;
                state.awaitingVoiceMode = null;

                const lower = cleanText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const isShort = /\b(resumida|corta|breve|resumen|resumido)\b/.test(lower);
                const mode = isShort ? 'short' : 'full';

                // Remove visual indicator
                const asking = document.querySelector('.voice-mode-asking');
                if (asking) asking.remove();

                // Show what was transcribed and chosen mode
                console.log(`[Voice Mode] Transcribed answer: "${cleanText}" → mode: ${mode}`);

                // Show chosen mode badge
                const chosen = document.createElement('div');
                chosen.className = 'response-mode-chosen';
                chosen.innerHTML = mode === 'short'
                    ? '<i class="ph ph-list-bullets"></i> Resumida'
                    : '<i class="ph ph-article"></i> Extendida';
                elements.chatMessages.appendChild(chosen);

                sendToWebSocket(pendingMessage, mode);
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Guardar en búsquedas recientes (como voz)
            saveRecentSearch(cleanText, true);
            const actionable = isActionableQuery(cleanText);

            // Si estamos en Blinda (diapo 3), enviar al chat de Blinda, NO al chat principal
            if (isOnBlindaScreen()) {
                sendBlindaMessage(cleanText);
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Si estamos en Juego (diapo 4) con modal abierto, enviar como pista
            if (isOnJuegoModal() && !state._juegoHintUsed) {
                const input = document.getElementById('juego-chat-input');
                if (input) { input.value = cleanText; }
                document.getElementById('juego-chat-send')?.click();
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Si estamos en Diapo 5, enviar al chat de Diapo 5
            if (isOnDiapo5Screen()) {
                sendDiapo5Message(cleanText);
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Si estamos en Diapo 6, enviar al chat de Diapo 6
            if (isOnDiapo6Screen()) {
                sendDiapo6Message(cleanText);
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Si estamos en Diapo 8, enviar al chat de Diapo 8
            if (isOnDiapo7Screen()) {
                sendDiapo7Message(cleanText);
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            if (!elements.chatScreen.classList.contains('hidden')) {
                addMessage(cleanText, 'user');
                if (actionable && state.voiceTriggered && !state.activityMode) {
                    // Voice: ask mode by TTS and listen (skip in activity mode)
                    // Return here — askResponseModeByVoice manages its own recording cycle
                    askResponseModeByVoice(cleanText);
                    return;
                } else {
                    // Non-actionable or activity mode: send directly
                    sendToWebSocket(cleanText);
                }
            } else {
                // Coming from welcome/plan screen
                elements.planScreen?.classList.add('hidden');
                if (actionable && state.voiceTriggered) {
                    // Show chat first, then ask mode by voice
                    showChatScreen(cleanText, false, true); // skipSend=true
                    return;
                }
                showChatScreen(cleanText, false);
            }
        } else {
            console.error('Error transcripción:', data.error);
            // If awaiting voice mode answer and transcription failed, fallback to 'full' silently
            if (state.awaitingVoiceMode) {
                console.log('[Voice Mode] Transcription failed, falling back to full mode');
                if (state.voiceModeTimeout) { clearTimeout(state.voiceModeTimeout); state.voiceModeTimeout = null; }
                state.voiceModeRecording = false;
                const pendingMessage = state.awaitingVoiceMode;
                state.awaitingVoiceMode = null;
                const asking = document.querySelector('.voice-mode-asking');
                if (asking) asking.remove();
                sendToWebSocket(pendingMessage, 'full');
            } else {
                // Show capabilities message when transcription fails (only for normal queries)
                if (!elements.chatScreen.classList.contains('hidden')) {
                    addMessage('No pude entender lo que dijiste. Puedes preguntarme sobre enseñanza de español como lengua extranjera, actividades didácticas, o estrategias de personalización con IA.', 'assistant');
                }
            }
        }

        updateRecordingUI(false);

    } catch (error) {
        console.error('Error transcripción:', error);
        // If awaiting voice mode answer and error, fallback to 'full' silently
        if (state.awaitingVoiceMode) {
            console.log('[Voice Mode] Transcription error, falling back to full mode');
            if (state.voiceModeTimeout) { clearTimeout(state.voiceModeTimeout); state.voiceModeTimeout = null; }
            state.voiceModeRecording = false;
            const pendingMessage = state.awaitingVoiceMode;
            state.awaitingVoiceMode = null;
            const asking = document.querySelector('.voice-mode-asking');
            if (asking) asking.remove();
            sendToWebSocket(pendingMessage, 'full');
        } else {
            if (!elements.chatScreen.classList.contains('hidden')) {
                addMessage('No pude entender lo que dijiste. Intenta de nuevo.', 'assistant');
            }
        }
        updateRecordingUI(false);
    }

    // Resume wake word listening after recording completes
    resumeWakeWordAfterRecording();
}

function toggleRecording() {
    // iOS: Pre-warm audio element on user gesture so TTS can play later
    warmupIOSAudio();

    if (state.isRecording) {
        stopRecording();
    } else {
        // Voice interaction → auto-enable TTS responses
        enableTTS();
        state.voiceTriggered = true;
        startRecording();
    }
}

/**
 * iOS Safari requires audio to be "unlocked" by user gesture.
 * This creates and plays a silent audio to enable future playback.
 */
function warmupIOSAudio() {
    // Warmup audio on user gesture - works on all browsers
    try {
        if (!state.iosAudioElement) {
            state.iosAudioElement = new Audio();
            state.iosAudioElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        }
        state.iosAudioElement.play().then(() => {
            state.iosAudioElement.pause();
            console.log('[Audio] Warmup OK');
        }).catch(() => {});
    } catch (e) {}
}

// ============================================
// Detección de consultas con contenido real
// ============================================
/**
 * Determina si un mensaje contiene una consulta real sobre
 * enseñanza de ELE, didáctica, o agentes IA en educación.
 * Solo muestra el selector de formato cuando hay contenido relevante.
 * Cualquier otra cosa (saludos, frases vagas, charla) se envía directo.
 */
function isActionableQuery(text) {
    const t = text.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const eleKeywords = [
        // ELE y didáctica
        /ele\b/i, /espanol como lengua/i, /lengua extranjera/i,
        /didactica/i, /ensenanza/i, /aprendizaje/i, /pedagogia/i,
        /metodologia/i, /enfoque/i, /comunicativo/i,
        // Niveles MCER
        /mcer/i, /marco comun/i, /a1/i, /a2/i, /b1/i, /b2/i, /c1/i, /c2/i,
        /nivel/i, /competencia/i, /destreza/i,
        // Actividades y materiales
        /actividad/i, /ejercicio/i, /material/i, /recurso/i, /secuencia/i,
        /unidad didactica/i, /tarea/i, /dinamica/i, /juego/i,
        // Agentes e IA
        /agente/i, /inteligencia artificial/i, /personaliz/i, /ia\b/i,
        /chatbot/i, /automatiz/i, /adapta/i, /feedback/i,
        /retroalimentacion/i, /correccion/i,
        // Evaluación
        /evalua/i, /rubrica/i, /califica/i, /examen/i, /prueba/i,
        // Habilidades lingüísticas
        /gramatica/i, /vocabulario/i, /pronunciacion/i, /escritura/i,
        /lectura/i, /comprension/i, /expresion oral/i, /interaccion/i,
        // Acciones
        /como enseno/i, /como puedo/i, /que actividad/i, /como evaluo/i,
        /como corrijo/i, /como motivo/i, /como adapto/i,
    ];

    return eleKeywords.some(kw => kw.test(t));
}

function releaseCachedMicStream() {
    if (state.cachedMicStream) {
        state.cachedMicStream.getTracks().forEach(t => t.stop());
        state.cachedMicStream = null;
    }
}

// ============================================
// Enviar mensaje por texto
// ============================================
function sendMessage() {
    const input = elements.welcomeScreen.classList.contains('hidden')
        ? elements.chatInput
        : elements.messageInput;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';

    // Guardar en búsquedas recientes
    saveRecentSearch(message);

    // Text input → always send directly as 'full', no mode selector
    state.voiceTriggered = false;
    releaseCachedMicStream();

    // Si estamos en welcome, ir al chat
    if (!elements.welcomeScreen.classList.contains('hidden')) {
        showChatScreen(message, false); // text: no selector
    } else {
        addMessage(message, 'user');
        sendToWebSocket(message); // text: send directly as 'full'
    }
}

/**
 * Asks response mode by voice: TTS asks "¿Resumida o extendida?",
 * then starts recording to listen for the user's voice answer.
 */
async function askResponseModeByVoice(message) {
    console.log('[Voice Mode] askResponseModeByVoice called for:', message);

    // 1. Show visual indicator
    const indicator = document.createElement('div');
    indicator.className = 'voice-mode-asking';
    indicator.innerHTML = `
        <i class="ph ph-speaker-high"></i>
        <span>Eliana pregunta: ¿Resumida o extendida?</span>
    `;
    elements.chatMessages.appendChild(indicator);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // 2. Play question via TTS (skip_summary = true, send text directly)
    try {
        console.log('[Voice Mode] Playing TTS question...');
        await playTTSAndWait('¿Quieres la respuesta resumida o extendida?');
        console.log('[Voice Mode] TTS question finished');
    } catch (e) {
        console.error('[Voice Mode] TTS failed:', e);
    }

    // 3. Wait 400ms for speaker echo to dissipate before opening mic
    await new Promise(r => setTimeout(r, 400));

    // 4. Update indicator to show we're listening
    indicator.innerHTML = `
        <i class="ph ph-microphone"></i>
        <span>Escuchando tu respuesta...</span>
    `;

    // 5. Set flag so transcribeAudio knows we're awaiting mode
    state.awaitingVoiceMode = message;

    // 6. Start recording to listen for answer (with longer min recording)
    console.log('[Voice Mode] Starting recording for mode answer...');
    state.voiceModeRecording = true; // flag for silence detection to use longer min
    startRecording();

    // 7. Safety timeout — if no answer in 10s, send as 'full'
    state.voiceModeTimeout = setTimeout(() => {
        if (state.awaitingVoiceMode) {
            console.log('[Voice Mode] Timeout — sending as full');
            state.voiceModeRecording = false;
            const msg = state.awaitingVoiceMode;
            state.awaitingVoiceMode = null;
            const asking = document.querySelector('.voice-mode-asking');
            if (asking) asking.remove();
            stopRecording();
            sendToWebSocket(msg, 'full');
        }
    }, 10000);
}

/**
 * Muestra un selector de modo de respuesta (resumida/extendida)
 * debajo del mensaje del usuario. Al elegir, envía al WebSocket.
 */
function showResponseModeSelector(message) {
    const selector = document.createElement('div');
    selector.className = 'response-mode-selector';
    selector.innerHTML = `
        <div class="response-mode-selector__header">
            <i class="ph ph-chat-dots"></i>
            <span>Formato de respuesta</span>
        </div>
        <div class="response-mode-selector__buttons">
            <button class="response-mode-btn response-mode-btn--short" data-mode="short">
                <div class="response-mode-btn__icon">
                    <i class="ph ph-list-bullets"></i>
                </div>
                <div class="response-mode-btn__text">
                    <strong>Resumida</strong>
                    <span>Datos clave y directa</span>
                </div>
            </button>
            <button class="response-mode-btn response-mode-btn--full" data-mode="full">
                <div class="response-mode-btn__icon">
                    <i class="ph ph-article"></i>
                </div>
                <div class="response-mode-btn__text">
                    <strong>Extendida</strong>
                    <span>Argumentario completo</span>
                </div>
            </button>
        </div>
    `;

    elements.chatMessages.appendChild(selector);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Handlers
    selector.querySelectorAll('.response-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            // Reemplazar selector con indicador del modo elegido
            const chosen = document.createElement('div');
            chosen.className = 'response-mode-chosen';
            chosen.innerHTML = mode === 'short'
                ? '<i class="ph ph-list-bullets"></i> Resumida'
                : '<i class="ph ph-article"></i> Extendida';
            selector.replaceWith(chosen);
            // Enviar al WebSocket con el modo
            sendToWebSocket(message, mode);
        });
    });
}

// ============================================
// Infographic Feature
// ============================================

const INFOGRAPHIC_THEMES = {
    productos:  { primary: '#6B5B95', primaryDark: '#4A3D6B', light: '#D8D0E8', accent: '#8B78B4', bg: '#EDEAF0', badge: '#F0ECF5', border: '#D5CDE0' },
    objeciones: { primary: '#7B6B95', primaryDark: '#524068', light: '#DDD0E8', accent: '#9B88B4', bg: '#EFECF2', badge: '#F2EEF7', border: '#D8CFE3' },
    argumentos: { primary: '#5B6B95', primaryDark: '#3D4A6B', light: '#D0D8E8', accent: '#7888B4', bg: '#EAEDF2', badge: '#ECF0F5', border: '#CDD5E0' }
};

function appendInfographicCTA(messageRow, fullResponse) {
    if (!messageRow || !fullResponse) return;

    const cta = document.createElement('div');
    cta.className = 'infographic-cta';
    cta.innerHTML = `
        <i class="ph ph-image-square"></i>
        <span class="infographic-cta__text">¿Quieres una infografía resumida para mostrar al médico?</span>
        <div class="infographic-cta__actions">
            <button class="infographic-cta__btn infographic-cta__btn--yes">
                <i class="ph ph-check"></i> Sí, generar
            </button>
            <button class="infographic-cta__btn infographic-cta__btn--no">
                <i class="ph ph-x"></i> No, gracias
            </button>
        </div>
    `;

    // Insert after the message row
    messageRow.after(cta);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Button handlers
    cta.querySelector('.infographic-cta__btn--yes').addEventListener('click', () => {
        requestInfographic(fullResponse, cta);
    });
    cta.querySelector('.infographic-cta__btn--no').addEventListener('click', () => {
        cta.classList.add('infographic-cta--exiting');
        cta.addEventListener('animationend', () => cta.remove());
    });
}

async function requestInfographic(agentResponse, ctaElement) {
    console.log('[Infographic] Requesting infographic via POST...');

    // Replace CTA with loading spinner
    const loading = document.createElement('div');
    loading.className = 'infographic-loading';
    loading.innerHTML = `
        <div class="infographic-loading__spinner"></div>
        <span class="infographic-loading__text">Generando infografía...</span>
    `;
    ctaElement.replaceWith(loading);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    try {
        const response = await fetch('/api/infographic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_response: agentResponse })
        });

        const result = await response.json();
        console.log('[Infographic] Response:', result.success);

        if (result.success && result.data) {
            console.log('[Infographic] Data received, rendering card');
            const insertAfter = loading.previousElementSibling || elements.chatMessages.lastElementChild;
            loading.remove();
            renderInfographic(result.data, insertAfter);
        } else {
            console.error('[Infographic] Error:', result.error || result.detail);
            loading.innerHTML = `
                <div class="infographic-error">
                    <i class="ph ph-warning-circle"></i>
                    <span>No se pudo generar la infografía: ${result.error || 'Error desconocido'}</span>
                </div>
            `;
            loading.className = 'infographic-error-container';
        }
    } catch (err) {
        console.error('[Infographic] Fetch error:', err);
        loading.innerHTML = `
            <div class="infographic-error">
                <i class="ph ph-warning-circle"></i>
                <span>Error de conexión al generar la infografía.</span>
            </div>
        `;
        loading.className = 'infographic-error-container';
    }
}

function renderInfographic(data, afterElement) {
    const theme = INFOGRAPHIC_THEMES[data.color_tema] || INFOGRAPHIC_THEMES.productos;

    // Build sections HTML (NotebookLM style: white cards with circular icon badges)
    const sectionsHTML = (data.secciones || []).map(sec => `
        <div class="infographic-card__section">
            <div class="infographic-card__section-header">
                <div class="infographic-card__section-icon">
                    <i class="ph ph-${sec.icono || 'circle'}"></i>
                </div>
                <span class="infographic-card__section-title">${sec.titulo}</span>
            </div>
            <ul class="infographic-card__section-list">
                ${(sec.puntos || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    // Build data grid HTML (KPI badges)
    const dataGridHTML = (data.datos_tabla || []).map(d => `
        <div class="infographic-card__kpi">
            <span class="infographic-card__kpi-value">${d.valor}</span>
            <span class="infographic-card__kpi-label">${d.etiqueta}</span>
        </div>
    `).join('');

    // Product highlight (circular icon badge)
    const prod = data.producto_destacado;
    const productHTML = (prod && prod.nombre) ? `
        <div class="infographic-card__product">
            <div class="infographic-card__product-icon">
                <i class="ph ph-package"></i>
            </div>
            <div class="infographic-card__product-info">
                <strong>${prod.nombre}</strong>
                ${prod.dosis ? `<span>${prod.dosis}</span>` : ''}
                ${prod.indicacion ? `<span>${prod.indicacion}</span>` : ''}
            </div>
        </div>
    ` : '';

    // Key phrase
    const quoteHTML = data.frase_clave ? `
        <blockquote class="infographic-card__quote">
            ${data.frase_clave}
        </blockquote>
    ` : '';

    // Build full card (NotebookLM style)
    const card = document.createElement('div');
    card.className = 'infographic-card';
    card.style.setProperty('--nblm-bg', theme.bg);
    card.style.setProperty('--nblm-primary', theme.primary);
    card.style.setProperty('--nblm-primary-dark', theme.primaryDark);
    card.style.setProperty('--nblm-primary-light', theme.light);
    card.style.setProperty('--nblm-accent', theme.accent);
    card.style.setProperty('--nblm-badge-bg', theme.badge);
    card.style.setProperty('--nblm-border', theme.border);
    card.innerHTML = `
        <div class="infographic-card__header">
            <div class="infographic-card__brand">
                <i class="ph-bold ph-pulse"></i>
                <span>Eliana</span>
            </div>
            <h3 class="infographic-card__title">${data.titulo || 'Resumen'}</h3>
            ${data.subtitulo ? `<p class="infographic-card__subtitle">${data.subtitulo}</p>` : ''}
        </div>
        ${dataGridHTML ? `<div class="infographic-card__data-grid">${dataGridHTML}</div>` : ''}
        <div class="infographic-card__body">
            ${sectionsHTML}
            ${productHTML}
            ${quoteHTML}
        </div>
        <div class="infographic-card__footer">
            <span>Eliana &middot; Infograf&iacute;a generada por IA</span>
        </div>
        <div class="infographic-actions">
            <button class="infographic-actions__download" title="Descargar PNG">
                <i class="ph ph-download-simple"></i> Descargar
            </button>
        </div>
    `;

    // Insert into chat
    if (afterElement && afterElement.parentNode) {
        afterElement.after(card);
    } else {
        elements.chatMessages.appendChild(card);
    }
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Download handler
    card.querySelector('.infographic-actions__download').addEventListener('click', () => {
        downloadInfographicAsPNG(card);
    });
}

function downloadInfographicAsPNG(cardElement) {
    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas not loaded');
        return;
    }

    const actionsBar = cardElement.querySelector('.infographic-actions');
    if (actionsBar) actionsBar.style.display = 'none';

    html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#EDEAF0',
        logging: false
    }).then(canvas => {
        if (actionsBar) actionsBar.style.display = '';
        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'infografia-eliana.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }).catch(err => {
        if (actionsBar) actionsBar.style.display = '';
        console.error('Error generating PNG:', err);
    });
}


// ============================================
// Wake Word Detection — "Hola Eliana" / "Hey Eliana" / "Eliana"
// ============================================
// Flexible patterns — no \b boundaries (Spanish SpeechRecognition
// transcripts often lack proper word spacing/punctuation)
const WAKE_WORD_PATTERNS = [
    /hola\s*eliana/i,
    /hey\s*eliana/i,
    /oye\s*eliana/i,
    /ok\s*eliana/i,
    /ola\s*eliana/i,      // STT typo sin h
    /hola\s*iliana/i,     // STT variante
    /hola\s*eliane/i,     // STT variante
    /hey\s*iliana/i,
    /oye\s*iliana/i,
    /seguimos\s*eliana/i,      // presenter: "seguimos, Eliana"
    /continuamos\s*eliana/i,   // presenter: "continuamos, Eliana"
    /adelante\s*eliana/i,      // presenter: "adelante, Eliana"
    /bueno\s*eliana/i,         // presenter: "bueno, Eliana"
    /pues\s*eliana/i,          // presenter: "pues, Eliana"
    /venga\s*eliana/i,         // presenter: "venga, Eliana"
    /vale\s*eliana/i,          // presenter: "vale, Eliana"
    /vamos\s*eliana/i,         // presenter: "vamos, Eliana"
];

// Single-word fallback: standalone "eliana" (or variants) only if it's the whole transcript
const WAKE_WORD_SOLO = /^\s*(eliana|iliana|eliane)\s*$/i;

/**
 * Checks if the transcript contains a wake word.
 */
function containsWakeWord(transcript) {
    const t = transcript.toLowerCase().trim();
    if (!t) return false;
    // Detectar "eliana" (o variantes) en cualquier posición del transcript
    if (/\b(eliana|iliana|eliane)\b/i.test(t)) return true;
    return false;
}

/**
 * Strips wake word patterns from transcribed text.
 * Returns cleaned text, or empty string if the text was ONLY a wake word / greeting.
 */
function stripWakeWord(text) {
    let t = text.trim();

    // 1) Remove wake word patterns anywhere in the text (not just start)
    for (const pattern of WAKE_WORD_PATTERNS) {
        t = t.replace(new RegExp(pattern.source + '[,\\s.!?]*', 'gi'), '').trim();
    }

    // 2) Strip standalone "eliana" variations (NOT "elena" — it's a common name)
    t = t.replace(/\b(eliana|iliana|eliane)\b[,\s.!?]*/gi, '').trim();

    // 3) If what remains is just a greeting word or nothing, return empty
    const leftover = t.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^\s*(hola|hey|oye|ok|buenas?|buenos?|que tal|como estas?|gracias?|adios|hasta luego)?\s*[.!?,]*\s*$/i.test(leftover)) {
        return '';
    }

    return t;
}

/**
 * Strips wake word for Blinda context — only removes "eliana" variants and pure greetings.
 * Preserves action words like "seguimos", "continuamos", "adelante", "vamos", etc.
 * that are meaningful instructions to Eliana in the blinda chat.
 */
function stripWakeWordForBlinda(text) {
    if (!text) return '';
    let t = text.trim();
    // Remove only the name "eliana" and variants (not the action verbs)
    t = t.replace(/\b(eliana|iliana|eliane)\b[,\s.!?]*/gi, '').trim();
    // Remove pure greeting prefixes
    t = t.replace(/^(hola|hey|oye|ok|bueno|pues|venga|vale)\b[,\s]*/gi, '').trim();
    return t;
}

/**
 * Play a short beep to confirm wake word detection.
 */
function playWakeBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);  // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        osc.onended = () => ctx.close();
    } catch (e) {
        // Silently ignore — beep is optional UX nicety
    }
}

/**
 * WakeWord — uses a SINGLE reused SpeechRecognition instance.
 * Creating new instances causes Chrome to abort (only 1 allowed at a time).
 * continuous=false is more reliable; we restart in onend.
 */
let _wkRecog = null;          // single instance, created once
let _wkStarting = false;      // synchronous guard: true between start() and onstart/onerror

function _getWakeWordRecognition() {
    if (_wkRecog) return _wkRecog;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = true;        // keep mic open — no restart flicker
    r.interimResults = true;
    r.maxAlternatives = 3;

    let _wkSessionId = 0;
    r.onstart = () => {
        _wkStarting = false;
        state.wakeWordActive = true;
        updateWakeWordUI(true);
        _wkSessionId++;
    };

    r.onaudiostart = () => {};
    r.onsoundstart = () => {};
    r.onspeechstart = () => {};
    r.onspeechend = () => {};
    r.onsoundend = () => {};
    r.onaudioend = () => {};

    let _wkPendingTranscript = null;
    let _wkPendingTimeout = null;

    function _fireWakeWord(transcript) {
        if (_wkPendingTimeout) { clearTimeout(_wkPendingTimeout); _wkPendingTimeout = null; }
        _wkPendingTranscript = null;
        console.log('[WakeWord] Firing with:', transcript);
        state.wakeWordEnabled = false;
        r.abort();
        state.wakeWordActive = false;
        setTimeout(() => {
            state.wakeWordEnabled = true;
            onWakeWordDetected(transcript);
        }, 400);
    }

    r.onresult = (event) => {
        if (state.ttsPlaying || orbGreetingPlaying) return;

        // Acumular todo el transcript disponible
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
            fullText += event.results[i][0].transcript;
        }

        // Buscar wake word en cualquier alternativa nueva
        let wakeFound = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
            for (let a = 0; a < event.results[i].length; a++) {
                if (containsWakeWord(event.results[i][a].transcript)) {
                    wakeFound = true;
                    break;
                }
            }
            if (wakeFound) break;
        }

        if (!wakeFound) return;

        // Si el resultado es final, actuar de inmediato con el transcript completo
        const latestResult = event.results[event.results.length - 1];
        if (latestResult.isFinal) {
            _fireWakeWord(fullText.trim());
            return;
        }

        // Resultado interim: guardar y esperar 800ms por si viene más texto
        _wkPendingTranscript = fullText.trim();
        if (_wkPendingTimeout) clearTimeout(_wkPendingTimeout);
        _wkPendingTimeout = setTimeout(() => {
            if (_wkPendingTranscript) {
                _fireWakeWord(_wkPendingTranscript);
            }
        }, 800);
    };

    r.onerror = (event) => {
        _wkStarting = false;
        if (['no-speech', 'aborted', 'network'].includes(event.error)) return;
        console.log(`[WakeWord] Error: ${event.error}`);
        state.wakeWordActive = false;
        updateWakeWordUI(false);
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
            state.wakeWordEnabled = false;
            updateWakeWordToggle(false);
            localStorage.setItem('eliana_wake_word', 'off');
        }
    };

    r.onend = () => {
        state.wakeWordActive = false;
        _wkStarting = false;
        if (state.wakeWordEnabled && !state.isRecording) {
            setTimeout(() => startWakeWordListening(), 1000);
        } else {
            updateWakeWordUI(false);
        }
    };

    _wkRecog = r;
    return r;
}

function startWakeWordListening() {
    if (state.wakeWordActive || _wkStarting || state.isRecording) return;

    const r = _getWakeWordRecognition();
    if (!r) return;

    _wkStarting = true;
    state.wakeWordRecognition = r;
    try {
        r.start();
    } catch (e) {
        _wkStarting = false;
    }
}

function stopWakeWordListening() {
    _wkStarting = false;
    if (_wkRecog) {
        try { _wkRecog.abort(); } catch(e) {}
    }
    state.wakeWordActive = false;
    updateWakeWordUI(false);
}

/**
 * Called when the wake word is detected.
 * Plays beep, shows visual feedback, navigates to chat and starts recording.
 * Like Siri: say "Hola Eliana" → it listens to everything you say.
 */
function onWakeWordDetected(transcript = '') {
    // Si el navegador no permite audio aún (sin interacción), solo feedback visual
    if (!_userHasInteracted) {
        console.log('[WakeWord] Detectado pero sin interacción — solo feedback visual');
        if (window.orbSetListening) window.orbSetListening(true);
        setTimeout(() => {
            if (window.orbSetListening) window.orbSetListening(false);
        }, 3000);
        return;
    }

    // Si estamos en la pantalla de login, SOLO reproducir saludo — sin LLM, sin grabación
    if (!elements.loginScreen.classList.contains('hidden')) {
        console.log('[MIC-DEBUG] onWakeWordDetected on LOGIN — only greeting, no mic');
        playWakeBeep();
        handleOrbGreeting();
        // NO reactivar wake word en login — evita bucle de eco/ruido ambiente
        return;
    }

    playWakeBeep();
    // Voice interaction → auto-enable TTS responses
    forceEnableTTS();
    state.voiceTriggered = true;

    // Si estamos en la pantalla de Blinda, NO navegar al chat.
    // Extraer contenido útil del transcript del wake word y enviarlo directamente.
    if (elements.blindaScreen && !elements.blindaScreen.classList.contains('hidden')) {
        console.log('[WakeWord] En Blinda — interacción en contexto');
        const blindaOrb = document.getElementById('blinda-orb-container');
        if (blindaOrb && window.orbSetListening) window.orbSetListening(true);

        // Extraer texto significativo del transcript (quitar solo "eliana" y variantes)
        const blindaText = stripWakeWordForBlinda(transcript);
        if (blindaText) {
            // El usuario dijo algo útil junto al wake word → enviar directamente
            console.log('[WakeWord] Blinda text:', blindaText);
            sendBlindaMessage(blindaText);
            if (window.orbSetListening) window.orbSetListening(false);
            resumeWakeWordAfterRecording();
        } else {
            // Solo dijo el wake word → abrir grabación para que hable
            startRecording();
        }
        return;
    }

    // Si estamos en Diapo 5, misma logica que Blinda
    if (elements.diapo5Screen && !elements.diapo5Screen.classList.contains('hidden')) {
        console.log('[WakeWord] En Diapo5 — interaccion en contexto');
        const diapo5Orb = document.getElementById('diapo5-orb-container');
        if (diapo5Orb && window.orbSetListening) window.orbSetListening(true);

        const diapo5Text = stripWakeWordForBlinda(transcript);
        if (diapo5Text) {
            console.log('[WakeWord] Diapo5 text:', diapo5Text);
            sendDiapo5Message(diapo5Text);
            if (window.orbSetListening) window.orbSetListening(false);
            resumeWakeWordAfterRecording();
        } else {
            startRecording();
        }
        return;
    }

    // Si estamos en Diapo 6, misma logica que Diapo 5
    if (elements.diapo6Screen && !elements.diapo6Screen.classList.contains('hidden')) {
        console.log('[WakeWord] En Diapo6 — interaccion en contexto');
        const diapo6Orb = document.getElementById('diapo6-orb-container');
        if (diapo6Orb && window.orbSetListening) window.orbSetListening(true);

        const diapo6Text = stripWakeWordForBlinda(transcript);
        if (diapo6Text) {
            console.log('[WakeWord] Diapo6 text:', diapo6Text);
            sendDiapo6Message(diapo6Text);
            if (window.orbSetListening) window.orbSetListening(false);
            resumeWakeWordAfterRecording();
        } else {
            startRecording();
        }
        return;
    }

    // Si estamos en Diapo 7, misma logica que Diapo 5/6
    if (elements.diapo7Screen && !elements.diapo7Screen.classList.contains('hidden')) {
        console.log('[WakeWord] En Diapo7 — interaccion en contexto');
        const diapo7Orb = document.getElementById('diapo7-orb-container');
        if (diapo7Orb && window.orbSetListening) window.orbSetListening(true);

        const diapo7Text = stripWakeWordForBlinda(transcript);
        if (diapo7Text) {
            console.log('[WakeWord] Diapo7 text:', diapo7Text);
            sendDiapo7Message(diapo7Text);
            if (window.orbSetListening) window.orbSetListening(false);
            resumeWakeWordAfterRecording();
        } else {
            startRecording();
        }
        return;
    }

    if (elements.chatScreen.classList.contains('hidden')) {
        // Navigate to chat, then start recording after transition
        showChatScreen('', false);
        setTimeout(() => {
            startRecording();
        }, 400);
    } else {
        // Already on chat — just start recording
        startRecording();
    }
}

/**
 * Shows a brief visual flash when wake word is detected.
 */
function showWakeWordFeedback() {
    // Flash the orb
    if (window.orbSetListening) window.orbSetListening(true);

    // Build centered overlay card
    const toast = document.createElement('div');
    toast.className = 'wake-word-toast';
    toast.innerHTML = `
        <div class="wake-word-toast__card">
            <div class="wake-word-toast__icon">
                <i class="ph ph-chat-circle-dots"></i>
            </div>
            <span class="wake-word-toast__text">Hola, soy Eliana</span>
            <span class="wake-word-toast__hint">Abriendo chat...</span>
        </div>`;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('wake-word-toast--visible');
    });

    // Remove after 2.5s
    setTimeout(() => {
        toast.classList.remove('wake-word-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 2500);
}

/**
 * Toggles wake word detection on/off.
 */
function toggleWakeWord() {
    state.wakeWordEnabled = !state.wakeWordEnabled;
    updateWakeWordToggle(state.wakeWordEnabled);

    if (state.wakeWordEnabled) {
        startWakeWordListening();
        localStorage.setItem('eliana_wake_word', 'on');
    } else {
        stopWakeWordListening();
        localStorage.setItem('eliana_wake_word', 'off');
    }
}

/**
 * Updates the wake word toggle button visual state + text label.
 */
function updateWakeWordToggle(enabled) {
    ['wake-word-btn', 'chat-wake-word-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('wake-word-toggle--active', enabled);
        btn.title = enabled ? 'Desactivar Hola, Eliana' : 'Activar Hola, Eliana';
        const label = btn.querySelector('.wake-word-label');
        if (label) label.textContent = enabled ? 'Hola, Eliana · on' : 'Hola, Eliana · off';
        const icon = btn.querySelector('.ph');
        if (icon) {
            icon.className = enabled ? 'ph ph-microphone' : 'ph ph-microphone-slash';
        }
    });
}

/**
 * Updates the wake word listening indicator (no-op now, state shown by label).
 */
function updateWakeWordUI(listening) {
    // Visual state is fully handled by updateWakeWordToggle
}

/**
 * Restarts wake word listening after recording completes.
 * Called at the end of transcribeAudio().
 */
function resumeWakeWordAfterRecording() {
    const onLogin = !elements.loginScreen.classList.contains('hidden');
    console.log('[MIC-DEBUG] resumeWakeWordAfterRecording — wakeWordEnabled:', state.wakeWordEnabled, 'wakeWordActive:', state.wakeWordActive, 'onLogin:', onLogin);
    if (onLogin) {
        console.log('[MIC-DEBUG] On login screen — NOT resuming wake word');
        return;
    }
    if (state.wakeWordEnabled && !state.wakeWordActive) {
        console.log('[MIC-DEBUG] Will restart wake word in 1s');
        setTimeout(() => {
            startWakeWordListening();
        }, 1000);
    }
}

// ============================================
// TTS — Lectura en voz alta (ElevenLabs)
// ============================================

// Estado TTS
state.ttsAudio = null;       // Audio element actual
state.ttsPlaying = false;    // Reproducción en curso
state.ttsEnabled = false;    // Auto-play desactivado por defecto — el usuario lo activa con el botón de voz
state.ttsManuallyDisabled = false; // true cuando el usuario desactiva TTS con el botón de voz

/**
 * Toggles TTS auto-play on/off via the voice button in chat bottom bar.
 */
function toggleTTS() {
    state.ttsEnabled = !state.ttsEnabled;
    state.ttsManuallyDisabled = !state.ttsEnabled;
    updateVoiceButton(state.ttsEnabled);

    if (state.ttsEnabled) {
        localStorage.setItem('eliana_tts', 'on');
    } else {
        stopTTS();
        localStorage.setItem('eliana_tts', 'off');
    }
}

function disableTTS() {
    state.ttsEnabled = false;
    state.ttsManuallyDisabled = true;
    stopTTS();
    updateVoiceButton(false);
    localStorage.setItem('eliana_tts', 'off');
}

/**
 * Enables TTS silently (no toggle, just turn on).
 * Called when voice interaction starts (wake word, orb card, mic button).
 */
function enableTTS() {
    if (state.ttsManuallyDisabled) return;
    if (!state.ttsEnabled) {
        state.ttsEnabled = true;
        updateVoiceButton(true);
        localStorage.setItem('eliana_tts', 'on');
    }
}

function forceEnableTTS() {
    state.ttsManuallyDisabled = false;
    state.ttsEnabled = true;
    updateVoiceButton(true);
    localStorage.setItem('eliana_tts', 'on');
}

/**
 * Updates the voice orb button UI in the chat bottom bar.
 */
function updateVoiceButton(enabled) {
    // Update both chat and blinda voice buttons
    ['chat-voice-btn', 'blinda-voice-btn', 'diapo5-voice-btn', 'juego-voice-btn', 'diapo6-voice-btn', 'diapo7-voice-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (enabled) {
            btn.classList.add('voice-orb--active');
            btn.title = 'Voz de Eliana activada';
        } else {
            btn.classList.remove('voice-orb--active');
            btn.title = 'Voz de Eliana desactivada';
        }
    });
}

/**
 * Envía texto al endpoint /api/tts y reproduce el audio streaming.
 * Si ya hay un audio reproduciéndose, lo detiene primero.
 */
async function playTTS(text, skipSummary = false, isActivity = false) {
    // Detener audio previo si existe
    stopTTS();
    state.ttsCancelled = false;  // Reset flag para esta nueva reproducción
    // Pausar wake word para que no capte el audio del TTS
    stopWakeWordListening();

    if (!text || !text.trim()) return;

    try {
        console.log(`[TTS] Requesting audio for ${text.length} chars (skip_summary=${skipSummary})...`);
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, skip_summary: skipSummary, is_activity: isActivity })
        });

        // Si el usuario navegó atrás mientras el fetch estaba en progreso, no reproducir
        if (state.ttsCancelled) {
            console.log('[TTS] Cancelled during fetch — not playing');
            return;
        }

        if (!response.ok) {
            console.error('[TTS] Server error:', response.status);
            return;
        }

        // Reproducir como blob (más compatible que MediaSource para MP3 streaming)
        const blob = await response.blob();

        // Revisar de nuevo después de leer el blob
        if (state.ttsCancelled) {
            console.log('[TTS] Cancelled during blob read — not playing');
            return;
        }

        const audioUrl = URL.createObjectURL(blob);

        // iOS Safari: reuse warmed-up audio element to keep user gesture context
        // Desktop/Android: create new Audio (no gesture restrictions)
        const audio = state.iosAudioElement || new Audio();
        audio.src = audioUrl;

        state.ttsAudio = audio;
        state.ttsPlaying = true;

        // Activar orb en modo "hablando"
        if (window.orbSetListening) window.orbSetListening(true);

        // Use one-time event handlers to avoid stacking listeners on reused element
        const onEnded = () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            state.ttsPlaying = false;
            URL.revokeObjectURL(audioUrl);
            if (window.orbSetListening) window.orbSetListening(false);

            console.log('[MIC-DEBUG] TTS onEnded — voiceTriggered:', state.voiceTriggered, 'ttsEnabled:', state.ttsEnabled, 'isRecording:', state.isRecording, 'screen:', !elements.loginScreen.classList.contains('hidden') ? 'login' : 'other');

            // Si la interacción fue por voz, activar micrófono automáticamente
            if (state.voiceTriggered && state.ttsEnabled) {
                // Actividad 3: no auto-grabar, solo invitar con pulso visual
                if (state.activityMode === 'pregunta_ia') {
                    console.log('[MIC-DEBUG] pregunta_ia — mic invite pulse (no auto-record)');
                    const micBtn = document.getElementById('chat-mic-btn');
                    if (micBtn) {
                        micBtn.classList.add('mic-invite');
                        // Quitar pulso al hacer click o tras 8s
                        const removePulse = () => micBtn.classList.remove('mic-invite');
                        micBtn.addEventListener('click', removePulse, { once: true });
                        setTimeout(removePulse, 8000);
                    }
                    resumeWakeWordAfterRecording();
                } else {
                    console.log('[MIC-DEBUG] Voice mode — will auto-start recording in 300ms');
                    // Pequeño delay para que el usuario sepa que puede hablar
                    setTimeout(() => {
                        if (!state.isRecording && !state.ttsPlaying) {
                            console.log('[MIC-DEBUG] Auto-starting recording NOW');
                            state._autoRecordAfterTTS = true;
                            startRecording();
                        } else {
                            console.log('[MIC-DEBUG] Skipped auto-record — isRecording:', state.isRecording, 'ttsPlaying:', state.ttsPlaying);
                        }
                    }, 300);
                }
            } else {
                // En pregunta_ia: mostrar pulso aunque voiceTriggered sea false (opener)
                if (state.activityMode === 'pregunta_ia') {
                    console.log('[MIC-DEBUG] pregunta_ia opener — mic invite pulse');
                    const micBtn = document.getElementById('chat-mic-btn');
                    if (micBtn) {
                        micBtn.classList.add('mic-invite');
                        const removePulse = () => micBtn.classList.remove('mic-invite');
                        micBtn.addEventListener('click', removePulse, { once: true });
                        setTimeout(removePulse, 8000);
                    }
                }
                // Solo reanudar wake word si no es modo voz
                console.log('[MIC-DEBUG] No voice mode — calling resumeWakeWordAfterRecording()');
                resumeWakeWordAfterRecording();
            }
        };

        const onError = (e) => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            console.error('[TTS] Audio playback error:', e);
            state.ttsPlaying = false;
            URL.revokeObjectURL(audioUrl);
            if (window.orbSetListening) window.orbSetListening(false);
        };

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        await audio.play();
        console.log('[TTS] Playing audio');

    } catch (err) {
        console.error('[TTS] Error:', err);
        state.ttsPlaying = false;
        if (window.orbSetListening) window.orbSetListening(false);
    }
}

/**
 * Plays TTS and returns a Promise that resolves when audio finishes.
 * Used for voice mode question so we can wait before starting recording.
 */
function playTTSAndWait(text) {
    return new Promise(async (resolve) => {
        state.ttsCancelled = false;
        // Pausar wake word para que no capte el audio del TTS como wake word
        stopWakeWordListening();
        try {
            console.log('[TTS] playTTSAndWait: requesting audio for:', text.substring(0, 50) + '...');
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, skip_summary: true })
            });

            if (state.ttsCancelled) { resolve(); return; }

            if (!response.ok) {
                console.error('[TTS] playTTSAndWait: server error', response.status);
                resolve();
                return;
            }

            // Esperar a que se descargue todo el audio antes de reproducir
            const blob = await response.blob();

            if (state.ttsCancelled) { resolve(); return; }

            console.log('[TTS] playTTSAndWait: got complete blob, size:', blob.size);
            if (blob.size === 0) {
                console.error('[TTS] playTTSAndWait: empty blob');
                resolve();
                return;
            }

            const audioUrl = URL.createObjectURL(blob);

            // iOS Safari: reuse warmed-up audio element for user gesture context
            const audio = state.iosAudioElement || new Audio();
            audio.src = audioUrl;
            state.ttsAudio = audio;

            // Activar orb en modo "hablando"
            if (window.orbSetListening) window.orbSetListening(true);

            const onEnded = () => {
                audio.removeEventListener('ended', onEnded);
                audio.removeEventListener('error', onError);
                console.log('[TTS] playTTSAndWait: audio ended naturally');
                URL.revokeObjectURL(audioUrl);
                state.ttsAudio = null;
                if (window.orbSetListening) window.orbSetListening(false);
                resumeWakeWordAfterRecording();
                resolve();
            };
            const onError = (e) => {
                audio.removeEventListener('ended', onEnded);
                audio.removeEventListener('error', onError);
                console.error('[TTS] playTTSAndWait: audio error', e);
                URL.revokeObjectURL(audioUrl);
                state.ttsAudio = null;
                if (window.orbSetListening) window.orbSetListening(false);
                resumeWakeWordAfterRecording();
                resolve();
            };
            audio.addEventListener('ended', onEnded);
            audio.addEventListener('error', onError);

            console.log('[TTS] playTTSAndWait: starting playback, duration will be shown after load');
            audio.addEventListener('loadedmetadata', () => {
                console.log('[TTS] playTTSAndWait: audio duration:', audio.duration, 'seconds');
            }, { once: true });

            await audio.play();
            console.log('[TTS] playTTSAndWait: playback started');
        } catch (e) {
            console.error('[TTS] playTTSAndWait error:', e);
            if (window.orbSetListening) window.orbSetListening(false);
            resumeWakeWordAfterRecording();
            resolve();
        }
    });
}

/**
 * Detiene la reproducción TTS actual.
 */
function stopTTS() {
    state.ttsCancelled = true;  // Cancelar cualquier TTS en progreso (fetch pendiente)
    if (state.ttsAudio) {
        state.ttsAudio.pause();
        state.ttsAudio.currentTime = 0;
        // Don't null out if it's the reused iOS audio element — just stop playback
        if (state.ttsAudio !== state.iosAudioElement) {
            state.ttsAudio = null;
        }
    }
    state.ttsPlaying = false;
    if (window.orbSetListening) window.orbSetListening(false);
}

/**
 * Añade un botón de speaker a un mensaje del asistente para re-escuchar.
 */
function addSpeakerButton(messageElement, fullText) {
    if (!messageElement || !fullText) return;

    const row = messageElement.closest('.message-row') || messageElement;

    // No duplicar
    if (row.querySelector('.tts-speaker-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'tts-speaker-btn';
    btn.title = 'Escuchar respuesta';
    btn.innerHTML = '<i class="ph ph-speaker-high"></i>';

    btn.addEventListener('click', () => {
        if (state.ttsPlaying && state.ttsAudio) {
            stopTTS();
            btn.innerHTML = '<i class="ph ph-speaker-high"></i>';
            btn.title = 'Escuchar respuesta';
        } else {
            playTTS(fullText, !!state.activityMode);
            btn.innerHTML = '<i class="ph ph-stop"></i>';
            btn.title = 'Detener audio';
            // Restaurar icono cuando termine
            const checkEnd = setInterval(() => {
                if (!state.ttsPlaying) {
                    btn.innerHTML = '<i class="ph ph-speaker-high"></i>';
                    btn.title = 'Escuchar respuesta';
                    clearInterval(checkEnd);
                }
            }, 500);
        }
    });

    row.appendChild(btn);
}


// ============================================
// Login & Authentication
// ============================================
let demoOrbClicked = false;

const VALID_CREDENTIALS = {
    usuario: 'Gabriel',
    password: 'Prisma'
};

function showLoginScreen() {
    stopTTS();
    elements.loginScreen?.classList.remove('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');
    state.activityMode = null;
    state.activityMessageCount = 0;
    state.profileGenerated = false;
}

function handleLogout() {
    // Detener TTS al cerrar sesión
    stopTTS();

    // Limpiar estado de sesión
    localStorage.removeItem('eliana_logged_in');
    localStorage.removeItem('eliana_user');

    // Limpiar campos de login
    if (elements.loginUser) elements.loginUser.value = '';
    if (elements.loginPassword) elements.loginPassword.value = '';

    // Reset demo orb click flag
    demoOrbClicked = false;

    // Mostrar pantalla de login
    showLoginScreen();
}

function hideLoginScreen() {
    elements.loginScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.loginScreen?.classList.add('hidden');
        elements.loginScreen?.classList.remove('fade-out');
        elements.welcomeScreen?.classList.remove('hidden');
    }, 300);
}

function handleLogin(username, password) {
    // Demo: validación simple (en producción sería un API call)
    if (username === VALID_CREDENTIALS.usuario && password === VALID_CREDENTIALS.password) {
        localStorage.setItem('eliana_logged_in', 'true');
        localStorage.setItem('eliana_user', username);
        hideLoginScreen();
        // Sincronizar historial después de login
        syncSearchHistory();
        return true;
    }
    return false;
}

async function handleFaceID() {
    // Verificar si Face ID / Touch ID está disponible (Web Authentication API)
    if (!window.PublicKeyCredential) {
        alert('Tu navegador no soporta autenticación biométrica');
        return;
    }

    try {
        // Verificar si ya hay credencial guardada
        const credentialId = localStorage.getItem('eliana_faceid_credential');

        if (credentialId) {
            // Autenticar con credencial existente
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    timeout: 60000,
                    userVerification: 'required',
                    allowCredentials: [{
                        id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
                        type: 'public-key'
                    }]
                }
            });

            if (credential) {
                localStorage.setItem('eliana_logged_in', 'true');
                hideLoginScreen();
            }
        } else {
            // Primera vez: registrar Face ID
            const confirmed = confirm('¿Deseas configurar Face ID para acceder rápidamente?');
            if (!confirmed) return;

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: { name: 'Eliana', id: window.location.hostname },
                    user: {
                        id: new Uint8Array(16),
                        name: 'usuario@eliana.app',
                        displayName: 'Usuario Eliana'
                    },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                    timeout: 60000,
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    }
                }
            });

            if (credential) {
                // Guardar credential ID para futuras autenticaciones
                const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
                localStorage.setItem('eliana_faceid_credential', credId);
                localStorage.setItem('eliana_logged_in', 'true');
                hideLoginScreen();
            }
        }
    } catch (err) {
        console.error('Face ID error:', err);
        if (err.name === 'NotAllowedError') {
            alert('Autenticación cancelada o no permitida');
        } else {
            alert('Error al usar Face ID. Intenta con usuario y contraseña.');
        }
    }
}

function checkAuthOnLoad() {
    // DEMO MODE: Siempre mostrar login para la demo
    // Comentar estas 2 líneas para producción
    localStorage.removeItem('eliana_logged_in');
    localStorage.removeItem('eliana_user');

    const isLoggedIn = localStorage.getItem('eliana_logged_in') === 'true';
    if (isLoggedIn) {
        elements.loginScreen?.classList.add('hidden');
        elements.welcomeScreen?.classList.remove('hidden');
    } else {
        elements.loginScreen?.classList.remove('hidden');
        elements.welcomeScreen?.classList.add('hidden');
    }
}

// Orb click — reproduce el saludo de voz (sin cambiar de página)
let orbGreetingPlaying = false;
async function handleOrbGreeting() {
    // Si ya está reproduciéndose, no hacer nada
    if (orbGreetingPlaying) return;
    orbGreetingPlaying = true;

    warmupIOSAudio();
    enableTTS();

    if (window.orbSetListening) window.orbSetListening(true);

    const greetingText = '¡Chiquillo, bienvenidos al décimo sexto encuentro de profesores ELE en Polonia! Soy Eliana, y hoy estoy aquí con Mando para enseñaros cómo los agentes de inteligencia artificial pueden personalizar la enseñanza sin que perdáis el control pedagógico. Así que venga, ¡preguntadme lo que queráis, buscadme las cosquillas, que aquí estamos pa eso!';

    // Enviar texto directamente al TTS (skip_summary = true, sin pasar por el LLM)
    playTTS(greetingText, true);

    // Permitir volver a reproducir cuando termine el audio
    // NO reiniciar wake word en login — evita que grabe conversación ambiental
    const checkDone = setInterval(() => {
        if (!state.ttsPlaying) {
            orbGreetingPlaying = false;
            if (window.orbSetListening) window.orbSetListening(false);
            clearInterval(checkDone);
        }
    }, 500);
}

// Botón Entrar — transición a "Conoce a Eliana"
function handleEnterBtn() {
    localStorage.setItem('eliana_logged_in', 'true');
    localStorage.setItem('eliana_user', 'Presentador');
    warmupIOSAudio();
    enableTTS();

    // Transición a la pantalla "Conoce a Eliana"
    elements.loginScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.loginScreen?.classList.add('hidden');
        elements.loginScreen?.classList.remove('fade-out');
        showConoceScreen();
    }, 300);
}

// ============================================
// Conoce a Eliana — Navegación y actividades
// ============================================
const ACTIVITY_LABELS = {
    yo_nunca_nunca: 'Yo Nunca Nunca de Profe',
    dime_algo: 'Dime Algo y Te Digo Quién Eres',
    pregunta_ia: 'Lo Que Nunca Le Preguntas a una IA'
};

const ACTIVITY_OPENERS = {
    yo_nunca_nunca: 'Vamos a jugar a Yo Nunca Nunca. Funciona así: yo digo una frase "yo nunca nunca he..." sobre cosas de profes, y tú me cuentas si te ha pasado. Pero antes, ¿cómo te llamas?',
    dime_algo: 'Bienvenido a mi consulta de perfilado psicológico docente. Funciona así: tú me dices tres palabras favoritas en español, una por una, y yo te digo qué tipo de profe eres. Pero primero, ¿cómo te llamas?',
    pregunta_ia: 'Vamos a conocernos de verdad. Funciona así: yo te hago preguntas sobre ti como profe y charlamos un rato. Pero antes, ¿cómo te llamas?'
};

function showConoceScreen() {
    stopTTS();
    elements.loginScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');
    elements.conoceScreen?.classList.remove('hidden');
    elements.conoceScreen?.classList.remove('fade-out');

    // Crear orb en el contenedor
    const orbContainer = document.getElementById('conoce-orb-container');
    if (orbContainer && window.orbCreateInElement) {
        const orbSize = window.innerWidth <= 480 ? 280 : window.innerWidth <= 968 ? 320 : 220;
        window.orbCreateInElement(orbContainer, orbSize);
    }
}

function showActivityChat(activityMode) {
    state.activityMode = activityMode;
    state.activityMessageCount = 0;
    state.profileGenerated = false;

    // Cerrar WebSocket existente para conversación fresca
    if (state.websocket) {
        state.websocket.close();
        state.websocket = null;
    }

    // Fade out conoce
    elements.conoceScreen?.classList.add('fade-out');

    setTimeout(() => {
        elements.conoceScreen?.classList.add('hidden');
        elements.conoceScreen?.classList.remove('fade-out');
        elements.chatScreen?.classList.remove('hidden');

        // Limpiar chat previo
        elements.chatMessages.innerHTML = '';

        // Ocultar label de actividad — solo mostrar "En línea"
        const activityLabel = document.getElementById('chat-activity-label');
        if (activityLabel) {
            activityLabel.style.display = 'none';
        }

        // Crear orb en chat header — mismo orb que login/conoce (200 partículas = size > 100)
        const chatOrbContainer = document.getElementById('orb-container-chat-header');
        if (chatOrbContainer && window.orbCreateInElement) {
            chatOrbContainer.innerHTML = '';
            window.orbCreateInElement(chatOrbContainer, 140);
        }

        // Eliana habla primero
        const opener = ACTIVITY_OPENERS[activityMode];
        addMessage(opener, 'assistant');
        state.activityMessageCount++;

        // TTS del opener
        playTTS(opener, true);

        elements.chatInput?.focus();
    }, 300);
}

function showProfileScreen(profileData) {
    stopTTS();
    stopWakeWordListening();
    state.voiceTriggered = false;
    state.isRecording = false;

    elements.chatScreen?.classList.add('fade-out');

    setTimeout(() => {
        elements.chatScreen?.classList.add('hidden');
        elements.chatScreen?.classList.remove('fade-out');
        elements.profileScreen?.classList.remove('hidden');

        renderProfileCard(profileData);

        // Orb decorativo
        const orbContainer = document.getElementById('profile-orb-container');
        if (orbContainer && window.orbCreateInElement) {
            window.orbCreateInElement(orbContainer, 80);
        }
    }, 300);
}

function renderProfileCard(data) {
    try {
        const profile = typeof data === 'string' ? JSON.parse(data) : data;

        // Phosphor icon en vez de emoji unicode
        const iconName = profile.icono || profile.emoji || 'graduation-cap';
        const iconEl = document.getElementById('profile-emoji');
        iconEl.textContent = '';
        iconEl.innerHTML = `<i class="ph-bold ph-${iconName}"></i>`;

        document.getElementById('profile-title').textContent = profile.titulo || 'Profe Extraordinario';

        const rasgosContainer = document.getElementById('profile-rasgos');
        rasgosContainer.innerHTML = '';
        (profile.rasgos || []).forEach(rasgo => {
            const chip = document.createElement('span');
            chip.className = 'profile-card__rasgo';
            chip.textContent = rasgo;
            rasgosContainer.appendChild(chip);
        });

        document.getElementById('profile-frase').textContent =
            '"' + (profile.frase_memorable || '...') + '"';

        const superpoderEl = document.getElementById('profile-superpoder');
        superpoderEl.innerHTML = `<i class="ph-bold ph-lightning"></i> ${profile.superpoder || 'Superpoder desconocido'}`;

        document.getElementById('profile-prediccion').textContent =
            profile.prediccion || '';
    } catch (e) {
        console.error('[Profile] Error rendering:', e, data);
        document.getElementById('profile-title').textContent = 'Tu perfil docente';
        document.getElementById('profile-emoji').innerHTML = '<i class="ph-bold ph-graduation-cap"></i>';
    }
}

function showActivityClosing() {
    if (document.getElementById('generate-profile-floating-btn')) return;

    // Solo botón — el LLM ya incluyó el cierre en su última respuesta
    const btn = document.createElement('button');
    btn.id = 'generate-profile-floating-btn';
    btn.className = 'generate-profile-btn';
    btn.innerHTML = '<i class="ph ph-identification-card"></i> Generar perfil';
    btn.addEventListener('click', requestProfileGeneration);

    elements.chatMessages.appendChild(btn);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function requestProfileGeneration() {
    if (state.profileGenerated) return;
    state.profileGenerated = true;

    // Cortar toda actividad de voz para que Eliana no siga hablando
    stopTTS();
    stopWakeWordListening();
    state.voiceTriggered = false;

    // Quitar botón
    const btn = document.getElementById('generate-profile-floating-btn');
    if (btn) btn.remove();

    // Indicador de carga
    addTypingIndicator();
    elements.chatStatus.textContent = 'Generando perfil...';

    // Enviar por WebSocket
    if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
        state.websocket.send(JSON.stringify({
            type: 'generate_profile',
            activity_mode: state.activityMode
        }));
    }
}

// ============================================
// BLINDA TU PROMPT — Quiz de tarjetas
// ============================================

const BLINDA_LETTERS = ['T1', 'T2', 'T3', 'T4', 'T5'];
const BLINDA_COLORS = {
    T1: '#2E86AB', T2: '#3A7D44', T3: '#C2185B',
    T4: '#E65100', T5: '#6A1B9A'
};
const BLINDA_TERRITORIES = {
    T1: 'Didáctica y metodología',
    T2: 'Precisión y calibración de la IA',
    T3: 'Ética y contenido responsable',
    T4: 'Evaluación',
    T5: 'Limitaciones técnicas de la IA'
};
const BLINDA_ICONS = {
    T1: 'ph-fill ph-chalkboard-teacher',
    T2: 'ph-fill ph-crosshair',
    T3: 'ph-fill ph-shield-check',
    T4: 'ph-fill ph-clipboard-text',
    T5: 'ph-fill ph-gear'
};
const BLINDA_CARDS_PER_ROUND = 5;

function isMobile() {
    return window.innerWidth <= 968;
}

function showBlindaScreen() {
    // Diapo 3 solo en escritorio — en móvil saltar a diapo 4 (juego)
    if (isMobile()) { showJuegoScreen(); return; }
    stopTTS();
    // Hide all screens (can come from profile or conoce)
    elements.profileScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.loginScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');

    elements.blindaScreen?.classList.remove('hidden');
    elements.blindaScreen?.classList.remove('fade-out');

    // Reset demo to step 0
    state.demoStep = 0;
    state.blindaPhase = 0;
    if (typeof advanceDemoTo === 'function') advanceDemoTo(0);
    if (typeof resetTerritoryHighlight === 'function') resetTerritoryHighlight();

    // Orb — compact size for blinda (120px desktop, smaller on mobile)
    const orbContainer = document.getElementById('blinda-orb-container');
    if (orbContainer && window.orbCreateInElement) {
        const orbSize = window.innerWidth <= 480 ? 64 : window.innerWidth <= 968 ? 80 : 120;
        window.orbCreateInElement(orbContainer, orbSize);
    }
}

function hideBlindaScreen() {
    elements.blindaScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.blindaScreen?.classList.add('hidden');
        elements.blindaScreen?.classList.remove('fade-out');
        showConoceScreen();
    }, 300);
}

// ---- Blinda Chat (interacción con Eliana dentro de diapo 3) ----

function isOnBlindaScreen() {
    return elements.blindaScreen && !elements.blindaScreen.classList.contains('hidden');
}
function isOnJuegoModal() {
    const modal = document.getElementById('juego-card-modal');
    return modal && !modal.classList.contains('hidden');
}

function addBlindaChatBubble(text, role) {
    const messages = document.getElementById('blinda-chat-messages');
    if (!messages) return null;
    const bubble = document.createElement('div');
    bubble.className = `blinda-chat__bubble blinda-chat__bubble--${role}`;
    if (role === 'assistant' && text) {
        bubble.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(text) : text;
    } else {
        bubble.textContent = text;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

function sendBlindaMessage(message) {
    // Add user bubble
    addBlindaChatBubble(message, 'user');

    // Detectar fase: si el usuario dice "continuamos" o pregunta por tarjeta, avanzar fase
    // Normalize: strip accents so "continúa" matches "continu"
    const lowerMsg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/continu|adelante|siguiente|vamos/.test(lowerMsg) || /tarjeta|carta|mecanica|como funciona|como se juega/.test(lowerMsg)) {
        state.blindaPhase = (state.blindaPhase || 0) + 1;
        console.log('[Blinda] Phase advanced to:', state.blindaPhase);
    }

    // Auto-advance: si el USUARIO dice la respuesta correcta (A), avanzar al paso 3
    if (state.demoStep === 2 && typeof advanceDemoTo === 'function') {
        const lower = message.toLowerCase();
        // Solo avanzar si menciona la A como respuesta (no B ni C)
        if ((lower.includes('es la a') || lower.includes('la a.') || lower.includes('la a,') || lower.includes('respuesta es a') || /la a/.test(lower)) && !lower.includes('la b') && !lower.includes('la c')) {
            setTimeout(() => advanceDemoTo(3), 3000);
        }
    }

    // Typing indicator
    const messages = document.getElementById('blinda-chat-messages');
    const typing = document.createElement('div');
    typing.className = 'blinda-chat__bubble blinda-chat__bubble--assistant blinda-chat__typing';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    state.currentMessage = '';
    let assistantBubble = null;

    const doSend = () => {
        // activity_mode: "blinda" → prompt de co-presentadora (no pregunta nombre, habla ante la sala)
        const payload = { message, response_mode: 'full', activity_mode: 'blinda' };
        // Primera vez: enviar el texto estático como contexto previo para que Eliana no repita saludo
        if (!state._blindaContextSent) {
            payload.prior_context = {
                question: 'Eliana, ya hemos terminado las actividades. ¿Qué viene ahora?',
                answer: 'Genial, ya hemos roto el hielo. Ahora vamos a poner a prueba vuestro ojo crítico como profes. He preparado unas tarjetas que os van a sorprender. Mando, cuando quieras. [NOTA INTERNA: esto fue solo la introducción, NO es ninguna fase. La FASE 1 empieza con el próximo "continuamos".]'
            };
            state._blindaContextSent = true;
        }
        state._blindaWs.send(JSON.stringify(payload));
    };

    const handleBlindaMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[BlindaWS] msg type:', data.type, 'demoStep:', state.demoStep, 'phase:', state.blindaPhase);

        if (data.type === 'token') {
            if (!assistantBubble) {
                typing.remove();
                assistantBubble = addBlindaChatBubble('', 'assistant');
                if (window.smd && assistantBubble) {
                    const renderer = window.smd.default_renderer(assistantBubble);
                    state._blindaSmdParser = window.smd.parser(renderer);
                } else {
                    state._blindaSmdParser = null;
                }
            }
            state.currentMessage += data.content;
            if (state._blindaSmdParser) {
                window.smd.parser_write(state._blindaSmdParser, data.content);
            } else if (assistantBubble) {
                assistantBubble.innerHTML = typeof renderMarkdown === 'function'
                    ? renderMarkdown(state.currentMessage, false) : state.currentMessage;
            }
            messages.scrollTop = messages.scrollHeight;
            // Live demo: auto-advance + territory highlight. Step 4 manual only.
            if (typeof checkTerritoryHighlight === 'function') {
                const lower = state.currentMessage.toLowerCase();
                if (state.demoStep === 0 && state.blindaPhase === 1) {
                    console.log('[Demo] Step0 check:', lower.includes('tarjeta'), lower.includes('territorio'), 'msg:', lower.substring(0,60));
                }
                if (state.demoStep === 0 && state.blindaPhase === 1 && (lower.includes('tarjeta') || lower.includes('carta') || lower.includes('categor') || lower.includes('territorio'))) {
                    console.log('[Demo] Advancing to step 1!');
                    advanceDemoTo(1);
                }
                if (state.demoStep === 1 && state.blindaPhase >= 2 && (lower.includes('darle la vuelta') || lower.includes('situaci') || lower.includes('tres opcion') || lower.includes('a, b') || lower.includes('opci'))) {
                    advanceDemoTo(2);
                }
                if (state.demoStep === 2 && (lower.includes('enhorabuena') || lower.includes('bingo') || lower.includes('habéis acertado') || lower.includes('muy bien'))) {
                    advanceDemoTo(3);
                }
                checkTerritoryHighlight(state.currentMessage);
            }
        }
        else if (data.type === 'end') {
            if (state._blindaSmdParser) {
                window.smd.parser_end(state._blindaSmdParser);
                state._blindaSmdParser = null;
            }
            // TTS
            if (state.currentMessage && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(state.currentMessage, true);
            }
            // Demo: avance de pasos 2-4 es manual (dots/flecha).
            // Paso 0→1 ya se hace en streaming (token handler).
            assistantBubble = null;
            resumeWakeWordAfterRecording();
        }
        else if (data.type === 'error') {
            typing.remove();
            addBlindaChatBubble('Error: ' + data.message, 'assistant');
            assistantBubble = null;
        }
    };

    // Use a SEPARATE WebSocket for Blinda (so it doesn't inherit activity_mode from diapo 2)
    if (state._blindaWs && state._blindaWs.readyState === WebSocket.OPEN) {
        state._blindaWs.onmessage = handleBlindaMessage;
        doSend();
        return;
    }

    if (state._blindaWs) {
        state._blindaWs.close();
        state._blindaWs = null;
        state._blindaContextSent = false;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state._blindaWs = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);
    state._blindaWs.onopen = doSend;
    state._blindaWs.onmessage = handleBlindaMessage;
    state._blindaWs.onerror = () => {
        typing.remove();
        addBlindaChatBubble('Error de conexión', 'assistant');
    };
}

async function fetchBlindaCards() {
    if (state.blindaCards.length > 0) return state.blindaCards;
    try {
        // Try DB endpoint first, fall back to JSON file
        let res = await fetch('/api/prompt-cards');
        let data = res.ok ? await res.json() : [];
        if (data.length === 0) {
            res = await fetch('/cards_data.json');
            data = res.ok ? await res.json() : [];
        }
        state.blindaCards = data;
        console.log(`[Blinda] Fetched ${data.length} cards`);
        return data;
    } catch (err) {
        console.error('[Blinda] Error fetching cards:', err);
        return [];
    }
}

function pickRandomCards(cards, count) {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

async function startBlindaGame() {
    const cards = await fetchBlindaCards();
    if (cards.length === 0) {
        console.error('[Blinda] No cards available');
        return;
    }

    state.blindaRound = pickRandomCards(cards, BLINDA_CARDS_PER_ROUND);
    state.blindaIndex = 0;
    state.blindaScore = 0;
    state.blindaAnswers = [];

    // Switch to game phase
    document.getElementById('blinda-intro')?.classList.add('hidden');
    document.getElementById('blinda-summary')?.classList.add('hidden');
    document.getElementById('blinda-game')?.classList.remove('hidden');

    showCarouselAnimation();
}

function showCarouselAnimation() {
    const carousel = document.getElementById('blinda-carousel');
    const cardContainer = document.getElementById('blinda-card-container');
    const feedback = document.getElementById('blinda-feedback');
    if (!carousel) return;

    // Hide card and feedback
    cardContainer?.classList.add('hidden');
    feedback?.classList.add('hidden');

    // Update progress
    const idx = state.blindaIndex;
    document.getElementById('blinda-progress-text').textContent = `${idx + 1} / ${BLINDA_CARDS_PER_ROUND}`;
    document.getElementById('blinda-progress-fill').style.width = `${((idx + 1) / BLINDA_CARDS_PER_ROUND) * 100}%`;

    // Build carousel track with ~12 mini cards (visual variety)
    const currentCard = state.blindaRound[idx];
    const miniCount = 12;
    const selectedIdx = 8; // where the carousel stops

    carousel.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'blinda-carousel__track';

    for (let i = 0; i < miniCount; i++) {
        const letter = i === selectedIdx ? currentCard.letter : BLINDA_LETTERS[Math.floor(Math.random() * BLINDA_LETTERS.length)];
        const mini = document.createElement('div');
        mini.className = 'blinda-carousel__mini';
        mini.dataset.letter = letter;
        const iconClass = BLINDA_ICONS[letter] || 'ph-fill ph-shield-check';
        mini.innerHTML = `<span>${letter}</span><i class="${iconClass}"></i>`;
        if (i === selectedIdx) mini.id = 'blinda-selected-mini';
        track.appendChild(mini);
    }
    carousel.appendChild(track);

    // Animate: slide track left, decelerate, stop at selected card centered
    const miniWidth = 92; // 80px + 12px gap
    const carouselCenter = carousel.offsetWidth / 2 - 40; // half carousel - half card
    const targetX = -(selectedIdx * miniWidth) + carouselCenter;

    // Start from right
    gsap.set(track, { x: carousel.offsetWidth });
    gsap.to(track, {
        x: targetX,
        duration: 1.8,
        ease: 'power4.out',
        onComplete: () => {
            // Highlight selected card
            const selected = document.getElementById('blinda-selected-mini');
            if (selected) {
                selected.classList.add('blinda-carousel__mini--selected');
            }
            // After a short pause, show the flip card
            setTimeout(() => openBlindaCard(currentCard), 500);
        }
    });
}

function openBlindaCard(card) {
    const container = document.getElementById('blinda-card-container');
    const cardEl = document.getElementById('blinda-card');
    const letterEl = document.getElementById('blinda-card-letter');
    const situationEl = document.getElementById('blinda-card-situation');
    const optionsEl = document.getElementById('blinda-card-options');
    if (!container || !cardEl) return;

    // Set front color based on letter
    const front = cardEl.querySelector('.blinda-card__front');
    if (front) {
        const color = BLINDA_COLORS[card.letter] || '#6B8F71';
        front.style.background = `linear-gradient(145deg, ${color}, ${color}dd)`;
    }

    letterEl.textContent = card.letter;
    situationEl.textContent = card.situation;

    // Build A/B/C options
    optionsEl.innerHTML = '';
    const options = [
        { label: 'A', text: card.option_a },
        { label: 'B', text: card.option_b },
        { label: 'C', text: card.option_c }
    ];
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'blinda-option-btn';
        btn.innerHTML = `<span class="blinda-option-btn__label">${opt.label}</span><span>${opt.text}</span>`;
        btn.addEventListener('click', () => selectBlindaOption(opt.label, card));
        optionsEl.appendChild(btn);
    });

    // Reset flip state and show
    cardEl.classList.remove('flipped');
    container.classList.remove('hidden');

    // Animate card entrance
    gsap.fromTo(container, { scale: 0.8, opacity: 0 }, {
        scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.4)'
    });

    // Auto-flip after a brief pause so user sees the front first
    setTimeout(() => {
        cardEl.classList.add('flipped');
    }, 800);
}

function selectBlindaOption(chosen, card) {
    const correct = chosen === card.correct_answer;
    if (correct) state.blindaScore++;
    state.blindaAnswers.push({ card, chosen, correct });

    // Highlight buttons
    const optionsEl = document.getElementById('blinda-card-options');
    const buttons = optionsEl.querySelectorAll('.blinda-option-btn');
    buttons.forEach(btn => {
        const label = btn.querySelector('.blinda-option-btn__label').textContent;
        if (label === card.correct_answer) {
            btn.classList.add('blinda-option-btn--correct');
        } else if (label === chosen && !correct) {
            btn.classList.add('blinda-option-btn--wrong');
        }
        btn.classList.add('blinda-option-btn--disabled');
    });

    // Show feedback after a short delay
    setTimeout(() => showBlindaFeedback(correct, card.explanation), 600);
}

function showBlindaFeedback(correct, explanation) {
    const feedback = document.getElementById('blinda-feedback');
    const icon = document.getElementById('blinda-feedback-icon');
    const text = document.getElementById('blinda-feedback-text');
    if (!feedback) return;

    feedback.className = `blinda-feedback blinda-feedback--${correct ? 'correct' : 'wrong'}`;
    icon.innerHTML = correct
        ? '<i class="ph-fill ph-check-circle"></i>'
        : '<i class="ph-fill ph-x-circle"></i>';
    text.textContent = correct ? 'Correcto' : explanation;

    feedback.classList.remove('hidden');
}

function nextBlindaCard() {
    state.blindaIndex++;
    if (state.blindaIndex >= BLINDA_CARDS_PER_ROUND) {
        showBlindaSummary();
    } else {
        showCarouselAnimation();
    }
}

function showBlindaSummary() {
    document.getElementById('blinda-game')?.classList.add('hidden');
    const summary = document.getElementById('blinda-summary');
    summary?.classList.remove('hidden');

    // Score
    const scoreEl = document.getElementById('blinda-summary-score');
    scoreEl.textContent = `${state.blindaScore} / ${BLINDA_CARDS_PER_ROUND}`;

    // Learnings - show wrong answers with explanations
    const learningsEl = document.getElementById('blinda-summary-learnings');
    learningsEl.innerHTML = '';
    state.blindaAnswers.forEach(a => {
        const div = document.createElement('div');
        div.className = `blinda-learning-item blinda-learning-item--${a.correct ? 'correct' : 'wrong'}`;
        if (a.correct) {
            div.textContent = `${a.card.letter}: Correcto`;
        } else {
            div.textContent = `${a.card.letter}: ${a.card.explanation}`;
        }
        learningsEl.appendChild(div);
    });
}

function replayBlinda() {
    startBlindaGame();
}

// ============================================
// BLINDA DEMO — Visual companion for diapo 3
// ============================================

const DEMO_CARD = {
    letter: 'T2',
    level: 2,
    category: 'Corrección de errores',
    situation: 'Prompt: "Da feedback sobre esta redacción B1". La IA: "Buen trabajo. Sigue así. Tienes buen nivel. Hay algunas cositas que mejorar".',
    option_a: 'Specific-feedback: "Cita 2 frases buenas del texto explicando por qué. Cita 2 errores con la corrección y la regla".',
    option_b: 'El feedback positivo general motiva al alumno a seguir escribiendo.',
    option_c: 'Pide que sea más largo y detallado: "Feedback de mínimo 200 palabras".',
    correct_answer: 'A',
    explanation: '"Algunas cositas" no es feedback, es ruido. El specific-feedback exige citas del texto real. La C añade palabras, no sustancia.'
};

/** Builds the HTML for a card back (shared between demo + juego) */
function buildCardBackHTML(card, color, prefix = 'blinda') {
    const territory = BLINDA_TERRITORIES[card.letter] || '';
    const category = card.category || '';
    // Show category if available, otherwise territory name
    const displayCat = category.replace(/^T\d-/, '') || territory;
    const icon = BLINDA_ICONS[card.letter] || 'ph-fill ph-shield-check';
    const level = card.level || 1;
    const levelDots = Array.from({ length: 3 }, (_, i) =>
        `<span class="${prefix}-card__level-dot ${i < level ? `${prefix}-card__level-dot--active` : ''}" style="${i < level ? `background:${color}` : ''}"></span>`
    ).join('');

    return `
        <div class="${prefix}-card__header" style="border-bottom-color: ${color}33">
            <div class="${prefix}-card__category">
                <i class="${icon}" style="color:${color}"></i>
                <span>${displayCat}</span>
            </div>
            <div class="${prefix}-card__level" title="Dificultad ${level}/3">
                ${levelDots}
            </div>
        </div>
        <p class="${prefix}-card__situation">${card.situation}</p>
        <div class="${prefix}-card__options">
            ${['A', 'B', 'C'].map(l => {
                const text = card[`option_${l.toLowerCase()}`];
                return `<div class="${prefix}-option-btn ${prefix}-option-btn--disabled">
                    <span class="${prefix}-option-btn__label" style="color:${color}">${l}</span><span>${text}</span>
                </div>`;
            }).join('')}
        </div>`;
}

const DEMO_KEYWORD_MAP = [
    { step: 1, patterns: ['tarjeta', 'tarjetas', 'carta', 'cartas', 'baraja', 'boca abajo', 'categor'] },
    { step: 2, patterns: ['darle la vuelta', 'abre', 'ejemplo', 'situaci', 'tres opcion'] },
    { step: 3, patterns: ['acert', 'correct', 'os explico', 'no pasa nada', 'felicit', 'respond'] },
    { step: 4, patterns: ['os toca', 'vosotros', 'sacad el', 'vuestro turno', 'movil', 'a jugar'] }
];

// Map territory keywords to letters for live highlight during streaming
const TERRITORY_KEYWORD_MAP = [
    { letter: 'T1', patterns: ['azul', 'didáctica', 'didactica', 'metodolog'] },
    { letter: 'T2', patterns: ['verde', 'precisión', 'precision', 'calibrac'] },
    { letter: 'T3', patterns: ['rosa', 'ética', 'etica', 'responsable'] },
    { letter: 'T4', patterns: ['naranja', 'evaluación', 'evaluacion'] },
    { letter: 'T5', patterns: ['violeta', 'limitacion', 'limitaciones', 'técnica', 'tecnica'] }
];

// Track which territories have been highlighted so we go in order
let _lastHighlightedIndex = -1;

function checkTerritoryHighlight(streamingText) {
    const lower = streamingText.toLowerCase();
    // Only highlight if we're on demo step 1 (territory cards visible)
    if (state.demoStep !== 1) return;

    for (let i = 0; i < TERRITORY_KEYWORD_MAP.length; i++) {
        if (i <= _lastHighlightedIndex) continue; // Only forward
        const mapping = TERRITORY_KEYWORD_MAP[i];
        for (const pat of mapping.patterns) {
            if (lower.includes(pat)) {
                highlightTerritoryCard(mapping.letter, i);
                _lastHighlightedIndex = i;
                return; // One at a time
            }
        }
    }
}

function highlightTerritoryCard(letter) {
    // Remove highlight from all
    document.querySelectorAll('.blinda-demo__territory-card').forEach(card => {
        card.classList.remove('blinda-demo__territory-card--highlight');
        gsap.to(card, { scale: 1, duration: 0.4, ease: 'power2.out' });
    });
    // Highlight the matching card
    const target = document.querySelector(`.blinda-demo__territory-card[data-letter="${letter}"]`);
    if (target) {
        target.classList.add('blinda-demo__territory-card--highlight');
        gsap.to(target, { scale: 1.18, duration: 0.5, ease: 'back.out(1.7)' });
    }
}

function resetTerritoryHighlight() {
    _lastHighlightedIndex = -1;
    document.querySelectorAll('.blinda-demo__territory-card').forEach(card => {
        card.classList.remove('blinda-demo__territory-card--highlight');
        gsap.to(card, { scale: 1, duration: 0.3 });
    });
}

function checkDemoAdvance(fullText) {
    const lower = fullText.toLowerCase();
    let targetStep = state.demoStep;
    for (const mapping of DEMO_KEYWORD_MAP) {
        if (mapping.step > state.demoStep) {
            for (const pat of mapping.patterns) {
                if (lower.includes(pat)) {
                    targetStep = Math.max(targetStep, mapping.step);
                    break;
                }
            }
        }
    }
    if (targetStep > state.demoStep) {
        advanceDemoTo(targetStep);
    }
}

function advanceDemoTo(step) {
    state.demoStep = step;
    document.querySelectorAll('.blinda-demo__step').forEach(el => {
        el.classList.remove('blinda-demo__step--active');
    });
    const target = document.querySelector(`[data-demo-step="${step}"]`);
    if (target) {
        target.classList.add('blinda-demo__step--active');
        if (step === 1) renderDemoPreview();
        if (step === 2) renderDemoFlip();
        if (step === 3) renderDemoFeedback();
    }
    document.querySelectorAll('.demo-stepper__dot').forEach(dot => {
        dot.classList.toggle('demo-stepper__dot--active', parseInt(dot.dataset.step) === step);
    });
}

function renderDemoPreview() {
    const container = document.getElementById('demo-step-1');
    if (!container || container.children.length > 0) return;
    const grid = document.createElement('div');
    grid.className = 'blinda-demo__cards-preview';
    BLINDA_LETTERS.forEach((letter, i) => {
        const card = document.createElement('div');
        card.className = 'blinda-demo__territory-card';
        card.dataset.letter = letter;
        const color = BLINDA_COLORS[letter] || '#6B8F71';
        const icon = BLINDA_ICONS[letter] || 'ph-fill ph-shield-check';
        const name = BLINDA_TERRITORIES[letter] || letter;
        card.style.background = `linear-gradient(145deg, ${color}, ${color}dd)`;
        card.innerHTML = `
            <i class="${icon}"></i>
            <span class="blinda-demo__territory-name">${name}</span>`;
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8) translateY(20px)';
        grid.appendChild(card);
        setTimeout(() => {
            gsap.to(card, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' });
        }, i * 150);
    });
    container.appendChild(grid);
}

function renderDemoFlip() {
    const container = document.getElementById('demo-step-2');
    if (!container || container.querySelector('.blinda-card-container')) return;
    const card = DEMO_CARD;
    const color = BLINDA_COLORS[card.letter] || '#6B8F71';

    const icon = BLINDA_ICONS[card.letter] || 'ph-fill ph-shield-check';
    const territoryName = BLINDA_TERRITORIES[card.letter] || card.letter;
    const displayCat = (card.category || '').replace(/^T\d-/, '') || territoryName;
    const level = card.level || 1;
    const levelDots = Array.from({ length: 3 }, (_, i) =>
        `<span class="blinda-card__level-dot ${i < level ? 'blinda-card__level-dot--active' : ''}" style="${i < level ? `background:${color}` : ''}"></span>`
    ).join('');
    container.innerHTML = `
        <div class="blinda-demo__card-pair">
            <!-- Front face -->
            <div class="blinda-demo__card-front" style="background: linear-gradient(145deg, ${color}, ${color}bb)">
                <i class="${icon}" style="font-size: 36px; opacity: 0.85;"></i>
                <div class="blinda-demo__card-front-name">${territoryName}</div>
                <div class="blinda-demo__card-front-cat">${displayCat}</div>
                <div class="blinda-card__level" style="margin-top: auto;">${levelDots}</div>
            </div>
            <!-- Back face -->
            <div class="blinda-demo__card-back" style="border-top: 5px solid ${color};">
                <p class="blinda-card__situation">${card.situation}</p>
                <div class="blinda-card__options">
                    ${['A', 'B', 'C'].map(l => {
                        const text = card['option_' + l.toLowerCase()];
                        return `<div class="blinda-option-btn" style="border-left: 3px solid ${color}">
                            <span class="blinda-option-btn__label" style="color:${color}">${l}</span><span>${text}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;

    // Animate pair entrance
    const front = container.querySelector('.blinda-demo__card-front');
    const back = container.querySelector('.blinda-demo__card-back');
    if (front) gsap.fromTo(front, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
    if (back) gsap.fromTo(back, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: 'power2.out' });
}

function renderDemoFeedback() {
    const container = document.getElementById('demo-step-3');
    if (!container || container.children.length > 0) return;
    const card = DEMO_CARD;
    const color = BLINDA_COLORS[card.letter] || '#6B8F71';
    const territoryName = BLINDA_TERRITORIES[card.letter] || card.letter;
    const feedbackIcon = BLINDA_ICONS[card.letter] || 'ph-fill ph-shield-check';
    const displayCat = (card.category || '').replace(/^T\d-/, '') || territoryName;
    const level = card.level || 1;
    const levelDots = Array.from({ length: 3 }, (_, i) =>
        `<span class="blinda-card__level-dot ${i < level ? 'blinda-card__level-dot--active' : ''}" style="${i < level ? `background:${color}` : ''}"></span>`
    ).join('');

    container.innerHTML = `
        <div class="blinda-demo__card-pair">
            <div class="blinda-demo__card-front" style="background: linear-gradient(145deg, ${color}, ${color}bb)">
                <i class="${feedbackIcon}" style="font-size: 36px; opacity: 0.85;"></i>
                <div class="blinda-demo__card-front-name">${territoryName}</div>
                <div class="blinda-demo__card-front-cat">${displayCat}</div>
                <div class="blinda-card__level" style="margin-top: auto;">${levelDots}</div>
            </div>
            <div class="blinda-demo__card-back" style="border-top: 5px solid ${color};">
                <p class="blinda-card__situation">${card.situation}</p>
                <div class="blinda-card__options">
                    ${['A', 'B', 'C'].map(l => {
                        const text = card['option_' + l.toLowerCase()];
                        const isCorrect = l === card.correct_answer;
                        const cls = isCorrect ? 'blinda-option-btn blinda-option-btn--correct' : 'blinda-option-btn';
                        const style = isCorrect
                            ? 'border-left: 3px solid #4CAF50'
                            : `border-left: 3px solid ${color}; opacity: 0.4`;
                        return `<div class="${cls}" style="${style}">
                            <span class="blinda-option-btn__label" style="color:${isCorrect ? '#4CAF50' : color}">${l}</span><span>${text}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
        <div class="blinda-feedback blinda-feedback--correct" style="margin-top: var(--space-16); border-left: 4px solid ${color};">
            <div class="blinda-feedback__icon" style="color: ${color}"><i class="ph-fill ph-check-circle"></i></div>
            <p class="blinda-feedback__text">${card.explanation}</p>
        </div>`;

    gsap.fromTo(container.querySelector('.blinda-feedback'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.3, ease: 'power2.out' });
}

// ============================================
// JUEGO SCREEN — Full game (diapo 4)
// ============================================

function showJuegoScreen() {
    stopTTS();
    elements.loginScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');

    elements.juegoScreen?.classList.remove('hidden');
    elements.juegoScreen?.classList.remove('fade-out');

    // Reset to intro
    document.getElementById('juego-intro')?.classList.remove('hidden');
    document.getElementById('juego-game')?.classList.add('hidden');
    document.getElementById('juego-summary')?.classList.add('hidden');
}

function hideJuegoScreen() {
    elements.juegoScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.juegoScreen?.classList.add('hidden');
        elements.juegoScreen?.classList.remove('fade-out');
        showBlindaScreen();
    }, 300);
}

// ============================================
// DIAPO 5 — El Chef y el Agente
// ============================================

const DIAPO5_CAPABILITIES = [
    {
        id: 'percibir',
        name: 'PERCIBIR',
        icon: 'ph-fill ph-eye',
        color: '#7EC8E3',
        chef: 'El chef mira qué ingredientes hay, quién está en la mesa, si es una cena romántica o un cumpleaños de niños.',
        agent: 'Observa quién es el alumno, qué nivel tiene, qué ha estudiado, dónde falla. Lee el contexto antes de actuar.',
        teacher: 'Entráis a clase y en 30 segundos sabéis quién no ha dormido, quién no ha estudiado y quién va a dar guerra.',
        punchline: 'Sin esto, es como cocinar sin saber para quién.'
    },
    {
        id: 'razonar',
        name: 'RAZONAR',
        icon: 'ph-fill ph-brain',
        color: '#81C784',
        chef: 'Decide: para esta mesa, risotto; para aquella, algo rápido porque tienen prisa.',
        agent: 'Decide qué estrategia usar: ¿práctica oral o escrita? ¿Juego de rol o texto? ¿Repaso o avanzo? Elige el mejor camino.',
        teacher: 'Decidís en tiempo real: «Cambio de plan, hoy toca juego porque es viernes y están muertos.»',
        punchline: 'No improvisa a lo loco. Tiene un plan.'
    },
    {
        id: 'actuar',
        name: 'ACTUAR',
        icon: 'ph-fill ph-lightning',
        color: '#F48FB1',
        chef: 'Cocina. No se queda mirando la receta eternamente. Lo ejecuta.',
        agent: 'Genera el ejercicio, adapta el texto, crea el audio, prepara la actividad. Pasa de la estrategia a la acción.',
        teacher: 'El momento en que dejáis el café y entráis al aula. Creáis la actividad, adaptáis el material, improvisáis.',
        punchline: 'Basta de pensar. Es hora de hacer.'
    },
    {
        id: 'herramientas',
        name: 'HERRAMIENTAS',
        icon: 'ph-fill ph-wrench',
        color: '#B39DDB',
        chef: 'Tiene cuchillos, horno, especias, batidora. Sin herramientas no hay cocina.',
        agent: 'Tiene el MCER, generadores de audio, bancos de ejercicios, adaptadores de textos por nivel, correctores.',
        teacher: 'El libro, el MCER, ese vídeo que encontrasteis a las 11 de la noche, las fichas de la compañera.',
        punchline: 'No solo piensa. Tiene con qué trabajar.'
    },
    {
        id: 'memoria',
        name: 'MEMORIA',
        icon: 'ph-fill ph-clock-counter-clockwise',
        color: '#FFB74D',
        chef: 'Recuerda que la mesa 3 es celíaca, que la mesa 7 pidió el vino de ayer, que el del fondo es alérgico al marisco.',
        agent: 'Recuerda que María lleva dos semanas con el subjuntivo, que Lucas no habla pero entiende todo, que Ahmed necesita vocabulario práctico.',
        teacher: '«Ahmed ya domina comida, María sigue con el subjuntivo, Lucas no habla pero entiende todo.»',
        punchline: 'No empieza de cero cada sesión.'
    }
];

const DIAPO5_KEYWORD_MAP = [
    { step: 1, patterns: ['viene a la cabeza', 'lluvia de ideas', 'nube de palabras', 'qué pensáis', 'qué os viene', 'escucháis', 'escuchais', 'agente de ia'] },
    { step: 2, patterns: ['imaginad un restaurante', 'chatbot es un camarero', 'agente es el chef'] },
    { step: 3, patterns: ['percibir', 'primera capacidad', 'primer poder'] },
    { step: 4, patterns: ['razonar', 'segunda capacidad', 'segundo poder'] },
    { step: 5, patterns: ['actuar', 'tercera capacidad', 'tercer poder', 'acción'] },
    { step: 6, patterns: ['herramientas', 'cuarta capacidad', 'cuarto poder'] },
    { step: 7, patterns: ['memoria', 'quinta capacidad', 'quinto poder', 'recuerda'] },
    { step: 8, patterns: ['multiplicar', 'vosotros por mil', 'no viene a sustituir', 'viene a multiplicar'] }
];

function showDiapo5Screen() {
    stopTTS();
    elements.loginScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');

    elements.diapo5Screen?.classList.remove('hidden');
    elements.diapo5Screen?.classList.remove('fade-out');

    // Reset demo to step 0
    state.diapo5Step = 0;
    advanceDiapo5To(0);

    // Orb
    const orbContainer = document.getElementById('diapo5-orb-container');
    if (orbContainer && window.orbCreateInElement) {
        const orbSize = window.innerWidth <= 480 ? 64 : window.innerWidth <= 968 ? 80 : 120;
        window.orbCreateInElement(orbContainer, orbSize);
    }
}

function hideDiapo5Screen() {
    elements.diapo5Screen?.classList.add('fade-out');
    setTimeout(() => {
        elements.diapo5Screen?.classList.add('hidden');
        elements.diapo5Screen?.classList.remove('fade-out');
        showJuegoScreen();
    }, 300);
}

function isOnDiapo5Screen() {
    return elements.diapo5Screen && !elements.diapo5Screen.classList.contains('hidden');
}

function addDiapo5ChatBubble(text, role) {
    const messages = document.getElementById('diapo5-chat-messages');
    if (!messages) return null;
    const bubble = document.createElement('div');
    bubble.className = `blinda-chat__bubble blinda-chat__bubble--${role}`;
    if (role === 'assistant' && text) {
        bubble.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(text) : text;
    } else {
        bubble.textContent = text;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

function sendDiapo5Message(message) {
    addDiapo5ChatBubble(message, 'user');

    const messages = document.getElementById('diapo5-chat-messages');
    const typing = document.createElement('div');
    typing.className = 'blinda-chat__bubble blinda-chat__bubble--assistant blinda-chat__typing';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    state.currentMessage = '';
    let assistantBubble = null;

    const doSend = () => {
        const payload = { message, response_mode: 'full', activity_mode: 'agentes' };
        if (!state._diapo5ContextSent) {
            payload.prior_context = {
                question: 'Eliana, vamos a explicar qué es un agente de IA con la metáfora del chef.',
                answer: 'Vamos a ver ahora qué es un agente de IA. Mando, cuando quieras.'
            };
            state._diapo5ContextSent = true;
        }
        state._diapo5Ws.send(JSON.stringify(payload));
    };

    const handleDiapo5Message = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
            if (!assistantBubble) {
                typing.remove();
                assistantBubble = addDiapo5ChatBubble('', 'assistant');
                if (window.smd && assistantBubble) {
                    const renderer = window.smd.default_renderer(assistantBubble);
                    state._diapo5SmdParser = window.smd.parser(renderer);
                } else {
                    state._diapo5SmdParser = null;
                }
            }
            state.currentMessage += data.content;
            if (state._diapo5SmdParser) {
                window.smd.parser_write(state._diapo5SmdParser, data.content);
            } else if (assistantBubble) {
                assistantBubble.innerHTML = typeof renderMarkdown === 'function'
                    ? renderMarkdown(state.currentMessage, false) : state.currentMessage;
            }
            messages.scrollTop = messages.scrollHeight;
            // Live auto-advance: detect keywords while Eliana speaks (streaming)
            checkDiapo5Advance(state.currentMessage);
        }
        else if (data.type === 'end') {
            if (state._diapo5SmdParser) {
                window.smd.parser_end(state._diapo5SmdParser);
                state._diapo5SmdParser = null;
            }
            if (state.currentMessage && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(state.currentMessage, true);
            }
            // Final check in case streaming missed a keyword
            if (state.currentMessage) {
                checkDiapo5Advance(state.currentMessage);
            }
            assistantBubble = null;
            resumeWakeWordAfterRecording();
        }
        else if (data.type === 'error') {
            typing.remove();
            addDiapo5ChatBubble('Error: ' + data.message, 'assistant');
            assistantBubble = null;
        }
    };

    if (state._diapo5Ws && state._diapo5Ws.readyState === WebSocket.OPEN) {
        state._diapo5Ws.onmessage = handleDiapo5Message;
        doSend();
        return;
    }

    if (state._diapo5Ws) {
        state._diapo5Ws.close();
        state._diapo5Ws = null;
        state._diapo5ContextSent = false;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state._diapo5Ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);
    state._diapo5Ws.onopen = doSend;
    state._diapo5Ws.onmessage = handleDiapo5Message;
    state._diapo5Ws.onerror = () => {
        typing.remove();
        addDiapo5ChatBubble('Error de conexion', 'assistant');
    };
}

function checkDiapo5Advance(fullText) {
    const lower = fullText.toLowerCase();
    // Only check for the NEXT step — never skip steps
    const nextStep = state.diapo5Step + 1;
    const mapping = DIAPO5_KEYWORD_MAP.find(m => m.step === nextStep);
    if (!mapping) return;
    for (const pat of mapping.patterns) {
        if (lower.includes(pat)) {
            advanceDiapo5To(nextStep);
            return;
        }
    }
}

function advanceDiapo5To(step) {
    state.diapo5Step = step;
    document.querySelectorAll('.diapo5-demo__step').forEach(el => {
        el.classList.remove('diapo5-demo__step--active');
    });
    const target = document.querySelector(`[data-diapo5-step="${step}"]`);
    if (target) {
        target.classList.add('diapo5-demo__step--active');
        if (step === 1) renderDiapo5WordCloud();
        else if (step === 2) renderDiapo5Intro();
        else if (step >= 3 && step <= 7) renderDiapo5Capability(step - 3);
        else if (step === 8) renderDiapo5Closing();
        else if (step === 9) renderDiapo5Song();
    }
    document.querySelectorAll('[data-diapo5-dot]').forEach(dot => {
        dot.classList.toggle('demo-stepper__dot--active', parseInt(dot.dataset.diapo5Dot) === step);
    });
}

// Step 1: Word cloud (nube de palabras)
const DIAPO5_CLOUD_WORDS = [
    { text: 'Responde preguntas', size: 'md', color: '#9E9E9E' },
    { text: 'Usa herramientas', size: 'lg', color: '#B39DDB' },
    { text: 'Genera texto', size: 'md', color: '#9E9E9E' },
    { text: 'Planifica pasos', size: 'lg', color: '#81C784' },
    { text: 'Necesita instrucciones exactas', size: 'sm', color: '#BCAAA4' },
    { text: 'Recuerda lo anterior', size: 'lg', color: '#FFB74D' },
    { text: 'Actúa por su cuenta', size: 'lg', color: '#F48FB1' },
    { text: 'Busca información', size: 'md', color: '#B39DDB' },
    { text: 'Copia y pega', size: 'sm', color: '#BCAAA4' },
    { text: 'Adapta su estrategia', size: 'lg', color: '#81C784' },
    { text: 'Siempre dice lo mismo', size: 'sm', color: '#BCAAA4' },
    { text: 'Observa el contexto', size: 'lg', color: '#7EC8E3' },
    { text: 'Ejecuta tareas', size: 'md', color: '#F48FB1' },
    { text: 'Solo habla', size: 'sm', color: '#BCAAA4' },
    { text: 'Aprende del alumno', size: 'md', color: '#FFB74D' },
    { text: 'Traduce palabra por palabra', size: 'sm', color: '#BCAAA4' },
];

function renderDiapo5WordCloud() {
    const container = document.getElementById('diapo5-step-1');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-wordcloud">
            <h3 class="diapo5-wordcloud__title">¿Cuáles describen a un agente de IA?</h3>
            <div class="diapo5-wordcloud__cloud" id="diapo5-cloud">
                ${DIAPO5_CLOUD_WORDS.map(w => `
                    <span class="diapo5-wordcloud__word diapo5-wordcloud__word--${w.size}" style="color: ${w.color}; border-color: ${w.color}">${w.text}</span>
                `).join('')}
            </div>
        </div>
    `;

    const words = container.querySelectorAll('.diapo5-wordcloud__word');
    words.forEach((word, i) => {
        gsap.fromTo(word,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.35, delay: i * 0.06, ease: 'back.out(1.5)' }
        );
    });
}

// Step 2: Chef vs Chatbot intro
function renderDiapo5Intro() {
    const container = document.getElementById('diapo5-step-2');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-chef-intro">
            <div class="diapo5-chef-intro__vs">
                <div class="diapo5-chef-intro__card diapo5-chef-intro__card--chatbot">
                    <div class="diapo5-chef-intro__icon-wrap" style="background: var(--md-sys-color-surface-container-high)">
                        <i class="ph-fill ph-chat-dots" style="color: var(--md-sys-color-outline)"></i>
                    </div>
                    <h4 class="diapo5-chef-intro__label">Chatbot</h4>
                    <p class="diapo5-chef-intro__desc">Un camarero que lee la carta. Le preguntas qué hay y te dice «sopa, ensalada y carne». A todos igual. Siempre lo mismo.</p>
                </div>
                <div class="diapo5-chef-intro__divider">
                    <span>VS</span>
                </div>
                <div class="diapo5-chef-intro__card diapo5-chef-intro__card--agent">
                    <div class="diapo5-chef-intro__icon-wrap" style="background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary))">
                        <i class="ph-fill ph-chef-hat" style="color: #fff"></i>
                    </div>
                    <h4 class="diapo5-chef-intro__label">Agente</h4>
                    <p class="diapo5-chef-intro__desc">Un chef. Observa, piensa, cocina, usa herramientas y recuerda los gustos de cada mesa.</p>
                </div>
            </div>
            <p class="diapo5-chef-intro__hook">Un agente trabaja como un chef. Y como vosotros.</p>
        </div>
    `;

    const cards = container.querySelectorAll('.diapo5-chef-intro__card');
    cards.forEach((card, i) => {
        gsap.fromTo(card,
            { y: 30, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.5, delay: i * 0.25, ease: 'back.out(1.4)' }
        );
    });
    const hook = container.querySelector('.diapo5-chef-intro__hook');
    if (hook) gsap.fromTo(hook, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.7, ease: 'power2.out' });
}

// Steps 3-7: Individual capabilities
function renderDiapo5Capability(capIndex) {
    const cap = DIAPO5_CAPABILITIES[capIndex];
    if (!cap) return;
    const container = document.getElementById(`diapo5-step-${capIndex + 3}`);
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-cap">
            <div class="diapo5-cap__header" style="background: linear-gradient(135deg, ${cap.color}, ${cap.color}cc)">
                <div class="diapo5-cap__icon">
                    <i class="${cap.icon}"></i>
                </div>
                <h3 class="diapo5-cap__name">${cap.name}</h3>
            </div>
            <div class="diapo5-cap__rows">
                <div class="diapo5-cap__row">
                    <div class="diapo5-cap__row-icon"><i class="ph-fill ph-chef-hat"></i></div>
                    <div class="diapo5-cap__row-content">
                        <span class="diapo5-cap__row-label">El chef</span>
                        <p class="diapo5-cap__row-text">${cap.chef}</p>
                    </div>
                </div>
                <div class="diapo5-cap__row diapo5-cap__row--agent">
                    <div class="diapo5-cap__row-icon" style="background: ${cap.color}"><i class="ph-fill ph-robot"></i></div>
                    <div class="diapo5-cap__row-content">
                        <span class="diapo5-cap__row-label">El agente</span>
                        <p class="diapo5-cap__row-text">${cap.agent}</p>
                    </div>
                </div>
                <div class="diapo5-cap__row diapo5-cap__row--teacher">
                    <div class="diapo5-cap__row-icon"><i class="ph-fill ph-chalkboard-teacher"></i></div>
                    <div class="diapo5-cap__row-content">
                        <span class="diapo5-cap__row-label">Vosotros</span>
                        <p class="diapo5-cap__row-text">${cap.teacher}</p>
                    </div>
                </div>
            </div>
            <p class="diapo5-cap__punchline" style="background: linear-gradient(135deg, ${cap.color}22, ${cap.color}11); color: ${cap.color}">${cap.punchline}</p>
        </div>
    `;

    // Animate
    const header = container.querySelector('.diapo5-cap__header');
    const rows = container.querySelectorAll('.diapo5-cap__row');
    const punch = container.querySelector('.diapo5-cap__punchline');
    if (header) gsap.fromTo(header, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    rows.forEach((row, i) => {
        gsap.fromTo(row,
            { x: -20, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.35, delay: 0.2 + i * 0.15, ease: 'power2.out' }
        );
    });
    if (punch) gsap.fromTo(punch, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, delay: 0.75, ease: 'power2.out' });
}

// Step 8: Closing
function renderDiapo5Closing() {
    const container = document.getElementById('diapo5-step-8');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-closing">
            <div class="diapo5-closing__caps">
                ${DIAPO5_CAPABILITIES.map((cap, i) => `
                    <div class="diapo5-closing__cap" style="background: linear-gradient(135deg, ${cap.color}, ${cap.color}cc)">
                        <i class="${cap.icon}"></i>
                        <span>${cap.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="diapo5-closing__message">
                <p class="diapo5-closing__text">Vosotros ya sois chefs. Cada clase es un menú distinto para comensales distintos.</p>
                <p class="diapo5-closing__text">La diferencia es que vosotros cocinéis para 25 mesas a la vez, solos, cansados y sin ayudante.</p>
                <p class="diapo5-closing__highlight">Un agente es un chef que puede cocinar para cada alumno a la vez, sin cansarse, sin olvidar nada, con todos los ingredientes del mundo.</p>
            </div>
            <div class="diapo5-closing__tagline">
                <i class="ph-fill ph-arrow-fat-lines-right"></i>
                <span>No viene a sustituir al chef. Viene a multiplicarlo.</span>
            </div>
        </div>
    `;

    // Animate caps
    const caps = container.querySelectorAll('.diapo5-closing__cap');
    caps.forEach((cap, i) => {
        gsap.fromTo(cap,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.35, delay: i * 0.1, ease: 'back.out(1.7)' }
        );
    });
    // Animate message
    const texts = container.querySelectorAll('.diapo5-closing__text, .diapo5-closing__highlight');
    texts.forEach((t, i) => {
        gsap.fromTo(t, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.6 + i * 0.2, ease: 'power2.out' });
    });
    // Animate tagline
    const tagline = container.querySelector('.diapo5-closing__tagline');
    if (tagline) gsap.fromTo(tagline, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, delay: 1.4, ease: 'back.out(1.5)' });
}

// Step 9: Song
function renderDiapo5Song() {
    const container = document.getElementById('diapo5-step-9');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-song">
            <div class="diapo5-song__header">
                <i class="ph-fill ph-music-notes"></i>
                <h3 class="diapo5-song__title">LA CANCIÓN DEL AGENTE</h3>
            </div>
            <div class="diapo5-song__player">
                <button class="diapo5-song__play-btn" id="diapo5-song-btn">
                    <i class="ph-fill ph-play"></i>
                </button>
                <div class="diapo5-song__progress">
                    <div class="diapo5-song__progress-bar" id="diapo5-song-progress"></div>
                </div>
                <span class="diapo5-song__time" id="diapo5-song-time">0:00</span>
            </div>
            <div class="diapo5-song__lyrics">
                <div class="diapo5-song__section diapo5-song__section--intro">
                    <span class="diapo5-song__line">¡ATENCIÓN PROFES! ESTO NO ES UN CHATBOT CUALQUIERA.</span>
                </div>
                <div class="diapo5-song__section diapo5-song__section--verse">
                    <span class="diapo5-song__line">PRIMERO TE MIRO, TE LEO, TE ESCUCHO</span>
                    <span class="diapo5-song__line"><strong style="color: #7EC8E3">PERCIBO</strong> TU MUNDO, ENTIENDO TU ASUNTO</span>
                    <span class="diapo5-song__line">DESPUÉS ME LO PIENSO, <strong style="color: #81C784">RAZONO</strong> UN RATITO</span>
                    <span class="diapo5-song__line">ELIJO EL CAMINO, CON CALMA Y CON RUMBO</span>
                    <span class="diapo5-song__line">¡Y AHORA SÍ, <strong style="color: #F48FB1">ACTÚO</strong> CON GANAS!</span>
                </div>
                <div class="diapo5-song__section diapo5-song__section--chorus">
                    <span class="diapo5-song__line"><strong style="color: #7EC8E3">PERCIBO</strong>, <strong style="color: #81C784">RAZONO</strong>, Y LUEGO <strong style="color: #F48FB1">ACTÚO</strong></span>
                    <span class="diapo5-song__line">CON MIS <strong style="color: #B39DDB">HERRAMIENTAS</strong> SOY UN AGENTAZO</span>
                    <span class="diapo5-song__line">Y SI VUELVES MAÑANA YO ME ACUERDO DE TODO</span>
                    <span class="diapo5-song__line">¡<strong style="color: #FFB74D">MEMORIA</strong> DE PROFE, PERO SIN EL CANSANCIO!</span>
                </div>
            </div>
        </div>
    `;

    // Song player
    const songBtn = container.querySelector('#diapo5-song-btn');
    const progressBar = container.querySelector('#diapo5-song-progress');
    const timeDisplay = container.querySelector('#diapo5-song-time');
    let songAudio = null;
    let progressInterval = null;

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    };

    songBtn?.addEventListener('click', () => {
        if (!songAudio) {
            songAudio = new Audio('/static/cancion-agente.mp3');
            songAudio.addEventListener('ended', () => {
                songBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
                songBtn.classList.remove('diapo5-song__play-btn--playing');
                if (progressBar) progressBar.style.width = '0%';
                if (timeDisplay) timeDisplay.textContent = '0:00';
                clearInterval(progressInterval);
            });
        }
        if (songAudio.paused) {
            stopTTS();
            songAudio.play();
            songBtn.innerHTML = '<i class="ph-fill ph-pause"></i>';
            songBtn.classList.add('diapo5-song__play-btn--playing');
            progressInterval = setInterval(() => {
                if (songAudio.duration) {
                    const pct = (songAudio.currentTime / songAudio.duration) * 100;
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (timeDisplay) timeDisplay.textContent = formatTime(songAudio.currentTime);
                }
            }, 250);
        } else {
            songAudio.pause();
            songBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
            songBtn.classList.remove('diapo5-song__play-btn--playing');
            clearInterval(progressInterval);
        }
    });

    // Animate
    const header = container.querySelector('.diapo5-song__header');
    const player = container.querySelector('.diapo5-song__player');
    const verses = container.querySelectorAll('.diapo5-song__verse');
    if (header) gsap.fromTo(header, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    if (player) gsap.fromTo(player, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, delay: 0.2, ease: 'back.out(1.4)' });
    verses.forEach((v, i) => {
        gsap.fromTo(v, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.35, delay: 0.4 + i * 0.15, ease: 'power2.out' });
    });
}

// ---- End Diapo 5 ----

async function startJuegoGame() {
    const cards = await fetchBlindaCards();
    if (cards.length === 0) {
        console.error('[Juego] No cards available');
        return;
    }

    state.juegoRound = pickRandomCards(cards, BLINDA_CARDS_PER_ROUND);
    state.juegoIndex = 0;
    state.juegoScore = 0;
    state.juegoAnswers = [];

    document.getElementById('juego-intro')?.classList.add('hidden');
    document.getElementById('juego-summary')?.classList.add('hidden');
    document.getElementById('juego-game')?.classList.remove('hidden');

    showJuegoCarousel();
}

function showJuegoCarousel() {
    const carousel = document.getElementById('juego-carousel');
    const feedback = document.getElementById('juego-feedback');
    const modal = document.getElementById('juego-card-modal');
    if (!carousel) return;

    feedback?.classList.add('hidden');
    if (modal) modal.classList.add('hidden');

    const idx = state.juegoIndex;
    document.getElementById('juego-progress-text').textContent = `${idx + 1} / ${BLINDA_CARDS_PER_ROUND}`;
    document.getElementById('juego-progress-fill').style.width = `${((idx + 1) / BLINDA_CARDS_PER_ROUND) * 100}%`;

    const currentCard = state.juegoRound[idx];
    const miniCount = 12;
    const selectedIdx = 8;

    carousel.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'juego-carousel__track';

    for (let i = 0; i < miniCount; i++) {
        const letter = i === selectedIdx ? currentCard.letter : BLINDA_LETTERS[Math.floor(Math.random() * BLINDA_LETTERS.length)];
        const mini = document.createElement('div');
        mini.className = 'juego-carousel__mini';
        mini.dataset.letter = letter;
        const tName = BLINDA_TERRITORIES[letter] || letter;
        const tIcon = BLINDA_ICONS[letter] || 'ph-fill ph-shield-check';
        const tColor = BLINDA_COLORS[letter] || '#6B8F71';
        mini.style.background = tColor;
        mini.innerHTML = `<i class="${tIcon} juego-carousel__mini-icon"></i><img src="/static/imagenes/logo_juego.png" class="juego-carousel__mini-logo" alt=""><span class="juego-carousel__mini-name">${tName}</span>`;
        if (i === selectedIdx) mini.id = 'juego-selected-mini';
        track.appendChild(mini);
    }
    carousel.appendChild(track);

    const miniWidth = 200;
    const carouselCenter = carousel.offsetWidth / 2 - 90;
    const targetX = -(selectedIdx * miniWidth) + carouselCenter;

    gsap.set(track, { x: carousel.offsetWidth });
    gsap.to(track, {
        x: targetX,
        duration: 1.8,
        ease: 'power4.out',
        onComplete: () => {
            const selected = document.getElementById('juego-selected-mini');
            if (selected) selected.classList.add('juego-carousel__mini--selected');
            setTimeout(() => openJuegoCard(currentCard), 500);
        }
    });
}

function openJuegoCard(card) {
    const container = document.getElementById('juego-card-container');
    if (!container) return;

    const color = BLINDA_COLORS[card.letter] || card.color || '#6B8F71';
    const displayCat = (card.category || '').replace(/^T\d-/, '') || BLINDA_TERRITORIES[card.letter] || '';
    const territoryName = BLINDA_TERRITORIES[card.letter] || card.letter;
    const icon = BLINDA_ICONS[card.letter] || 'ph-fill ph-shield-check';
    const level = card.level || 1;
    const levelDots = Array.from({ length: 3 }, (_, i) =>
        `<span class="juego-card__level-dot ${i < level ? 'juego-card__level-dot--active' : ''}" style="${i < level ? `background:${color}` : ''}"></span>`
    ).join('');

    // Render card-pair format (same as diapo 3)
    container.innerHTML = `
        <div class="juego-modal__card-front" style="background: linear-gradient(145deg, ${color}, ${color}bb)">
            <i class="${icon} juego-modal__card-front-icon"></i>
            <div class="juego-modal__card-front-name">${territoryName}</div>
            <div class="juego-modal__card-front-cat">${displayCat}</div>
            <div class="juego-card__level" style="margin-top: auto;">${levelDots}</div>
        </div>
        <div class="juego-modal__card-back" style="border-top: 5px solid ${color};">
            <div class="juego-card__header" style="border-bottom-color: ${color}33">
                <div class="juego-card__category">
                    <i class="${icon}" style="color:${color}"></i>
                    <span>${displayCat}</span>
                </div>
                <div class="juego-card__level" title="Dificultad ${level}/3">${levelDots}</div>
            </div>
            <p class="juego-card__situation" id="juego-card-situation">${card.situation}</p>
            <div class="juego-card__options" id="juego-card-options"></div>
        </div>`;

    const optionsEl = container.querySelector('#juego-card-options');
    [{ label: 'A', text: card.option_a }, { label: 'B', text: card.option_b }, { label: 'C', text: card.option_c }].forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'juego-option-btn';
        btn.innerHTML = `<span class="juego-option-btn__label" style="background:${color}; color:#fff">${opt.label}</span><span>${opt.text}</span>`;
        btn.addEventListener('click', () => selectJuegoOption(opt.label, card));
        optionsEl.appendChild(btn);
    });

    // Open modal
    const modal = document.getElementById('juego-card-modal');
    if (modal) modal.classList.remove('hidden');

    // Wire close button & backdrop
    const closeBtn = document.getElementById('juego-modal-close');
    const backdrop = document.getElementById('juego-modal-backdrop');
    const closeModal = () => {
        stopTTS();
        if (modal) modal.classList.add('hidden');
        const inp = document.getElementById('juego-chat-input');
        if (inp) { inp.disabled = false; inp.placeholder = 'Pregunta a Eliana...'; }
    };
    if (closeBtn) { closeBtn.onclick = closeModal; }
    if (backdrop) { backdrop.onclick = closeModal; }

    // Reset chat
    const chatMessages = document.getElementById('juego-chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '<div class="blinda-chat__bubble blinda-chat__bubble--assistant">Puedes preguntarme una pista antes de elegir tu respuesta.</div>';
    }
    state._juegoHintUsed = false;

    // Wire chat send
    const sendBtn = document.getElementById('juego-chat-send');
    const input = document.getElementById('juego-chat-input');
    const sendHint = () => {
        const text = input?.value.trim();
        if (!text || state._juegoHintUsed) return;
        input.value = '';
        state._juegoHintUsed = true;
        sendJuegoHint(text, card);
    };
    if (sendBtn) sendBtn.onclick = sendHint;
    if (input) {
        input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHint(); } };
    }

    // Animate entrance
    const frontEl = container.querySelector('.juego-modal__card-front');
    const backEl = container.querySelector('.juego-modal__card-back');
    if (frontEl) gsap.fromTo(frontEl, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
    if (backEl) gsap.fromTo(backEl, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: 'power2.out' });
}

function sendJuegoHint(message, card) {
    const chatMessages = document.getElementById('juego-chat-messages');
    if (!chatMessages) return;

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'blinda-chat__bubble blinda-chat__bubble--user';
    userBubble.textContent = message;
    chatMessages.appendChild(userBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Typing indicator
    const typing = document.createElement('div');
    typing.className = 'blinda-chat__bubble blinda-chat__bubble--assistant blinda-chat__typing';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Disable input after one question
    const input = document.getElementById('juego-chat-input');
    if (input) { input.disabled = true; input.placeholder = 'Solo una pregunta por tarjeta'; }

    const territory = BLINDA_TERRITORIES[card.letter] || '';
    const hintPrompt = `El profesor juega a Blindapalabras. Territorio: "${territory}". Situación: "${card.situation}". Opciones: A) ${card.option_a} B) ${card.option_b} C) ${card.option_c}. Correcta: ${card.correct_answer}. El profesor pregunta: "${message}". Da una pista breve (2-3 frases) sin revelar la respuesta directamente. Sé motivadora y divertida.`;

    let assistantBubble = null;
    let fullResponse = '';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const handleMsg = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'token') {
            if (!assistantBubble) {
                typing.remove();
                assistantBubble = document.createElement('div');
                assistantBubble.className = 'blinda-chat__bubble blinda-chat__bubble--assistant';
                chatMessages.appendChild(assistantBubble);
            }
            fullResponse += data.content;
            assistantBubble.textContent = fullResponse;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else if (data.type === 'end') {
            state._juegoHintWs.onmessage = null;
            if (fullResponse && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(fullResponse, true);
            }
        }
    };

    const doSend = () => {
        state._juegoHintWs.onmessage = handleMsg;
        state._juegoHintWs.send(JSON.stringify({ message: hintPrompt, response_mode: 'full', activity_mode: 'blinda' }));
    };

    if (state._juegoHintWs && state._juegoHintWs.readyState === WebSocket.OPEN) {
        doSend();
        return;
    }
    if (state._juegoHintWs) { state._juegoHintWs.close(); state._juegoHintWs = null; }
    state._juegoHintWs = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);
    state._juegoHintWs.onopen = doSend;
}

function selectJuegoOption(chosen, card) {
    const correct = chosen === card.correct_answer;
    if (correct) state.juegoScore++;
    state.juegoAnswers.push({ card, chosen, correct });

    const optionsEl = document.getElementById('juego-card-options');
    const buttons = optionsEl.querySelectorAll('.juego-option-btn');
    buttons.forEach(btn => {
        const label = btn.querySelector('.juego-option-btn__label').textContent;
        if (label === card.correct_answer) {
            btn.classList.add('juego-option-btn--correct');
        } else if (label === chosen && !correct) {
            btn.classList.add('juego-option-btn--wrong');
        }
        btn.classList.add('juego-option-btn--disabled');
    });

    // Show feedback in the chat panel
    const chatMessages = document.getElementById('juego-chat-messages');
    if (chatMessages) {
        const feedbackBubble = document.createElement('div');
        feedbackBubble.className = 'blinda-chat__bubble blinda-chat__bubble--assistant';
        const icon = correct ? '<i class="ph-fill ph-check-circle" style="color:#4CAF50"></i>' : '<i class="ph-fill ph-x-circle" style="color:var(--md-sys-color-primary)"></i>';
        const resultText = correct
            ? `${icon} <strong>Correcto.</strong> ${card.explanation}`
            : `${icon} <strong>Incorrecto.</strong> La respuesta correcta era <strong>${card.correct_answer}</strong>. ${card.explanation}`;
        feedbackBubble.innerHTML = resultText;
        chatMessages.appendChild(feedbackBubble);

        // TTS del feedback
        const spokenText = correct
            ? `Correcto. ${card.explanation}`
            : `Incorrecto. La respuesta correcta era ${card.correct_answer}. ${card.explanation}`;
        if (state.ttsEnabled || state.voiceTriggered) {
            playTTS(spokenText, true);
        }

        // Add "Siguiente tarjeta" button in chat
        const nextBtn = document.createElement('button');
        nextBtn.className = 'juego-chat-next-btn';
        nextBtn.innerHTML = 'Siguiente tarjeta <i class="ph ph-arrow-right"></i>';
        nextBtn.addEventListener('click', () => {
            stopTTS();
            const modal = document.getElementById('juego-card-modal');
            if (modal) modal.classList.add('hidden');
            nextJuegoCard();
        });
        chatMessages.appendChild(nextBtn);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function showJuegoFeedback(correct, explanation) {
    const feedback = document.getElementById('juego-feedback');
    const icon = document.getElementById('juego-feedback-icon');
    const text = document.getElementById('juego-feedback-text');
    if (!feedback) return;

    feedback.className = `juego-feedback juego-feedback--${correct ? 'correct' : 'wrong'}`;
    icon.innerHTML = correct
        ? '<i class="ph-fill ph-check-circle"></i>'
        : '<i class="ph-fill ph-x-circle"></i>';
    text.textContent = correct
        ? explanation
        : explanation;

    feedback.classList.remove('hidden');
}

function nextJuegoCard() {
    state.juegoIndex++;
    if (state.juegoIndex >= BLINDA_CARDS_PER_ROUND) {
        showJuegoSummary();
    } else {
        showJuegoCarousel();
    }
}

function showJuegoSummary() {
    document.getElementById('juego-game')?.classList.add('hidden');
    const summary = document.getElementById('juego-summary');
    summary?.classList.remove('hidden');

    // Score
    const scoreEl = document.getElementById('juego-summary-score');
    scoreEl.textContent = `${state.juegoScore} / ${BLINDA_CARDS_PER_ROUND}`;

    // Areas de mejora (agrupadas por categoria)
    const areasEl = document.getElementById('juego-summary-areas');
    areasEl.innerHTML = '';
    const wrongByCategory = {};
    state.juegoAnswers.filter(a => !a.correct).forEach(a => {
        const cat = (a.card.category || a.card.letter || '').replace(/^T\d-/, '');
        if (!wrongByCategory[cat]) wrongByCategory[cat] = 0;
        wrongByCategory[cat]++;
    });

    if (Object.keys(wrongByCategory).length > 0) {
        const title = document.createElement('h3');
        title.className = 'juego-summary__areas-title';
        title.innerHTML = '<i class="ph ph-target"></i> Áreas a reforzar';
        areasEl.appendChild(title);
        const tagContainer = document.createElement('div');
        tagContainer.className = 'juego-summary__area-tags';
        for (const [cat, count] of Object.entries(wrongByCategory)) {
            const tag = document.createElement('span');
            tag.className = 'juego-area-tag';
            tag.textContent = `${cat} (${count})`;
            tagContainer.appendChild(tag);
        }
        areasEl.appendChild(tagContainer);
    }

    // Learnings detallados
    const learningsEl = document.getElementById('juego-summary-learnings');
    learningsEl.innerHTML = '';
    state.juegoAnswers.forEach(a => {
        const div = document.createElement('div');
        div.className = `juego-learning-item juego-learning-item--${a.correct ? 'correct' : 'wrong'}`;
        const catName = (a.card.category || '').replace(/^T\d-/, '') || BLINDA_TERRITORIES[a.card.letter] || a.card.letter;
        if (a.correct) {
            div.innerHTML = `<span class="juego-learning__icon"><i class="ph-fill ph-check-circle"></i></span>
                             <span>${catName}: Correcto</span>`;
        } else {
            div.innerHTML = `<span class="juego-learning__icon"><i class="ph-fill ph-x-circle"></i></span>
                             <div><strong>${catName}</strong>: Elegiste ${a.chosen}, correcta era ${a.card.correct_answer}
                             <p class="juego-learning__explanation">${a.card.explanation}</p></div>`;
        }
        learningsEl.appendChild(div);
    });

    // Discusion en parejas
    const discussionEl = document.getElementById('juego-summary-discussion');
    const categories = Object.keys(wrongByCategory);
    let html = '<h3 class="juego-summary__discuss-title"><i class="ph ph-chat-circle-dots"></i> Para comentar en pareja</h3><ul class="juego-discuss-list">';
    html += '<li>¿Qué tarjeta os ha hecho dudar más? ¿Por qué?</li>';
    html += '<li>¿Habéis usado IA generativa en algún curso o actividad de clase? ¿Qué resultado obtuvisteis?</li>';
    if (categories.length > 0) {
        html += `<li>De las tarjetas que habéis fallado (${categories.join(', ')}), ¿os ha pasado algo parecido en la práctica?</li>`;
    }
    html += '<li>Después de ver vuestros resultados, ¿qué haríais diferente la próxima vez que uséis IA en ELE?</li>';
    html += '<li>¿Qué os ha sorprendido más: lo que la IA hace bien o lo que hace mal?</li></ul>';
    discussionEl.innerHTML = html;
}

function replayJuego() {
    startJuegoGame();
}

// ============================================
// DIAPO 6 — Elige tu agente
// ============================================
const DIAPO6_AGENTS = {
    act1: [
        { id: 'traduccion', img: 'traduccion.png', name: 'Traducción', displayName: 'Traducir vocabulario', desc: 'Traducción pedagógica: adapta la traducción al contexto de aprendizaje y al nivel del estudiante' },
        { id: 'expansor', img: 'expansor.png', name: 'Expansor', displayName: 'Más vocabulario', desc: 'Genera vocabulario adicional adaptado a la edad y contexto del estudiante' },
        { id: 'enfocado', img: 'enfocado.png', name: 'Enfocado', displayName: 'Mis palabras', desc: 'Trabaja solo las palabras que el usuario elige, personaliza el aprendizaje' },
        { id: 'improvisador', img: 'improvisador.png', name: 'Improvisador', displayName: 'Sorpréndeme', desc: 'El estudiante no sabe qué le espera: genera una actividad sorpresa basada en su perfil' }
    ],
    act2: [
        { id: 'masticador', img: 'masticador.png', name: 'Masticador', displayName: 'Aprender del texto', desc: 'Analiza el texto y extrae vocabulario clave para trabajar en contexto' },
        { id: 'aprobador', img: 'aprobador.png', name: 'Aprobador', displayName: 'Gramapop', desc: 'Píldoras de gramática con MARS/EARS, gramática de las construcciones y Van Patten' },
        { id: 'miron', img: 'miron.png', name: 'Mirón', displayName: 'Comprensión global visual', desc: 'Genera actividades visuales de comprensión lectora a partir del texto' },
        { id: 'explorador', img: 'explorador.png', name: 'Explorador', displayName: 'Mapa mental', desc: 'Crea mapas mentales y organiza ideas visualmente a partir del contenido' }
    ]
};

const DIAPO6_TOTAL_STEPS = 5;
let diapo6Step = 0;

function initDiapo6() {
    diapo6Step = 0;

    renderDiapo6CatsGrid();
    renderDiapo6AgentCards('diapo6-agents-act1', DIAPO6_AGENTS.act1);
    renderDiapo6AgentCards('diapo6-agents-act2', DIAPO6_AGENTS.act2);
    renderDiapo6Bars();
    connectDiapo6Dashboard();
    updateDiapo6Step(0);

    // Stepper dot clicks
    document.querySelectorAll('[data-diapo6-dot]').forEach(dot => {
        dot.addEventListener('click', () => {
            const step = parseInt(dot.dataset.diapo6Dot);
            updateDiapo6Step(step);
        });
    });
}

function renderDiapo6CatsGrid() {
    const grid = document.getElementById('diapo6-cats-grid');
    if (!grid) return;
    const allAgents = [...DIAPO6_AGENTS.act1, ...DIAPO6_AGENTS.act2];
    grid.innerHTML = allAgents.map(a => `
        <div class="diapo6-cat-mini" data-agent-id="${a.id}">
            <img class="diapo6-cat-mini__img" src="/static/imagenes/${a.img}" alt="${a.name}">
            <span class="diapo6-cat-mini__name">???</span>
        </div>
    `).join('');
}

function renderDiapo6AgentCards(containerId, agents) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const allNames = [...DIAPO6_AGENTS.act1, ...DIAPO6_AGENTS.act2].map(a => a.name);
    // Shuffle names for each render
    const shuffled = [...allNames].sort(() => Math.random() - 0.5);

    container.innerHTML = agents.map(a => `
        <div class="diapo6-agent-card" data-agent-id="${a.id}">
            <img class="diapo6-agent-card__img" src="/static/imagenes/${a.img}" alt="">
            <div class="diapo6-agent-card__desc">${a.desc}</div>
            <select class="diapo6-agent-card__select" data-correct="${a.name}">
                <option value="" disabled selected>Elige nombre...</option>
                ${shuffled.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
            <div class="diapo6-agent-card__result"></div>
        </div>
    `).join('');

    container.querySelectorAll('.diapo6-agent-card__select').forEach(select => {
        select.addEventListener('change', () => {
            checkDiapo6AgentAnswer(select);
        });
    });
}

function checkDiapo6AgentAnswer(select) {
    const card = select.closest('.diapo6-agent-card');
    const correct = select.dataset.correct;
    const chosen = select.value;
    const resultEl = card.querySelector('.diapo6-agent-card__result');
    const agentId = card.dataset.agentId;

    if (chosen === correct) {
        card.classList.add('diapo6-agent-card--correct');
        card.classList.remove('diapo6-agent-card--wrong');
        select.disabled = true;
        if (resultEl) resultEl.textContent = correct;
        // Wake up the cat in the intro grid
        const miniCat = document.querySelector(`.diapo6-cat-mini[data-agent-id="${agentId}"]`);
        if (miniCat) {
            miniCat.classList.add('diapo6-cat-mini--awake');
            const nameSpan = miniCat.querySelector('.diapo6-cat-mini__name');
            if (nameSpan) nameSpan.textContent = correct;
        }
    } else {
        card.classList.add('diapo6-agent-card--wrong');
        if (resultEl) resultEl.textContent = 'Intenta de nuevo';
        setTimeout(() => {
            card.classList.remove('diapo6-agent-card--wrong');
            if (resultEl) resultEl.textContent = '';
            select.value = '';
        }, 1200);
    }
}

const DIAPO6_OPINION_LABELS = {
    convencido: 'Me ha convencido',
    potencial: 'Tiene potencial',
    no_convencido: 'No me ha convencido'
};

function renderDiapo6Bars() {
    // Barras de agentes
    const agentsContainer = document.getElementById('diapo6-bars-agents');
    if (agentsContainer) {
        const allAgents = [...DIAPO6_AGENTS.act1, ...DIAPO6_AGENTS.act2];
        agentsContainer.innerHTML = allAgents.map(a => `
            <div class="diapo6-bar" data-agent-name="${a.name}">
                <span class="diapo6-bar__label">${a.name}</span>
                <div class="diapo6-bar__track">
                    <div class="diapo6-bar__fill" style="width: 0%"></div>
                </div>
                <span class="diapo6-bar__count">0</span>
            </div>
        `).join('');
    }
    // Barras de opinión
    const opinionsContainer = document.getElementById('diapo6-bars-opinions');
    if (opinionsContainer) {
        opinionsContainer.innerHTML = Object.entries(DIAPO6_OPINION_LABELS).map(([key, label]) => `
            <div class="diapo6-bar" data-opinion="${key}">
                <span class="diapo6-bar__label">${label}</span>
                <div class="diapo6-bar__track">
                    <div class="diapo6-bar__fill diapo6-bar__fill--${key}" style="width: 0%"></div>
                </div>
                <span class="diapo6-bar__count">0</span>
            </div>
        `).join('');
    }
}

function connectDiapo6Dashboard() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws/encuesta-dashboard`);
    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            updateDiapo6Dashboard(data);
        } catch (err) { /* ignore */ }
    };
    ws.onclose = () => {
        // Reconectar tras 3s
        setTimeout(connectDiapo6Dashboard, 3000);
    };
}

function updateDiapo6Dashboard(data) {
    const total = data.total || 0;
    const countEl = document.getElementById('diapo6-vote-count');
    if (countEl) countEl.textContent = total;

    // Actualizar barras de agentes
    if (data.agents) {
        const maxAgent = Math.max(1, ...Object.values(data.agents));
        Object.entries(data.agents).forEach(([name, count]) => {
            const bar = document.querySelector(`.diapo6-bar[data-agent-name="${name}"]`);
            if (!bar) return;
            const fill = bar.querySelector('.diapo6-bar__fill');
            const countSpan = bar.querySelector('.diapo6-bar__count');
            if (fill) fill.style.width = `${(count / maxAgent) * 100}%`;
            if (countSpan) countSpan.textContent = count;
        });
    }

    // Actualizar barras de opinión
    if (data.opinions) {
        const maxOp = Math.max(1, ...Object.values(data.opinions));
        Object.entries(data.opinions).forEach(([key, count]) => {
            const bar = document.querySelector(`.diapo6-bar[data-opinion="${key}"]`);
            if (!bar) return;
            const fill = bar.querySelector('.diapo6-bar__fill');
            const countSpan = bar.querySelector('.diapo6-bar__count');
            if (fill) fill.style.width = `${(count / maxOp) * 100}%`;
            if (countSpan) countSpan.textContent = count;
        });
    }
}

function updateDiapo6Step(step) {
    diapo6Step = step;
    // Toggle steps
    document.querySelectorAll('[data-diapo6-step]').forEach(el => {
        el.classList.toggle('diapo6-demo__step--active', parseInt(el.dataset.diapo6Step) === step);
    });
    // Toggle stepper dots
    document.querySelectorAll('[data-diapo6-dot]').forEach(dot => {
        dot.classList.toggle('demo-stepper__dot--active', parseInt(dot.dataset.diapo6Dot) === step);
    });
}

function advanceDiapo6() {
    if (diapo6Step < DIAPO6_TOTAL_STEPS - 1) {
        updateDiapo6Step(diapo6Step + 1);
    }
}

function showDiapo6Screen() {
    stopTTS();
    elements.loginScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');

    elements.diapo6Screen?.classList.remove('hidden');
    elements.diapo6Screen?.classList.remove('fade-out');

    const orbContainer = document.getElementById('diapo6-orb-container');
    if (orbContainer && window.orbCreateInElement) {
        const orbSize = window.innerWidth <= 480 ? 64 : window.innerWidth <= 968 ? 80 : 120;
        window.orbCreateInElement(orbContainer, orbSize);
    }

    initDiapo6();
}

function hideDiapo6Screen() {
    elements.diapo6Screen?.classList.add('fade-out');
    setTimeout(() => {
        elements.diapo6Screen?.classList.add('hidden');
        elements.diapo6Screen?.classList.remove('fade-out');
    }, 300);
}

function isOnDiapo6Screen() {
    return elements.diapo6Screen && !elements.diapo6Screen.classList.contains('hidden');
}

const DIAPO6_KEYWORD_MAP = [
    { step: 1, patterns: ['descubrir', 'dos actividades', 'sacad los móviles', 'sacad los moviles', 'adivinar', 'actividad 1'] },
    { step: 2, patterns: ['segunda', 'actividad 2', 'siguiente actividad', 'pasemos', 'diálogo', 'dialogo', 'texto y gramática', 'texto y gramatica'] },
    { step: 3, patterns: ['probar', 'qr', 'materiaele', 'escaneáis', 'escaneais'] },
    { step: 4, patterns: ['resultados', 'encuesta', 'pantalla', 'cuáles os han gustado', 'cuales os han gustado', 'votad'] }
];

function addDiapo6ChatBubble(text, role) {
    const messages = document.getElementById('diapo6-chat-messages');
    if (!messages) return null;
    const bubble = document.createElement('div');
    bubble.className = `blinda-chat__bubble blinda-chat__bubble--${role}`;
    if (role === 'assistant' && text) {
        bubble.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(text) : text;
    } else {
        bubble.textContent = text;
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

function sendDiapo6Message(message) {
    addDiapo6ChatBubble(message, 'user');

    const messages = document.getElementById('diapo6-chat-messages');
    const typing = document.createElement('div');
    typing.className = 'blinda-chat__bubble blinda-chat__bubble--assistant blinda-chat__typing';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    state.currentMessage = '';
    let assistantBubble = null;

    const doSend = () => {
        const payload = { message, response_mode: 'full', activity_mode: 'miau' };
        if (!state._diapo6ContextSent) {
            payload.prior_context = {
                question: 'Eliana, estos gatos son los agentes MIAU, cuéntanos.',
                answer: 'Estos son los agentes MIAU. ¿Por qué gatos? Porque son independientes, curiosos y siempre caen de pie. Como un buen agente IA.'
            };
            state._diapo6ContextSent = true;
        }
        state._diapo6Ws.send(JSON.stringify(payload));
    };

    const handleDiapo6Message = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
            if (!assistantBubble) {
                typing.remove();
                assistantBubble = addDiapo6ChatBubble('', 'assistant');
                if (window.smd && assistantBubble) {
                    const renderer = window.smd.default_renderer(assistantBubble);
                    state._diapo6SmdParser = window.smd.parser(renderer);
                } else {
                    state._diapo6SmdParser = null;
                }
            }
            state.currentMessage += data.content;
            if (state._diapo6SmdParser) {
                window.smd.parser_write(state._diapo6SmdParser, data.content);
            } else if (assistantBubble) {
                assistantBubble.innerHTML = typeof renderMarkdown === 'function'
                    ? renderMarkdown(state.currentMessage, false) : state.currentMessage;
            }
            messages.scrollTop = messages.scrollHeight;
            // Live auto-advance: detect keywords while Eliana speaks
            checkDiapo6Advance(state.currentMessage);
        }
        else if (data.type === 'end') {
            if (state._diapo6SmdParser) {
                window.smd.parser_end(state._diapo6SmdParser);
                state._diapo6SmdParser = null;
            }
            if (state.currentMessage && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(state.currentMessage, true);
            }
            if (state.currentMessage) {
                checkDiapo6Advance(state.currentMessage);
            }
            assistantBubble = null;
            resumeWakeWordAfterRecording();
        }
        else if (data.type === 'error') {
            typing.remove();
            addDiapo6ChatBubble('Error: ' + data.message, 'assistant');
            assistantBubble = null;
        }
    };

    if (state._diapo6Ws && state._diapo6Ws.readyState === WebSocket.OPEN) {
        state._diapo6Ws.onmessage = handleDiapo6Message;
        doSend();
        return;
    }

    if (state._diapo6Ws) {
        state._diapo6Ws.close();
        state._diapo6Ws = null;
        state._diapo6ContextSent = false;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state._diapo6Ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);
    state._diapo6Ws.onopen = doSend;
    state._diapo6Ws.onmessage = handleDiapo6Message;
    state._diapo6Ws.onerror = () => {
        typing.remove();
        addDiapo6ChatBubble('Error de conexion', 'assistant');
    };
}

function checkDiapo6Advance(fullText) {
    const lower = fullText.toLowerCase();
    const nextStep = diapo6Step + 1;
    const mapping = DIAPO6_KEYWORD_MAP.find(m => m.step === nextStep);
    if (!mapping) return;
    for (const pat of mapping.patterns) {
        if (lower.includes(pat)) {
            updateDiapo6Step(nextStep);
            return;
        }
    }
}

// ============================================
// DIAPO 8 — Construye tu Agente (Plataforma)
// ============================================
const DIAPO7_INGREDIENTS = [
    { icon: 'ph-fill ph-identification-badge', label: 'Nombre y descripción', desc: 'Identidad del agente: qué hace y para qué sirve', color: '#7EC8E3' },
    { icon: 'ph-fill ph-brain', label: 'System Prompt', desc: 'El cerebro: instrucciones que definen su personalidad y comportamiento', color: '#994E95' },
    { icon: 'ph-fill ph-cpu', label: 'Modelo de IA', desc: 'El motor: qué modelo de lenguaje usa (DeepSeek, GPT, Claude...)', color: '#6B82C4' },
    { icon: 'ph-fill ph-thermometer-simple', label: 'Temperatura', desc: 'Creatividad vs precisión: de 0 (exacto) a 2 (creativo)', color: '#F48FB1' },
    { icon: 'ph-fill ph-graduation-cap', label: 'Nivel MCER', desc: 'A1, A2, B1... el agente adapta su lenguaje al nivel del alumno', color: '#81C784' },
    { icon: 'ph-fill ph-sliders-horizontal', label: 'Adherencia al nivel', desc: 'Cuánto debe ceñirse al nivel: flexible o estricto', color: '#FFB74D' }
];

const DIAPO7_ACTIVITY_TYPES = [
    { icon: 'ph-fill ph-chat-circle-text', label: 'Expresión oral', color: '#7EC8E3' },
    { icon: 'ph-fill ph-book-open-text', label: 'Comprensión lectora', color: '#6B82C4' },
    { icon: 'ph-fill ph-text-aa', label: 'Vocabulario', color: '#81C784' },
    { icon: 'ph-fill ph-headphones', label: 'Comprensión auditiva', color: '#B39DDB' },
    { icon: 'ph-fill ph-pencil-line', label: 'Gramática', color: '#F48FB1' },
    { icon: 'ph-fill ph-pen-nib', label: 'Escritura', color: '#FFB74D' },
    { icon: 'ph-fill ph-speaker-high', label: 'Pronunciación', color: '#2A9FCC' },
    { icon: 'ph-fill ph-check-square', label: 'Autoevaluación', color: '#994E95' },
    { icon: 'ph-fill ph-users-three', label: 'Interacción oral', color: '#6B8F71' },
    { icon: 'ph-fill ph-textbox', label: 'Ortografía', color: '#D4826A' }
];

const DIAPO7_STRUCTURES = [
    'Opción múltiple', 'Completar huecos', 'Verdadero/Falso', 'Relacionar',
    'Ordenar', 'Respuesta corta', 'Diálogo', 'Redacción', 'Respuesta abierta'
];

const DIAPO7_TOTAL_STEPS = 5;
let diapo7Step = 0;

function showDiapo7Screen() {
    stopTTS();
    elements.loginScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.welcomeScreen?.classList.add('hidden');
    elements.planScreen?.classList.add('hidden');
    elements.profileScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');
    elements.diapo6Screen?.classList.add('hidden');

    elements.diapo7Screen?.classList.remove('hidden');
    elements.diapo7Screen?.classList.remove('fade-out');

    const orbContainer = document.getElementById('diapo7-orb-container');
    if (orbContainer && window.orbCreateInElement) {
        const orbSize = window.innerWidth <= 480 ? 64 : window.innerWidth <= 968 ? 80 : 120;
        window.orbCreateInElement(orbContainer, orbSize);
    }

    initDiapo7();
}

function hideDiapo7Screen() {
    elements.diapo7Screen?.classList.add('fade-out');
    setTimeout(() => {
        elements.diapo7Screen?.classList.add('hidden');
        elements.diapo7Screen?.classList.remove('fade-out');
    }, 300);
}

function isOnDiapo7Screen() {
    return elements.diapo7Screen && !elements.diapo7Screen.classList.contains('hidden');
}

function addDiapo7ChatBubble(text, role) {
    const container = document.getElementById('diapo7-chat-messages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = `blinda-chat__bubble blinda-chat__bubble--${role}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function sendDiapo7Message(message) {
    addDiapo7ChatBubble(message, 'user');

    // Check if user message (Mando) triggers advance
    checkDiapo7AdvanceFromUser(message);

    const messages = document.getElementById('diapo7-chat-messages');
    const typing = document.createElement('div');
    typing.className = 'blinda-chat__bubble blinda-chat__bubble--assistant blinda-chat__typing';
    typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    state._diapo7CurrentMsg = '';
    _diapo7AdvancedThisMsg = false;
    let assistantBubble = null;

    const doSend = () => {
        const payload = { message, response_mode: 'full', activity_mode: 'plataforma' };
        if (!state._diapo7ContextSent) {
            payload.prior_context = {
                question: 'Eliana, vamos a enseñar cómo se construye un agente en AgentiaELE.',
                answer: 'Ahora viene lo mejor: os voy a enseñar cómo se construye un agente.'
            };
            state._diapo7ContextSent = true;
        }
        state._diapo7Ws.send(JSON.stringify(payload));
    };

    const handleDiapo7Message = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
            if (!assistantBubble) {
                typing.remove();
                assistantBubble = addDiapo7ChatBubble('', 'assistant');
                if (window.smd && assistantBubble) {
                    const renderer = window.smd.default_renderer(assistantBubble);
                    state._diapo7SmdParser = window.smd.parser(renderer);
                } else {
                    state._diapo7SmdParser = null;
                }
            }
            state._diapo7CurrentMsg += data.content;
            if (state._diapo7SmdParser) {
                window.smd.parser_write(state._diapo7SmdParser, data.content);
            } else if (assistantBubble) {
                assistantBubble.innerHTML = typeof renderMarkdown === 'function'
                    ? renderMarkdown(state._diapo7CurrentMsg, false) : state._diapo7CurrentMsg;
            }
            messages.scrollTop = messages.scrollHeight;
            checkDiapo7Advance(state._diapo7CurrentMsg);
        }
        else if (data.type === 'end') {
            if (state._diapo7SmdParser) {
                window.smd.parser_end(state._diapo7SmdParser);
                state._diapo7SmdParser = null;
            }
            if (state._diapo7CurrentMsg && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(state._diapo7CurrentMsg, true);
            }
            if (state._diapo7CurrentMsg) {
                checkDiapo7Advance(state._diapo7CurrentMsg);
            }
            assistantBubble = null;
            resumeWakeWordAfterRecording();
        }
        else if (data.type === 'error') {
            typing.remove();
            addDiapo7ChatBubble('Error: ' + data.message, 'assistant');
            assistantBubble = null;
        }
    };

    if (state._diapo7Ws && state._diapo7Ws.readyState === WebSocket.OPEN) {
        state._diapo7Ws.onmessage = handleDiapo7Message;
        doSend();
        return;
    }

    if (state._diapo7Ws) {
        state._diapo7Ws.close();
        state._diapo7Ws = null;
        state._diapo7ContextSent = false;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state._diapo7Ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/chat`);
    state._diapo7Ws.onopen = doSend;
    state._diapo7Ws.onmessage = handleDiapo7Message;
    state._diapo7Ws.onerror = () => {
        typing.remove();
        addDiapo7ChatBubble('Error de conexión', 'assistant');
    };
}

const DIAPO7_KEYWORD_MAP = [
    { step: 1, patterns: ['dale al siguiente', 'más fácil de lo que pensáis', 'mas facil de lo que pensais', 'dos minutos'] },
    { step: 2, patterns: ['traductor', 'ejemplo', 'ficha', 'así de sencillo', 'asi de sencillo'] },
    { step: 3, patterns: ['actividades', 'no van solos', 'viven dentro'] },
    { step: 4, patterns: ['taller', 'mayo', 'inscripción', 'inscripcion'] }
];

let _diapo7AdvancedThisMsg = false;

const DIAPO7_USER_KEYWORDS = [
    { step: 2, patterns: ['siguiente', 'ejemplo', 'traductor', 'enséñanos', 'muéstranos', 'cómo se ve'] },
    { step: 3, patterns: ['siguiente', 'actividades', 'qué más', 'continúa', 'adelante'] },
    { step: 4, patterns: ['siguiente', 'taller', 'último', 'continúa', 'adelante'] }
];

function checkDiapo7AdvanceFromUser(userMsg) {
    const lower = userMsg.toLowerCase();
    const nextStep = diapo7Step + 1;
    const mapping = DIAPO7_USER_KEYWORDS.find(m => m.step === nextStep);
    if (!mapping) return;
    for (const pat of mapping.patterns) {
        if (lower.includes(pat)) {
            updateDiapo7Step(nextStep);
            return;
        }
    }
}

function checkDiapo7Advance(fullText) {
    if (_diapo7AdvancedThisMsg) return; // max 1 step per message
    const lower = fullText.toLowerCase();
    const nextStep = diapo7Step + 1;
    const mapping = DIAPO7_KEYWORD_MAP.find(m => m.step === nextStep);
    if (!mapping) return;
    for (const pat of mapping.patterns) {
        if (lower.includes(pat)) {
            _diapo7AdvancedThisMsg = true;
            updateDiapo7Step(nextStep);
            return;
        }
    }
}

function initDiapo7() {
    diapo7Step = 0;
    _diapo7ContextSent = false;
    renderDiapo7Ingredients();
    renderDiapo7Example();
    renderDiapo7Activities();
    renderDiapo7Workshop();
    updateDiapo7Step(0);
}

function updateDiapo7Step(step) {
    diapo7Step = step;
    document.querySelectorAll('[data-diapo7-step]').forEach(el => {
        el.classList.toggle('diapo7-demo__step--active', parseInt(el.dataset.diapo7Step) === step);
    });
    document.querySelectorAll('[data-diapo7-dot]').forEach(dot => {
        dot.classList.toggle('demo-stepper__dot--active', parseInt(dot.dataset.diapo7Dot) === step);
    });
}

function renderDiapo7Ingredients() {
    const container = document.getElementById('diapo7-ingredients');
    if (!container) return;
    container.innerHTML = `
        <h3 class="diapo7-section-title">
            <i class="ph-fill ph-puzzle-piece" style="background: rgba(153,78,149,0.15); color: #994E95"></i>
            Los ingredientes de un agente
        </h3>
        <div class="diapo7-ingredients__grid">
            ${DIAPO7_INGREDIENTS.map(ing => `
                <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, ${ing.color}22 0%, rgba(239,237,247,0.5) 100%); border-color: ${ing.color}33">
                    <div class="diapo7-ingredient-card__icon" style="background: ${ing.color}22; color: ${ing.color}">
                        <i class="${ing.icon}"></i>
                    </div>
                    <div class="diapo7-ingredient-card__text">
                        <strong>${ing.label}</strong>
                        <span>${ing.desc}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderDiapo7Example() {
    const container = document.getElementById('diapo7-example');
    if (!container) return;
    container.innerHTML = `
        <h3 class="diapo7-section-title">
            <i class="ph-fill ph-magnifying-glass" style="background: rgba(126,200,227,0.15); color: #7EC8E3"></i>
            Ejemplo: Agente Traductor
        </h3>
        <div class="diapo7-agent-ficha">
            <div class="diapo7-agent-ficha__header">
                <img class="diapo7-agent-ficha__img" src="/static/imagenes/traduccion.png" alt="Traductor">
                <div>
                    <h4 class="diapo7-agent-ficha__name">Ag. Traducción</h4>
                    <p class="diapo7-agent-ficha__desc">Traduce del español a otra lengua según el contexto y nivel</p>
                </div>
            </div>
            <div class="diapo7-agent-ficha__fields">
                <div class="diapo7-ficha-field">
                    <span class="diapo7-ficha-field__label"><i class="ph-fill ph-brain"></i> System Prompt</span>
                    <span class="diapo7-ficha-field__value diapo7-ficha-field__value--prompt">Eres un traductor pedagógico. Traduces vocabulario adaptado al contexto de aprendizaje y al nivel MCER del estudiante. Usas ejemplos de la vida cotidiana.</span>
                </div>
                <div class="diapo7-ficha-field diapo7-ficha-field--row">
                    <div class="diapo7-ficha-field__item">
                        <span class="diapo7-ficha-field__label"><i class="ph-fill ph-cpu"></i> Modelo</span>
                        <span class="diapo7-ficha-field__value">DeepSeek</span>
                    </div>
                    <div class="diapo7-ficha-field__item">
                        <span class="diapo7-ficha-field__label"><i class="ph-fill ph-thermometer-simple"></i> Temp.</span>
                        <span class="diapo7-ficha-field__value">0.3</span>
                    </div>
                    <div class="diapo7-ficha-field__item">
                        <span class="diapo7-ficha-field__label"><i class="ph-fill ph-graduation-cap"></i> Nivel</span>
                        <span class="diapo7-ficha-field__value">A1</span>
                    </div>
                    <div class="diapo7-ficha-field__item">
                        <span class="diapo7-ficha-field__label"><i class="ph-fill ph-sliders-horizontal"></i> Adherencia</span>
                        <span class="diapo7-ficha-field__value">Alta</span>
                    </div>
                </div>
            </div>
        </div>
        <p class="diapo7-example-note"><i class="ph-fill ph-lightbulb"></i> Así de sencillo: defines qué hace, cómo habla y a qué nivel.</p>
        <a href="https://agentiaele.netlify.app/demo/agents" target="_blank" rel="noopener" class="diapo7-demo-link">
            <i class="ph-fill ph-arrow-square-out"></i> Ver demo en AgentiaELE
        </a>
    `;
}

function renderDiapo7Activities() {
    const container = document.getElementById('diapo7-activities');
    if (!container) return;
    container.innerHTML = `
        <h3 class="diapo7-section-title">
            <i class="ph-fill ph-stack" style="background: rgba(129,199,132,0.15); color: #81C784"></i>
            Los agentes viven en actividades
        </h3>
        <p class="diapo7-activities__subtitle">El profe diseña actividades y elige qué agentes ofrece al alumno en cada una</p>
        <div class="diapo7-ingredients__grid">
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #994E9522 0%, rgba(239,237,247,0.5) 100%); border-color: #994E9533">
                <div class="diapo7-ingredient-card__icon" style="background: #994E9522; color: #994E95">
                    <i class="ph-fill ph-list-bullets"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>10 tipos de actividad</strong>
                    <span>Expresión oral, comprensión lectora, vocabulario, gramática, escritura, pronunciación, autoevaluación, interacción oral, ortografía, comprensión auditiva</span>
                </div>
            </div>
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #6B82C422 0%, rgba(239,237,247,0.5) 100%); border-color: #6B82C433">
                <div class="diapo7-ingredient-card__icon" style="background: #6B82C422; color: #6B82C4">
                    <i class="ph-fill ph-grid-four"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>9 estructuras</strong>
                    <span>Opción múltiple, completar huecos, verdadero/falso, relacionar, ordenar, respuesta corta, diálogo, redacción, respuesta abierta</span>
                </div>
            </div>
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #2A9FCC22 0%, rgba(239,237,247,0.5) 100%); border-color: #2A9FCC33">
                <div class="diapo7-ingredient-card__icon" style="background: #2A9FCC22; color: #2A9FCC">
                    <i class="ph-fill ph-users-three"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>Agentes a la carta</strong>
                    <span>El profe elige qué agentes están disponibles para el alumno en cada actividad: traductor, expansor, enfocado, improvisador y más</span>
                </div>
            </div>
        </div>
        <a href="https://agentiaele.netlify.app/demo/activities/f58292a6-163b-43e8-aeff-54a4cea13e93" target="_blank" rel="noopener" class="diapo7-demo-link">
            <i class="ph-fill ph-arrow-square-out"></i> Ver demo de actividad
        </a>
    `;
}

function renderDiapo7Workshop() {
    const container = document.getElementById('diapo7-workshop');
    if (!container) return;
    container.innerHTML = `
        <h3 class="diapo7-section-title">
            <i class="ph-fill ph-chalkboard-teacher" style="background: rgba(212,130,106,0.15); color: #D4826A"></i>
            Taller online — Mayo 2026
        </h3>
        <p class="diapo7-activities__subtitle">Crea tus propios agentes para tu manual y tus alumnos</p>
        <div class="diapo7-ingredients__grid">
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #7EC8E322 0%, rgba(239,237,247,0.5) 100%); border-color: #7EC8E333">
                <div class="diapo7-ingredient-card__icon" style="background: #7EC8E322; color: #7EC8E3">
                    <i class="ph-fill ph-wrench"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>Construye agentes para TU manual</strong>
                    <span>Diseña agentes adaptados a tu libro de texto, tu programa y tus objetivos de clase</span>
                </div>
            </div>
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #81C78422 0%, rgba(239,237,247,0.5) 100%); border-color: #81C78433">
                <div class="diapo7-ingredient-card__icon" style="background: #81C78422; color: #81C784">
                    <i class="ph-fill ph-user-focus"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>Adapta a TU nivel y TUS alumnos</strong>
                    <span>Personaliza el nivel MCER, la temperatura y el comportamiento para cada grupo</span>
                </div>
            </div>
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #B39DDB22 0%, rgba(239,237,247,0.5) 100%); border-color: #B39DDB33">
                <div class="diapo7-ingredient-card__icon" style="background: #B39DDB22; color: #B39DDB">
                    <i class="ph-fill ph-play-circle"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>Pruébalos en clase al día siguiente</strong>
                    <span>Agentes listos para usar con tus alumnos desde el primer momento</span>
                </div>
            </div>
        </div>
        <div class="diapo7-workshop__cta">
            <i class="ph-fill ph-envelope-simple"></i>
            <span>Indícalo en el formulario de inscripción de la mesa</span>
        </div>
    `;
}

// ============================================
// DIAPOSITIVA FINAL — Gracias / Ačiū
// ============================================
function showFinalScreen() {
    stopTTS();
    document.querySelectorAll('.main-content').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('final-screen');
    if (el) {
        el.classList.remove('hidden');
        el.classList.remove('fade-out');
    }
    initFinalSongPlayer();
}

function hideFinalScreen() {
    const el = document.getElementById('final-screen');
    if (!el) return;
    el.classList.add('fade-out');
    setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('fade-out');
    }, 300);
}

let _finalSongInited = false;
function initFinalSongPlayer() {
    if (_finalSongInited) return;
    _finalSongInited = true;

    const songBtn = document.getElementById('final-song-btn');
    const progressBar = document.getElementById('final-song-progress');
    const timeDisplay = document.getElementById('final-song-time');
    if (!songBtn) return;

    let songAudio = null;
    let progressInterval = null;

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    };

    songBtn.addEventListener('click', () => {
        if (!songAudio) {
            songAudio = new Audio('/static/cancion-agente.mp3');
            songAudio.addEventListener('ended', () => {
                songBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
                songBtn.classList.remove('final-song__play-btn--playing');
                if (progressInterval) clearInterval(progressInterval);
                if (progressBar) progressBar.style.width = '0%';
                if (timeDisplay) timeDisplay.textContent = '0:00';
            });
        }

        if (songAudio.paused) {
            songAudio.play();
            songBtn.innerHTML = '<i class="ph-fill ph-pause"></i>';
            songBtn.classList.add('final-song__play-btn--playing');
            progressInterval = setInterval(() => {
                if (songAudio.duration) {
                    const pct = (songAudio.currentTime / songAudio.duration) * 100;
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (timeDisplay) timeDisplay.textContent = formatTime(songAudio.currentTime);
                }
            }, 300);
        } else {
            songAudio.pause();
            songBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
            songBtn.classList.remove('final-song__play-btn--playing');
            if (progressInterval) clearInterval(progressInterval);
        }
    });
}

// ============================================
// Event Listeners
// ============================================
function init() {
    // Versión automática desde cache bust del CSS
    const cssLink = document.querySelector('link[href*="style.css?v="]');
    if (cssLink) {
        const v = cssLink.href.match(/\?v=([^&]+)/)?.[1];
        const el = document.getElementById('app-version');
        if (v && el) el.textContent = 'v' + v;
    }

    // Check authentication on load
    checkAuthOnLoad();

    // Botón Entrar — transición al chat
    elements.loginBtn?.addEventListener('click', handleEnterBtn);

    // Login orb — solo saludo de voz (wrapper + container para máxima sensibilidad)
    elements.loginOrbContainer?.addEventListener('click', handleOrbGreeting);
    document.querySelector('.login-orb-wrapper')?.addEventListener('click', handleOrbGreeting);

    // Logout buttons (all screens)
    elements.logoutBtn?.addEventListener('click', handleLogout);
    elements.chatLogoutBtn?.addEventListener('click', handleLogout);
    elements.planLogoutBtn?.addEventListener('click', handleLogout);

    // Conoce a Eliana — activity card clicks
    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', () => {
            const activity = card.dataset.activity;
            if (activity) showActivityChat(activity);
        });
    });

    // Blinda tu Prompt — demo (diapo 3)
    document.getElementById('blinda-nav-back')?.addEventListener('click', hideBlindaScreen);
    document.getElementById('blinda-nav-next')?.addEventListener('click', showJuegoScreen);
    // Demo stepper dots (manual backup)
    document.querySelectorAll('.demo-stepper__dot').forEach(dot => {
        dot.addEventListener('click', () => advanceDemoTo(parseInt(dot.dataset.step)));
    });

    // Juego (diapo 4)
    document.getElementById('juego-start-btn')?.addEventListener('click', startJuegoGame);
    document.getElementById('juego-next-btn')?.addEventListener('click', nextJuegoCard);
    document.getElementById('juego-replay-btn')?.addEventListener('click', replayJuego);
    document.getElementById('juego-back-btn')?.addEventListener('click', hideJuegoScreen);
    document.getElementById('juego-nav-back')?.addEventListener('click', hideJuegoScreen);
    document.getElementById('juego-nav-next')?.addEventListener('click', showDiapo5Screen);
    document.getElementById('juego-next-screen-btn')?.addEventListener('click', showDiapo5Screen);

    // Blinda chat — send text
    document.getElementById('blinda-chat-send')?.addEventListener('click', () => {
        const input = document.getElementById('blinda-chat-input');
        const text = input?.value.trim();
        if (!text) return;
        input.value = '';
        sendBlindaMessage(text);
    });
    document.getElementById('blinda-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('blinda-chat-send')?.click();
        }
    });

    // Blinda chat — mic (same as main chat mic)
    document.getElementById('blinda-mic-btn')?.addEventListener('click', () => {
        enableTTS();
        state.voiceTriggered = true;
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Blinda chat — voice toggle (TTS on/off)
    document.getElementById('blinda-voice-btn')?.addEventListener('click', () => {
        if (state.ttsEnabled) {
            disableTTS();
        } else {
            enableTTS();
        }
    });

    // Juego modal — mic (STT)
    document.getElementById('juego-mic-btn')?.addEventListener('click', () => {
        enableTTS();
        state.voiceTriggered = true;
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Juego modal — voice toggle (TTS on/off)
    document.getElementById('juego-voice-btn')?.addEventListener('click', () => {
        if (state.ttsEnabled) {
            disableTTS();
        } else {
            enableTTS();
        }
    });

    // Diapo 5 — El Agente segun los Grandes Maestros
    document.getElementById('diapo5-nav-back')?.addEventListener('click', hideDiapo5Screen);
    document.getElementById('diapo5-nav-next')?.addEventListener('click', () => {
        elements.diapo5Screen?.classList.add('fade-out');
        setTimeout(() => {
            elements.diapo5Screen?.classList.add('hidden');
            elements.diapo5Screen?.classList.remove('fade-out');
            showDiapo6Screen();
        }, 300);
    });
    // Stepper dots
    document.querySelectorAll('[data-diapo5-dot]').forEach(dot => {
        dot.addEventListener('click', () => advanceDiapo5To(parseInt(dot.dataset.diapo5Dot)));
    });
    // Diapo5 chat — send text
    document.getElementById('diapo5-chat-send')?.addEventListener('click', () => {
        const input = document.getElementById('diapo5-chat-input');
        const text = input?.value.trim();
        if (!text) return;
        input.value = '';
        sendDiapo5Message(text);
    });
    document.getElementById('diapo5-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('diapo5-chat-send')?.click();
        }
    });
    // Diapo5 chat — mic
    // Al APAGAR el mic manualmente → descartar audio (evita que Whisper
    // transcriba ruido residual: "gracias", "hola", etc.)
    document.getElementById('diapo5-mic-btn')?.addEventListener('click', () => {
        enableTTS();
        state.voiceTriggered = true;
        if (state.isRecording) {
            state._discardRecording = true;
            stopRecording();
        } else {
            startRecording();
        }
    });
    // Diapo5 chat — voice toggle
    document.getElementById('diapo5-voice-btn')?.addEventListener('click', () => {
        if (state.ttsEnabled) {
            disableTTS();
        } else {
            enableTTS();
        }
    });

    // Diapo 6 — Elige tu agente
    document.getElementById('diapo6-nav-back')?.addEventListener('click', () => {
        hideDiapo6Screen();
        setTimeout(() => showDiapo5Screen(), 300);
    });
    document.getElementById('diapo6-nav-next')?.addEventListener('click', () => {
        hideDiapo6Screen();
        setTimeout(() => showDiapo7Screen(), 300);
    });
    document.getElementById('diapo6-chat-send')?.addEventListener('click', () => {
        const input = document.getElementById('diapo6-chat-input');
        const text = input?.value.trim();
        if (!text) return;
        input.value = '';
        sendDiapo6Message(text);
    });
    document.getElementById('diapo6-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('diapo6-chat-send')?.click(); }
    });
    document.getElementById('diapo6-mic-btn')?.addEventListener('click', () => {
        enableTTS(); state.voiceTriggered = true;
        if (state.isRecording) { state._discardRecording = true; stopRecording(); } else { startRecording(); }
    });
    document.getElementById('diapo6-voice-btn')?.addEventListener('click', () => {
        if (state.ttsEnabled) disableTTS(); else enableTTS();
    });

    // Diapo 8 — Construye tu Agente
    document.getElementById('diapo7-nav-back')?.addEventListener('click', () => {
        hideDiapo7Screen();
        setTimeout(() => showDiapo6Screen(), 300);
    });
    document.getElementById('diapo7-nav-next')?.addEventListener('click', () => {
        hideDiapo7Screen();
        setTimeout(() => showFinalScreen(), 300);
    });
    document.querySelectorAll('[data-diapo7-dot]').forEach(dot => {
        dot.addEventListener('click', () => updateDiapo7Step(parseInt(dot.dataset.diapo7Dot)));
    });
    document.getElementById('diapo7-chat-send')?.addEventListener('click', () => {
        const input = document.getElementById('diapo7-chat-input');
        const text = input?.value.trim();
        if (!text) return;
        input.value = '';
        sendDiapo7Message(text);
    });
    document.getElementById('diapo7-chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('diapo7-chat-send')?.click(); }
    });
    document.getElementById('diapo7-mic-btn')?.addEventListener('click', () => {
        enableTTS(); state.voiceTriggered = true;
        if (state.isRecording) { state._discardRecording = true; stopRecording(); } else { startRecording(); }
    });
    document.getElementById('diapo7-voice-btn')?.addEventListener('click', () => {
        if (state.ttsEnabled) disableTTS(); else enableTTS();
    });

    // Conoce screen — back/next/logout
    document.getElementById('conoce-back-btn')?.addEventListener('click', showLoginScreen);
    document.getElementById('conoce-next-btn')?.addEventListener('click', showBlindaScreen);
    document.getElementById('conoce-logout-btn')?.addEventListener('click', handleLogout);

    // Profile screen actions — "Siguiente" goes to Blinda tu Prompt (linear flow)
    document.getElementById('profile-back-btn')?.addEventListener('click', () => {
        elements.profileScreen?.classList.add('hidden');
        state.activityMode = null;
        state.activityMessageCount = 0;
        state.profileGenerated = false;
        showBlindaScreen();
    });

    document.getElementById('profile-share-btn')?.addEventListener('click', async () => {
        const card = document.getElementById('profile-card');
        if (!card || !window.html2canvas) return;
        try {
            const canvas = await window.html2canvas(card, { backgroundColor: '#FDFAF5', scale: 2 });
            canvas.toBlob(async (blob) => {
                if (navigator.share && navigator.canShare) {
                    const file = new File([blob], 'mi-perfil-eliana.png', { type: 'image/png' });
                    try {
                        await navigator.share({
                            title: 'Mi perfil de Eliana',
                            text: 'Mi perfil docente generado por Eliana AI - XVI Encuentro de profesores de ELE en Polonia',
                            files: [file]
                        });
                    } catch (e) {
                        console.log('[Share] Cancelled:', e);
                    }
                } else {
                    // Fallback: download
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = 'mi-perfil-eliana.png';
                    link.click();
                }
            }, 'image/png');
        } catch (e) {
            console.error('[Share] Error:', e);
        }
    });

    document.getElementById('profile-download-btn')?.addEventListener('click', async () => {
        const card = document.getElementById('profile-card');
        if (!card || !window.html2canvas) return;
        try {
            const canvas = await window.html2canvas(card, { backgroundColor: '#FDFAF5', scale: 2 });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = 'mi-perfil-eliana.png';
            link.click();
        } catch (e) {
            console.error('[Download] Error:', e);
        }
    });

    // Welcome screen
    elements.profileBtn?.addEventListener('click', () => {
        alert('Pantalla de cuenta - próximamente');
    });

    // Bento cards — "Habla conmigo": go to chat + start recording
    elements.orbCard?.addEventListener('click', () => {
        // iOS: Pre-warm audio on user gesture
        warmupIOSAudio();

        if (state.isRecording) {
            stopRecording();
            return;
        }
        // Voice interaction → auto-enable TTS responses
        enableTTS();
        state.voiceTriggered = true;
        // Navigate to chat first, then start recording after transition
        if (elements.chatScreen.classList.contains('hidden')) {
            showChatScreen('', false);
            setTimeout(() => {
                startRecording();
            }, 400);
        } else {
            startRecording();
        }
    });

    elements.moodCard?.addEventListener('click', openMoodOverlay);

    elements.planCard?.addEventListener('click', showPlanScreen);

    // FAQ chips (event delegation) - iOS-optimized with INSTANT visual feedback
    let faqChipProcessing = false;

    const applyFaqChipActiveStyle = (chip) => {
        // Apply inline styles IMMEDIATELY for iOS - cannot rely on CSS classes
        chip.style.transform = 'scale(0.96)';
        chip.style.background = '#D6E2FF'; // primary-container
        chip.style.borderColor = '#2D5BA0'; // primary
        chip.style.color = '#142D5E'; // on-primary-container
    };

    const removeFaqChipActiveStyle = (chip) => {
        chip.style.transform = '';
        chip.style.background = '';
        chip.style.borderColor = '';
        chip.style.color = '';
    };

    const executeFaqChipAction = (chip) => {
        if (!chip || !chip.dataset.question || faqChipProcessing) return;
        faqChipProcessing = true;
        console.log('[FAQ Chip] Executing action for:', chip.dataset.question);
        saveRecentSearch(chip.dataset.question);
        showChatScreen(chip.dataset.question, true);
        // Reset after navigation
        setTimeout(() => { faqChipProcessing = false; }, 800);
    };

    // TOUCHSTART - immediate visual feedback on touch devices
    elements.faqSection?.addEventListener('touchstart', (e) => {
        const chip = e.target.closest('.faq-chip');
        if (chip) {
            applyFaqChipActiveStyle(chip);
        }
    }, { passive: true });

    // TOUCHEND - execute action and remove style
    elements.faqSection?.addEventListener('touchend', (e) => {
        const chip = e.target.closest('.faq-chip');
        if (chip) {
            // Execute action immediately on touchend (no delay)
            executeFaqChipAction(chip);
            // Remove style after short delay for visual feedback
            setTimeout(() => removeFaqChipActiveStyle(chip), 150);
        }
    }, { passive: true });

    // TOUCHCANCEL - cleanup
    elements.faqSection?.addEventListener('touchcancel', () => {
        document.querySelectorAll('.faq-chip').forEach(c => removeFaqChipActiveStyle(c));
    }, { passive: true });

    // MOUSEDOWN/MOUSEUP for desktop
    elements.faqSection?.addEventListener('mousedown', (e) => {
        const chip = e.target.closest('.faq-chip');
        if (chip) applyFaqChipActiveStyle(chip);
    });

    elements.faqSection?.addEventListener('mouseup', (e) => {
        const chip = e.target.closest('.faq-chip');
        if (chip) setTimeout(() => removeFaqChipActiveStyle(chip), 150);
    });

    // CLICK - fallback for desktop (touchend already handles mobile)
    elements.faqSection?.addEventListener('click', (e) => {
        // Only execute if not already processed by touchend
        if ('ontouchstart' in window) return; // Skip on touch devices
        const chip = e.target.closest('.faq-chip');
        if (chip && chip.dataset.question) {
            executeFaqChipAction(chip);
        }
    });

    // Input en welcome
    elements.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // Chat screen — back button: volver a conoce si estamos en actividad
    elements.backBtn?.addEventListener('click', () => {
        if (state.activityMode) {
            stopTTS();
            state.activityMode = null;
            state.activityMessageCount = 0;
            state.profileGenerated = false;
            elements.chatMessages.innerHTML = '';
            const activityLabel = document.getElementById('chat-activity-label');
            if (activityLabel) activityLabel.style.display = 'none';
            if (state.websocket) {
                state.websocket.close();
                state.websocket = null;
            }
            elements.chatScreen?.classList.add('hidden');
            showConoceScreen();
        } else {
            showWelcomeScreen();
        }
    });

    elements.chatMicBtn?.addEventListener('click', toggleRecording);

    elements.chatSendBtn?.addEventListener('click', sendMessage);

    elements.chatInput?.addEventListener('keydown', (e) => {
        // Enter envía, Shift+Enter nueva línea
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    elements.chatInput?.addEventListener('input', () => {
        const textarea = elements.chatInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    // Plan screen
    elements.planBackBtn?.addEventListener('click', showWelcomeFromPlan);
    elements.navChatBtn?.addEventListener('click', showChatFromPlan);
    elements.navOrb?.addEventListener('click', toggleRecording);

    // Overview filter chips
    elements.planOverviewChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.planOverviewChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentOverview = chip.dataset.filter;
            renderPlanTasks();
        });
    });

    // Task section filters (project, time, status)
    document.getElementById('filter-project')?.addEventListener('change', renderPlanTasks);
    document.getElementById('filter-time')?.addEventListener('change', () => {
        // Sync time filter with overview
        const timeFilter = document.getElementById('filter-time');
        if (timeFilter) {
            currentOverview = timeFilter.value;
            // Sync overview chips
            elements.planOverviewChips.forEach(c => {
                c.classList.toggle('active', c.dataset.filter === currentOverview);
            });
            renderPlanTasks();
        }
    });
    document.getElementById('filter-status')?.addEventListener('change', renderPlanTasks);

    // Mood overlay
    elements.moodCloseBtn?.addEventListener('click', closeMoodOverlay);
    elements.moodSlider?.addEventListener('input', onMoodSliderInput);
    elements.moodSubmitBtn?.addEventListener('click', submitMood);
    elements.moodInfoBtn?.addEventListener('click', () => {
        alert('Selecciona cómo te encuentras hoy moviendo el control deslizante. Tu estado de ánimo personaliza la experiencia de la app.');
    });

    // Cargar mood del día desde localStorage
    loadMoodFromStorage();

    // Seed: insertar búsquedas de ejemplo con respuesta hardcodeada
    // Si no hay búsquedas, o si las existentes no tienen 'answer' (versión vieja), reemplazar
    const SEED_DATA = [
        {
            query: '¿Cómo puede un agente de IA personalizar la enseñanza de ELE?',
            icon: 'default',
            desc: 'Consulta sobre agentes IA en ELE',
            timestamp: Date.now() - 3600000,
            answer: 'Un agente de IA puede personalizar la enseñanza de ELE adaptando contenidos al nivel MCER del estudiante (A1-C2), generando actividades específicas para sus necesidades, ofreciendo retroalimentación inmediata en producción escrita y oral, y ajustando el ritmo de aprendizaje. El profesor mantiene el control pedagógico definiendo los objetivos y validando las propuestas del agente.'
        },
        {
            query: '¿Qué actividades puedo crear con IA para una clase de B1?',
            icon: 'default',
            desc: 'Generación de materiales didácticos',
            timestamp: Date.now() - 7200000,
            answer: 'Para un nivel B1 puedes usar IA para crear:\n\n1) Diálogos situacionales adaptados (en una tienda, en el médico, pidiendo direcciones).\n2) Ejercicios de comprensión lectora con textos generados sobre temas de interés del grupo.\n3) Actividades de corrección de errores donde el estudiante identifica y corrige producciones.\n4) Juegos de rol con retroalimentación automática sobre gramática y vocabulario.'
        },
    ];
    const existing = loadRecentSearches();
    const needsSeed = existing.length === 0 || (existing.length <= 2 && !existing[0].answer);
    if (needsSeed) {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(SEED_DATA));
    }

    // Renderizar búsquedas recientes
    renderRecentSearches();

    // Sincronizar historial con servidor si el usuario está logueado
    if (localStorage.getItem('eliana_logged_in') === 'true') {
        syncSearchHistory();
    }

    // Wake word toggle buttons
    document.getElementById('wake-word-btn')?.addEventListener('click', toggleWakeWord);
    document.getElementById('chat-wake-word-btn')?.addEventListener('click', toggleWakeWord);

    // Wake word: activar solo tras primer gesto del usuario
    // Chrome requiere interacción del usuario para acceder al micrófono —
    // sin gesto, start() aborta inmediatamente y crea un bucle infinito
    state.wakeWordEnabled = true;
    updateWakeWordToggle(true);
    const startWakeOnFirstClick = () => {
        if (!state.wakeWordActive && state.wakeWordEnabled) {
            startWakeWordListening();
        }
        document.removeEventListener('click', startWakeOnFirstClick);
        document.removeEventListener('touchstart', startWakeOnFirstClick);
    };
    document.addEventListener('click', startWakeOnFirstClick);
    document.addEventListener('touchstart', startWakeOnFirstClick);

    // TTS voice button in chat bottom bar
    document.getElementById('chat-voice-btn')?.addEventListener('click', toggleTTS);

    // Restore TTS preference from localStorage (default: off)
    const savedTTS = localStorage.getItem('eliana_tts');
    if (savedTTS === 'on') {
        state.ttsEnabled = true;
        updateVoiceButton(true);
    } else {
        state.ttsEnabled = false;
        updateVoiceButton(false);
    }

    // Detener TTS cuando el usuario sale de la pestaña o navega atrás en el navegador
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopTTS();
    });
    window.addEventListener('pagehide', () => {
        stopTTS();
        releaseCachedMicStream();
    });

    console.log('Eliana inicializada');
}

// Iniciar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
