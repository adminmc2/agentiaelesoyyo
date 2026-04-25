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

// ─────────────────────────────────────────────────────────────────────────
// KILL-SWITCH — modo presentación (Fase 2 de saneo legacy)
// Cuando true, las funciones de navegación a pantallas de la app personal
// original (welcome/chat/plan/conoce) son NO-OP. Esto evita efectos
// colaterales (WebSocket abiertos, TTS pisado, state mutado) aunque algún
// listener legacy las invoque.
//
// IMPORTANTE — dualidad de comportamiento (Fase 3B, v23.7.5):
//   · Toggle real: solo en funciones cuyo BODY original siga intacto tras el
//     `if (__legacyGuard(...)) return;`. Actualmente NINGUNA.
//   · Marcador de auditoría: en las 7 funciones con body eliminado en v23.7.5
//     (ver marcadores `@deprecated` en cada una). Aunque pongas false, esas
//     funciones siguen siendo no-op porque su body ya no existe; para
//     restaurarlo haría falta recuperarlo del historial de git.
//
// Para debug: cambiar a `false` manualmente en este archivo y recargar
// (es `const`, no se puede reasignar en runtime desde consola).
// ─────────────────────────────────────────────────────────────────────────
const MODO_PRESENTACION = true;
function __legacyGuard(fnName) {
    if (MODO_PRESENTACION) {
        console.warn(`[LEGACY bloqueado] ${fnName} — si ves esto, alguna ruta antigua sigue activa`);
        return true;
    }
    return false;
}

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
    // Eliana Widget
    elianaWidgetState: 'fab',  // 'fab' | 'floating' | 'docked' | 'expanded'
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

    // Diapo 6 screen (IA para estudiantes / Strategos) — v23.18.0
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
    product:   'chalkboard-teacher',
    objection: 'exam',
    argument:  'cat',
    voice:     'microphone',
    default:   'clock'
};

function classifySearchIcon(query) {
    const q = query.toLowerCase();
    if (/vocabulario|gramática|gramatica|actividad|ejercicio|diálogo|dialogo|lectura/i.test(q)) return 'product';
    if (/agente|miau|prompt|ia|inteligencia artificial/i.test(q)) return 'argument';
    if (/evalua|correg|rúbrica|rubrica|examen|nivel/i.test(q)) return 'objection';
    return 'default';
}

