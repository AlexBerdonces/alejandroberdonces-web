/* ==========================================================================
   Mejorador de Prompts — widget compartido (ES / EN / FR / CA)
   Llama al Worker de Cloudflare (mejorador-prompts.aberdonces.workers.dev).
   Los textos de UI vienen de window.PROMPT_IMPROVER_I18N, definido inline
   en cada página antes de cargar este script.
   Seguridad: la respuesta de Gemini se pinta siempre con textContent,
   nunca con innerHTML — no se ejecuta como código aunque contenga HTML/JS.
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
  const copyHintEl = $("pi-copy-hint");
  const valoracionEl = $("pi-valoracion");
  const graciasEl = $("pi-gracias");
  const estrellas = Array.from(document.querySelectorAll("#pi-estrellas button"));

  let usoId = null;
  // Copiar solo se permite tras valorar. Si el Worker no devuelve un id de
  // uso (no hay nada que valorar), no se bloquea la copia.
  let valorado = false;

  function resetValoracion() {
    valorado = false;
    valoracionEl.classList.remove("visible", "prompt-tool__rating--attention");
    graciasEl.classList.remove("visible");
    copyBtn.classList.remove("is-locked");
    if (copyHintEl) copyHintEl.classList.remove("visible");
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
        resetValoracion();
        if (usoId) {
          valoracionEl.classList.add("visible");
          copyBtn.classList.add("is-locked");
        } else {
          // Sin id de uso no hay valoración posible: no se bloquea la copia.
          valorado = true;
        }
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
    if (!valorado) {
      if (copyHintEl) {
        copyHintEl.textContent =
          t.copyLocked ||
          "Please rate the result from 1 to 5 stars below before copying it.";
        copyHintEl.classList.add("visible");
      }
      valoracionEl.classList.add("prompt-tool__rating--attention");
      valoracionEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(
        () => valoracionEl.classList.remove("prompt-tool__rating--attention"),
        1700
      );
      return;
    }
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
  });

  estrellas.forEach((starBtn) => {
    starBtn.addEventListener("click", async () => {
      if (!usoId) return;
      const v = parseInt(starBtn.dataset.v, 10);
      estrellas.forEach((b) => {
        b.classList.toggle("is-active", parseInt(b.dataset.v, 10) <= v);
        b.disabled = true;
      });
      graciasEl.classList.add("visible");
      // Valorar desbloquea la copia de inmediato, sin esperar a la red.
      valorado = true;
      copyBtn.classList.remove("is-locked");
      if (copyHintEl) copyHintEl.classList.remove("visible");
      valoracionEl.classList.remove("prompt-tool__rating--attention");
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
