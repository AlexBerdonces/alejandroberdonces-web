/* ==========================================================================
   Mejorador de Prompts — widget compartido (ES / EN / FR / CA)
   Llama al Worker de Cloudflare (mejorador-prompts.aberdonces.workers.dev).
   Los textos de UI vienen de window.PROMPT_IMPROVER_I18N, definido inline
   en cada página antes de cargar este script.
   Seguridad: la respuesta de Gemini se pinta siempre con textContent,
   nunca con innerHTML — no se ejecuta como código aunque contenga HTML/JS.

   Copia: siempre libre e inmediata, sin ninguna condición previa.
   CSAT: unos segundos después de copiar aparece un popup NO bloqueante
   pidiendo valorar el resultado (1-5 estrellas). Se puede cerrar con la
   X, con Escape, o se cierra solo tras valorar. Nunca impide seguir
   usando la página.
   ========================================================================== */
(function () {
  "use strict";

  const WORKER_URL = "https://mejorador-prompts.aberdonces.workers.dev";
  const t = window.PROMPT_IMPROVER_I18N || {};
  const $ = (id) => document.getElementById(id);

  const btn = $("pi-btn");
  if (!btn) return; // esta página no tiene el widget

  const objetivoEl = $("pi-objetivo");
  const contextoEl = $("pi-contexto");
  const errorEl = $("pi-error");
  const resultadoEl = $("pi-resultado");
  const outputEl = $("pi-output");
  const copyBtn = $("pi-copy");
  const valoracionEl = $("pi-valoracion");
  const valoracionCloseEl = $("pi-valoracion-close");
  const graciasEl = $("pi-gracias");
  const estrellas = Array.from(document.querySelectorAll("#pi-estrellas button"));

  let usoId = null;
  let csatShown = false;
  let csatShowTimer = null;
  let csatHideTimer = null;

  // Retraso entre "Copiar" y la aparición del popup: lo bastante corto para
  // que la experiencia siga fresca, lo bastante largo para no sentirse como
  // una interrupción del propio gesto de copiar.
  const CSAT_DELAY_MS = 1200;
  const CSAT_AUTOCLOSE_AFTER_RATING_MS = 1800;

  function showCsat() {
    if (csatShown || !usoId || !valoracionEl) return;
    csatShown = true;
    valoracionEl.classList.add("visible");
    // Doble rAF para asegurar que el navegador pinta "display: block" antes
    // de añadir la clase que dispara la transición de entrada.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => valoracionEl.classList.add("show"));
    });
  }

  function hideCsat() {
    if (!valoracionEl) return;
    valoracionEl.classList.remove("show");
    clearTimeout(csatHideTimer);
    csatHideTimer = setTimeout(() => {
      valoracionEl.classList.remove("visible");
    }, 250);
  }

  function resetCsat() {
    clearTimeout(csatShowTimer);
    clearTimeout(csatHideTimer);
    csatShown = false;
    if (valoracionEl) valoracionEl.classList.remove("show", "visible");
    if (graciasEl) graciasEl.classList.remove("visible");
    estrellas.forEach((b) => {
      b.disabled = false;
      b.classList.remove("is-active");
    });
  }

  btn.addEventListener("click", async () => {
    const objetivo = objetivoEl.value.trim();
    const contexto = contextoEl.value.trim();
    errorEl.classList.remove("visible");

    if (!objetivo) {
      errorEl.textContent = t.errGoal || "Write at least your goal.";
      errorEl.classList.add("visible");
      return;
    }

    const originalLabel = t.improveBtn || btn.textContent;
    btn.disabled = true;
    btn.textContent = t.improving || "…";

    try {
      const payload = { objetivo, contexto };
      payload.turnstileToken =
        document.querySelector('[name="cf-turnstile-response"]')?.value || "";

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || t.errFail || "Something went wrong.";
        errorEl.classList.add("visible");
      } else {
        // Nunca innerHTML: la respuesta se muestra siempre como texto plano.
        outputEl.textContent = data.prompt;
        resultadoEl.classList.add("visible");
        usoId = data.id || null;
        resetCsat();
      }
    } catch {
      errorEl.textContent = t.errConn || "Couldn't connect to the service.";
      errorEl.classList.add("visible");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
      // Un token de Turnstile solo es válido una vez. Sin este reset, un
      // segundo clic (tras un error o incluso tras un éxito) reenviaría el
      // mismo token y Cloudflare lo rechazaría siempre como "duplicate".
      if (window.turnstile) {
        try {
          window.turnstile.reset();
        } catch {
          // si el widget no está listo o ya se recargó la página, no pasa nada
        }
      }
    }
  });

  copyBtn.addEventListener("click", async () => {
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
    const original = t.copyBtn || copyBtn.textContent;
    copyBtn.textContent = t.copiedBtn || "✅";
    setTimeout(() => (copyBtn.textContent = original), 2000);

    // La copia nunca espera al CSAT: el popup llega después, por su cuenta.
    clearTimeout(csatShowTimer);
    csatShowTimer = setTimeout(showCsat, CSAT_DELAY_MS);
  });

  if (valoracionCloseEl) {
    valoracionCloseEl.addEventListener("click", () => {
      clearTimeout(csatShowTimer);
      hideCsat();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      valoracionEl &&
      valoracionEl.classList.contains("visible")
    ) {
      hideCsat();
    }
  });

  estrellas.forEach((starBtn) => {
    starBtn.addEventListener("click", async () => {
      if (!usoId) return;
      const v = parseInt(starBtn.dataset.v, 10);
      estrellas.forEach((b) => {
        b.classList.toggle("is-active", parseInt(b.dataset.v, 10) <= v);
        b.disabled = true;
      });
      if (graciasEl) graciasEl.classList.add("visible");
      setTimeout(hideCsat, CSAT_AUTOCLOSE_AFTER_RATING_MS);
      try {
        await fetch(WORKER_URL + "/rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: usoId, rating: v }),
        });
      } catch {
        // silencioso: la valoración es secundaria, no molesta al usuario
      }
    });
  });
})();