function getSearchDescription(query) {
    const type = classifySearchIcon(query);
    switch (type) {
        case 'product':   return 'Consulta sobre actividades ELE';
        case 'objection': return 'Evaluación y seguimiento';
        case 'argument':  return 'Agentes IA y tecnología';
        default:          return 'Conversación con Eliana';
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

// Tareas mock con fechas relativas
const PLAN_TASKS = [
    // --- En proceso ---
    { id: 1, title: 'Preparar actividad de vocabulario A2', date: '2026-03-27', project: 'clases', status: 'in_progress', tasks: 2, subtasks: 1 },
    { id: 2, title: 'Diseñar rúbrica de expresión oral', date: '2026-03-27', project: 'evaluacion', status: 'in_progress', tasks: 1, subtasks: 0 },
    { id: 3, title: 'Crear diálogo cotidiano B1', date: '2026-03-27', project: 'clases', status: 'in_progress', tasks: 3, subtasks: 2 },
    // --- Por hacer ---
    { id: 4, title: 'Adaptar lectura al nivel A1', date: '2026-03-28', project: 'clases', status: 'todo', tasks: 2, subtasks: 0 },
    { id: 5, title: 'Revisar ejercicios de gramática U3', date: '2026-03-29', project: 'clases', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 6, title: 'Preparar actividad cultural — fiestas', date: '2026-03-30', project: 'cultura', status: 'todo', tasks: 1, subtasks: 1 },
    { id: 7, title: 'Configurar agente corrector MIAU', date: '2026-03-31', project: 'evaluacion', status: 'todo', tasks: 2, subtasks: 0 },
    { id: 8, title: 'Reunión departamento de lenguas', date: '2026-04-02', project: 'admin', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 9, title: 'Crear examen parcial B2', date: '2026-04-03', project: 'evaluacion', status: 'todo', tasks: 2, subtasks: 1 },
    { id: 10, title: 'Actualizar programación didáctica', date: '2026-04-05', project: 'admin', status: 'todo', tasks: 1, subtasks: 0 },
    { id: 11, title: 'Diseñar tarea final de unidad', date: '2026-04-07', project: 'clases', status: 'todo', tasks: 3, subtasks: 2 },
    // --- Retrasadas ---
    { id: 12, title: 'Corregir redacciones grupo B1.2', date: '2026-03-26', project: 'evaluacion', status: 'overdue', tasks: 1, subtasks: 1 },
    { id: 13, title: 'Subir materiales al aula virtual', date: '2026-03-25', project: 'admin', status: 'overdue', tasks: 2, subtasks: 0 },
    { id: 14, title: 'Preparar comprensión auditiva A2', date: '2026-03-24', project: 'clases', status: 'overdue', tasks: 1, subtasks: 0 },
    // --- Completadas ---
    { id: 15, title: 'Actividad de roleplay — en el mercado', date: '2026-03-23', project: 'clases', status: 'done', tasks: 2, subtasks: 1 },
    { id: 16, title: 'Taller IA para profesores ELE', date: '2026-03-22', project: 'cultura', status: 'done', tasks: 1, subtasks: 0 },
];

// Proyectos con sus colores
const PLAN_PROJECTS = {
    clases:     { label: 'Clases',       color: 'var(--md-sys-color-primary)' },
    evaluacion: { label: 'Evaluación',   color: 'var(--md-sys-color-secondary)' },
    cultura:    { label: 'Cultura',      color: 'var(--md-sys-color-tertiary)' },
    admin:      { label: 'Organización', color: 'var(--md-sys-color-tertiary)' }
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
/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showChatScreen(initialMessage, showSelector = false, skipSend = false) {
    __legacyGuard('showChatScreen');
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

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showWelcomeScreen() {
    __legacyGuard('showWelcomeScreen');
}

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showPlanScreen() {
    __legacyGuard('showPlanScreen');
}

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showWelcomeFromPlan() {
    __legacyGuard('showWelcomeFromPlan');
}

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showChatFromPlan() {
    __legacyGuard('showChatFromPlan');
}

// ============================================
// Markdown rendering + Phosphor icon enrichment
// ============================================

// Map of keywords to Phosphor icon names for semantic enrichment
const ICON_MAP_HEADERS = {
    // ELE — Enseñanza
    'eliana':         'chalkboard-teacher',
    'vocabulario':    'translate',
    'gramática':      'book-open',
    'gramatica':      'book-open',
    'comunicación':   'chat-circle',
    'comunicacion':   'chat-circle',
    'cultura':        'globe-hemisphere-west',
    'destreza':       'target',
    'destrezas':      'target',
    'actividad':      'pencil-line',
    'actividades':    'pencil-line',
    'ejercicio':      'clipboard-text',
    'ejercicios':     'clipboard-text',
    'diálogo':        'chat-dots',
    'dialogo':        'chat-dots',
    'lectura':        'book-open-text',
    'comprensión':    'ear',
    'comprension':    'ear',
    'expresión':      'microphone',
    'expresion':      'microphone',
    'evaluación':     'exam',
    'evaluacion':     'exam',
    'nivel':          'stairs',
    // IA y agentes
    'agente':         'cat',
    'agentes':        'cat',
    'prompt':         'terminal',
    'miau':           'cat',
    'tecnología':     'gear',
    'tecnologia':     'gear',
    'personalizar':   'user-focus',
    'personalización':'user-focus',
    'personalizacion':'user-focus',
    // Genéricos
    'beneficio':      'star',
    'beneficios':     'star',
    'ventaja':        'star',
    'ventajas':       'star',
    'estrategia':     'strategy',
    'resultado':      'chart-line-up',
    'resultados':     'chart-line-up',
    'ejemplo':        'lightbulb',
    'ejemplos':       'lightbulb',
    // Secciones
    'datos clave':    'chart-bar',
    'estudio':        'book-open-text',
    'estudios':       'book-open-text',
    'referencia':     'book-open-text',
    'comparativa':    'scales',
    'comparación':    'scales',
    'comparacion':    'scales',
    'diferencia':     'scales',
    'conclusión':     'check-circle',
    'conclusion':     'check-circle',
    'resumen':        'list-bullets',
    'recomendación':  'lightbulb',
    'recomendacion':  'lightbulb',
    'tip':            'lightbulb',
    'nota':           'note',
    'importante':     'warning-circle',
    'advertencia':    'warning'
};

// Icon for table header cells based on content
const ICON_MAP_TABLE = {
    'nombre':         'tag',
    'actividad':      'pencil-line',
    'nivel':          'stairs',
    'destreza':       'target',
    'agente':         'cat',
    'tipo':           'shapes',
    'beneficio':      'star',
    'ventaja':        'star',
    'característica': 'check-circle',
    'caracteristica': 'check-circle',
    'aspecto':        'list-bullets',
    'dato':           'chart-bar',
    'detalle':        'info',
    'paso':           'number-circle-one',
    'acción':         'lightning',
    'accion':         'lightning',
    'ejemplo':        'lightbulb',
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
                if (state.activityMessageCount >= 6 && !state.profileGenerated) {
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

        if (rmsDb > SPEECH_THRESHOLD_DB) {
            speechDetected = true;
            speechFrames++;
            silenceStart = null;
        }

        // Sin habla en 8s
        if (!speechDetected && elapsed > NO_SPEECH_TIMEOUT) {
            if (state.voiceTriggered) {
                // Manual mic click — send to Whisper anyway, let server decide
                console.log('[Silence] No speech in 8s (manual click) — sending to Whisper anyway');
            } else {
                console.log('[Silence] No speech in 8s (auto) — discarding');
                state._discardRecording = true;
            }
            stopRecording();
            return;
        }

        // Silencio después de habla → auto-parar
        if (rmsDb < SILENCE_THRESHOLD_DB && elapsed > MIN_RECORDING && speechDetected) {
            if (!silenceStart) {
                silenceStart = Date.now();
            } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                // Verificar que hubo habla real (>5% de los frames)
                const speechRatio = speechFrames / totalFrames;
                if (speechRatio < 0.05 && !state.voiceTriggered) {
                    console.log('[Silence] Speech ratio too low (' + (speechRatio * 100).toFixed(1) + '%), discarding (auto)');
                    state._discardRecording = true;
                } else if (speechRatio < 0.05) {
                    console.log('[Silence] Speech ratio low (' + (speechRatio * 100).toFixed(1) + '%) but manual click — sending to Whisper');
                }
                console.log('[Silence] Auto-stop after ' + SILENCE_DURATION + 'ms silence (speechRatio=' + (speechRatio * 100).toFixed(1) + '%)');
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

    // Diapo 5 ya no tiene mic (v23.16)

    // Diapo 6 MIAU eliminada en v23.17.0

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

            // Diapo 5 ya no tiene chat (v23.16) — ignorar voz en esa pantalla
            if (isOnDiapo5Screen()) {
                updateRecordingUI(false);
                resumeWakeWordAfterRecording();
                return;
            }

            // Diapo 6 MIAU eliminada en v23.17.0

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
    // iOS: SpeechRecognition breaks the audio session even when denied,
    // causing getUserMedia streams to return empty data. Skip entirely on iOS.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return;

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

    // Diapo 5 ya no tiene chat ni wake-word (v23.16) — Eliana habla sola al abrir
    if (elements.diapo5Screen && !elements.diapo5Screen.classList.contains('hidden')) {
        return;
    }

    // Diapo 6 MIAU eliminada en v23.17.0

    // Si estamos en Diapo 7, misma logica que Diapo 5
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
state.ttsGain = 3.0;         // Boost de volumen TTS (1.0 = normal, 3.0 = 300%)
state._ttsAudioCtx = null;   // AudioContext para amplificación
state._ttsGainNode = null;   // GainNode reutilizable

/**
 * Amplifica un elemento <audio> usando Web Audio API GainNode.
 * Permite subir el volumen por encima del máximo del navegador.
 * createMediaElementSource solo se puede llamar una vez por elemento,
 * así que marcamos el elemento y reutilizamos la conexión.
 */
function boostAudioVolume(audioElement) {
    try {
        if (!state._ttsAudioCtx) {
            state._ttsAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            state._ttsGainNode = state._ttsAudioCtx.createGain();
            state._ttsGainNode.connect(state._ttsAudioCtx.destination);
        }
        // Resume if suspended (iOS)
        if (state._ttsAudioCtx.state === 'suspended') {
            state._ttsAudioCtx.resume();
        }
        state._ttsGainNode.gain.value = state.ttsGain;
        // Solo conectar una vez por elemento (createMediaElementSource no se puede repetir)
        if (!audioElement._boosted) {
            const source = state._ttsAudioCtx.createMediaElementSource(audioElement);
            source.connect(state._ttsGainNode);
            audioElement._boosted = true;
        }
    } catch (e) {
        console.log('[TTS] Boost skipped:', e.message);
    }
}

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
    ['chat-voice-btn', 'blinda-voice-btn', 'juego-voice-btn', 'diapo7-voice-btn'].forEach(id => {
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
 *
 * Cancelación por TOKEN (state.ttsRequestId): cada llamada captura su propio
 * id incremental. stopTTS (y cualquier llamada nueva) invalida las anteriores
 * incrementando el contador. Evita el race donde un fetch lento "resucita"
 * tras ser cancelado porque el flag global fue reseteado por otra petición.
 */
async function playTTS(text, skipSummary = false, isActivity = false) {
    // Detener audio previo si existe (esto también invalida peticiones en vuelo)
    stopTTS();
    // Token único para ESTA petición: si otra playTTS o stopTTS se ejecuta
    // después, incrementará el contador y este id quedará obsoleto.
    if (state.ttsRequestId == null) state.ttsRequestId = 0;
    const myId = ++state.ttsRequestId;
    state.ttsCancelled = false;  // Mantener por compat con otros flujos
    // Pausar wake word para que no capte el audio del TTS
    stopWakeWordListening();

    if (!text || !text.trim()) return;

    try {
        console.log(`[TTS] req=${myId} requesting ${text.length} chars (skip_summary=${skipSummary})`);
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, skip_summary: skipSummary, is_activity: isActivity })
        });

        // Si llegó una petición más reciente o alguien llamó a stopTTS, abortar.
        if (state.ttsRequestId !== myId) {
            console.log(`[TTS] req=${myId} stale after fetch — aborted (current=${state.ttsRequestId})`);
            return;
        }

        if (!response.ok) {
            console.error('[TTS] Server error:', response.status);
            return;
        }

        // Reproducir como blob (más compatible que MediaSource para MP3 streaming)
        const blob = await response.blob();

        // Revisar de nuevo después de leer el blob
        if (state.ttsRequestId !== myId) {
            console.log(`[TTS] req=${myId} stale after blob — aborted (current=${state.ttsRequestId})`);
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
            // Hook: notifica a componentes UI que el TTS terminó
            window.dispatchEvent(new CustomEvent('tts:end'));

            console.log('[MIC-DEBUG] TTS onEnded — voiceTriggered:', state.voiceTriggered, 'ttsEnabled:', state.ttsEnabled, 'isRecording:', state.isRecording, 'screen:', !elements.loginScreen.classList.contains('hidden') ? 'login' : 'other');

            // Si la interacción fue por voz, activar micrófono automáticamente
            if (state.voiceTriggered && state.ttsEnabled) {
                // Actividad 3: no auto-grabar, solo invitar con pulso visual
                if (state.activityMode) {
                    console.log('[MIC-DEBUG] activity — mic invite pulse (no auto-record)');
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
                if (state.activityMode) {
                    console.log('[MIC-DEBUG] activity opener — mic invite pulse');
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
            window.dispatchEvent(new CustomEvent('tts:end'));
        };

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // Amplificar volumen para altavoces externos
        boostAudioVolume(audio);

        // Último check antes del play: si la petición ya no es la actual, no arrancar
        if (state.ttsRequestId !== myId) {
            console.log(`[TTS] req=${myId} stale before play — aborted`);
            return;
        }

        // Hook: notifica a componentes UI que el TTS empieza (botón MUTE pulsa, bocinas de burbuja)
        window.dispatchEvent(new CustomEvent('tts:start'));

        await audio.play();
        console.log(`[TTS] req=${myId} playing`);

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

            // Amplificar volumen para altavoces externos
            boostAudioVolume(audio);

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
    const wasPlaying = state.ttsPlaying;
    state.ttsCancelled = true;  // Legacy flag (mantener por compat con otros flujos)
    // Invalidar TODAS las peticiones en vuelo incrementando el token. Cualquier
    // playTTS pendiente verá que state.ttsRequestId !== su myId y abortará.
    if (state.ttsRequestId == null) state.ttsRequestId = 0;
    state.ttsRequestId++;
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
    // Si estaba sonando, notifica fin para que los componentes UI limpien su estado visual
    if (wasPlaying) window.dispatchEvent(new CustomEvent('tts:end'));
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

    const greetingText = '¡Chiquillo, bienvenidos a Destino ELE VIENA! Soy Eliana, y hoy estoy aquí con Román para enseñaros cómo los agentes de inteligencia artificial pueden personalizar la enseñanza sin que perdáis el control pedagógico. Así que venga, ¡preguntadme lo que queráis, buscadme las cosquillas, que aquí estamos pa eso!';

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

    // Transición a la pantalla 02 — Juego Intro (¿Qué es un agente de IA?)
    elements.loginScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.loginScreen?.classList.add('hidden');
        elements.loginScreen?.classList.remove('fade-out');
        showJuegoIntroScreen();
    }, 300);
}

// ---- Diapo 02 — Juego Intro ----
function showJuegoIntroScreen() {
    stopTTS();
    // Ocultar todas las demás pantallas
    elements.loginScreen?.classList.add('hidden');
    elements.conoceScreen?.classList.add('hidden');
    elements.chatScreen?.classList.add('hidden');
    elements.blindaScreen?.classList.add('hidden');
    elements.juegoScreen?.classList.add('hidden');
    elements.diapo5Screen?.classList.add('hidden');
    elements.diapo7Screen?.classList.add('hidden');

    const screen = document.getElementById('juego-intro-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    screen.classList.remove('fade-out');

    // Generar el QR dinámico apuntando a /juego3 (página móvil del juego).
    // Se usa la URL absoluta del servidor actual para que funcione con cualquier
    // deployment (ngrok, producción, local) sin hardcodear dominio.
    renderJintroQRCode();
}

// Genera el QR SVG dentro de #jintro-qr-svg apuntando a ${origin}/juego3
function renderJintroQRCode() {
    const host = document.getElementById('jintro-qr-svg');
    if (!host) return;
    if (typeof window.qrcode !== 'function') {
        // Lib no cargada aún → reintento breve
        setTimeout(renderJintroQRCode, 200);
        return;
    }
    try {
        const url = `${location.origin}/juego3`;
        // Type 0 = autodetect versión, 'M' = corrección media (adecuada para escaneo en aula)
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        // createSvgTag(cellSize, margin) — usamos cellSize=1 y margin=2 para un SVG limpio
        // que escala con CSS (la clase .jintro-qr-svg ya le da tamaño visual).
        host.innerHTML = qr.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
        const svg = host.querySelector('svg');
        if (svg) {
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.display = 'block';
            // Color del módulo: negro sobre blanco (máximo contraste para escaneo)
            svg.querySelectorAll('rect, path').forEach(n => {
                if (n.getAttribute('fill') !== 'white' && n.getAttribute('fill') !== '#ffffff' && n.getAttribute('fill') !== '#FFFFFF') {
                    n.setAttribute('fill', '#2c2c2c');
                }
            });
        }
        console.log('[juego-intro] QR generado →', url);
    } catch (e) {
        console.warn('[juego-intro] QR generation failed:', e);
    }
}

function hideJuegoIntroScreen() {
    const screen = document.getElementById('juego-intro-screen');
    if (!screen) return;
    screen.classList.add('fade-out');
    setTimeout(() => {
        screen.classList.add('hidden');
        screen.classList.remove('fade-out');
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

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Para restaurar: `git show <hash-anterior>:static/app.js`.
 */
function showConoceScreen() {
    __legacyGuard('showConoceScreen');
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
        let jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
        // Strip markdown code fences (```json ... ```)
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const profile = JSON.parse(jsonStr);

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

/**
 * @deprecated v23.7.5 — body eliminado. No-op definitivo (ver MODO_PRESENTACION).
 * Diapo 3 original (Blinda tu Prompt demo). Para restaurar: `git show <hash>:static/app.js`.
 */
function showBlindaScreen() {
    __legacyGuard('showBlindaScreen');
}

function hideBlindaScreen() {
    elements.blindaScreen?.classList.add('fade-out');
    setTimeout(() => {
        elements.blindaScreen?.classList.add('hidden');
        elements.blindaScreen?.classList.remove('fade-out');
        showConoceScreen();
    }, 300);
}

// ---- Eliana Widget (floating/docked/expanded chat) ----

function setWidgetState(newState) {
    const widget = document.getElementById('eliana-widget');
    const page = document.querySelector('.blinda-page--fullscreen');
    if (!widget) return;

    const oldState = state.elianaWidgetState;
    state.elianaWidgetState = newState;

    // Remove all state classes
    widget.classList.remove('eliana-widget--fab', 'eliana-widget--floating', 'eliana-widget--docked', 'eliana-widget--expanded', 'eliana-widget--dragging');
    widget.classList.add(`eliana-widget--${newState}`);
    widget.dataset.state = newState;

    // Reset inline drag position when changing state
    if (newState !== oldState) {
        widget.style.left = '';
        widget.style.top = '';
        widget.style.bottom = '';
        widget.style.right = '';
    }

    // Toggle docked class on page for content margin
    if (page) {
        page.classList.toggle('blinda-page--has-docked', newState === 'docked');
    }

    // Entry animation for panel states
    if (oldState === 'fab' && newState !== 'fab') {
        widget.classList.add('eliana-widget--entering');
        setTimeout(() => widget.classList.remove('eliana-widget--entering'), 400);
    }

    // Update expand button icon
    const expandBtn = widget.querySelector('[data-action="expand"]');
    if (expandBtn) {
        const icon = expandBtn.querySelector('i');
        if (icon) {
            icon.className = newState === 'expanded' ? 'ph ph-arrows-in' : 'ph ph-arrows-out';
        }
        expandBtn.title = newState === 'expanded' ? 'Reducir' : 'Ampliar';
    }

    // Update dock button icon
    const dockBtn = widget.querySelector('[data-action="dock"]');
    if (dockBtn) {
        const icon = dockBtn.querySelector('i');
        if (icon) {
            icon.className = newState === 'docked' ? 'ph ph-x-square' : 'ph ph-sidebar-simple';
        }
        dockBtn.title = newState === 'docked' ? 'Desanclar' : 'Anclar lateral';
    }
}

function initWidgetDrag() {
    const widget = document.getElementById('eliana-widget');
    const header = document.getElementById('eliana-widget-header');
    if (!widget || !header) return;

    let isDragging = false;
    let startX, startY, origLeft, origTop;

    function onStart(e) {
        // Only drag in floating/expanded states
        if (state.elianaWidgetState === 'docked' || state.elianaWidgetState === 'fab') return;
        // Don't drag from buttons
        if (e.target.closest('.eliana-widget__btn')) return;

        isDragging = true;
        widget.classList.add('eliana-widget--dragging');

        const touch = e.touches ? e.touches[0] : e;
        const rect = widget.getBoundingClientRect();
        startX = touch.clientX;
        startY = touch.clientY;
        origLeft = rect.left;
        origTop = rect.top;

        // Switch from bottom/right to left/top positioning for drag
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
        widget.style.left = origLeft + 'px';
        widget.style.top = origTop + 'px';

        e.preventDefault();
    }

    function onMove(e) {
        if (!isDragging) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        widget.style.left = (origLeft + dx) + 'px';
        widget.style.top = (origTop + dy) + 'px';
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        widget.classList.remove('eliana-widget--dragging');

        // Clamp to viewport
        const rect = widget.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        widget.style.left = Math.max(0, Math.min(rect.left, maxX)) + 'px';
        widget.style.top = Math.max(0, Math.min(rect.top, maxY)) + 'px';
    }

    header.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    header.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function initWidgetListeners() {
    const widget = document.getElementById('eliana-widget');
    if (!widget) return;

    // FAB click → activar voz (sin abrir chat). Fix #1: solo voiceTriggered,
    // no enableTTS persistente.
    document.getElementById('eliana-widget-fab')?.addEventListener('click', () => {
        state.voiceTriggered = true;
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Cluster de acciones bajo el FAB: Mover / Chat / Anclar
    widget.querySelectorAll('.eliana-widget__fab-action').forEach(btn => {
        const action = btn.dataset.action;
        if (action === 'chat') {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setWidgetState('floating');
            });
        } else if (action === 'dock') {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setWidgetState('docked');
            });
        } else if (action === 'move') {
            // Drag del widget desde el botón "mover"
            let dragging = false;
            let startX, startY, origLeft, origTop;
            const onStart = (e) => {
                e.stopPropagation();
                e.preventDefault();
                dragging = true;
                widget.classList.add('eliana-widget--dragging');
                const t = e.touches ? e.touches[0] : e;
                const rect = widget.getBoundingClientRect();
                startX = t.clientX; startY = t.clientY;
                origLeft = rect.left; origTop = rect.top;
                widget.style.bottom = 'auto';
                widget.style.right = 'auto';
                widget.style.left = origLeft + 'px';
                widget.style.top = origTop + 'px';
            };
            const onMove = (e) => {
                if (!dragging) return;
                const t = e.touches ? e.touches[0] : e;
                widget.style.left = (origLeft + t.clientX - startX) + 'px';
                widget.style.top = (origTop + t.clientY - startY) + 'px';
                if (e.touches) e.preventDefault();
            };
            const onEnd = () => {
                if (!dragging) return;
                dragging = false;
                widget.classList.remove('eliana-widget--dragging');
                const rect = widget.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                widget.style.left = Math.max(0, Math.min(rect.left, maxX)) + 'px';
                widget.style.top = Math.max(0, Math.min(rect.top, maxY)) + 'px';
            };
            btn.addEventListener('mousedown', onStart);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            btn.addEventListener('touchstart', onStart, { passive: false });
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }
    });

    // Header action buttons
    widget.querySelectorAll('.eliana-widget__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'minimize') {
                setWidgetState('fab');
            } else if (action === 'dock') {
                setWidgetState(state.elianaWidgetState === 'docked' ? 'floating' : 'docked');
            } else if (action === 'expand') {
                setWidgetState(state.elianaWidgetState === 'expanded' ? 'floating' : 'expanded');
            }
        });
    });

    // Init drag
    initWidgetDrag();

    // Create mini orb in FAB
    if (window.orbCreateInElement) {
        const fabOrb = document.getElementById('eliana-widget-orb-mini');
        if (fabOrb) window.orbCreateInElement(fabOrb, 100);
    }

    // Orb pequeño al lado del nombre "Eliana" en la cabecera del chat
    if (window.orbCreateInElement) {
        const headerOrb = document.getElementById('blinda-orb-container');
        if (headerOrb && !headerOrb.querySelector('canvas')) {
            window.orbCreateInElement(headerOrb, 44);
        }
    }

    // Mensaje de bienvenida inicial (con bocina incluida al ser addBlindaChatBubble)
    const messagesEl = document.getElementById('blinda-chat-messages');
    if (messagesEl && messagesEl.childElementCount === 0) {
        addBlindaChatBubble('Hola, soy Eliana. Pídeme cualquier cosa que necesites mientras jugáis.', 'assistant');
    }

    // Sincronizar estado visual del botón MUTE (bocina grande) con eventos reales de TTS.
    // Se registra una sola vez por sesión (protegido con flag global).
    if (!window.__elianaVoiceBtnTTSHooked) {
        window.__elianaVoiceBtnTTSHooked = true;
        window.addEventListener('tts:start', () => {
            const voiceBtn = document.getElementById('blinda-voice-btn');
            if (voiceBtn) voiceBtn.classList.add('is-tts-playing');
        });
        window.addEventListener('tts:end', () => {
            const voiceBtn = document.getElementById('blinda-voice-btn');
            if (voiceBtn) voiceBtn.classList.remove('is-tts-playing');
        });
    }
}

// ---- Blinda Chat (interacción con Eliana dentro de diapo 3) ----

function isOnBlindaScreen() {
    // v23.8.x: el flujo activo usa `#juego3-screen` + widget `#eliana-widget`.
    // `#blinda-screen` queda como legacy oculto y no debe gobernar el enrutado STT.
    // Basta con que la pantalla juego3 esté visible — da igual el estado del widget
    // (fab/floating/docked/expanded): el audio va siempre a sendBlindaMessage.
    const legacyVisible = elements.blindaScreen && !elements.blindaScreen.classList.contains('hidden');
    const juego3Screen = document.getElementById('juego3-screen');
    const juego3Visible = !!(juego3Screen && !juego3Screen.classList.contains('hidden'));
    return !!legacyVisible || juego3Visible;
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

    // Bocina por burbuja: solo en respuestas de Eliana.
    // Al pulsar reproduce el TTS de ESA respuesta concreta; el pulso visual
    // se limpia con el evento real `tts:end` (no con timeout).
    if (role === 'assistant') {
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'blinda-chat__tts';
        ttsBtn.title = 'Escuchar esta respuesta';
        ttsBtn.setAttribute('aria-label', 'Escuchar respuesta');
        ttsBtn.innerHTML = '<i class="ph ph-speaker-simple-high"></i>';
        ttsBtn.addEventListener('click', () => {
            const content = bubble.textContent.trim();
            if (!content) return;
            // Detiene TTS previo (dispatch `tts:end` limpia cualquier bocina pulsante)
            stopTTS();
            // Pulso en ESTA bocina
            ttsBtn.classList.add('blinda-chat__tts--playing');
            // Listener one-shot para limpiar cuando termine este audio
            const clearPulse = () => {
                ttsBtn.classList.remove('blinda-chat__tts--playing');
                window.removeEventListener('tts:end', clearPulse);
            };
            window.addEventListener('tts:end', clearPulse);
            playTTS(content, true);
        });
        messages.appendChild(ttsBtn);
    }

    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

function sendBlindaMessage(message) {
    // Add user bubble
    addBlindaChatBubble(message, 'user');

    // NOTA: lógica de fases (blindaPhase) y auto-advance con advanceDemoTo ELIMINADA
    // en v23.8.x. Pertenecía al juego legacy "Blinda tu Prompt" (diapo 3 antigua,
    // ahora oculta). El flujo actual "Descubre al agente" no usa fases ni demo DOM.

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
        // En diapo 5 usamos el prompt 'diapo5' (habla del contenido de esa diapo).
        // En el resto (diapo 3 con widget abierto) usamos 'juego3_chat'.
        const activity = isOnDiapo5Screen() ? 'diapo5' : 'juego3_chat';
        const payload = { message, response_mode: 'full', activity_mode: activity };
        state._blindaWs.send(JSON.stringify(payload));
    };

    const handleBlindaMessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[BlindaWS] msg type:', data.type);

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
            // NOTA: bloque de auto-advance por keywords (tarjeta/territorio/opci/etc.) ELIMINADO
            // en v23.8.x. Pertenecía a la demo "Blinda tu Prompt" (diapo 3 legacy). El juego
            // actual "Descubre al agente" no usa demoStep/blindaPhase/checkTerritoryHighlight.
        }
        else if (data.type === 'end') {
            if (state._blindaSmdParser) {
                window.smd.parser_end(state._blindaSmdParser);
                state._blindaSmdParser = null;
            }
            // TTS: solo si el usuario invocó por voz (Fix #1) o ttsEnabled explícito.
            if (state.currentMessage && (state.ttsEnabled || state.voiceTriggered)) {
                playTTS(state.currentMessage, true);
            }
            // Reset del flag voz: el próximo turno empieza limpio (texto → silencioso).
            state.voiceTriggered = false;
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
    // Diapo 4 legacy bloqueada: cualquier intento de abrirla redirige a diapo 3.
    elements.juegoScreen?.classList.add('hidden');
    if (typeof showJuego3Screen === 'function') {
        showJuego3Screen();
    }
    return;

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
    elements.juegoScreen?.classList.add('hidden');
    // Si se invoca por código antiguo, salir hacia diapo 3 y no a blinda legacy.
    if (typeof showJuego3Screen === 'function') {
        showJuego3Screen();
    }
}

// ============================================
// DIAPO 5 — Saca el agente que llevas dentro (v23.16.4)
// 4 pasos secuenciales con transiciones fade-blur.
// Avance manual con flechas del header.
// ============================================

const DIAPO5_TOTAL_STEPS = 4;
const DIAPO5_COMMUNITY_URL = 'https://forms.hablandis.com/hablandis/form/elencuentroeleMiln/formperma/RZKSb0WA04Szly2Z32iJ1i6yml9-5md5qPNbw2hCQ8A';

// Paso 1 — Morphing text (ingredientes)
const DIAPO5_MORPH_WORDS = [
    'Pedagogía', 'Lingüística ELE', 'MCER', 'Errores por L1',
    'Cultura', 'Empatía', 'Tu estilo'
];
const DIAPO5_MORPH_TIME = 1.6;       // tiempo de transición entre palabras (s)
const DIAPO5_MORPH_COOLDOWN = 0.7;   // tiempo de "lectura" entre transiciones (s)

// Paso 2 — Split central (estático, sin animación JS necesaria)

// Paso 3 — Terminal manifiesto (con 2 sublíneas profe/agente por letra)
const DIAPO5_ELITE_LINES = [
    { letter: 'E', word: 'Empático',  profe: 'escuchas al alumno',          agente: 'lee el contexto del aula' },
    { letter: 'L', word: 'Leal',      profe: 'fiel a tu rúbrica',           agente: 'respeta tus criterios' },
    { letter: 'I', word: 'Intuitivo', profe: 'sabes qué pasa en clase',     agente: 'anticipa al alumno' },
    { letter: 'T', word: 'Tenaz',     profe: 'terminas lo empezado',        agente: 'no desiste con el error' },
    { letter: 'E', word: 'Elegante',  profe: 'explicas con gracia',         agente: 'entrega siempre' }
];

// State (no toca al state global — variables module-level)
let _diapo5Step = 1;
let _diapo5MorphRAF = null;
let _diapo5TerminalTimer = null;

function showDiapo5Screen() {
    if (isMobile()) { showFinalScreen(); return; }
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

    // Reset al paso 1 sin transición
    _diapo5Step = 1;
    document.querySelectorAll('#diapo5-stage .diapo5-step').forEach(el => {
        el.classList.remove('is-active', 'is-leaving');
    });
    document.querySelector('#diapo5-stage .diapo5-step[data-step="1"]')?.classList.add('is-active');

    // Init estáticos (idempotentes)
    initDiapo5QR();

    // Mostrar el widget Eliana flotante global (mismo orb que en diapo 3 y 4)
    const elianaWidget = document.getElementById('eliana-widget');
    if (elianaWidget) {
        elianaWidget.classList.remove('hidden');
        if (typeof setWidgetState === 'function') setWidgetState('fab');
        if (!_diapo5ElianaInit && typeof initWidgetListeners === 'function') {
            initWidgetListeners();
            _diapo5ElianaInit = true;
        }
        // Reset del chat con mensaje inicial específico de la diapo 5
        const messagesEl = document.getElementById('blinda-chat-messages');
        if (messagesEl) {
            messagesEl.innerHTML = '';
            addBlindaChatBubble('Hola, soy Eliana. Esta diapo trata de algo concreto: tú ya tienes lo que un agente necesita — pedagogía, MCER, tu estilo. Un mismo agente sirve para ti como profe y para tu alumno. Pregúntame por la dualidad, por ELITE o por la comunidad.', 'assistant');
        }
    }

    // Arranca la animación del paso 1
    _diapo5RunStep(1);
}
let _diapo5ElianaInit = false;

function hideDiapo5Screen() {
    _diapo5StopAll();
    stopTTS();
    elements.diapo5Screen?.classList.add('fade-out');
    setTimeout(() => {
        elements.diapo5Screen?.classList.add('hidden');
        elements.diapo5Screen?.classList.remove('fade-out');
        // El widget Eliana lo deja showJuego3Screen() / la diapo siguiente.
        // Volver a diapo 3 para no pasar por la diapo 4 legacy.
        showJuego3Screen();
    }, 300);
}

function isOnDiapo5Screen() {
    return elements.diapo5Screen && !elements.diapo5Screen.classList.contains('hidden');
}

// ──────────── Navegación entre pasos ────────────
function diapo5NextStep() {
    if (_diapo5Step >= DIAPO5_TOTAL_STEPS) {
        // Último paso → diapo 6 "IA para estudiantes" (Strategos)
        _diapo5StopAll();
        elements.diapo5Screen?.classList.add('fade-out');
        setTimeout(() => {
            elements.diapo5Screen?.classList.add('hidden');
            elements.diapo5Screen?.classList.remove('fade-out');
            if (typeof showDiapo6Screen === 'function') showDiapo6Screen();
            else if (typeof showFinalScreen === 'function') showFinalScreen();
        }, 300);
        return;
    }
    _diapo5GoToStep(_diapo5Step + 1);
}

function diapo5PrevStep() {
    if (_diapo5Step <= 1) {
        hideDiapo5Screen();
        return;
    }
    _diapo5GoToStep(_diapo5Step - 1);
}

function _diapo5GoToStep(target) {
    if (!isOnDiapo5Screen()) return;
    if (target < 1 || target > DIAPO5_TOTAL_STEPS) return;
    if (target === _diapo5Step) return;

    const stage = document.getElementById('diapo5-stage');
    if (!stage) return;

    // Detener animaciones del paso saliente
    _diapo5StopStep(_diapo5Step);

    const outgoing = stage.querySelector(`.diapo5-step[data-step="${_diapo5Step}"]`);
    const incoming = stage.querySelector(`.diapo5-step[data-step="${target}"]`);

    outgoing?.classList.remove('is-active');
    outgoing?.classList.add('is-leaving');
    incoming?.classList.remove('is-leaving');
    // Force reflow para que la transición arranque desde el estado inicial
    void incoming?.offsetWidth;
    incoming?.classList.add('is-active');

    setTimeout(() => outgoing?.classList.remove('is-leaving'), 700);

    _diapo5Step = target;
    // Lanzar animaciones del paso entrante con un pequeño delay para que
    // el fade-blur tenga tiempo de empezar antes de la animación interna.
    setTimeout(() => _diapo5RunStep(target), 120);
}

function _diapo5RunStep(step) {
    if (step === 1) _diapo5StartMorph();
    else if (step === 3) _diapo5StartTerminal();
    // step 2 es estático (split central con agente unificador).
    // step 4 es estático (card neón con QR).
}

function _diapo5StopStep(step) {
    if (step === 1) _diapo5StopMorph();
    else if (step === 3) _diapo5StopTerminal();
}

function _diapo5StopAll() {
    _diapo5StopMorph();
    _diapo5StopTerminal();
}

// Sincroniza el contador interno de paso (usado por el deep-link snap directo
// para que diapo5NextStep / diapo5PrevStep partan del paso correcto tras el salto).
function _diapo5SyncStep(n) {
    if (typeof n === 'number' && n >= 1 && n <= DIAPO5_TOTAL_STEPS) {
        _diapo5Step = n;
    }
}

// ──────────── PASO 1 — Morphing text ────────────
function _diapo5StartMorph() {
    _diapo5StopMorph();
    const wrap = document.getElementById('diapo5-morph');
    if (!wrap) return;
    const a = wrap.querySelector('.diapo5-morph__text--a');
    const b = wrap.querySelector('.diapo5-morph__text--b');
    if (!a || !b) return;

    let textIndex = 0;
    let morphProg = 0;        // progreso dentro de una transición
    let coolProg = 0;         // tiempo de cooldown (texto estable)
    let lastTime = performance.now();

    a.textContent = DIAPO5_MORPH_WORDS[0];
    b.textContent = DIAPO5_MORPH_WORDS[1 % DIAPO5_MORPH_WORDS.length];

    const setStyles = (frac) => {
        // frac 0..1: 0 = texto A visible, 1 = texto B visible
        const inv = 1 - frac;
        b.style.filter  = `blur(${Math.min(8 / Math.max(frac, 0.001) - 8, 100)}px)`;
        b.style.opacity = `${Math.pow(frac, 0.4)}`;
        a.style.filter  = `blur(${Math.min(8 / Math.max(inv, 0.001) - 8, 100)}px)`;
        a.style.opacity = `${Math.pow(inv, 0.4)}`;
    };

    const tick = (now) => {
        if (!isOnDiapo5Screen() || _diapo5Step !== 1) {
            _diapo5StopMorph();
            return;
        }
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        if (coolProg > 0) {
            // Estado estable: A visible, B oculto
            coolProg -= dt;
            a.style.opacity = '1';
            a.style.filter  = 'blur(0)';
            b.style.opacity = '0';
            b.style.filter  = 'blur(0)';
        } else {
            morphProg += dt;
            let frac = morphProg / DIAPO5_MORPH_TIME;
            if (frac >= 1) {
                frac = 1;
                setStyles(frac);
                // Cierra transición: avanza índice y resetea
                textIndex++;
                a.textContent = DIAPO5_MORPH_WORDS[textIndex % DIAPO5_MORPH_WORDS.length];
                b.textContent = DIAPO5_MORPH_WORDS[(textIndex + 1) % DIAPO5_MORPH_WORDS.length];
                morphProg = 0;
                coolProg = DIAPO5_MORPH_COOLDOWN;
            } else {
                setStyles(frac);
            }
        }
        _diapo5MorphRAF = requestAnimationFrame(tick);
    };
    _diapo5MorphRAF = requestAnimationFrame(tick);
}

function _diapo5StopMorph() {
    if (_diapo5MorphRAF) {
        cancelAnimationFrame(_diapo5MorphRAF);
        _diapo5MorphRAF = null;
    }
}

// (v23.16.8) Paso 2 ya no tiene flip — se sustituyó por split central estático.

// ──────────── PASO 3 — Terminal manifiesto (2 columnas PROFE/AGENTE) ────────────
const _diapo5EscapeHtml = (s) => s.replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));

function _diapo5StartTerminal() {
    _diapo5StopTerminal();
    const body = document.getElementById('diapo5-terminal-body');
    if (!body) return;
    body.innerHTML = '';

    // Pre-creamos un bloque por letra: header (E.  Empático) + 2 sublíneas (profe / agente)
    const blocks = DIAPO5_ELITE_LINES.map(() => {
        const block = document.createElement('div');
        block.className = 'diapo5-terminal__line';
        const head  = document.createElement('div'); head.className  = 'diapo5-terminal__head';
        const sub1  = document.createElement('div'); sub1.className  = 'diapo5-terminal__sub diapo5-terminal__sub--profe';
        const sub2  = document.createElement('div'); sub2.className  = 'diapo5-terminal__sub diapo5-terminal__sub--agente';
        block.append(head, sub1, sub2);
        body.appendChild(block);
        return { head, sub1, sub2 };
    });

    // Cursor fijo al final del body
    const cursor = document.createElement('span');
    cursor.className = 'diapo5-terminal__cursor';
    cursor.innerHTML = '&nbsp;';
    body.appendChild(cursor);

    // Por cada letra hay 3 fases de tecleo: head, sub-profe, sub-agente
    let lineIdx = 0;
    let phase = 0;     // 0 = head, 1 = sub-profe, 2 = sub-agente
    let charIdx = 0;

    const headTextOf = (l) => `> ${l.letter}.  ${l.word}.`;
    const subProfeOf  = (l) => l.profe;
    const subAgenteOf = (l) => l.agente;

    const renderHead = (full, partial) => {
        const data = DIAPO5_ELITE_LINES[lineIdx];
        const promptStr = '> ';
        const letterStr = `${data.letter}.`;
        const wordStr   = `  ${data.word}.`;
        const totalPrompt = promptStr.length;
        const totalLetter = totalPrompt + letterStr.length;
        let html = '';
        if (charIdx <= totalPrompt) {
            html = `<span class="prompt">${_diapo5EscapeHtml(partial)}</span>`;
        } else if (charIdx <= totalLetter) {
            html = `<span class="prompt">${_diapo5EscapeHtml(promptStr)}</span>`
                 + `<span class="letter">${_diapo5EscapeHtml(partial.slice(totalPrompt))}</span>`;
        } else {
            html = `<span class="prompt">${_diapo5EscapeHtml(promptStr)}</span>`
                 + `<span class="letter">${_diapo5EscapeHtml(letterStr)}</span>`
                 + `<span class="word">${_diapo5EscapeHtml(partial.slice(totalLetter))}</span>`;
        }
        blocks[lineIdx].head.innerHTML = html;
    };

    const renderSub = (kind, full, partial) => {
        // El "partial" ahora ya NO tiene la etiqueta — el label es estático en el DOM
        // y solo se teclea el texto. Pintamos label fijo + text parcial.
        const label = kind === 'profe' ? 'PROFE' : 'AGENTE';
        const html =
            `<span class="diapo5-terminal__sub-label">${label}</span>`
            + `<span class="diapo5-terminal__sub-text">${_diapo5EscapeHtml(partial)}</span>`;
        const targetEl = kind === 'profe' ? blocks[lineIdx].sub1 : blocks[lineIdx].sub2;
        targetEl.innerHTML = html;
    };

    const typeStep = () => {
        if (!isOnDiapo5Screen() || _diapo5Step !== 3) {
            _diapo5StopTerminal();
            return;
        }
        if (lineIdx >= DIAPO5_ELITE_LINES.length) return; // terminado

        const data = DIAPO5_ELITE_LINES[lineIdx];
        let full;
        if (phase === 0)      full = headTextOf(data);
        else if (phase === 1) full = subProfeOf(data);
        else                  full = subAgenteOf(data);

        charIdx++;
        const partial = full.slice(0, charIdx);
        if (phase === 0) renderHead(full, partial);
        else if (phase === 1) renderSub('profe', full, partial);
        else renderSub('agente', full, partial);

        if (charIdx >= full.length) {
            phase++;
            charIdx = 0;
            if (phase > 2) {
                phase = 0;
                lineIdx++;
            }
            // Pausa más larga entre fases / líneas
            _diapo5TerminalTimer = setTimeout(typeStep, phase === 0 ? 320 : 180);
        } else {
            _diapo5TerminalTimer = setTimeout(typeStep, 18 + Math.random() * 18);
        }
    };
    // Pequeño delay inicial para que la transición entre antes de empezar a teclear
    _diapo5TerminalTimer = setTimeout(typeStep, 400);
}

function _diapo5StopTerminal() {
    if (_diapo5TerminalTimer) {
        clearTimeout(_diapo5TerminalTimer);
        _diapo5TerminalTimer = null;
    }
}

// ──────────── QR estático (paso 4) ────────────
function initDiapo5QR() {
    const container = document.getElementById('diapo5-qr');
    if (!container || container.dataset.rendered === 'true') return;
    if (typeof window.qrcode !== 'function') {
        console.warn('[Diapo5] qrcode-generator no cargado');
        return;
    }
    try {
        const qr = window.qrcode(0, 'M');
        qr.addData(DIAPO5_COMMUNITY_URL);
        qr.make();
        container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        container.dataset.rendered = 'true';
    } catch (err) {
        console.error('[Diapo5] Error generando QR:', err);
    }
}

// (v23.16.7) initDiapo5ElianaOrb eliminado: el orb del paso 4 se sustituye
// por el widget global .eliana-widget que aparece en TODOS los pasos
// (mismo widget que ya se usa en diapo 3 y 4).

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
// DIAPO 6 — IA para estudiantes (Strategos) — v23.18.0
// 4 pasos secuenciales con transiciones slide horizontal.
// Arquitectura clonada de DIAPO 5. Contenido de los pasos pendiente.
// ============================================

const DIAPO6_TOTAL_STEPS = 4;

// Paso 1 — layout-text-flip
const DIAPO6_FLIP_WORDS = ['una TARJETA', 'un AGENTE', 'una ESTRATEGIA'];
const DIAPO6_FLIP_INTERVAL_MS = 3000;

// State module-level
let _diapo6Step = 1;
let _diapo6ElianaInit = false;
let _diapo6FlipTimer = null;
let _diapo6FlipIndex = 0;

function showDiapo6Screen() {
    // Solo escritorio (bypass en móvil como la 5)
    if (isMobile()) {
        console.warn('[Diapo6] Solo escritorio — bypass en móvil');
        return;
    }
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

    const screen = document.getElementById('diapo6-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    screen.classList.remove('fade-out');

    // Reset al paso 1 sin transición
    _diapo6Step = 1;
    document.querySelectorAll('#diapo6-stage .diapo6-step').forEach(el => {
        el.classList.remove('is-active', 'is-leaving');
    });
    document.querySelector('#diapo6-stage .diapo6-step[data-step="1"]')?.classList.add('is-active');

    // Widget Eliana flotante global (mismo patrón que diapo 5)
    const elianaWidget = document.getElementById('eliana-widget');
    if (elianaWidget) {
        elianaWidget.classList.remove('hidden');
        if (typeof setWidgetState === 'function') setWidgetState('fab');
        if (!_diapo6ElianaInit && typeof initWidgetListeners === 'function') {
            initWidgetListeners();
            _diapo6ElianaInit = true;
        }
    }

    _diapo6RunStep(1);
}

function hideDiapo6Screen() {
    _diapo6StopAll();
    stopTTS();
    const screen = document.getElementById('diapo6-screen');
    if (!screen) return;
    screen.classList.add('fade-out');
    setTimeout(() => {
        screen.classList.add('hidden');
        screen.classList.remove('fade-out');
        if (typeof showDiapo5Screen === 'function') showDiapo5Screen();
    }, 300);
}

function isOnDiapo6Screen() {
    const screen = document.getElementById('diapo6-screen');
    return !!screen && !screen.classList.contains('hidden');
}

// ──────────── Navegación entre pasos ────────────
function diapo6NextStep() {
    if (_diapo6Step >= DIAPO6_TOTAL_STEPS) {
        // v23.19.0 — último paso de diapo 6 ahora salta a diapo 7 (LucAPI)
        _diapo6StopAll();
        const screen = document.getElementById('diapo6-screen');
        screen?.classList.add('fade-out');
        setTimeout(() => {
            screen?.classList.add('hidden');
            screen?.classList.remove('fade-out');
            if (typeof showDiapo7Screen === 'function') showDiapo7Screen();
        }, 300);
        return;
    }
    _diapo6GoToStep(_diapo6Step + 1);
}

function diapo6PrevStep() {
    if (_diapo6Step <= 1) {
        hideDiapo6Screen();
        return;
    }
    _diapo6GoToStep(_diapo6Step - 1);
}

function _diapo6GoToStep(target) {
    if (!isOnDiapo6Screen()) return;
    if (target < 1 || target > DIAPO6_TOTAL_STEPS) return;
    if (target === _diapo6Step) return;

    const stage = document.getElementById('diapo6-stage');
    if (!stage) return;

    _diapo6StopStep(_diapo6Step);

    const outgoing = stage.querySelector(`.diapo6-step[data-step="${_diapo6Step}"]`);
    const incoming = stage.querySelector(`.diapo6-step[data-step="${target}"]`);

    outgoing?.classList.remove('is-active');
    outgoing?.classList.add('is-leaving');
    incoming?.classList.remove('is-leaving');
    void incoming?.offsetWidth;
    incoming?.classList.add('is-active');

    setTimeout(() => outgoing?.classList.remove('is-leaving'), 700);

    _diapo6Step = target;
    setTimeout(() => _diapo6RunStep(target), 120);
}

function _diapo6RunStep(step) {
    if (step === 1) _diapo6StartFlipLayout();
    // pasos 2, 3, 4 pendientes
}

function _diapo6StopStep(step) {
    if (step === 1) _diapo6StopFlipLayout();
}

function _diapo6StopAll() {
    _diapo6StopFlipLayout();
}

// ──────────── PASO 1 — Layout text flip cycling (v23.18.1) ────────────
function _diapo6StartFlipLayout() {
    _diapo6StopFlipLayout();
    const pill = document.getElementById('diapo6-flip-pill');
    if (!pill) return;

    _diapo6FlipIndex = 0;
    // Asegura palabra inicial visible sin animación
    let current = pill.querySelector('.diapo6-flip-layout__word');
    if (current) {
        current.textContent = DIAPO6_FLIP_WORDS[0];
        current.classList.remove('is-entering', 'is-exiting');
    }

    _diapo6FlipTimer = setInterval(() => {
        if (!isOnDiapo6Screen() || _diapo6Step !== 1) {
            _diapo6StopFlipLayout();
            return;
        }
        const pillEl = document.getElementById('diapo6-flip-pill');
        if (!pillEl) return;
        const outgoing = pillEl.querySelector('.diapo6-flip-layout__word:not(.is-exiting)');
        if (!outgoing) return;

        _diapo6FlipIndex = (_diapo6FlipIndex + 1) % DIAPO6_FLIP_WORDS.length;
        const nextText = DIAPO6_FLIP_WORDS[_diapo6FlipIndex];

        // Saliente: animar exit y quitar al terminar
        outgoing.classList.add('is-exiting');
        setTimeout(() => outgoing.remove(), 520);

        // Entrante: crear nuevo span justo detrás (mismo momento para solape visual)
        const incoming = document.createElement('span');
        incoming.className = 'diapo6-flip-layout__word is-entering';
        incoming.textContent = nextText;
        pillEl.appendChild(incoming);
        setTimeout(() => incoming.classList.remove('is-entering'), 520);
    }, DIAPO6_FLIP_INTERVAL_MS);
}

function _diapo6StopFlipLayout() {
    if (_diapo6FlipTimer) {
        clearInterval(_diapo6FlipTimer);
        _diapo6FlipTimer = null;
    }
}

// Sincroniza _diapo6Step para el deep-link snap directo
function _diapo6SyncStep(n) {
    if (typeof n === 'number' && n >= 1 && n <= DIAPO6_TOTAL_STEPS) {
        _diapo6Step = n;
    }
}

// ============================================
// DIAPO 8 — Construye tu Agente (Plataforma)
// ============================================
const DIAPO7_INGREDIENTS = [
    { icon: 'ph-fill ph-identification-badge', label: 'Nombre y descripción', desc: 'Identidad del agente: qué hace y para qué sirve', color: '#7EC8E3' },
    { icon: 'ph-fill ph-brain', label: 'System Prompt', desc: 'El cerebro: instrucciones que definen su personalidad y comportamiento', color: '#D0AAD1' },
    { icon: 'ph-fill ph-cpu', label: 'Modelo de IA', desc: 'El motor: qué modelo de lenguaje usa (DeepSeek, GPT, Claude...)', color: '#D0E8E9' },
    { icon: 'ph-fill ph-thermometer-simple', label: 'Temperatura', desc: 'Creatividad vs precisión: de 0 (exacto) a 2 (creativo)', color: '#F48FB1' },
    { icon: 'ph-fill ph-graduation-cap', label: 'Nivel MCER', desc: 'A1, A2, B1... el agente adapta su lenguaje al nivel del alumno', color: '#81C784' },
    { icon: 'ph-fill ph-sliders-horizontal', label: 'Adherencia al nivel', desc: 'Cuánto debe ceñirse al nivel: flexible o estricto', color: '#FFB74D' }
];

const DIAPO7_ACTIVITY_TYPES = [
    { icon: 'ph-fill ph-chat-circle-text', label: 'Expresión oral', color: '#7EC8E3' },
    { icon: 'ph-fill ph-book-open-text', label: 'Comprensión lectora', color: '#D0E8E9' },
    { icon: 'ph-fill ph-text-aa', label: 'Vocabulario', color: '#81C784' },
    { icon: 'ph-fill ph-headphones', label: 'Comprensión auditiva', color: '#B39DDB' },
    { icon: 'ph-fill ph-pencil-line', label: 'Gramática', color: '#F48FB1' },
    { icon: 'ph-fill ph-pen-nib', label: 'Escritura', color: '#FFB74D' },
    { icon: 'ph-fill ph-speaker-high', label: 'Pronunciación', color: '#2A9FCC' },
    { icon: 'ph-fill ph-check-square', label: 'Autoevaluación', color: '#D0AAD1' },
    { icon: 'ph-fill ph-users-three', label: 'Interacción oral', color: '#6B8F71' },
    { icon: 'ph-fill ph-textbox', label: 'Ortografía', color: '#C9A632' }
];

const DIAPO7_STRUCTURES = [
    'Opción múltiple', 'Completar huecos', 'Verdadero/Falso', 'Relacionar',
    'Ordenar', 'Respuesta corta', 'Diálogo', 'Redacción', 'Respuesta abierta'
];

const DIAPO7_TOTAL_STEPS = 5;
let diapo7Step = 0;

function showDiapo7Screen() {
    // v23.19.0 — Diapo 7 · LucAPI Comprensión lectora (esqueleto — fase A)
    if (typeof hideAllScreens === 'function') hideAllScreens();
    elements.diapo7Screen = document.getElementById('diapo7-screen');
    elements.diapo7Screen?.classList.remove('hidden', 'fade-out');
    elements.diapo7Screen?.scrollTo?.(0, 0);
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

    // Check if user message (Román) triggers advance
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
            <i class="ph-fill ph-puzzle-piece" style="background: rgba(153,78,149,0.15); color: #D0AAD1"></i>
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
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #D0AAD122 0%, rgba(239,237,247,0.5) 100%); border-color: #D0AAD133">
                <div class="diapo7-ingredient-card__icon" style="background: #D0AAD122; color: #D0AAD1">
                    <i class="ph-fill ph-list-bullets"></i>
                </div>
                <div class="diapo7-ingredient-card__text">
                    <strong>10 tipos de actividad</strong>
                    <span>Expresión oral, comprensión lectora, vocabulario, gramática, escritura, pronunciación, autoevaluación, interacción oral, ortografía, comprensión auditiva</span>
                </div>
            </div>
            <div class="diapo7-ingredient-card" style="background: linear-gradient(160deg, #D0E8E922 0%, rgba(239,237,247,0.5) 100%); border-color: #D0E8E933">
                <div class="diapo7-ingredient-card__icon" style="background: #D0E8E922; color: #D0E8E9">
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
            <i class="ph-fill ph-chalkboard-teacher" style="background: rgba(212,130,106,0.15); color: #C9A632"></i>
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
// ============================================
// (Función showMobileEncuesta eliminada: encuesta legacy retirada en v23.17.1)

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
// Diapo 03 — Juego "Descubre al agente" (juego3)
// ============================================
const juego3 = {
    cards: null,
    ws: null,
    retryMs: 1500,
    currentCard: -1,
    phase: 'idle',       // idle | voting | revealed | ended
    total: 10,
    tally: { A: 0, B: 0, C: 0 },
    widgetExpanded: false,
    widgetOrb: null,     // three.js orb instance
    elianaOrb: null,     // three.js orb for final screen
    elianaStreaming: false,
    // Métricas simples de sesión — útiles en taller real para saber si la pantalla
    // final está cayendo al "último recurso" (fetch + LLM fallando). Inspeccionable
    // desde DevTools: `juego3.metrics`
    metrics: {
        ultimo_recurso_count: 0,
        ultimo_recurso_reasons: [],  // [{ts, fetch_failed, ws_error, no_tokens}]
        summary_fetch_fail_count: 0,
        llm_error_count: 0,
    },
};

const JUEGO3_FORMAT_META = {
    'casting':              { icon: 'ph-chats-circle', label: 'Casting',              color: '#D0AAD1' },
    'misma-orden':          { icon: 'ph-flask',        label: 'Misma orden',          color: '#C9A632' },
    'mientras-no-estabas':  { icon: 'ph-moon',         label: 'Mientras no estabas',  color: '#6B2F6D' },
    'titular':              { icon: 'ph-newspaper',    label: 'Titular',              color: '#8CBEB2' },
};

async function loadJuego3Cards() {
    if (juego3.cards) return juego3.cards;
    try {
        const res = await fetch('/api/juego3/cards');
        const data = await res.json();
        juego3.cards = data.cards;
        juego3.total = data.total || 10;
        return juego3.cards;
    } catch (e) {
        console.error('[Juego3] Error cargando cartas', e);
        return [];
    }
}

function connectJuego3Dashboard() {
    const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/juego3-dashboard`;
    juego3.ws = new WebSocket(url);
    juego3.ws.onopen = () => { juego3.retryMs = 1500; console.log('[Juego3] dashboard conectado'); };
    juego3.ws.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'state') {
                juego3.currentCard = msg.current_card;
                juego3.phase = msg.phase;
                juego3.total = msg.total;
                if (msg.n_vivo != null) juego3.nVivo = msg.n_vivo;
                if (msg.n_sesion != null) juego3.nSesion = msg.n_sesion;
                renderJuego3();
            } else if (msg.type === 'tally' && msg.card === juego3.currentCard) {
                juego3.tally = msg.votes;
                if (msg.n_vivo != null) juego3.nVivo = msg.n_vivo;
                renderJuego3Bars();
            } else if (msg.type === 'summary') {
                juego3.summary = msg.data;
                // Si el proyector está en estado revealed, refrescar el donut acumulativo
                // con los nuevos datos agregados.
                if (juego3.phase === 'revealed' && typeof renderJuego3Cumulative === 'function') {
                    renderJuego3Cumulative();
                }
                // REFRESCAR fallback de pantalla final SOLO si ya existe (lo creó el
                // timeout de startJuego3ElianaFinal tras 2s sin tokens). Nunca crear
                // desde aquí — si el LLM está streameando o aún no se abrió la pantalla
                // final, el strip no debe aparecer.
                const fbExists = document.getElementById('juego3-eliana-fallback');
                if (fbExists && typeof renderJuego3ElianaFallback === 'function') {
                    renderJuego3ElianaFallback();
                }
            }
        } catch (e) { /* ignore */ }
    };
    juego3.ws.onclose = () => {
        setTimeout(() => { juego3.retryMs = Math.min(juego3.retryMs * 1.5, 10000); connectJuego3Dashboard(); }, juego3.retryMs);
    };
    juego3.ws.onerror = () => { try { juego3.ws.close(); } catch (_) {} };
}

function sendJuego3Cmd(type) {
    if (juego3.ws && juego3.ws.readyState === WebSocket.OPEN) {
        juego3.ws.send(JSON.stringify({ type }));
    }
}

async function showJuego3Screen() {
    stopTTS();
    // Mantener la preferencia actual del usuario (MUTE/voz activa) en juego3.
    state.voiceTriggered = false;
    document.querySelectorAll('.main-content, #login-screen, #welcome-screen').forEach(el => el.classList.add('hidden'));
    const screen = document.getElementById('juego3-screen');
    if (!screen) return;
    screen.classList.remove('hidden');

    // Mostrar el widget flotante de Eliana (reutiliza el widget del proyecto con sus 4 estados)
    const widget = document.getElementById('eliana-widget');
    if (widget) {
        widget.classList.remove('hidden');
        if (!juego3.elianaWidgetInit) {
            if (typeof setWidgetState === 'function') setWidgetState('fab');
            if (typeof initWidgetListeners === 'function') initWidgetListeners();
            juego3.elianaWidgetInit = true;
        } else {
            if (typeof setWidgetState === 'function') setWidgetState('fab');
        }
    }

    await loadJuego3Cards();
    if (!juego3.ws || juego3.ws.readyState === WebSocket.CLOSED) {
        connectJuego3Dashboard();
    }
    renderJuego3();
}

function hideJuego3Screen() {
    const screen = document.getElementById('juego3-screen');
    if (!screen) return;
    screen.classList.add('hidden');
    if (_juego3CardTTSTimer) {
        clearTimeout(_juego3CardTTSTimer);
        _juego3CardTTSTimer = null;
    }
    // Ocultar widget de Eliana al salir
    const widget = document.getElementById('eliana-widget');
    if (widget) widget.classList.add('hidden');
}

function renderJuego3() {
    const idle = document.getElementById('juego3-idle');
    const play = document.getElementById('juego3-play');
    const ended = document.getElementById('juego3-ended');
    const eliana = document.getElementById('juego3-eliana-screen');
    if (!idle || !play || !ended || !eliana) return;

    // Reset visibility
    [idle, play, ended, eliana].forEach(el => el.classList.add('hidden'));

    if (juego3.currentCard < 0 || juego3.phase === 'idle') {
        idle.classList.remove('hidden');
        _juego3LastTTSCardIdx = -1; // Reset para que TTS arranque en carta 0 si se reinicia
        _juego3TTSInFlight = false;  // Liberar lock por si quedó colgado
        if (_juego3CardTTSTimer) {
            clearTimeout(_juego3CardTTSTimer);
            _juego3CardTTSTimer = null;
        }
        return;
    }

    if (juego3.phase === 'ended' && !juego3.elianaStreaming) {
        ended.classList.remove('hidden');
        return;
    }

    if (juego3.elianaStreaming) {
        eliana.classList.remove('hidden');
        return;
    }

    // Jugando: mostrar split
    play.classList.remove('hidden');
    renderJuego3Card();
    renderJuego3Bars();
    updateJuego3Controls();
}

function renderJuego3Card() {
    if (!juego3.cards) return;
    const card = juego3.cards[juego3.currentCard];
    if (!card) return;

    const container = document.getElementById('juego3-card');
    const areaEl = document.getElementById('juego3-area');
    const iconEl = document.getElementById('juego3-card-icon');
    const numEl = document.getElementById('juego3-card-num');
    const backEl = document.getElementById('juego3-card-back');
    const questionEl = document.getElementById('juego3-question');
    const optsEl = document.getElementById('juego3-opts');
    const explainEl = document.getElementById('juego3-explain');
    const progressEl = document.getElementById('juego3-progress');

    const fmt = JUEGO3_FORMAT_META[card.formato] || { icon: 'ph-circle', label: card.formato };
    const color = '#6B2F6D'; // color único para todas las cartas (violeta oscuro Eliana)

    // Frente: enunciado en lugar del area (que era spoiler)
    if (areaEl) areaEl.textContent = card.enunciado_frente || card.pregunta || '';
    if (iconEl) iconEl.className = `ph-fill ${fmt.icon} juego3-card__front-icon`;
    if (numEl) numEl.textContent = `${juego3.currentCard + 1} / ${juego3.total}`;
    questionEl.textContent = card.pregunta;
    progressEl.textContent = `${juego3.currentCard + 1} / ${juego3.total}`;

    // Color dinámico por CSS variables
    if (container) {
        container.style.setProperty('--juego3-card-color', color);
        container.style.setProperty('--juego3-card-color-soft', `${color}bb`);
    }

    container.className = `juego3-card juego3-card--${card.formato}`;

    // Chip del concepto (area) al inicio del dorso — solo tras el reveal
    if (backEl) {
        const existingChip = backEl.querySelector('.juego3-card__area-chip');
        if (existingChip) existingChip.remove();
        if (juego3.phase === 'revealed' && card.area) {
            const chip = document.createElement('div');
            chip.className = 'juego3-card__area-chip';
            chip.innerHTML = `<i class="ph-fill ph-check-circle"></i><span>Concepto: ${card.area}</span>`;
            backEl.insertBefore(chip, backEl.firstChild);
        }
    }

    // Opciones
    optsEl.innerHTML = card.opciones.map(op => {
        let cls = 'juego3-opt';
        if (juego3.phase === 'revealed') {
            if (op.letra === card.correcta) cls += ' juego3-opt--correct';
            else cls += ' juego3-opt--wrong';
        }
        return `
            <li class="${cls}">
                <span class="juego3-opt__letter">${op.letra}</span>
                <span class="juego3-opt__body">
                    <i class="ph-fill ${op.icono} juego3-opt__icon"></i>
                    <span class="juego3-opt__text">${op.texto}</span>
                </span>
            </li>
        `;
    }).join('');

    // Explicación (solo si revelado)
    if (juego3.phase === 'revealed') {
        explainEl.classList.remove('hidden');
        explainEl.innerHTML = `
            <div class="juego3-card__explain-row">
                <span class="juego3-card__explain-tag juego3-card__explain-tag--chatbot">Chatbot</span>
                <span>${card.explicaciones.chatbot}</span>
            </div>
            <div class="juego3-card__explain-row">
                <span class="juego3-card__explain-tag juego3-card__explain-tag--asistente">Asistente</span>
                <span>${card.explicaciones.asistente}</span>
            </div>
            <div class="juego3-card__explain-row">
                <span class="juego3-card__explain-tag juego3-card__explain-tag--agente">Agente</span>
                <span>${card.explicaciones.agente}</span>
            </div>
        `;
    } else {
        explainEl.classList.add('hidden');
        explainEl.innerHTML = '';
    }

    // TTS automático: Eliana lee el enunciado + el intro al abrir cada carta
    // Solo si el profesor no ha muteado (respeta state.ttsEnabled)
    triggerJuego3CardTTS(card);
}

// TTS automático al abrir una carta nueva — es parte del juego, siempre suena
// Lee SOLO el enunciado del frente. No intro, no pregunta, no opciones.
//
// Robustez (v23.13.12):
//  - Guard por carta: _juego3LastTTSCardIdx evita re-disparo al re-render.
//  - Token ttsRequestId de playTTS: evita carrera entre fetches lentos de cartas
//    consecutivas (bug del reviser: carta 2 se cortaba/duplicaba 2/5 veces).
//  - Lock _juego3TTSInFlight: si ya hay un playTTS en vuelo para esta carta
//    (caso edge de doble click o state repetido), no relanzamos.
//  - Logs con prefijo [tts_card_*] para diagnóstico en taller real.
let _juego3LastTTSCardIdx = -1;
let _juego3CardTTSTimer = null;
let _juego3TTSInFlight = false;  // true entre setTimeout y playTTS efectivo
function triggerJuego3CardTTS(card) {
    if (!card) return;
    if (juego3.phase !== 'voting') return; // Solo antes del reveal
    if (_juego3LastTTSCardIdx === juego3.currentCard) {
        console.log(`[tts_card_skip] card=${juego3.currentCard} reason=already_fired_for_this_card`);
        return;
    }
    if (_juego3TTSInFlight) {
        console.log(`[tts_card_skip] card=${juego3.currentCard} reason=in_flight`);
        return;
    }

    const text = card.enunciado_frente;
    if (!text) return;

    _juego3LastTTSCardIdx = juego3.currentCard;
    _juego3TTSInFlight = true;

    if (_juego3CardTTSTimer) {
        clearTimeout(_juego3CardTTSTimer);
        _juego3CardTTSTimer = null;
    }

    const scheduledIdx = juego3.currentCard;
    console.log(`[tts_card_start] card=${scheduledIdx} req_pending=true`);
    // Pequeño delay para que la transición visual termine antes del audio
    _juego3CardTTSTimer = setTimeout(async () => {
        _juego3CardTTSTimer = null;
        // Revalidar: la carta pudo haber cambiado durante los 400ms
        if (juego3.currentCard !== scheduledIdx || juego3.phase !== 'voting') {
            console.log(`[tts_card_abort_stale] card=${scheduledIdx} current=${juego3.currentCard} phase=${juego3.phase}`);
            _juego3TTSInFlight = false;
            return;
        }
        if (typeof playTTS === 'function') {
            const reqAtStart = (state.ttsRequestId || 0) + 1; // predicción del siguiente id
            console.log(`[tts_card_play] card=${scheduledIdx} req=${reqAtStart}`);
            try {
                await playTTS(text);
            } catch (_) { /* playTTS ya logea */ }
        }
        _juego3TTSInFlight = false;
    }, 400);
}

// Metadata de los 3 tipos de IA para el chart de confusión (proyector)
const JUEGO3_TIPO_META = {
    chatbot:   { label: 'Chatbot',   icon: 'ph-chat-circle-text' },
    asistente: { label: 'Asistente', icon: 'ph-note-pencil' },
    agente:    { label: 'Agente',    icon: 'ph-lightning' },
};

function renderJuego3Bars() {
    // El panel ya no muestra barras A/B/C en voting (evita efecto rebaño).
    // Delegamos a renderJuego3Panel() que decide qué estado mostrar.
    renderJuego3Panel();
}

/**
 * Panel derecho del proyector.
 *   voting   → estado "waiting" con contador de participación (sin distribución A/B/C).
 *   revealed → chart por TIPO de IA (chatbot / asistente / agente), agente destacado verde.
 */
function renderJuego3Panel() {
    const waitingEl = document.getElementById('juego3-waiting');
    const chartTipoEl = document.getElementById('juego3-chart-tipo');
    const cumEl = document.getElementById('juego3-chart-cumulative');
    const titleEl = document.getElementById('juego3-panel-title');
    if (!waitingEl || !chartTipoEl) return;

    const card = juego3.cards ? juego3.cards[juego3.currentCard] : null;
    const tally = juego3.tally || {};
    const totalVotos = (tally.A || 0) + (tally.B || 0) + (tally.C || 0);
    const nVivo = (juego3.nVivo != null) ? juego3.nVivo : totalVotos;

    if (juego3.phase === 'revealed' && card) {
        // ── Chart por TIPO de IA + donut acumulativo ──
        waitingEl.classList.add('hidden');
        chartTipoEl.classList.remove('hidden');
        if (cumEl) cumEl.classList.remove('hidden');
        if (titleEl) titleEl.textContent = `Carta ${juego3.currentCard + 1} — Resultados`;
        renderJuego3Cumulative();

        if (totalVotos === 0) {
            chartTipoEl.innerHTML = `<div class="juego3-ctipo-empty">Nadie respondió esta carta</div>`;
            return;
        }

        const porTipo = { chatbot: 0, asistente: 0, agente: 0 };
        const letraToTipo = {};
        (card.opciones || []).forEach(op => {
            if (op.tipo in porTipo) {
                porTipo[op.tipo] = tally[op.letra] || 0;
                letraToTipo[op.letra] = op.tipo;
            }
        });
        const correctaTipo = letraToTipo[card.correcta] || 'agente';
        const aciertos = porTipo[correctaTipo] || 0;
        const pctAcierto = Math.round((aciertos / totalVotos) * 100);

        const orden = ['chatbot', 'asistente', 'agente'];
        const rows = orden.map(tipo => {
            const meta = JUEGO3_TIPO_META[tipo];
            const count = porTipo[tipo];
            const pct = totalVotos > 0 ? Math.round((count / totalVotos) * 100) : 0;
            const isCorrect = (tipo === correctaTipo);
            return `
                <div class="juego3-ctipo-row ${isCorrect ? 'juego3-ctipo-row--agente' : ''}">
                    <div class="juego3-ctipo-icon"><i class="ph-fill ${meta.icon}"></i></div>
                    <div class="juego3-ctipo-main">
                        <div class="juego3-ctipo-label">
                            <span>${meta.label}</span>
                            ${isCorrect ? '<span class="juego3-ctipo-badge">Correcta</span>' : ''}
                        </div>
                        <div class="juego3-ctipo-track">
                            <div class="juego3-ctipo-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                    <div class="juego3-ctipo-count">${count}<span class="juego3-ctipo-count__pct">${pct}%</span></div>
                </div>
            `;
        }).join('');

        const footer = `
            <div class="juego3-ctipo-footer">
                <span class="juego3-ctipo-footer__label">Aciertos</span>
                <span class="juego3-ctipo-footer__value">${aciertos} / ${totalVotos} <small style="font-size:14px;opacity:0.7">(${pctAcierto}%)</small></span>
            </div>
        `;
        chartTipoEl.innerHTML = rows + footer;
        return;
    }

    // ── Waiting (voting, sin distribución para evitar rebaño) ──
    waitingEl.classList.remove('hidden');
    chartTipoEl.classList.add('hidden');
    if (cumEl) cumEl.classList.add('hidden');
    if (titleEl) titleEl.textContent = 'Respuestas del grupo';

    const countEl = document.getElementById('juego3-waiting-count');
    const fillEl = document.getElementById('juego3-waiting-fill');
    const labelEl = document.getElementById('juego3-waiting-label');
    // N explícito siempre: si no hay conectados ni votos, mostramos "0 de 0"
    // en vez del ambiguo "…". Semántica completa de N_vivo.
    const denom = (nVivo && nVivo > 0) ? nVivo : Math.max(totalVotos, 0);
    if (countEl) countEl.textContent = `${totalVotos} de ${denom} ${totalVotos === 1 ? 'ha' : 'han'} votado`;
    if (fillEl) {
        const pct = (nVivo > 0) ? Math.min(100, Math.round((totalVotos / nVivo) * 100)) : 0;
        fillEl.style.width = `${pct}%`;
    }
    if (labelEl) {
        labelEl.textContent = (totalVotos === 0) ? 'Esperando respuestas…' : 'Llegando votos…';
    }
}

function updateJuego3Controls() {
    const revealBtn = document.getElementById('juego3-reveal-btn');
    const nextBtn = document.getElementById('juego3-next-btn');
    if (!revealBtn || !nextBtn) return;
    revealBtn.disabled = (juego3.phase !== 'voting');
    nextBtn.disabled = false;
    const isLast = juego3.currentCard >= juego3.total - 1;
    nextBtn.innerHTML = isLast
        ? `Terminar <i class="ph-bold ph-check"></i>`
        : `Siguiente <i class="ph-bold ph-arrow-right"></i>`;
}

// ── Eliana final ──
/**
 * Arranca la pantalla final de Eliana:
 *  1. Intenta obtener summary local del backend (para chips de fallback).
 *  2. Solo si el summary confirma que nadie jugó → mensaje amable sin LLM.
 *  3. En cualquier otro caso (datos OK o fetch HTTP fallido pero LLM accesible)
 *     → abre WS /ws/chat con activity_mode='juego3_final'. El backend inyecta
 *     el summary JSON server-side en el system prompt, no depende del fetch cliente.
 *  4. Chips fallback condicional: aparecen SOLO si hay summary local Y pasan 2s
 *     sin tokens (o el LLM erroró). Si no hay summary local y el LLM también falla,
 *     mostramos un mensaje amable de último recurso.
 */
async function startJuego3ElianaFinal() {
    juego3.elianaStreaming = true;
    renderJuego3();

    // Guard por host: el nodo #juego3-eliana-orb se eliminó en v23.15.0
    // (el widget flotante ya representa a Eliana). Si alguien re-introduce el
    // nodo en el futuro, este guard lo inicializará automáticamente. elianaOrb
    // se mantiene en el state como defensive null (no se toca).
    const _orbHost = document.getElementById('juego3-eliana-orb');
    if (_orbHost && !juego3.elianaOrb && typeof window.orbCreateInElement === 'function') {
        try {
            juego3.elianaOrb = window.orbCreateInElement(_orbHost, 340);
        } catch (e) { console.warn('[Juego3] orb eliana init:', e); }
    }

    const textEl = document.getElementById('juego3-eliana-text');
    const cta = document.getElementById('juego3-eliana-advance');
    if (textEl) textEl.textContent = '';
    if (cta) cta.classList.add('hidden');

    // 1. Intentar obtener summary del servidor (best-effort, para chips locales).
    //    Si falla NO hacemos short-circuit — el backend igualmente inyectará el
    //    summary server-side cuando llamemos al LLM con activity_mode=juego3_final.
    let summary = null;
    let summaryFetchFailed = false;
    try {
        const res = await fetch('/api/juego3/summary');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        summary = await res.json();
        juego3.summary = summary;
    } catch (e) {
        console.warn('[Juego3] summary fetch failed — intentando LLM igualmente:', e);
        summaryFetchFailed = true;
        juego3.metrics.summary_fetch_fail_count++;
    }

    // Panel de resultados detallados (solo si hay datos; se oculta si no)
    if (typeof renderJuego3Results === 'function') renderJuego3Results();

    // 2. Short-circuit SOLO si tenemos summary confirmado con cero actividad.
    //    (Si el fetch falló, no asumimos "nadie jugó" — el backend sabrá).
    if (summary && (summary.cartas_jugadas === 0 || summary.global?.votos === 0)) {
        const msg = `Bueno, esta vez no ha habido tiempo de votar, pero os habéis llevado lo importante: la idea. Pasemos a lo siguiente, que viene lo chulo.`;
        await typeText(textEl, msg, 18);
        if (cta) cta.classList.remove('hidden');
        juego3.elianaStreaming = false;
        return;
    }

    // 3. LLM streaming vía /ws/chat con activity_mode='juego3_final'.
    //    El backend inyecta el summary JSON server-side (ver main.py).
    //    Si también el WS falla, último recurso = mensaje amable.
    let anyTokenReceived = false;
    let fallbackTimer = null;
    let handledClose = false; // evitar doble-manejo entre onerror/onclose/onend

    // Último recurso: si no hay summary local Y el LLM no entregó nada.
    const ultimoRecurso = async (reasonTag = 'close') => {
        if (handledClose) return;
        handledClose = true;
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        if (anyTokenReceived) {
            juego3.elianaStreaming = false;
            return;
        }
        // Métrica: incrementar contador + registrar motivo para diagnóstico post-taller.
        juego3.metrics.ultimo_recurso_count++;
        juego3.metrics.ultimo_recurso_reasons.push({
            ts: new Date().toISOString(),
            reason: reasonTag,
            fetch_failed: summaryFetchFailed,
            no_tokens: !anyTokenReceived,
            has_local_summary: !!(juego3.summary && juego3.summary.por_carta),
        });
        console.warn(`[juego3][metric] ultimo_recurso_fired count=${juego3.metrics.ultimo_recurso_count} reason=${reasonTag} fetch_failed=${summaryFetchFailed} local_summary=${!!juego3.summary}`);

        // Preferencia 1: si hay summary local, mostrar chips.
        if (juego3.summary && juego3.summary.por_carta) {
            renderJuego3ElianaFallback();
        } else if (textEl && !textEl.textContent) {
            // Preferencia 2: mensaje fijo cuando no hay datos locales ni LLM.
            const msg = `Habéis terminado las cinco cartas. Ya tenéis la idea — un agente no es un chatbot, ni siquiera un asistente. Pasemos a lo siguiente.`;
            await typeText(textEl, msg, 18);
        }
        if (cta) cta.classList.remove('hidden');
        juego3.elianaStreaming = false;
    };

    const armFallback = () => {
        // Solo disparamos chips en timeout si hay summary local. Si no hay,
        // dejamos que onclose/onerror manejen el "último recurso".
        fallbackTimer = setTimeout(() => {
            if (!anyTokenReceived && juego3.summary && juego3.summary.por_carta) {
                renderJuego3ElianaFallback();
            }
        }, 2000);
    };

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${location.host}/ws/chat`);

    let buffer = '';

    ws.onopen = () => {
        ws.send(JSON.stringify({
            message: 'Comenta los resultados del grupo en tono jovial según los datos.',
            response_mode: 'full',
            activity_mode: 'juego3_final'
        }));
        armFallback();
    };

    ws.onmessage = (ev) => {
        try {
            const data = JSON.parse(ev.data);
            if (data.type === 'token') {
                if (!anyTokenReceived) {
                    anyTokenReceived = true;
                    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
                    // Quitar chips fallback si estaban visibles
                    const oldFb = document.getElementById('juego3-eliana-fallback');
                    if (oldFb) oldFb.remove();
                }
                buffer += data.content;
                if (textEl) textEl.textContent = buffer;
            } else if (data.type === 'end') {
                handledClose = true;
                if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
                if (cta) cta.classList.remove('hidden');
                juego3.elianaStreaming = false;
                // TTS: que Eliana hable si el profesor tiene TTS activo o lo pidió por voz
                if (buffer && (state.ttsEnabled || state.voiceTriggered)) {
                    playTTS(buffer, true);
                }
                try { ws.close(); } catch (_) {}
            } else if (data.type === 'error') {
                console.warn('[Juego3] eliana error:', data.message);
                juego3.metrics.llm_error_count++;
                ultimoRecurso('llm_error');
                try { ws.close(); } catch (_) {}
            }
        } catch (e) { /* ignore */ }
    };

    ws.onerror = () => {
        console.warn('[Juego3] eliana ws error');
        juego3.metrics.llm_error_count++;
        ultimoRecurso('ws_error');
    };

    ws.onclose = () => {
        // Si cerró sin haber emitido 'end' ni tokens, es cierre anómalo.
        if (!handledClose) ultimoRecurso('ws_close_no_end');
    };

    // Log diagnóstico útil en taller real
    if (summaryFetchFailed) {
        console.info('[Juego3] summary HTTP fetch falló — LLM streaming depende del WS; si WS también falla, caerá al último recurso.');
    }
}

/**
 * Donut acumulativo: % de aciertos de agente agregado sobre el total de votos
 * de todas las cartas jugadas. Se actualiza en cada reveal.
 *
 * Fuente de datos: juego3.summary.global (rellenado por el WS handler de summary
 * y por el fetch inicial si se abre la pantalla final).
 *
 * Fallback: si aún no hay summary local (sesión recién iniciada), lo calculamos
 * a partir del tally de la carta actual para que al menos muestre algo coherente.
 */
function renderJuego3Cumulative() {
    const host = document.getElementById('juego3-chart-cumulative');
    if (!host) return;

    let aciertos = 0;
    let votos = 0;
    let cartasJugadas = 0;
    let totalCartas = juego3.total || 5;

    if (juego3.summary && juego3.summary.global) {
        aciertos = juego3.summary.global.aciertos || 0;
        votos = juego3.summary.global.votos || 0;
        cartasJugadas = juego3.summary.cartas_jugadas || 0;
        totalCartas = juego3.summary.total_cartas || totalCartas;
    } else {
        // Fallback: calcular desde tally de la carta actual.
        const card = juego3.cards ? juego3.cards[juego3.currentCard] : null;
        if (card && juego3.tally) {
            const tally = juego3.tally;
            const totalCard = (tally.A || 0) + (tally.B || 0) + (tally.C || 0);
            const correctos = tally[card.correcta] || 0;
            aciertos = correctos;
            votos = totalCard;
            cartasJugadas = totalCard > 0 ? 1 : 0;
        }
    }

    const pct = votos > 0 ? Math.round((aciertos / votos) * 100) : 0;
    const fallos = Math.max(0, votos - aciertos);

    host.innerHTML = `
        <div class="juego3-cum__header">
            <h4 class="juego3-cum__title">Acumulado</h4>
            <span class="juego3-cum__cards">${cartasJugadas} / ${totalCartas} cartas</span>
        </div>
        <div class="juego3-cum__body">
            <div class="juego3-donut" style="--pct: ${pct}">
                <div class="juego3-donut__center">
                    <span class="juego3-donut__pct">${pct}%</span>
                    <span class="juego3-donut__label">Aciertos</span>
                </div>
            </div>
            <div class="juego3-cum__legend">
                <div class="juego3-cum__row">
                    <span class="juego3-cum__dot juego3-cum__dot--ok"></span>
                    <span class="juego3-cum__num">${aciertos}</span>
                    <span>aciertos de agente</span>
                </div>
                <div class="juego3-cum__row juego3-cum__row--ko">
                    <span class="juego3-cum__dot juego3-cum__dot--ko"></span>
                    <span class="juego3-cum__num">${fallos}</span>
                    <span>confusiones</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Panel de resultados detallados en la pantalla Eliana final.
 *
 * Muestra 5 filas (una por carta) con: número, concepto, barra de pct_acierto,
 * ratio numérico, badge de "confundidos con X" si aplica.
 * Al final, TOTAL acumulado.
 *
 * Revelado progresivo (propuesta reviser):
 *   1. El contenedor hace fade-in + traslado vertical (300ms).
 *   2. Cada fila aparece con stagger de 80ms.
 *   3. Las barras se animan de 0 a su pct (600ms cubic-bezier).
 *
 * Si no hay datos (summary ausente, cartas_jugadas=0, por_carta vacío) → oculto.
 * No aparece nunca durante el juego — solo en la pantalla final.
 */
function renderJuego3Results() {
    const host = document.getElementById('juego3-eliana-results');
    if (!host) return;

    const summary = juego3.summary;
    // DoD: si cartas_jugadas=0 o no hay datos, NO mostrar panel.
    if (!summary || !summary.por_carta || summary.cartas_jugadas === 0) {
        host.classList.add('hidden');
        host.classList.remove('juego3-eliana__results--in');
        host.innerHTML = '';
        return;
    }

    const rows = summary.por_carta.map((c, i) => {
        const pct = c.pct_acierto;
        const totalV = c.total_votos || 0;
        const aciertos = c.aciertos || 0;
        const sinDatos = (totalV === 0 || pct == null);
        const fillWidth = sinDatos ? 0 : Math.max(0, Math.min(100, pct));
        const ratio = sinDatos ? '— / 0' : `${aciertos}/${totalV}`;
        const concept = (c.area || `Carta ${i + 1}`).trim();

        // Badge "confundidos con X" solo si pct<60 y hay confusion_dominante
        let badgeHTML = '';
        if (!sinDatos && pct < 60 && c.confusion_dominante) {
            badgeHTML = `<span class="juego3-res__badge">Confundieron con ${c.confusion_dominante}</span>`;
        }

        return `
            <li class="juego3-res__row" data-row-idx="${i}">
                <span class="juego3-res__num">${i + 1}</span>
                <div class="juego3-res__main">
                    <span class="juego3-res__concept" title="${concept}">${concept}</span>
                    <div class="juego3-res__track">
                        <div class="juego3-res__fill ${sinDatos ? 'juego3-res__fill--empty' : ''}" style="transform: scaleX(0); width: ${fillWidth}%"></div>
                    </div>
                    ${badgeHTML}
                </div>
                <span class="juego3-res__ratio">${ratio}</span>
            </li>
        `;
    }).join('');

    const g = summary.global || {};
    const totalAciertos = g.aciertos || 0;
    const totalVotos = g.votos || 0;
    const totalPct = (totalVotos > 0 && g.pct != null) ? g.pct : null;

    host.innerHTML = `
        <h3 class="juego3-res__title">Resultados por pregunta</h3>
        <ol class="juego3-res__list">${rows}</ol>
        <div class="juego3-res__total">
            <span>Total</span>
            <span class="juego3-res__total-value">
                ${totalAciertos} / ${totalVotos}
                ${totalPct != null ? `<small>${totalPct}%</small>` : ''}
            </span>
        </div>
    `;

    host.classList.remove('hidden');
    host.classList.remove('juego3-eliana__results--in'); // reset para re-animar si se vuelve a la pantalla

    // Revelado progresivo: contenedor entra con ~200ms de delay tras el orb,
    // filas con stagger de 80ms, barras animadas a 400ms del inicio de su fila.
    requestAnimationFrame(() => {
        setTimeout(() => {
            host.classList.add('juego3-eliana__results--in');
            const rowEls = host.querySelectorAll('.juego3-res__row');
            rowEls.forEach((row, idx) => {
                setTimeout(() => {
                    row.classList.add('juego3-res__row--in');
                    const fill = row.querySelector('.juego3-res__fill');
                    if (fill) {
                        // Pequeño delay extra para que la barra empiece DESPUÉS de la fila
                        setTimeout(() => fill.classList.add('juego3-res__fill--in'), 200);
                    }
                }, idx * 80);
            });
        }, 350);
    });
}

/**
 * Strip de chips con pct_acierto por carta — fallback condicional.
 * Se muestra solo si el LLM no respondió en 2s o erroró.
 * Si luego llegan tokens, se retira.
 */
function renderJuego3ElianaFallback() {
    const bodyEl = document.querySelector('.juego3-eliana__body');
    if (!bodyEl) return;
    const summary = juego3.summary;
    if (!summary || !summary.por_carta) return;

    // No duplicar si ya existe
    let fbEl = document.getElementById('juego3-eliana-fallback');
    if (!fbEl) {
        fbEl = document.createElement('div');
        fbEl.id = 'juego3-eliana-fallback';
        fbEl.className = 'juego3-eliana__fallback';
        // Insertar después del texto
        const textEl = document.getElementById('juego3-eliana-text');
        if (textEl && textEl.parentNode) {
            textEl.parentNode.insertBefore(fbEl, textEl.nextSibling);
        } else {
            bodyEl.appendChild(fbEl);
        }
    }

    const chips = summary.por_carta.map((c, i) => {
        const pct = c.pct_acierto;
        const pctLabel = (pct == null) ? '—' : `${pct}%`;
        const clsExtra = (pct == null) ? 'juego3-chip-pct--empty' : '';
        return `<span class="juego3-chip-pct ${clsExtra}" title="${c.area || ''}">Carta ${i + 1}: <strong>${pctLabel}</strong></span>`;
    }).join('');

    fbEl.innerHTML = `<div class="juego3-chip-pct__row">${chips}</div>`;
}

async function typeText(el, text, delay = 20) {
    if (!el) return;
    el.textContent = '';
    for (const ch of text) {
        el.textContent += ch;
        await new Promise(r => setTimeout(r, delay));
    }
}

/**
 * DEV HELPERS — accesibles desde DevTools para probar casos difíciles sin tirar la red.
 *
 * Uso:
 *   juego3DevSimulate('summary_fail')   → fuerza que el próximo fetch de summary falle
 *   juego3DevSimulate('llm_fail')       → fuerza que el próximo WS al LLM falle al abrir
 *   juego3DevSimulate('both_fail')      → combina los dos (último recurso sin datos)
 *   juego3DevSimulate('reset')          → limpia los flags
 *   juego3DevMetrics()                  → imprime tabla de métricas + razones
 */
window.juego3DevSimulate = function (mode) {
    const originalFetch = window.__juego3OriginalFetch || window.fetch;
    window.__juego3OriginalFetch = originalFetch;
    const originalWS = window.__juego3OriginalWS || window.WebSocket;
    window.__juego3OriginalWS = originalWS;

    if (mode === 'reset') {
        window.fetch = originalFetch;
        window.WebSocket = originalWS;
        console.info('[juego3][dev] simulación DESACTIVADA — fetch y WebSocket restaurados');
        return;
    }

    if (mode === 'summary_fail' || mode === 'both_fail') {
        window.fetch = function (url, ...rest) {
            if (typeof url === 'string' && url.includes('/api/juego3/summary')) {
                console.warn('[juego3][dev] interceptando fetch summary → reject');
                return Promise.reject(new Error('DEV_SIMULATED_NETWORK_ERROR'));
            }
            return originalFetch.call(this, url, ...rest);
        };
    }

    if (mode === 'llm_fail' || mode === 'both_fail') {
        window.WebSocket = function (url, protocols) {
            if (typeof url === 'string' && url.includes('/ws/chat')) {
                console.warn('[juego3][dev] interceptando WS /ws/chat → error inmediato');
                const fakeWs = {
                    readyState: 0,
                    send: () => {},
                    close: () => {},
                };
                setTimeout(() => {
                    if (typeof fakeWs.onerror === 'function') fakeWs.onerror(new Event('error'));
                    if (typeof fakeWs.onclose === 'function') fakeWs.onclose(new CloseEvent('close'));
                }, 50);
                return fakeWs;
            }
            return new originalWS(url, protocols);
        };
    }

    console.info(`[juego3][dev] simulación ACTIVA: mode=${mode}. Pulsa 'Eliana comenta resultados' para probar. Usa juego3DevSimulate('reset') para desactivar.`);
};

window.juego3DevMetrics = function () {
    console.group('[juego3] métricas de sesión');
    console.log('ultimo_recurso_count:', juego3.metrics.ultimo_recurso_count);
    console.log('summary_fetch_fail_count:', juego3.metrics.summary_fetch_fail_count);
    console.log('llm_error_count:', juego3.metrics.llm_error_count);
    if (juego3.metrics.ultimo_recurso_reasons.length) {
        console.table(juego3.metrics.ultimo_recurso_reasons);
    } else {
        console.log('(sin eventos ultimo_recurso — flujo normal)');
    }
    console.groupEnd();
};

// ============================================
// Event Listeners
// ============================================
function init() {
    // Reset del juego3 en cada carga/refresh: el estado vuelve a "idle" en el servidor
    // para que el presentador siempre empiece limpio al recargar.
    fetch('/api/juego3/reset', { method: 'POST' }).catch(() => {});

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

    // Blinda chat — mic (widget). Fix #1: NO enableTTS persistente; solo voiceTriggered
    // para que ESTA respuesta se reproduzca por voz (se resetea tras la respuesta).
    document.getElementById('blinda-mic-btn')?.addEventListener('click', () => {
        state.voiceTriggered = true;
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Blinda chat — botón MUTE: silencia el TTS en curso (sin desactivar el sistema)
    document.getElementById('blinda-voice-btn')?.addEventListener('click', () => {
        stopTTS();
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

    // Diapo 5 — Saca el agente que llevas dentro
    // FLECHAS DEL HEADER: saltan DIAPOSITIVA entera (izq → diapo 3, der → diapo 6).
    // FLECHAS LATERALES: navegan PASOS internos (1 → 2 → 3 → 4 o al revés).
    document.getElementById('diapo5-nav-back')?.addEventListener('click', () => {
        // Salta entera de diapo 5 → diapo 3 (hideDiapo5Screen ya hace ese return)
        hideDiapo5Screen();
    });
    document.getElementById('diapo5-nav-next')?.addEventListener('click', () => {
        // Salta entera de diapo 5 → diapo 6
        _diapo5StopAll();
        stopTTS();
        elements.diapo5Screen?.classList.add('fade-out');
        setTimeout(() => {
            elements.diapo5Screen?.classList.add('hidden');
            elements.diapo5Screen?.classList.remove('fade-out');
            if (typeof showDiapo6Screen === 'function') showDiapo6Screen();
            else if (typeof showFinalScreen === 'function') showFinalScreen();
        }, 300);
    });
    document.getElementById('diapo5-side-prev')?.addEventListener('click', diapo5PrevStep);
    document.getElementById('diapo5-side-next')?.addEventListener('click', diapo5NextStep);

    // Diapo 6 — IA para estudiantes (Strategos)
    // FLECHAS DEL HEADER: saltan DIAPOSITIVA entera (izq → diapo 5, der → pantalla final).
    // FLECHAS LATERALES: navegan PASOS internos (1 → 2 → 3 → 4 o al revés).
    document.getElementById('diapo6-nav-back')?.addEventListener('click', () => {
        // Salta entera de diapo 6 → diapo 5
        _diapo6StopAll();
        stopTTS();
        const screen = document.getElementById('diapo6-screen');
        screen?.classList.add('fade-out');
        setTimeout(() => {
            screen?.classList.add('hidden');
            screen?.classList.remove('fade-out');
            if (typeof showDiapo5Screen === 'function') showDiapo5Screen();
        }, 300);
    });
    document.getElementById('diapo6-nav-next')?.addEventListener('click', () => {
        // Salta entera de diapo 6 → pantalla final (próxima diapo cuando exista)
        _diapo6StopAll();
        stopTTS();
        const screen = document.getElementById('diapo6-screen');
        screen?.classList.add('fade-out');
        setTimeout(() => {
            screen?.classList.add('hidden');
            screen?.classList.remove('fade-out');
            if (typeof showFinalScreen === 'function') showFinalScreen();
        }, 300);
    });
    document.getElementById('diapo6-side-prev')?.addEventListener('click', diapo6PrevStep);
    document.getElementById('diapo6-side-next')?.addEventListener('click', diapo6NextStep);

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
                            text: 'Mi perfil docente generado por Eliana AI - Destino ELE VIENA',
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

    // Deep link: ?screen=juego salta directamente al juego (desde QR)
    const urlParams = new URLSearchParams(window.location.search);
    const screenParam = urlParams.get('screen');
    if (screenParam && typeof showJuegoScreen === 'function') {
        localStorage.setItem('eliana_user', 'Participante');
        localStorage.setItem('eliana_logged_in', 'true');
        setTimeout(() => {
            // Ocultar TODAS las pantallas
            document.querySelectorAll('.main-content, #login-screen, #welcome-screen').forEach(el => el.classList.add('hidden'));
            // Mostrar la pantalla solicitada
            if (screenParam === 'juego') showJuegoScreen();
            // 'miau' eliminado en v23.17.0 junto con la diapo 6 MIAU
            else if (screenParam === 'strategos' && typeof showDiapo6Screen === 'function') {
                showDiapo6Screen();
                // Si bypass móvil, no tocar nada más
                if (!isOnDiapo6Screen()) return;
                const stepParam = parseInt(urlParams.get('step') || '1', 10);
                if (stepParam >= 2 && stepParam <= 4) {
                    if (typeof _diapo6StopAll === 'function') _diapo6StopAll();
                    const stage = document.getElementById('diapo6-stage');
                    if (stage) {
                        stage.classList.add('diapo6-stage--no-transition');
                        document.querySelectorAll('#diapo6-stage .diapo6-step').forEach(el => {
                            el.classList.remove('is-active', 'is-leaving');
                        });
                        const target = document.querySelector(`#diapo6-stage .diapo6-step[data-step="${stepParam}"]`);
                        target?.classList.add('is-active');
                        void stage.offsetHeight;
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                stage.classList.remove('diapo6-stage--no-transition');
                            });
                        });
                    }
                    if (typeof _diapo6SyncStep === 'function') _diapo6SyncStep(stepParam);
                    if (typeof _diapo6RunStep === 'function') _diapo6RunStep(stepParam);
                }
            }
            else if (screenParam === 'juego-intro') showJuegoIntroScreen();
            else if (screenParam === 'diapo5' && typeof showDiapo5Screen === 'function') {
                showDiapo5Screen();
                // Guarda: en móvil showDiapo5Screen bypass a showDiapo6Screen().
                // Si tras la llamada la diapo 5 no está activa, no tocamos el snap
                // (evita trabajo innecesario + _diapo5Step desincronizado en móvil).
                if (!isOnDiapo5Screen()) return;
                // ?screen=diapo5&step=N salta al paso N (snap directo, sin transición)
                const stepParam = parseInt(urlParams.get('step') || '1', 10);
                if (stepParam >= 2 && stepParam <= 4) {
                    // Snap síncrono sin animación: añadir clase no-transition,
                    // mover clases, forzar reflow, quitar la clase. Así el paso
                    // destino aparece YA en pantalla, sin la animación slide.
                    if (typeof _diapo5StopAll === 'function') _diapo5StopAll();
                    const stage = document.getElementById('diapo5-stage');
                    if (stage) {
                        stage.classList.add('diapo5-stage--no-transition');
                        document.querySelectorAll('#diapo5-stage .diapo5-step').forEach(el => {
                            el.classList.remove('is-active', 'is-leaving');
                        });
                        const target = document.querySelector(`#diapo5-stage .diapo5-step[data-step="${stepParam}"]`);
                        target?.classList.add('is-active');
                        // Forzar reflow para que el cambio se aplique sin animar
                        void stage.offsetHeight;
                        // Limpiar la clase no-transition tras un tick para que las
                        // flechas posteriores SÍ animen.
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                stage.classList.remove('diapo5-stage--no-transition');
                            });
                        });
                    }
                    // CRÍTICO: sincronizar el estado interno
                    if (typeof _diapo5SyncStep === 'function') _diapo5SyncStep(stepParam);
                    // Arrancar animaciones internas del paso destino
                    if (typeof _diapo5RunStep === 'function') _diapo5RunStep(stepParam);
                }
            }
        }, 500);
    }

    // Event listeners para la diapo 02 — Juego Intro
    document.getElementById('juego-intro-back')?.addEventListener('click', () => {
        hideJuegoIntroScreen();
        setTimeout(() => showLoginScreen(), 300);
    });
    const goToJuego3 = () => {
        hideJuegoIntroScreen();
        setTimeout(() => showJuego3Screen(), 300);
    };
    document.getElementById('juego-intro-next')?.addEventListener('click', goToJuego3);
    document.getElementById('juego-intro-empezar')?.addEventListener('click', goToJuego3);

    // Event listeners para la diapo 03 — Juego "Descubre al agente"
    document.getElementById('juego3-nav-back')?.addEventListener('click', () => {
        hideJuego3Screen();
        setTimeout(() => showJuegoIntroScreen(), 300);
    });
    document.getElementById('juego3-nav-next')?.addEventListener('click', () => {
        // TODO: cuando exista diapo 4, avanzar; por ahora solo ocultar
        hideJuego3Screen();
    });
    document.getElementById('juego3-start-btn')?.addEventListener('click', () => sendJuego3Cmd('advance'));
    document.getElementById('juego3-reveal-btn')?.addEventListener('click', () => sendJuego3Cmd('reveal'));
    document.getElementById('juego3-next-btn')?.addEventListener('click', () => sendJuego3Cmd('advance'));
    // Reset del juego (con confirm para evitar pulsado accidental durante taller real).
    // Limpia estado server + votes_by_participant. Los móviles detectan phase=idle y
    // auto-limpian su localStorage (v23.13.9).
    document.getElementById('juego3-reset-btn')?.addEventListener('click', () => {
        if (confirm('¿Reiniciar el juego? Se borrarán todos los votos y volveremos al inicio.')) {
            sendJuego3Cmd('reset');
        }
    });
    document.getElementById('juego3-eliana-btn')?.addEventListener('click', () => startJuego3ElianaFinal());
    document.getElementById('juego3-eliana-advance')?.addEventListener('click', () => {
        // Avanzar a diapo 4 — por ahora solo cerrar
        hideJuego3Screen();
    });
    // Atajo: saltar de diapo 3 → diapo 5 sin pasar por la 4
    document.getElementById('juego3-skip-to-5-btn')?.addEventListener('click', () => {
        hideJuego3Screen();
        setTimeout(() => showDiapo5Screen(), 300);
    });

    // Deep link adicional para diapo 3
    if (screenParam === 'juego3') {
        setTimeout(() => showJuego3Screen(), 500);
    }

    console.log('Eliana inicializada');
}

// Iniciar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
