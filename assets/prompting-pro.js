/* ==========================================================================
   Genio del Prompting PRO — /prompting-pro
   Llama al Worker de Cloudflare genio-prompting-pro.
   Sin login clásico: la license key ES la cuenta (Lemon Squeezy). El token
   de sesión (24h, HMAC) se guarda en localStorage junto con la propia key
   para poder re-activar en silencio si el token caduca.
   Seguridad: la respuesta de Gemini se pinta siempre con textContent, nunca
   con innerHTML.
   ========================================================================== */
(function () {
  "use strict";

  const WORKER_URL = "https://genio-prompting-pro.aberdonces.workers.dev";
  const LS_TOKEN_KEY = "prompro_token";
  const LS_EXPIRES_KEY = "prompro_expires_at";
  const LS_EMAIL_KEY = "prompro_email";
  const LS_LICENSE_KEY = "prompro_license_key";

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------------
     SPEC DEL FORMULARIO — 21 combinaciones tipo × modelo
     Los valores de los chips son las cadenas EXACTAS que esperan los
     destilados (Artefacto_Mejorador_Prompts/destilados/<tipo>/<modelo>.md,
     sección "OPCIONES DEL FORMULARIO"). No cambiar sin revisar esos .md.
     ------------------------------------------------------------------------ */
  const TIPOS = [
    { id: "texto", label: "Texto", icon: "✍️", desc: "Emails, posts, artículos, guiones, cualquier texto." },
    { id: "imagen", label: "Imagen", icon: "🖼️", desc: "Prompts para generar imágenes con IA." },
    { id: "video", label: "Video", icon: "🎬", desc: "Prompts para generar clips de video con IA." },
    { id: "agente", label: "Agente", icon: "🤖", desc: "System prompts para agentes y automatizaciones." },
  ];

  const MODELOS = {
    texto: [
      { id: "generico", label: "Genérico (cualquier IA)" },
      { id: "claude", label: "Claude (Anthropic)" },
      { id: "openai", label: "ChatGPT / OpenAI" },
      { id: "gemini", label: "Gemini (Google)" },
      { id: "grok", label: "Grok (xAI)" },
      { id: "perplexity", label: "Perplexity" },
    ],
    imagen: [
      { id: "generico", label: "Genérico (cualquier IA)" },
      { id: "chatgpt_dalle", label: "ChatGPT / DALL·E" },
      { id: "nanobanana", label: "Nano Banana (Gemini Image)" },
      { id: "grok", label: "Grok Imagine" },
      { id: "midjourney", label: "Midjourney" },
    ],
    video: [
      { id: "generico", label: "Genérico (cualquier IA)" },
      { id: "sora", label: "Sora (OpenAI)" },
      { id: "veo3", label: "Veo 3 (Google)" },
      { id: "grokimagine", label: "Grok Imagine" },
      { id: "midjourney", label: "Midjourney Video" },
    ],
    agente: [
      { id: "generico", label: "Genérico (cualquier IA)" },
      { id: "claude", label: "Claude (Anthropic)" },
      { id: "openai", label: "ChatGPT / OpenAI" },
      { id: "grok", label: "Grok (xAI)" },
      { id: "gemini", label: "Gemini (Google)" },
    ],
  };

  // type: "chip" | "toggle" | "text"
  const OPCIONES = {
    texto: {
      generico: [
        { id: "audiencia", label: "Audiencia", type: "text", placeholder: "Ej.: clientes B2B del sector esquí" },
        { id: "formato", label: "Formato de salida", type: "text", placeholder: "Ej.: email de 150 palabras" },
        { id: "tono", label: "Tono", type: "chip", choices: ["Profesional", "Directo", "Cercano", "Formal", "Persuasivo"] },
      ],
      claude: [
        { id: "output_format", label: "Formato de output", type: "chip", choices: ["HTML (recomendado)", "Markdown", "Texto plano"], default: "HTML (recomendado)" },
        { id: "reasoning", label: "Modelo Claude", type: "chip", choices: ["Haiku 4.5 (rápido)", "Sonnet 5 (estándar)", "Opus 4.8", "Fable 5 (máxima capacidad)"], default: "Sonnet 5 (estándar)" },
        { id: "effort", label: "Nivel de effort (API)", type: "chip", choices: ["low", "medium", "high (default)", "xhigh", "max"], default: "high (default)" },
        { id: "frontend", label: "¿Tarea de diseño/frontend?", type: "toggle" },
        { id: "xml", label: "¿Estructurar el prompt con XML?", type: "toggle" },
        { id: "role", label: "¿Asignar un rol específico a Claude?", type: "toggle" },
      ],
      openai: [
        { id: "model_oai", label: "Modelo OpenAI", type: "chip", choices: ["GPT-5.6 Sol (GA)", "GPT-5.5 Instant", "GPT-5.5 Thinking", "GPT-5.5 Pro", "o3", "o4-mini"], default: "GPT-5.6 Sol (GA)" },
        { id: "api_or_chat", label: "¿API o ChatGPT.com?", type: "chip", choices: ["ChatGPT.com", "API"], default: "ChatGPT.com" },
        { id: "reasoning_effort", label: "reasoning_effort (solo API)", type: "chip", choices: ["low", "medium", "high", "xhigh", "max"], default: "medium" },
        { id: "antisyco", label: "¿Anti-sycophancy explícito?", type: "toggle" },
      ],
      gemini: [
        { id: "model_gem", label: "Modelo Gemini", type: "chip", choices: ["Gemini 2.0 Flash", "Gemini 2.5 Pro", "Gemini 2.5 Ultra"], default: "Gemini 2.5 Pro" },
        { id: "workspace", label: "¿Usas Google Workspace?", type: "toggle" },
        { id: "reverse", label: "¿Reverse Prompting?", type: "toggle" },
        { id: "power", label: "¿Añadir Power Prompt al final?", type: "toggle" },
      ],
      grok: [
        { id: "modelo_grok", label: "Modelo de Grok", type: "chip", choices: ["Grok 4.5", "Grok 4", "Grok 3"], default: "Grok 4.5" },
        { id: "plataforma_grok", label: "¿Dónde se usará?", type: "chip", choices: ["grok.com/app", "@grok bot en X", "API"], default: "grok.com/app" },
        { id: "x_search", label: "¿Búsqueda en X/Twitter?", type: "toggle" },
        { id: "political", label: "¿Tema político o controversial?", type: "toggle" },
        { id: "think", label: "¿Activar Think mode?", type: "toggle" },
      ],
      perplexity: [
        { id: "preset", label: "Preset de búsqueda", type: "chip", choices: ["fast-search", "pro-search", "deep-research"], default: "pro-search" },
        { id: "citations", label: "¿Citas de fuentes explícitas?", type: "toggle" },
        { id: "cap", label: "¿Cap numérico en resultados?", type: "toggle" },
        { id: "role_perp", label: "Rol del asistente", type: "text", placeholder: "Ej.: analista de mercado turístico" },
      ],
    },
    imagen: {
      generico: [
        { id: "ratio", label: "Proporción", type: "chip", choices: ["1:1 cuadrado", "16:9 horizontal", "9:16 vertical", "2:3 retrato"], default: "1:1 cuadrado" },
        { id: "style", label: "Estilo visual", type: "text", placeholder: "Ej.: fotorrealista, luz natural" },
        { id: "no_el", label: "Elementos a excluir", type: "text", placeholder: "Ej.: texto, logotipos" },
      ],
      chatgpt_dalle: [
        { id: "ratio", label: "Proporción", type: "chip", choices: ["1:1", "16:9", "9:16"], default: "1:1" },
        { id: "style", label: "Estilo visual", type: "chip", choices: ["Fotorrealista", "Artístico", "Ilustración", "Digital art", "Concept art"], default: "Fotorrealista" },
        { id: "no_text", label: "¿Especificar 'sin texto en la imagen'?", type: "toggle" },
        { id: "detail", label: "¿Descripción muy detallada?", type: "toggle" },
      ],
      nanobanana: [
        { id: "ratio", label: "Proporción", type: "chip", choices: ["1:1", "16:9", "9:16", "4:3"], default: "1:1" },
        { id: "style", label: "Estilo", type: "text", placeholder: "Ej.: minimalista, colores cálidos" },
        { id: "mood", label: "Mood / Atmósfera", type: "text", placeholder: "Ej.: acogedor, aventurero" },
        { id: "variante_nanobanana", label: "Variante", type: "chip", choices: ["Nano Banana 2", "Nano Banana Pro", "Flash Lite"], default: "Nano Banana 2" },
      ],
      grok: [
        { id: "ratio", label: "Proporción", type: "chip", choices: ["1:1", "16:9", "9:16"], default: "1:1" },
        { id: "style", label: "Estilo visual", type: "text", placeholder: "Ej.: fotorrealista, cinematográfico" },
        { id: "x_ctx", label: "¿Basado en contexto de X/Twitter?", type: "toggle" },
      ],
      midjourney: [
        { id: "ratio", label: "Proporción (--ar)", type: "chip", choices: ["1:1", "16:9 YouTube", "9:16 Instagram", "2:3 retrato", "4:3"], default: "1:1" },
        { id: "stylize", label: "Nivel artístico (--s)", type: "chip", choices: ["--s 50 realista", "--s 200 equilibrado", "--s 500 artístico", "--s 800 máximo"], default: "--s 200 equilibrado" },
        { id: "raw", label: "¿Modo fotorrealista (--raw)?", type: "toggle" },
        { id: "no_el", label: "Excluir elementos (--no)", type: "text", placeholder: "Ej.: texto, marcas de agua" },
        { id: "txt_img", label: "¿Texto dentro de la imagen?", type: "toggle" },
      ],
    },
    video: {
      generico: [
        { id: "dur", label: "Duración", type: "chip", choices: ["5 segundos", "10 segundos", "20 segundos", "60+ segundos"], default: "10 segundos" },
        { id: "fps", label: "FPS / Estilo", type: "chip", choices: ["24fps — cine", "30fps — web", "60fps — acción", "slow-motion"], default: "24fps — cine" },
        { id: "cam", label: "Movimiento de cámara", type: "text", placeholder: "Ej.: pan lento de izquierda a derecha" },
      ],
      sora: [
        { id: "dur", label: "Duración", type: "chip", choices: ["5s", "10s", "20s"], default: "10s" },
        { id: "fps", label: "Frame rate", type: "chip", choices: ["24fps — cine", "30fps — estándar", "60fps — fluido"], default: "24fps — cine" },
        { id: "cam", label: "Movimiento de cámara", type: "text", placeholder: "Ej.: dolly in lento" },
        { id: "physics", label: "¿Física realista específica?", type: "toggle" },
      ],
      veo3: [
        { id: "dur", label: "Duración", type: "chip", choices: ["8 segundos", "16 segundos"], default: "8 segundos" },
        { id: "audio", label: "¿Necesita audio o voces?", type: "toggle" },
        { id: "ratio", label: "Proporción", type: "chip", choices: ["16:9 landscape", "9:16 portrait", "1:1 square"], default: "16:9 landscape" },
        { id: "cam", label: "Movimiento de cámara", type: "text", placeholder: "Ej.: tracking shot siguiendo al sujeto" },
      ],
      grokimagine: [
        { id: "style", label: "Estilo del video", type: "text", placeholder: "Ej.: documental, cinematográfico" },
        { id: "dur", label: "Duración", type: "chip", choices: ["Corto 5-10s", "Medio 10-30s"], default: "Corto 5-10s" },
        { id: "x_ctx", label: "¿Relacionado con tema de X/Twitter?", type: "toggle" },
      ],
      midjourney: [
        { id: "ratio", label: "Proporción", type: "chip", choices: ["16:9", "9:16", "1:1"], default: "16:9" },
        { id: "style", label: "Estilo visual", type: "text", placeholder: "Ej.: hereda el estilo de tu imagen base" },
        { id: "cam", label: "Movimiento de cámara", type: "chip", choices: ["Estático", "Pan lento", "Dolly in", "Zoom out", "Tracking"], default: "Estático" },
      ],
    },
    agente: {
      generico: [
        { id: "system", label: "Sistema / Entorno", type: "text", placeholder: "Ej.: agente de soporte para una web de reservas" },
        { id: "tools", label: "Herramientas disponibles", type: "text", placeholder: "Ej.: buscar_vuelos, crear_reserva" },
        { id: "output", label: "Formato de output", type: "chip", choices: ["JSON estructurado", "Markdown con fuentes", "Pasos enumerados", "Texto libre"], default: "Texto libre" },
        { id: "guardrails", label: "¿Guardrails de reversibilidad?", type: "toggle" },
        { id: "parallel", label: "¿Acciones en paralelo?", type: "toggle" },
      ],
      claude: [
        { id: "model", label: "Modelo Claude", type: "chip", choices: ["Sonnet 5 (estándar)", "Fable 5 (máxima capacidad)", "Opus 4.8", "Haiku 4.5 (rápido/económico)"], default: "Sonnet 5 (estándar)" },
        { id: "effort", label: "Nivel de effort", type: "chip", choices: ["low", "medium", "high (default)", "xhigh", "max"], default: "high (default)" },
        { id: "tools", label: "Herramientas disponibles", type: "text", placeholder: "Ej.: Read, Write, Bash, Agent" },
        { id: "output", label: "Formato de output del agente", type: "chip", choices: ["JSON estructurado", "Markdown", "Texto con fuentes", "Pasos enumerados"], default: "Markdown" },
        { id: "grounding", label: "¿Grounding de progreso?", type: "toggle" },
        { id: "memory", label: "¿Sistema de memoria persistente?", type: "toggle" },
        { id: "subagents", label: "¿Subagentes paralelos?", type: "toggle" },
        { id: "react", label: "¿Framework ReAct (THOUGHT→ACTION→OBS)?", type: "toggle" },
        { id: "parallel", label: "¿Tool calls en paralelo?", type: "toggle" },
        { id: "guardrails", label: "¿Guardrails de reversibilidad?", type: "toggle" },
        { id: "xml", label: "¿Estructura XML en el system prompt?", type: "toggle" },
      ],
      openai: [
        { id: "model", label: "Modelo OpenAI", type: "chip", choices: ["GPT-5.6 Sol (GA)", "GPT-5.5 (agentic)", "o3 (razonamiento)", "o4-mini (eficiente)", "Codex (coding agent)"], default: "GPT-5.6 Sol (GA)" },
        { id: "ultra_mode", label: "¿Modo ultra (multi-agente)?", type: "toggle" },
        { id: "prog_tool_calling", label: "¿Programmatic Tool Calling?", type: "toggle" },
        { id: "computer_use", label: "¿Computer Use?", type: "toggle" },
        { id: "tool_search", label: "¿Tool Search dinámico?", type: "toggle" },
        { id: "tools", label: "Herramientas disponibles", type: "text", placeholder: "Ej.: web_search, code_interpreter" },
        { id: "output", label: "Formato de output", type: "chip", choices: ["JSON estructurado", "Markdown", "Código + explicación", "Pasos enumerados"], default: "Markdown" },
        { id: "api_mode", label: "¿Separar system prompt + user message?", type: "toggle" },
        { id: "reasoning_effort", label: "reasoning_effort (serie o / GPT-5.6)", type: "chip", choices: ["medium", "high", "xhigh", "max (GPT-5.6)"], default: "high" },
      ],
      grok: [
        { id: "modelo_grok", label: "Modelo Grok", type: "chip", choices: ["Grok 4.5", "Grok 4"], default: "Grok 4.5" },
        { id: "plataforma_grok", label: "Acceso", type: "chip", choices: ["API estándar (grok-4-0709)", "API rápida (grok-4-fast)"], default: "API estándar (grok-4-0709)" },
        { id: "voice_agent", label: "¿Agente de voz?", type: "toggle" },
        { id: "tools", label: "Herramientas disponibles", type: "text", placeholder: "Ej.: buscar_precio, crear_ticket" },
        { id: "x_search", label: "¿Búsqueda profunda en X/Twitter?", type: "toggle" },
        { id: "think", label: "¿Think mode para decisiones complejas?", type: "toggle" },
        { id: "deep_search", label: "¿DeepSearch iterativo?", type: "toggle" },
        { id: "output", label: "Formato de output", type: "chip", choices: ["JSON estructurado", "Markdown", "Análisis estructurado", "Timeline de X"], default: "Markdown" },
      ],
      gemini: [
        { id: "model", label: "Modelo Gemini", type: "chip", choices: ["Gemini 2.0 Flash (rápido)", "Gemini 2.5 Pro (estándar)", "Gemini 3.5 Flash (computer use nativo)", "Gemini 2.5 Ultra (máximo)"], default: "Gemini 2.5 Pro (estándar)" },
        { id: "managed_agents", label: "¿Usar Managed Agents API?", type: "toggle" },
        { id: "computer_use", label: "¿Computer use nativo?", type: "toggle" },
        { id: "workspace", label: "¿Integración con Google Workspace?", type: "toggle" },
        { id: "tools", label: "Herramientas / APIs disponibles", type: "text", placeholder: "Ej.: Google Sheets API, Calendar API" },
        { id: "function_calling", label: "¿Function calling estructurado?", type: "toggle" },
        { id: "context", label: "¿Contexto largo (>100k tokens)?", type: "toggle" },
        { id: "output", label: "Formato de output", type: "chip", choices: ["JSON estructurado", "Markdown", "Tabla Google Sheets", "Texto libre"], default: "Markdown" },
      ],
    },
  };

  /* ------------------------------------------------------------------------
     Estado
     ------------------------------------------------------------------------ */
  let state = {
    tipo: "texto",
    modelo: "generico",
  };

  function getStoredSession() {
    let token, expiresAt, email, licenseKey;
    try {
      token = localStorage.getItem(LS_TOKEN_KEY);
      expiresAt = parseInt(localStorage.getItem(LS_EXPIRES_KEY) || "0", 10);
      email = localStorage.getItem(LS_EMAIL_KEY) || "";
      licenseKey = localStorage.getItem(LS_LICENSE_KEY) || "";
    } catch {
      return { token: null, expiresAt: 0, email: "", licenseKey: "" };
    }
    return { token, expiresAt, email, licenseKey };
  }

  function saveSession({ token, expiresAt, email, licenseKey }) {
    try {
      if (token) localStorage.setItem(LS_TOKEN_KEY, token);
      if (expiresAt) localStorage.setItem(LS_EXPIRES_KEY, String(expiresAt));
      if (email) localStorage.setItem(LS_EMAIL_KEY, email);
      if (licenseKey) localStorage.setItem(LS_LICENSE_KEY, licenseKey);
    } catch {
      /* localStorage no disponible (modo privado, etc.) — la sesión no persiste */
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem(LS_EXPIRES_KEY);
      localStorage.removeItem(LS_EMAIL_KEY);
      // La license key SÍ se conserva para que el usuario no tenga que ir a
      // buscar su email si solo caducó el token de sesión.
    } catch {
      /* noop */
    }
  }

  /* ------------------------------------------------------------------------
     Elementos del DOM
     ------------------------------------------------------------------------ */
  const panelNoLicense = $("pp-panel-no-license");
  const panelActive = $("pp-panel-active");
  const panelExpired = $("pp-panel-expired");

  const licenseInput = $("pp-license-input");
  const activateBtn = $("pp-activate-btn");
  const activateError = $("pp-activate-error");
  const activateAgainBtn = $("pp-activate-again-btn");
  const expiredMsg = $("pp-expired-msg");
  const emailBadge = $("pp-email-badge");
  const logoutBtn = $("pp-logout-btn");

  const tipoTabs = $("pp-tipo-tabs");
  const modeloTabs = $("pp-modelo-tabs");
  const opcionesContainer = $("pp-opciones");
  const objetivoEl = $("pp-objetivo");
  const contextoEl = $("pp-contexto");
  const generateBtn = $("pp-generate-btn");
  const generateError = $("pp-generate-error");
  const resultadoEl = $("pp-resultado");
  const outputEl = $("pp-output");
  const copyBtn = $("pp-copy-btn");

  if (!panelNoLicense) return; // esta página no tiene el panel del Genio PRO

  /* ------------------------------------------------------------------------
     Render de estados
     ------------------------------------------------------------------------ */
  function showPanel(which) {
    panelNoLicense.hidden = which !== "no-license";
    panelActive.hidden = which !== "active";
    panelExpired.hidden = which !== "expired";
  }

  function renderTipoTabs() {
    tipoTabs.innerHTML = "";
    TIPOS.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pp-tab" + (t.id === state.tipo ? " is-active" : "");
      b.textContent = `${t.icon} ${t.label}`;
      b.setAttribute("aria-pressed", String(t.id === state.tipo));
      b.addEventListener("click", () => {
        if (state.tipo === t.id) return;
        state.tipo = t.id;
        state.modelo = MODELOS[t.id][0].id;
        renderTipoTabs();
        renderModeloTabs();
        renderOpciones();
      });
      tipoTabs.appendChild(b);
    });
  }

  function renderModeloTabs() {
    modeloTabs.innerHTML = "";
    MODELOS[state.tipo].forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pp-tab pp-tab--modelo" + (m.id === state.modelo ? " is-active" : "");
      b.textContent = m.label;
      b.setAttribute("aria-pressed", String(m.id === state.modelo));
      b.addEventListener("click", () => {
        if (state.modelo === m.id) return;
        state.modelo = m.id;
        renderModeloTabs();
        renderOpciones();
      });
      modeloTabs.appendChild(b);
    });
  }

  function renderOpciones() {
    opcionesContainer.innerHTML = "";
    const opciones = (OPCIONES[state.tipo] && OPCIONES[state.tipo][state.modelo]) || [];
    if (opciones.length === 0) {
      opcionesContainer.innerHTML = '<p class="pp-opciones__empty">Este modelo no tiene opciones adicionales: describe todo en el objetivo/contexto.</p>';
      return;
    }
    opciones.forEach((opt) => {
      const field = document.createElement("div");
      field.className = "pp-field";
      field.dataset.optId = opt.id;
      field.dataset.optType = opt.type;

      const label = document.createElement("label");
      label.className = "pp-field__label";
      label.textContent = opt.label;
      field.appendChild(label);

      if (opt.type === "chip") {
        const wrap = document.createElement("div");
        wrap.className = "pp-chips";
        const defaultVal = opt.default || opt.choices[0];
        opt.choices.forEach((choice) => {
          const c = document.createElement("button");
          c.type = "button";
          c.className = "pp-chip" + (choice === defaultVal ? " is-selected" : "");
          c.textContent = choice;
          c.dataset.value = choice;
          c.setAttribute("aria-pressed", String(choice === defaultVal));
          c.addEventListener("click", () => {
            wrap.querySelectorAll(".pp-chip").forEach((el) => {
              el.classList.remove("is-selected");
              el.setAttribute("aria-pressed", "false");
            });
            c.classList.add("is-selected");
            c.setAttribute("aria-pressed", "true");
          });
          wrap.appendChild(c);
        });
        field.appendChild(wrap);
      } else if (opt.type === "toggle") {
        label.classList.add("pp-field__label--toggle");
        const toggleWrap = document.createElement("label");
        toggleWrap.className = "pp-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "pp-toggle__input";
        const track = document.createElement("span");
        track.className = "pp-toggle__track";
        toggleWrap.appendChild(input);
        toggleWrap.appendChild(track);
        field.innerHTML = "";
        const row = document.createElement("div");
        row.className = "pp-field__toggle-row";
        row.appendChild(label);
        row.appendChild(toggleWrap);
        field.appendChild(row);
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "pp-field__input";
        input.maxLength = 200;
        if (opt.placeholder) input.placeholder = opt.placeholder;
        field.appendChild(input);
      }

      opcionesContainer.appendChild(field);
    });
  }

  function collectOpciones() {
    const opciones = {};
    const opts = (OPCIONES[state.tipo] && OPCIONES[state.tipo][state.modelo]) || [];
    opts.forEach((opt) => {
      const field = opcionesContainer.querySelector(`[data-opt-id="${cssEscape(opt.id)}"]`);
      if (!field) return;
      if (opt.type === "chip") {
        const selected = field.querySelector(".pp-chip.is-selected");
        opciones[opt.id] = selected ? selected.dataset.value : (opt.default || opt.choices[0]);
      } else if (opt.type === "toggle") {
        const input = field.querySelector(".pp-toggle__input");
        opciones[opt.id] = !!(input && input.checked);
      } else {
        const input = field.querySelector(".pp-field__input");
        opciones[opt.id] = input ? input.value.trim() : "";
      }
    });
    return opciones;
  }

  function cssEscape(s) {
    return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  /* ------------------------------------------------------------------------
     Activación de la licencia
     ------------------------------------------------------------------------ */
  async function activate(licenseKey) {
    const res = await fetch(WORKER_URL + "/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || "No se pudo activar la licencia." };
    }
    saveSession({ token: data.token, expiresAt: data.expiresAt, email: data.customerEmail || "", licenseKey });
    return { ok: true, data };
  }

  function enterActiveState(email) {
    if (emailBadge) {
      emailBadge.textContent = email ? `Sesión activa: ${email}` : "Sesión activa";
    }
    showPanel("active");
    renderTipoTabs();
    renderModeloTabs();
    renderOpciones();
  }

  function checkSessionOnLoad() {
    const { token, expiresAt, email, licenseKey } = getStoredSession();
    if (token && expiresAt && Date.now() < expiresAt) {
      enterActiveState(email);
    } else if (licenseKey) {
      // Token caducado o inexistente pero hay license key guardada:
      // renovación silenciosa antes de pedir nada al usuario.
      activate(licenseKey).then((result) => {
        if (result.ok) {
          enterActiveState(result.data.customerEmail || email);
        } else {
          showPanel("expired");
          if (expiredMsg) expiredMsg.textContent = result.error;
        }
      });
    } else {
      showPanel("no-license");
    }
  }

  if (activateBtn) {
    activateBtn.addEventListener("click", async () => {
      const key = (licenseInput.value || "").trim();
      activateError.classList.remove("visible");
      if (!key) {
        activateError.textContent = "Introduce tu license key.";
        activateError.classList.add("visible");
        return;
      }
      const originalLabel = activateBtn.textContent;
      activateBtn.disabled = true;
      activateBtn.textContent = "Activando…";
      try {
        const result = await activate(key);
        if (result.ok) {
          enterActiveState(result.data.customerEmail);
        } else {
          activateError.textContent = result.error;
          activateError.classList.add("visible");
        }
      } catch {
        activateError.textContent = "No se pudo conectar con el servicio. Inténtalo de nuevo.";
        activateError.classList.add("visible");
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = originalLabel;
      }
    });
  }

  if (activateAgainBtn) {
    activateAgainBtn.addEventListener("click", () => {
      clearSession();
      showPanel("no-license");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(LS_TOKEN_KEY);
        localStorage.removeItem(LS_EXPIRES_KEY);
        localStorage.removeItem(LS_EMAIL_KEY);
        localStorage.removeItem(LS_LICENSE_KEY);
      } catch {
        /* noop */
      }
      showPanel("no-license");
    });
  }

  /* ------------------------------------------------------------------------
     Generación
     ------------------------------------------------------------------------ */
  async function callGenerate(payload, token) {
    const res = await fetch(WORKER_URL + "/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const objetivo = objetivoEl.value.trim();
      const contexto = contextoEl.value.trim();
      generateError.classList.remove("visible");

      if (!objetivo) {
        generateError.textContent = "Escribe al menos tu objetivo.";
        generateError.classList.add("visible");
        return;
      }

      const { token, licenseKey } = getStoredSession();
      if (!token) {
        showPanel("expired");
        if (expiredMsg) expiredMsg.textContent = "Sesión no válida. Vuelve a introducir tu license key.";
        return;
      }

      const payload = {
        objetivo,
        contexto,
        tipo: state.tipo,
        modelo: state.modelo,
        opciones: collectOpciones(),
      };

      const originalLabel = generateBtn.textContent;
      generateBtn.disabled = true;
      generateBtn.textContent = "Generando…";

      try {
        let { ok, status, data } = await callGenerate(payload, token);

        // Sesión caducada: reactivación silenciosa con la key guardada y
        // reintento único de la misma generación.
        if (!ok && status === 401 && licenseKey) {
          const reactivated = await activate(licenseKey);
          if (reactivated.ok) {
            const retry = await callGenerate(payload, reactivated.data.token);
            ok = retry.ok;
            data = retry.data;
          }
        }

        if (!ok) {
          if (data.errorCode === "session_expired" || data.errorCode === "invalid_license") {
            clearSession();
            showPanel("expired");
            if (expiredMsg) expiredMsg.textContent = data.error || "Tu sesión ha caducado. Vuelve a introducir tu license key.";
          } else {
            generateError.textContent = data.error || "Algo ha fallado. Prueba de nuevo.";
            generateError.classList.add("visible");
          }
        } else {
          outputEl.textContent = data.prompt;
          resultadoEl.classList.add("visible");
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: "click_generar_prompt_pro" });
        }
      } catch {
        generateError.textContent = "No se pudo conectar con el servicio. Inténtalo de nuevo.";
        generateError.classList.add("visible");
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = originalLabel;
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "click_copiar_prompt_pro" });
      const texto = outputEl.textContent;
      try {
        await navigator.clipboard.writeText(texto);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      const original = copyBtn.textContent;
      copyBtn.textContent = "✅ Copiado";
      setTimeout(() => (copyBtn.textContent = original), 2000);
    });
  }

  checkSessionOnLoad();
})();
