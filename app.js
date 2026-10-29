(() => {
  const SHEETS_URL = String(window.LITPA_SHEETS_URL || "").trim();
  const STORAGE_Q = "litpa_preguntas_v2";
  const form = document.getElementById("eval-form");
  const list = document.getElementById("question-list");
  const maestroPanel = document.getElementById("maestro-panel");
  const bar = document.getElementById("progress-bar");
  const label = document.getElementById("progress-label");
  const status = document.getElementById("form-status");
  const dialog = document.getElementById("done-dialog");
  const summary = document.getElementById("done-summary");
  const header = document.querySelector(".site-header");
  const progressWrap = document.querySelector(".progress-wrap");
  const sentCount = document.getElementById("sent-count");
  const submitBtn = document.getElementById("submit-btn");
  const pageTitle = document.getElementById("page-title");
  const pageSub = document.getElementById("page-sub");
  const backLink = document.querySelector(".back-link");

  const VIEW_COPY = {
    inicio: {
      title: "Portafolio",
      sub: "Cuestionario anónimo de evaluación",
    },
    cuestionario: {
      title: "Evaluación docente",
      sub: "Cuestionario general y anónimo",
    },
    admin: {
      title: "Administración",
      sub: "Preguntas y resultados",
    },
  };

  const cloneData = (value) => JSON.parse(JSON.stringify(value));

  const normalizePreguntas = (data) => {
    const list = Array.isArray(data) ? data : [];
    return list.map((item) => {
      if (typeof item === "string") {
        return { texto: item, tipo: "si-no" };
      }
      return {
        texto: String(item?.texto || ""),
        tipo: item?.tipo === "texto" ? "texto" : item?.tipo === "maestros" ? "maestros" : "si-no",
      };
    });
  };

  const loadPreguntas = () => {
    try {
      const raw = localStorage.getItem(STORAGE_Q);
      if (raw) {
        const loaded = normalizePreguntas(JSON.parse(raw));
        if (loaded.length) return loaded;
      }
    } catch {
      /* usar originales */
    }
    return normalizePreguntas(cloneData(window.LITPA_PREGUNTAS || []));
  };

  let questions = loadPreguntas();
  const totalQ = () => questions.length;
  const closedTotal = () =>
    questions.filter((item) => item.tipo !== "texto" && item.tipo !== "maestros").length;
  const isClosed = (index) => {
    const t = questions[index]?.tipo;
    return t !== "texto" && t !== "maestros";
  };

  const savePreguntas = () => {
    questions = normalizePreguntas(questions);
    try {
      localStorage.setItem(STORAGE_Q, JSON.stringify(questions));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
    renderMaestroPick();
    renderQuestions();
    updateProgress();
  };

  const esc = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const setView = (view) => {
    const next = VIEW_COPY[view] ? view : "inicio";
    document.body.dataset.view = next;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      const on = panel.dataset.viewPanel === next;
      panel.hidden = !on;
    });
    if (pageTitle) pageTitle.textContent = VIEW_COPY[next].title;
    if (pageSub) pageSub.textContent = VIEW_COPY[next].sub;
    if (backLink) backLink.textContent = next === "admin" ? "Salir" : "Volver";
    syncStickyOffset();
    if (next === "admin") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pad = (n) => String(n).padStart(2, "0");

  const makeId = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `litpa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const renderMaestroPick = () => {
    if (!maestroPanel) return;
    const index = questions.findIndex((item) => item.tipo === "maestros");
    if (index < 0) {
      maestroPanel.hidden = true;
      maestroPanel.innerHTML = "";
      return;
    }
    const item = questions[index];
    const maestros = window.LITPA_MAESTROS || [];
    const name = `q${index}`;
    maestroPanel.hidden = false;
    maestroPanel.innerHTML = `
      <div class="maestro-panel-inner">
        <span class="maestro-badge" aria-hidden="true">${pad(index)}</span>
        <div class="maestro-panel-body">
          <p class="maestro-kicker">Reconocimiento docente</p>
          <h3 class="maestro-title" id="maestro-pick-title">${esc(item.texto)}</h3>
          <p class="maestro-help">Puede seleccionar uno o varios maestros.</p>
          <div class="maestro-multi" role="group" aria-labelledby="maestro-pick-title">
            ${maestros
              .map(
                (m) =>
                  `<label class="maestro-check"><input type="checkbox" name="${name}" value="${esc(m)}" /><span>${esc(m)}</span></label>`
              )
              .join("")}
          </div>
          <button type="button" class="admin-btn" id="maestro-comment-btn">Agregar comentario</button>
          <label class="field maestro-comment-wrap" id="maestro-comment-wrap" hidden>
            <span>Comentario <em>(opcional)</em></span>
            <textarea class="q-write" name="${name}_comentario" id="maestro-comment" maxlength="1000" rows="3" placeholder="Escriba un comentario sobre el o los maestros seleccionados."></textarea>
          </label>
        </div>
      </div>`;

    const btn = document.getElementById("maestro-comment-btn");
    const wrap = document.getElementById("maestro-comment-wrap");
    btn?.addEventListener("click", () => {
      if (!wrap) return;
      const open = wrap.hidden;
      wrap.hidden = !open;
      btn.textContent = open ? "Ocultar comentario" : "Agregar comentario";
      if (open) document.getElementById("maestro-comment")?.focus();
      else {
        const ta = document.getElementById("maestro-comment");
        if (ta) ta.value = "";
      }
    });
  };

  const renderQuestions = () => {
    list.innerHTML = questions
      .map((item, index) => {
        if (item.tipo === "maestros") return "";
        const name = `q${index}`;
        const id = `q${index}-label`;
        const open = item.tipo === "texto";
        let answer;
        if (open) {
          answer = `<textarea class="q-write" name="${name}" maxlength="2000" rows="4" placeholder="Escriba su sugerencia. No ponga nombres."></textarea>`;
        } else {
          answer = `<div class="choices" role="radiogroup" aria-labelledby="${id}">
              <label>
                <input type="radio" name="${name}" value="si" required />
                <span>Sí</span>
              </label>
              <label>
                <input type="radio" name="${name}" value="no" />
                <span>No</span>
              </label>
            </div>`;
        }
        return `
        <li>
          <div class="question${open ? " is-open" : ""}">
            <p class="q-prompt" id="${id}">
              <span class="q-num" aria-hidden="true">${pad(index)}</span>
              <span class="q-text">${esc(item.texto)}</span>
            </p>
            ${answer}
          </div>
        </li>`;
      })
      .join("");
  };

  const answeredCount = () => {
    let n = 0;
    for (let i = 0; i < totalQ(); i += 1) {
      if (isClosed(i) && form.querySelector(`input[name="q${i}"]:checked`)) n += 1;
    }
    return n;
  };

  const updateProgress = () => {
    const n = answeredCount();
    const need = closedTotal();
    bar.style.width = `${need ? (n / need) * 100 : 0}%`;
    label.textContent = `${n} de ${need} respondidas`;
    if (submitBtn.disabled) return;
    status.textContent = n === need && need > 0 ? "Cuestionario completo. Ya puede enviar." : "";
  };

  const setSentCount = (total) => {
    if (typeof total !== "number" || Number.isNaN(total)) {
      sentCount.textContent = "—";
      return;
    }
    sentCount.textContent = total.toLocaleString("es-MX");
  };

  const jsonp = (url) =>
    new Promise((resolve, reject) => {
      const cb = `litpa_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Tiempo de espera"));
      }, 10000);
      const cleanup = () => {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      };
      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };
      const script = document.createElement("script");
      script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${cb}`;
      script.onerror = () => {
        cleanup();
        reject(new Error("No se pudo leer el contador"));
      };
      document.head.appendChild(script);
    });

  const refreshCount = async () => {
    if (!SHEETS_URL) {
      setSentCount(NaN);
      return;
    }
    try {
      const data = await jsonp(SHEETS_URL);
      setSentCount(Number(data.total));
    } catch {
      setSentCount(NaN);
    }
  };

  const sendToSheets = async (payload) => {
    if (!SHEETS_URL) {
      throw new Error("Falta configurar Google Sheets (js/config.js).");
    }
    const body = JSON.stringify(payload);
    let posted = false;
    try {
      const res = await fetch(SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow",
      });
      posted = true;
      const parsed = JSON.parse(await res.text());
      if (parsed && parsed.ok) return parsed;
    } catch {
      if (!posted) {
        await fetch(SHEETS_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body,
        });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
    return jsonp(SHEETS_URL);
  };

  const syncStickyOffset = () => {
    if (!header || !progressWrap) return;
    const h = Math.ceil(header.getBoundingClientRect().height);
    progressWrap.style.top = `${h}px`;
    document.documentElement.style.setProperty("--header-h", `${h}px`);
  };

  const firstUnanswered = () => {
    for (let i = 0; i < totalQ(); i += 1) {
      if (isClosed(i) && !form.querySelector(`input[name="q${i}"]:checked`)) {
        return form.querySelector(`input[name="q${i}"]`)?.closest(".question");
      }
    }
    return null;
  };

  form.addEventListener("change", updateProgress);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);

    if (answeredCount() < closedTotal() || closedTotal() < 1) {
      status.textContent = "Responda las preguntas cerradas antes de enviar.";
      firstUnanswered()?.scrollIntoView({ block: "center" });
      return;
    }

    const now = new Date();
    const respuestas = {};
    for (let i = 0; i < totalQ(); i += 1) {
      if (questions[i]?.tipo === "maestros") {
        respuestas[`q${i}`] = data.getAll(`q${i}`).map((v) => String(v).trim()).filter(Boolean).join(", ");
        const comentario = String(data.get(`q${i}_comentario`) || "").trim();
        if (comentario) respuestas[`q${i}_comentario`] = comentario;
      } else {
        respuestas[`q${i}`] = String(data.get(`q${i}`) || "").trim();
      }
    }

    const payload = {
      id: makeId(),
      fecha_cliente: now.toISOString(),
      epoch_cliente: now.getTime(),
      total: totalQ(),
      tipos: questions.map((item) =>
        item.tipo === "texto" ? "texto" : item.tipo === "maestros" ? "maestros" : "si-no"
      ),
      respuestas,
      observacion: String(data.get("observacion") || "").trim(),
    };

    submitBtn.disabled = true;
    status.textContent = "Guardando respuesta anónima…";

    try {
      const result = await sendToSheets(payload);
      if (result && result.ok === false) {
        throw new Error(result.error || "No se pudo guardar. Intente de nuevo.");
      }
      const total = Number(result.total);
      setSentCount(total);
      summary.textContent =
        "Su envío es anónimo. No se registró nombre ni dato personal. " +
        (Number.isFinite(total)
          ? `Van ${total.toLocaleString("es-MX")} cuestionarios recibidos.`
          : "La respuesta quedó registrada.");
      form.reset();
      updateProgress();
      launchConfetti();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else status.textContent = summary.textContent;
      refreshCount();
    } catch (error) {
      status.textContent = error.message || "No se pudo guardar. Intente de nuevo.";
    } finally {
      submitBtn.disabled = false;
      syncStickyOffset();
    }
  });

  window.addEventListener("resize", syncStickyOffset);
  document.querySelectorAll("[data-open-view]").forEach((el) => {
    el.addEventListener("click", () => setView(el.dataset.openView));
    if (el.tagName !== "BUTTON") {
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setView(el.dataset.openView);
        }
      });
    }
  });
  renderMaestroPick();
  renderQuestions();
  setView("inicio");
  updateProgress();
  refreshCount();

  const boot = document.getElementById("boot-screen");
  const hideBoot = () => {
    if (!boot || boot.classList.contains("is-leaving")) return;
    boot.classList.add("is-leaving");
    document.body.classList.remove("is-booting");
    setTimeout(() => {
      boot.setAttribute("hidden", "");
      syncStickyOffset();
    }, 560);
  };
  const bootMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 4000;
  window.setTimeout(hideBoot, bootMs);

  const launchConfetti = () => {
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const colors = ["#882028", "#d4a017", "#ffffff", "#f8e8b0", "#6a181e", "#e8c547"];
    const particles = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.15,
    }));
    const start = performance.now();
    const duration = 3000;
    const frame = (now) => {
      const elapsed = now - start;
      if (elapsed > duration) { canvas.remove(); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.min(1, 1 - (elapsed - duration + 600) / 600);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.rot += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  document.getElementById("qr-open")?.addEventListener("click", () => {
    const dlg = document.getElementById("qr-dialog");
    const img = document.getElementById("qr-img");
    if (!dlg || !img) return;
    const url = encodeURIComponent(window.location.href.split("?")[0]);
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${url}`;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });

  window.LITPA_APP = {
    cloneData,
    normalizePreguntas,
    getPreguntas: () => questions,
    setPreguntas: (next) => {
      const loaded = normalizePreguntas(next);
      if (!loaded.length) return;
      questions = loaded;
      savePreguntas();
    },
    savePreguntas,
    originalsPreguntas: () => normalizePreguntas(cloneData(window.LITPA_PREGUNTAS || [])),
    setView,
    jsonp,
  };
})();
