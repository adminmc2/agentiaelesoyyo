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
    demoStep: 0,               // demo visual step (0-4)
    // Juego (diapo 4)
    juegoRound: [],
    juegoIndex: 0,
    juegoScore: 0,
    juegoAnswers: [],
    // Diapo 5 — Agentes
    diapo5Step: 0,
    _diapo5Ws: null,
    _diapo5ContextSent: false,
    _diapo5SmdParser: null
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
    // Prevent starting a new recording if one is already in progress
    if (state.isRecording) {
        console.log('[Recording] Already recording, ignoring startRecording()');
        return;
    }

    try {
        // Stop TTS if playing (don't talk while listening)
        stopTTS();

        // iOS: ensure audio element is warmed up for later TTS playback
        warmupIOSAudio();

        // Pause wake word listening while recording
        if (state.wakeWordActive) {
            stopWakeWordListening();
        }

        // Always request fresh getUserMedia — iOS requires this for each recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioStream = stream;

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
// ============================================
function startSilenceDetection(stream) {
    // Close any previous AudioContext to avoid iOS conflicts with multiple contexts
    if (state.audioContext) {
        state.audioContext.close().catch(() => {});
        state.audioContext = null;
        state.analyser = null;
    }
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    state.audioContext = audioContext;
    state.analyser = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const SILENCE_THRESHOLD = 15;
    // Voice mode answer is a single word — use faster silence detection
    const isVoiceMode = state.voiceModeRecording;
    const SILENCE_DURATION = isVoiceMode ? 1000 : 2000;   // 1s for mode, 3s normal
    const MIN_RECORDING = isVoiceMode ? 1000 : 1500;     // 1s for mode, 1.5s normal
    const MAX_RECORDING = 120000;   // Máximo absoluto: 2 minutos
    const NO_SPEECH_TIMEOUT = 8000; // Si nadie habla en 15s, parar

    let silenceStart = null;
    let speechDetected = false;
    const recordStart = Date.now();

    function checkSilence() {
        if (!state.isRecording) return;

        const elapsed = Date.now() - recordStart;

        if (elapsed > MAX_RECORDING) {
            console.log('[Silence] Max recording time reached, stopping');
            stopRecording();
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // Detect real speech
        if (avg > SILENCE_THRESHOLD * 1.5) {
            speechDetected = true;
        }

        // Si nadie habla en 15s, parar sin enviar
        if (!speechDetected && elapsed > NO_SPEECH_TIMEOUT) {
            console.log('[Silence] No speech detected in 15s, cancelling');
            state._discardRecording = true;
            stopRecording();
            return;
        }

        // Only evaluate silence after MIN_RECORDING and after speech was detected
        if (avg < SILENCE_THRESHOLD && elapsed > MIN_RECORDING && speechDetected) {
            if (!silenceStart) {
                silenceStart = Date.now();
            } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                console.log('[Silence] 5s silence after speech, auto-stopping');
                stopRecording();
                return;
            }
        } else if (avg >= SILENCE_THRESHOLD) {
            silenceStart = null;
        }

        state.silenceTimer = requestAnimationFrame(checkSilence);
    }

    checkSilence();
}

function stopSilenceDetection() {
    if (state.silenceTimer) {
        cancelAnimationFrame(state.silenceTimer);
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

            // Si estamos en Diapo 5, enviar al chat de Diapo 5
            if (isOnDiapo5Screen()) {
                sendDiapo5Message(cleanText);
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
    // Multi-word patterns first (more specific)
    if (WAKE_WORD_PATTERNS.some(p => p.test(t))) return true;
    // Solo "eliana" only if the entire transcript is just the word
    if (WAKE_WORD_SOLO.test(t)) return true;
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

    r.onresult = (event) => {
        if (state.ttsPlaying || orbGreetingPlaying) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
            for (let a = 0; a < event.results[i].length; a++) {
                const transcript = event.results[i][a].transcript;
                if (containsWakeWord(transcript)) {
                    console.log('[WakeWord] Detected!', transcript);
                    state.wakeWordEnabled = false;
                    r.abort();
                    state.wakeWordActive = false;
                    const fullTranscript = transcript;
                    setTimeout(() => {
                        state.wakeWordEnabled = true;
                        onWakeWordDetected(fullTranscript);
                    }, 400);
                    return;
                }
            }
        }
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
        playWakeBeep();
        handleOrbGreeting();
        // Reactivar WakeWord después del saludo para que siga escuchando
        resumeWakeWordAfterRecording();
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
    if (state.wakeWordEnabled && !state.wakeWordActive) {
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
    ['chat-voice-btn', 'blinda-voice-btn', 'diapo5-voice-btn'].forEach(id => {
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

            // Si la interacción fue por voz, activar micrófono automáticamente
            if (state.voiceTriggered && state.ttsEnabled) {
                console.log('[TTS] Voice mode — auto-starting recording after TTS ended');
                // Pequeño delay para que el usuario sepa que puede hablar
                setTimeout(() => {
                    if (!state.isRecording && !state.ttsPlaying) {
                        startRecording();
                    }
                }, 300);
            } else {
                // Solo reanudar wake word si no es modo voz
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

    const greetingText = '¡Chiquillo, bienvenidos a Destino ELE Kaunas 2026! Soy Eliana, y hoy estoy aquí con Román para enseñaros cómo los agentes de inteligencia artificial pueden personalizar la enseñanza sin que perdáis el control pedagógico. Así que venga, ¡preguntadme lo que queráis, buscadme las cosquillas, que aquí estamos pa eso!';

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
    T1: '#7EC8E3', T2: '#81C784', T3: '#F48FB1',
    T4: '#FFB74D', T5: '#B39DDB'
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
                answer: 'Genial, ya hemos roto el hielo. Ahora vamos a poner a prueba vuestro ojo crítico como profes. He preparado unas tarjetas que os van a sorprender. Román, cuando quieras.'
            };
            state._blindaContextSent = true;
        }
        state._blindaWs.send(JSON.stringify(payload));
    };

    const handleBlindaMessage = (event) => {
        const data = JSON.parse(event.data);

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
                if (state.demoStep === 0 && (lower.includes('tarjeta') || lower.includes('carta') || lower.includes('categor') || lower.includes('territorio'))) {
                    advanceDemoTo(1);
                }
                if (state.demoStep === 1 && (lower.includes('darle la vuelta') || lower.includes('situaci') || lower.includes('tres opcion') || lower.includes('a, b') || lower.includes('opci'))) {
                    advanceDemoTo(2);
                }
                if (state.demoStep === 2 && (lower.includes('la correcta es') || lower.includes('respuesta correcta') || lower.includes('la respuesta es la a') || lower.includes('bingo') || lower.includes('acertado') || lower.includes('habéis acertado'))) {
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
// DIAPO 5 — El Agente segun los Grandes Maestros
// ============================================

const DIAPO5_PAINTINGS = [
    {
        id: 'percibir',
        title: 'La joven de la perla',
        author: 'Johannes Vermeer, 1665',
        image: '/static/imagenes/pinturas/vermeer.jpg',
        capability: 'PERCIBIR',
        capabilityIcon: 'ph-fill ph-eye',
        capabilityColor: '#7EC8E3',
        options: [
            { label: 'A', text: 'Percibir — Observa y analiza antes de actuar', correct: true },
            { label: 'B', text: 'Memoria — Recuerda todo lo que ve', correct: false },
            { label: 'C', text: 'Herramientas — Usa un pendiente como herramienta secreta', correct: false, funny: true }
        ],
        explanation: 'Un agente primero OBSERVA: ¿qué nivel tiene el alumno? ¿Qué ha estudiado? ¿Qué necesita? Sin percibir el contexto, es como dar clase con los ojos cerrados.',
        teacherExample: 'Como cuando miráis las caras de vuestros alumnos y sabéis que no han entendido nada.'
    },
    {
        id: 'razonar',
        title: 'El pensador',
        author: 'Auguste Rodin, 1904',
        image: '/static/imagenes/pinturas/rodin.jpg',
        capability: 'RAZONAR',
        capabilityIcon: 'ph-fill ph-brain',
        capabilityColor: '#81C784',
        options: [
            { label: 'A', text: 'Actuar — Está a punto de levantarse a hacer algo', correct: false },
            { label: 'B', text: 'Razonar — Piensa, planifica, elige estrategia', correct: true },
            { label: 'C', text: 'Percibir — Está escuchando un podcast muy interesante', correct: false, funny: true }
        ],
        explanation: 'Un agente no ejecuta a lo loco. RAZONA: ¿qué estrategia uso? ¿Lista de vocabulario o juego con menú real? Elige el mejor camino.',
        teacherExample: 'Como vosotros cuando planificáis una clase: no improvisáis (bueno, a veces sí).'
    },
    {
        id: 'actuar',
        title: 'La libertad guiando al pueblo',
        author: 'Eugène Delacroix, 1830',
        image: '/static/imagenes/pinturas/delacroix.jpg',
        capability: 'ACTUAR',
        capabilityIcon: 'ph-fill ph-lightning',
        capabilityColor: '#F48FB1',
        options: [
            { label: 'A', text: 'Evaluar — Está juzgando al pueblo', correct: false },
            { label: 'B', text: 'Actuar — Pasa a la acción, ejecuta el plan', correct: true },
            { label: 'C', text: 'Memoria — Recuerda la revolución anterior', correct: false, funny: true }
        ],
        explanation: 'Después de percibir y razonar, el agente ACTÚA: genera el ejercicio, adapta el texto, crea el audio. No se queda pensando eternamente.',
        teacherExample: 'El momento en que dejáis el café y entráis al aula. ¡Acción pura!'
    },
    {
        id: 'memoria',
        title: 'La persistencia de la memoria',
        author: 'Salvador Dalí, 1931',
        image: '/static/imagenes/pinturas/dali.jpg',
        capability: 'MEMORIA',
        capabilityIcon: 'ph-fill ph-clock-counter-clockwise',
        capabilityColor: '#FFB74D',
        options: [
            { label: 'A', text: 'Memoria — Recuerda y acumula experiencia', correct: true },
            { label: 'B', text: 'Percibir — Los relojes perciben que se derriten', correct: false },
            { label: 'C', text: 'Razonar — Es una metáfora sobre pensar demasiado', correct: false, funny: true }
        ],
        explanation: 'Un agente RECUERDA: ayer este alumno tuvo problemas con el subjuntivo, la semana pasada dominó el vocabulario de comida.',
        teacherExample: 'No como vosotros la primera semana con 120 nombres nuevos que se os olvidan al día siguiente.'
    },
    {
        id: 'herramientas',
        title: 'La creación de Adán',
        author: 'Miguel Ángel, 1512',
        image: '/static/imagenes/pinturas/miguelangel.jpg',
        capability: 'HERRAMIENTAS',
        capabilityIcon: 'ph-fill ph-wrench',
        capabilityColor: '#B39DDB',
        options: [
            { label: 'A', text: 'Actuar — Está creando algo con las manos', correct: false },
            { label: 'B', text: 'Herramientas — Usa herramientas para crear y transformar', correct: true },
            { label: 'C', text: 'Percibir — Están intentando tocarse para percibirse', correct: false, funny: true }
        ],
        explanation: 'Un agente usa HERRAMIENTAS: busca en el MCER, genera audio, crea ejercicios, adapta textos. No solo responde preguntas, ¡tiene superpoderes!',
        teacherExample: 'Como vosotros con el proyector, la pizarra, los rotuladores y esa app que nunca funciona cuando la necesitáis.'
    }
];

const DIAPO5_AGENTS = [
    { name: 'Traductor', icon: 'ph-fill ph-translate', desc: 'Traduce y adapta textos al nivel del alumno' },
    { name: 'Vocabulario', icon: 'ph-fill ph-book-open-text', desc: 'Crea actividades de vocabulario contextualizadas' },
    { name: 'Personalizador', icon: 'ph-fill ph-user-focus', desc: 'Adapta contenido al perfil del estudiante' },
    { name: 'Creativo', icon: 'ph-fill ph-magic-wand', desc: 'Genera recursos didácticos originales' }
];

const DIAPO5_KEYWORD_MAP = [
    { step: 1, patterns: ['mirad la pantalla', 'cuáles creéis', 'cuales creeis'] },
    { step: 2, patterns: ['cuadros famosos', 'tres opciones'] },
    { step: 3, patterns: ['primer cuadro', 'vermeer', 'joven de la perla'] },
    { step: 4, patterns: ['segundo', 'pensador', 'rodin'] },
    { step: 5, patterns: ['tercer', 'libertad', 'delacroix'] },
    { step: 6, patterns: ['cuarto', 'dali', 'dalí', 'persistencia'] },
    { step: 7, patterns: ['quinto', 'último', 'ultimo', 'miguel ángel', 'miguel angel', 'creación', 'creacion'] },
    { step: 8, patterns: ['acabáis de describir', 'acabais de describir'] }
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
                question: 'Eliana, vamos a explicar que es un agente de IA.',
                answer: 'Vamos a ver ahora que es un agente de IA. Roman, cuando quieras.'
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
        // Render step content lazily
        if (step === 1) {
            renderDiapo5WordCloud();
        } else if (step === 2) {
            renderDiapo5PaintingsPreview();
        } else if (step >= 3 && step <= 7) {
            renderDiapo5Painting(step - 3);
        } else if (step === 8) {
            renderDiapo5Final();
        }
    }
    // Update stepper dots
    document.querySelectorAll('[data-diapo5-dot]').forEach(dot => {
        dot.classList.toggle('demo-stepper__dot--active', parseInt(dot.dataset.diapo5Dot) === step);
    });
}

// Static word cloud — mix of agent, chatbot, LLM and misleading terms
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

    // Staggered GSAP entrance
    const words = container.querySelectorAll('.diapo5-wordcloud__word');
    words.forEach((word, i) => {
        gsap.fromTo(word,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.35, delay: i * 0.06, ease: 'back.out(1.5)' }
        );
    });
}

function renderDiapo5PaintingsPreview() {
    const container = document.getElementById('diapo5-step-2');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-preview-intro">
            <h3 class="diapo5-preview-intro__title">5 cuadros, 5 capacidades</h3>
            <p class="diapo5-preview-intro__subtitle">Cada obra maestra esconde una capacidad del agente. ¿Sabréis adivinarlas?</p>
            <div class="diapo5-preview-grid">
                ${DIAPO5_PAINTINGS.map((p, i) => `
                    <div class="diapo5-preview-card">
                        <div class="diapo5-preview-card__frame">
                            <img class="diapo5-preview-card__img" src="${p.image}" alt="${p.title}">
                        </div>
                        <span class="diapo5-preview-card__title">${p.title}</span>
                        <span class="diapo5-preview-card__question" style="color: ${p.capabilityColor}">?</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // GSAP entrance
    const cards = container.querySelectorAll('.diapo5-preview-card');
    cards.forEach((card, i) => {
        gsap.fromTo(card,
            { rotateY: 90, opacity: 0 },
            { rotateY: 0, opacity: 1, duration: 0.5, delay: i * 0.15, ease: 'power2.out' }
        );
    });
}

function renderDiapo5Painting(paintingIndex) {
    const painting = DIAPO5_PAINTINGS[paintingIndex];
    if (!painting) return;
    const container = document.getElementById(`diapo5-step-${paintingIndex + 3}`);
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    // Phase: painting + options
    container.innerHTML = `
        <div class="diapo5-painting">
            <div class="diapo5-painting__frame">
                <img class="diapo5-painting__img" src="${painting.image}" alt="${painting.title}">
            </div>
            <div class="diapo5-painting__info">
                <p class="diapo5-painting__title">${painting.title}</p>
                <p class="diapo5-painting__author">${painting.author}</p>
            </div>
        </div>
        <div class="diapo5-options" id="diapo5-options-${paintingIndex}">
            ${painting.options.map((opt, i) => `
                <div class="diapo5-option" data-painting="${paintingIndex}" data-option="${i}">
                    <span class="diapo5-option__label" style="color: ${painting.capabilityColor}">${opt.label}</span>
                    <span>${opt.text}</span>
                </div>
            `).join('')}
        </div>
        <div class="diapo5-reveal-container" id="diapo5-reveal-${paintingIndex}"></div>
    `;

    // GSAP entrance
    const frame = container.querySelector('.diapo5-painting__frame');
    const opts = container.querySelectorAll('.diapo5-option');
    gsap.fromTo(frame, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' });
    opts.forEach((opt, i) => {
        gsap.fromTo(opt,
            { x: -20, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.3, delay: 0.3 + i * 0.1, ease: 'power2.out' }
        );
    });

    // Click handler for options
    opts.forEach(opt => {
        opt.addEventListener('click', () => {
            const pi = parseInt(opt.dataset.painting);
            const oi = parseInt(opt.dataset.option);
            handleDiapo5OptionClick(pi, oi);
        });
    });
}

function handleDiapo5OptionClick(paintingIndex, optionIndex) {
    const painting = DIAPO5_PAINTINGS[paintingIndex];
    const optionsContainer = document.getElementById(`diapo5-options-${paintingIndex}`);
    if (!optionsContainer || optionsContainer.dataset.answered) return;
    optionsContainer.dataset.answered = 'true';

    const allOpts = optionsContainer.querySelectorAll('.diapo5-option');
    allOpts.forEach((opt, i) => {
        opt.classList.add('diapo5-option--disabled');
        const optData = painting.options[i];
        if (optData.correct) {
            opt.classList.add('diapo5-option--correct');
        } else if (optData.funny) {
            opt.classList.add('diapo5-option--funny');
        } else {
            opt.classList.add('diapo5-option--wrong');
        }
    });

    // Shrink painting
    const frame = document.querySelector(`#diapo5-step-${paintingIndex + 3} .diapo5-painting__frame`);
    if (frame) {
        gsap.to(frame, { scale: 0.7, opacity: 0.6, duration: 0.4, ease: 'power2.inOut' });
    }

    // Show reveal
    const revealContainer = document.getElementById(`diapo5-reveal-${paintingIndex}`);
    if (revealContainer) {
        revealContainer.innerHTML = `
            <div class="diapo5-reveal">
                <div class="diapo5-reveal__icon" style="background: ${painting.capabilityColor}">
                    <i class="${painting.capabilityIcon}"></i>
                </div>
                <div class="diapo5-reveal__capability" style="color: ${painting.capabilityColor}">${painting.capability}</div>
                <p class="diapo5-reveal__explanation">${painting.explanation}</p>
                <p class="diapo5-reveal__teacher-example">${painting.teacherExample}</p>
            </div>
        `;
        const reveal = revealContainer.querySelector('.diapo5-reveal');
        gsap.fromTo(reveal,
            { y: 30, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
        );
    }
}

function renderDiapo5Final() {
    const container = document.getElementById('diapo5-step-8');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    container.innerHTML = `
        <div class="diapo5-final">
            <h2 class="diapo5-final__title">Lo que habéis descrito es un AGENTE de IA</h2>
            <div class="diapo5-final__diagram">
                ${DIAPO5_PAINTINGS.map((p, i) => `
                    <div class="diapo5-final__cap" style="background: linear-gradient(145deg, ${p.capabilityColor}, ${p.capabilityColor}dd)">
                        <i class="${p.capabilityIcon}"></i>
                        <span class="diapo5-final__cap-name">${p.capability}</span>
                    </div>
                `).join('')}
            </div>
            <h3 style="font: 600 16px 'Dosis', sans-serif; color: var(--md-sys-color-on-surface); margin-top: var(--space-16);">Nuestros agentes en AgentiaELE</h3>
            <div class="diapo5-agents">
                ${DIAPO5_AGENTS.map((a, i) => `
                    <div class="diapo5-agent-card">
                        <i class="${a.icon} diapo5-agent-card__icon"></i>
                        <span class="diapo5-agent-card__name">${a.name}</span>
                        <span class="diapo5-agent-card__desc">${a.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Animate capabilities
    const caps = container.querySelectorAll('.diapo5-final__cap');
    caps.forEach((cap, i) => {
        gsap.fromTo(cap,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, delay: i * 0.15, ease: 'back.out(1.7)' }
        );
    });

    // Animate agent cards
    const agents = container.querySelectorAll('.diapo5-agent-card');
    agents.forEach((card, i) => {
        gsap.fromTo(card,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, delay: 0.8 + i * 0.1, ease: 'power2.out' }
        );
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
    const cardContainer = document.getElementById('juego-card-container');
    const feedback = document.getElementById('juego-feedback');
    if (!carousel) return;

    cardContainer?.classList.add('hidden');
    feedback?.classList.add('hidden');

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
        const iconClass = BLINDA_ICONS[letter] || 'ph-fill ph-shield-check';
        mini.innerHTML = `<span>${letter}</span><i class="${iconClass}"></i>`;
        if (i === selectedIdx) mini.id = 'juego-selected-mini';
        track.appendChild(mini);
    }
    carousel.appendChild(track);

    const miniWidth = 92;
    const carouselCenter = carousel.offsetWidth / 2 - 40;
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
    const cardEl = document.getElementById('juego-card');
    const letterEl = document.getElementById('juego-card-letter');
    if (!container || !cardEl) return;

    const color = BLINDA_COLORS[card.letter] || card.color || '#6B8F71';
    const displayCat = (card.category || '').replace(/^T\d-/, '') || BLINDA_TERRITORIES[card.letter] || '';
    const icon = BLINDA_ICONS[card.letter] || 'ph-fill ph-shield-check';
    const level = card.level || 1;

    const front = cardEl.querySelector('.juego-card__front');
    if (front) {
        front.style.background = `linear-gradient(145deg, ${color}, ${color}dd)`;
    }

    letterEl.textContent = card.letter;

    // Build card back content
    const back = cardEl.querySelector('.juego-card__back');
    if (back) {
        const levelDots = Array.from({ length: 3 }, (_, i) =>
            `<span class="juego-card__level-dot ${i < level ? 'juego-card__level-dot--active' : ''}" style="${i < level ? `background:${color}` : ''}"></span>`
        ).join('');

        back.innerHTML = `
            <div class="juego-card__header" style="border-bottom-color: ${color}33">
                <div class="juego-card__category">
                    <i class="${icon}" style="color:${color}"></i>
                    <span>${displayCat}</span>
                </div>
                <div class="juego-card__level" title="Dificultad ${level}/3">
                    ${levelDots}
                </div>
            </div>
            <p class="juego-card__situation" id="juego-card-situation">${card.situation}</p>
            <div class="juego-card__options" id="juego-card-options"></div>`;

        const optionsEl = back.querySelector('#juego-card-options');
        const options = [
            { label: 'A', text: card.option_a },
            { label: 'B', text: card.option_b },
            { label: 'C', text: card.option_c }
        ];
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'juego-option-btn';
            btn.innerHTML = `<span class="juego-option-btn__label" style="color:${color}">${opt.label}</span><span>${opt.text}</span>`;
            btn.addEventListener('click', () => selectJuegoOption(opt.label, card));
            optionsEl.appendChild(btn);
        });
    }

    cardEl.classList.remove('flipped');
    container.classList.remove('hidden');

    gsap.fromTo(container, { scale: 0.8, opacity: 0 }, {
        scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.4)'
    });

    setTimeout(() => cardEl.classList.add('flipped'), 800);
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

    setTimeout(() => showJuegoFeedback(correct, card.explanation), 600);
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
        title.textContent = 'Areas a reforzar';
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
    let html = '<h3 class="juego-summary__discuss-title">Para comentar en pareja</h3><ul class="juego-discuss-list">';
    html += '<li>Cual os ha sorprendido mas?</li>';
    if (categories.length > 0) {
        html += `<li>Habeis tenido problemas con: ${categories.join(', ')}. Como las detectariais en el futuro?</li>`;
    }
    html += '<li>Que le pediriais a la IA de forma diferente ahora?</li></ul>';
    discussionEl.innerHTML = html;
}

function replayJuego() {
    startJuegoGame();
}

// ============================================
// Event Listeners
// ============================================
function init() {
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

    // Diapo 5 — El Agente segun los Grandes Maestros
    document.getElementById('diapo5-nav-back')?.addEventListener('click', hideDiapo5Screen);
    document.getElementById('diapo5-nav-next')?.addEventListener('click', () => {
        // Future: next screen after diapo5
        // For now advance demo step
        if (state.diapo5Step < 8) advanceDiapo5To(state.diapo5Step + 1);
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
    document.getElementById('diapo5-mic-btn')?.addEventListener('click', () => {
        enableTTS();
        state.voiceTriggered = true;
        if (state.isRecording) {
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
                            text: 'Mi perfil docente generado por Eliana AI - Destino ELE Kaunas 2026',
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
