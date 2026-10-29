(() => {
  const SALT = "litpa-admin-v1::";
  const DEFAULT_HASH = "9dc43e29cbaecbd6713955436582a57363ec7bf1901b515cf5700ad6aa03cf84";
  const STORAGE_P = "litpa_admin_hash_v1";
  const HOLD_MS = 650;

  const sha256 = (text) => {
    const rotr = (n, x) => (x >>> n) | (x << (32 - n));
    const utf8 = unescape(encodeURIComponent(String(text)));
    const bytes = [];
    for (let i = 0; i < utf8.length; i += 1) bytes.push(utf8.charCodeAt(i) & 255);
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLen / 4294967296);
    const low = bitLen >>> 0;
    bytes.push((high >>> 24) & 255, (high >>> 16) & 255, (high >>> 8) & 255, high & 255);
    bytes.push((low >>> 24) & 255, (low >>> 16) & 255, (low >>> 8) & 255, low & 255);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i += 1) {
        const j = offset + i * 4;
        w[i] =
          ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
        const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;
      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
  };

  const waitApp = (tries = 0) => {
    if (window.LITPA_APP) {
      start(window.LITPA_APP);
      return;
    }
    if (tries > 40) return;
    window.setTimeout(() => waitApp(tries + 1), 50);
  };

  const start = (app) => {
    const trigger = document.getElementById("admin-trigger");
    const lock = document.getElementById("admin-lock");
    const lockForm = document.getElementById("admin-lock-form");
    const lockPass = document.getElementById("admin-lock-pass");
    const lockMsg = document.getElementById("admin-lock-msg");
    const hello = document.getElementById("admin-hello");
    const saveState = document.getElementById("admin-save-state");
    const esc = (value) =>
      String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    let adminSection = "cuestionario";
    let holdTimer = 0;
    let holdFired = false;
    let startX = 0;
    let startY = 0;

    const expectedHash = () => localStorage.getItem(STORAGE_P) || DEFAULT_HASH;
    const hashPass = (value) => sha256(SALT + String(value || ""));
    const markSaved = (text) => {
      if (saveState) saveState.textContent = text || "Guardado en este dispositivo";
    };

    let resultadosData = null;

    const setAdminSection = (name) => {
      adminSection = ["cuestionario", "resultados"].includes(name) ? name : "cuestionario";
      document.querySelectorAll("#admin-section-switch [data-admin-section]").forEach((btn) => {
        const on = btn.dataset.adminSection === adminSection;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.adminPanel !== adminSection;
      });
      if (adminSection === "resultados" && !resultadosData) fetchResultados();
    };

    const INSTITUCION = "Liceo Tecnológico Profesional de Palencia";
    const REPORT_TITLE = "Resultados del cuestionario de evaluación docente";

    const apaDate = () =>
      new Date().toLocaleDateString("es-GT", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    const fetchResultados = async () => {
      const url = String(window.LITPA_SHEETS_URL || "").trim();
      const totalEl = document.getElementById("resultados-total");
      const chartEl = document.getElementById("resultados-chart");
      if (!url) {
        if (totalEl) totalEl.textContent = "Sin URL de Sheets configurada";
        return;
      }
      if (totalEl) totalEl.textContent = "Cargando…";
      try {
        const endpoint = url + (url.includes("?") ? "&" : "?") + "action=resultados";
        const data = await (app.jsonp ? app.jsonp(endpoint) : jsonpFetch(endpoint));
        resultadosData = data;
        renderResultados(data);
      } catch (err) {
        if (totalEl) totalEl.textContent = "Error al cargar resultados";
        if (chartEl) chartEl.innerHTML = `<p class="apa-error">${esc(String(err.message || err))}</p>`;
      }
    };

    const jsonpFetch = (url) =>
      new Promise((resolve, reject) => {
        const cb = `litpa_res_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Tiempo de espera"));
        }, 15000);
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
          reject(new Error("Error de red"));
        };
        document.head.appendChild(script);
      });

    const PIE_COLORS = [
      "#2e7d32",
      "#8b1e1e",
      "#c9a227",
      "#1e5a8b",
      "#6a3d7a",
      "#b85c38",
      "#2f6f6a",
      "#5c4033",
      "#882028",
      "#4a6741",
      "#7a5c2e",
      "#3d5a80",
      "#9c6644",
      "#52796f",
      "#6d597a",
      "#bc6c25",
    ];

    const renderPieChart = (labels, values, colors) => {
      const total = values.reduce((a, b) => a + (Number(b) || 0), 0);
      const cx = 80;
      const cy = 80;
      const r = 70;
      let angle = -Math.PI / 2;
      const slices = [];
      if (!total) {
        slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ddd" />`);
      } else {
        values.forEach((raw, i) => {
          const v = Number(raw) || 0;
          if (v <= 0) return;
          const frac = v / total;
          const a0 = angle;
          const a1 = angle + frac * Math.PI * 2;
          angle = a1;
          const color = colors[i] || PIE_COLORS[i % PIE_COLORS.length];
          if (frac >= 0.999) {
            slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`);
            return;
          }
          const x0 = cx + r * Math.cos(a0);
          const y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy + r * Math.sin(a1);
          const large = frac > 0.5 ? 1 : 0;
          slices.push(
            `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${color}" />`
          );
        });
      }
      const legend = labels
        .map((label, i) => {
          const v = Number(values[i]) || 0;
          const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
          const color = colors[i] || PIE_COLORS[i % PIE_COLORS.length];
          return `<li><span class="apa-pie-swatch" style="background:${color}"></span><span>${esc(label)}: ${v} (${pct}%)</span></li>`;
        })
        .join("");
      return `<div class="apa-pie-wrap" role="img" aria-label="Gráfica de pastel">
        <svg class="apa-pie" viewBox="0 0 160 160" width="180" height="180" aria-hidden="true">${slices.join("")}</svg>
        <ul class="apa-pie-legend">${legend}</ul>
      </div>`;
    };

    const renderResultados = (data) => {
      const totalEl = document.getElementById("resultados-total");
      const chartEl = document.getElementById("resultados-chart");
      if (!data || !data.ok) {
        if (totalEl) totalEl.textContent = "Sin datos";
        return;
      }
      const N = Number(data.total) || 0;
      if (totalEl) totalEl.textContent = `N = ${N}`;
      if (!chartEl) return;

      const preguntas = app.getPreguntas();
      let fig = 0;
      const logoSrc = window.LITPA_LOGO_PNG || "assets/logo.png";
      let html = `
        <div class="apa-sheet">
          <div class="apa-sheet-mark" aria-hidden="true">
            <img src="${esc(logoSrc)}" alt="" width="120" height="149" />
            <span>${esc(INSTITUCION)}</span>
          </div>
          <header class="apa-cover">
            <div class="apa-cover-bar"></div>
            <img class="apa-cover-logo" src="${esc(logoSrc)}" alt="" width="88" height="109" />
            <p class="apa-kicker">Documento institucional · Confidencial</p>
            <p class="apa-org">${esc(INSTITUCION)}</p>
            <h3 class="apa-title">${esc(REPORT_TITLE)}</h3>
            <p class="apa-cover-sub">Portafolio LITPA · Evaluación docente anónima</p>
            <table class="apa-cover-meta">
              <tr><th>Fecha de consulta</th><td>${esc(apaDate())}</td></tr>
              <tr><th>Tamaño de la muestra</th><td><em>N</em> = ${N}</td></tr>
              <tr><th>Presentación</th><td>Gráficas de pastel y tablas de frecuencias</td></tr>
            </table>
          </header>`;

      (data.preguntas || []).forEach((p, i) => {
        const nombre = (preguntas[i] && preguntas[i].texto) || p.texto || `Ítem ${i}`;
        const tipo = (preguntas[i] && preguntas[i].tipo) || p.tipo || "si-no";
        const num = String(i).padStart(2, "0");

        if (tipo === "maestros") {
          const counts = {};
          (p.respuestas || []).forEach((r) => {
            String(r)
              .split(/,\s*/)
              .forEach((m) => {
                const t = m.trim();
                if (t) counts[t] = (counts[t] || 0) + 1;
              });
          });
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          if (!sorted.length) return;
          fig += 1;
          html += `<figure class="apa-figure">
            <figcaption>
              <span class="apa-fig-num">Figura ${fig}</span>
              <span class="apa-fig-title">Gráfica de pastel · menciones docentes (ítem ${num}).</span>
            </figcaption>
            <p class="apa-item-text">${esc(nombre)}</p>
            ${renderPieChart(
              sorted.map((x) => x[0]),
              sorted.map((x) => x[1]),
              sorted.map((_, idx) => PIE_COLORS[idx % PIE_COLORS.length])
            )}
            <p class="apa-note"><em>Nota.</em> Frecuencias absolutas de menciones. ${esc(INSTITUCION)}. <em>N</em> = ${N}.</p>
          </figure>`;
          return;
        }

        if (tipo === "texto") {
          const respuestas = p.respuestas || [];
          if (!respuestas.length) return;
          fig += 1;
          html += `<figure class="apa-figure">
            <figcaption>
              <span class="apa-fig-num">Figura ${fig}</span>
              <span class="apa-fig-title">Respuestas abiertas al ítem ${num}.</span>
            </figcaption>
            <p class="apa-item-text">${esc(nombre)}</p>
            <ol class="apa-open-list">${respuestas.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
            <p class="apa-note"><em>Nota.</em> Respuestas textuales anónimas. ${esc(INSTITUCION)}. <em>N</em> = ${N}.</p>
          </figure>`;
          return;
        }

        const total = (p.si || 0) + (p.no || 0);
        const pctSi = total ? ((p.si / total) * 100).toFixed(1) : "0.0";
        const pctNo = total ? ((p.no / total) * 100).toFixed(1) : "0.0";
        fig += 1;
        html += `<figure class="apa-figure">
          <figcaption>
            <span class="apa-fig-num">Figura ${fig}</span>
            <span class="apa-fig-title">Gráfica de pastel · respuestas Sí/No al ítem ${num}.</span>
          </figcaption>
          <p class="apa-item-text">${esc(nombre)}</p>
          ${renderPieChart(["Sí", "No"], [p.si || 0, p.no || 0], ["#2e7d32", "#8b1e1e"])}
          <table class="apa-table">
            <caption>Tabla ${fig}. Frecuencias y porcentajes del ítem ${num}</caption>
            <thead><tr><th scope="col">Respuesta</th><th scope="col">f</th><th scope="col">%</th></tr></thead>
            <tbody>
              <tr><td>Sí</td><td>${p.si || 0}</td><td>${pctSi}</td></tr>
              <tr><td>No</td><td>${p.no || 0}</td><td>${pctNo}</td></tr>
              <tr><td>Total</td><td>${total}</td><td>${total ? "100.0" : "0.0"}</td></tr>
            </tbody>
          </table>
          <p class="apa-note"><em>Nota.</em> f = frecuencia absoluta. Los porcentajes se calcularon sobre respuestas válidas del ítem. ${esc(INSTITUCION)}. <em>N</em> = ${N}.</p>
        </figure>`;
      });

      if (data.observaciones && data.observaciones.length) {
        fig += 1;
        html += `<figure class="apa-figure">
          <figcaption>
            <span class="apa-fig-num">Figura ${fig}</span>
            <span class="apa-fig-title">Observaciones generales de los participantes.</span>
          </figcaption>
          <ol class="apa-open-list">${data.observaciones.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
          <p class="apa-note"><em>Nota.</em> Comentarios opcionales y anónimos. ${esc(INSTITUCION)}.</p>
        </figure>`;
      }

      html += `<footer class="apa-footer">
            <p>${esc(INSTITUCION)} · Portafolio LITPA</p>
            <p>Informe anónimo. No contiene nombres de estudiantes. Uso interno institucional.</p>
          </footer></div>`;
      chartEl.innerHTML = html;
    };

    const exportCSV = () => {
      if (!resultadosData || !resultadosData.preguntas) {
        fetchResultados();
        return;
      }
      const preguntas = app.getPreguntas();
      const BOM = "\uFEFF";
      const N = Number(resultadosData.total) || 0;
      const rows = [];
      rows.push([INSTITUCION]);
      rows.push([REPORT_TITLE]);
      rows.push([`Fecha de consulta: ${apaDate()}`]);
      rows.push([`N = ${N}`]);
      rows.push([]);
      rows.push(["Ítem", "Pregunta", "Tipo", "Sí (f)", "No (f)", "% Sí", "% No", "Respuestas / menciones"]);
      resultadosData.preguntas.forEach((p, i) => {
        const nombre = (preguntas[i] && preguntas[i].texto) || p.texto || `Ítem ${i}`;
        const tipo = (preguntas[i] && preguntas[i].tipo) || p.tipo || p.tipo;
        if ((p.tipo === "si-no" || tipo === "si-no") && tipo !== "texto" && tipo !== "maestros") {
          const total = (p.si || 0) + (p.no || 0);
          const pctSi = total ? ((p.si / total) * 100).toFixed(1) : "0.0";
          const pctNo = total ? ((p.no / total) * 100).toFixed(1) : "0.0";
          rows.push([i, nombre, "Sí/No", p.si || 0, p.no || 0, pctSi, pctNo, ""]);
        } else {
          rows.push([i, nombre, tipo === "maestros" ? "Maestros" : "Texto", "", "", "", "", (p.respuestas || []).join(" | ")]);
        }
      });
      if (resultadosData.observaciones && resultadosData.observaciones.length) {
        rows.push(["", "Observaciones generales", "Texto", "", "", "", "", resultadosData.observaciones.join(" | ")]);
      }
      rows.push([]);
      rows.push([`Nota. Datos anónimos. ${INSTITUCION}.`]);
      const csv =
        BOM +
        rows
          .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
          .join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resultados-litpa-apa.csv";
      a.click();
      URL.revokeObjectURL(url);
    };

    const renderAll = () => {
      renderQuestionsEditor();
      setAdminSection(adminSection);
    };

    const renderQuestionsEditor = () => {
      const box = document.getElementById("admin-questions");
      const count = document.getElementById("admin-q-count");
      const list = app.getPreguntas();
      if (count) count.textContent = `${list.length} pregunta${list.length === 1 ? "" : "s"}`;
      if (!box) return;
      box.innerHTML = list
        .map((item, i) => {
          const tipo = item.tipo === "texto" ? "texto" : "si-no";
          return `<div class="admin-q">
            <div class="admin-q-top">
              <span class="q-num">${String(i + 1).padStart(2, "0")}</span>
              <select data-q-tipo="${i}" aria-label="Tipo de pregunta">
                <option value="si-no"${tipo === "si-no" ? " selected" : ""}>Sí / No</option>
                <option value="texto"${tipo === "texto" ? " selected" : ""}>Respuesta escrita</option>
              </select>
              <button type="button" class="admin-btn" data-q-up="${i}" title="Subir">↑</button>
              <button type="button" class="admin-btn" data-q-down="${i}" title="Bajar">↓</button>
              <button type="button" class="admin-btn" data-q-del="${i}" title="Eliminar">×</button>
            </div>
            <textarea data-q-text="${i}" maxlength="400" rows="3">${esc(item.texto)}</textarea>
          </div>`;
        })
        .join("");
    };

    const persistPreguntas = () => {
      app.savePreguntas();
      const count = document.getElementById("admin-q-count");
      const list = app.getPreguntas();
      if (count) count.textContent = `${list.length} pregunta${list.length === 1 ? "" : "s"}`;
      markSaved("Cambios guardados");
    };

    const showLock = () => {
      lockMsg.textContent = "";
      lockPass.value = "";
      if (typeof lock.showModal === "function") lock.showModal();
      else lock.setAttribute("open", "");
      window.setTimeout(() => lockPass.focus(), 40);
    };

    const hideLock = () => {
      if (typeof lock.close === "function" && lock.open) lock.close();
      else lock.removeAttribute("open");
    };

    const showHello = () => {
      if (!hello) {
        app.setView("admin");
        renderAll();
        return;
      }
      hello.removeAttribute("hidden");
      hello.classList.remove("is-leaving");
      document.body.classList.add("is-booting");
      const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 2200;
      window.setTimeout(() => {
        hello.classList.add("is-leaving");
        document.body.classList.remove("is-booting");
        app.setView("admin");
        renderAll();
        window.setTimeout(() => hello.setAttribute("hidden", ""), 560);
      }, ms);
    };

    const enterAdmin = () => {
      hideLock();
      showHello();
    };

    const requestAdmin = () => {
      showLock();
    };

    trigger?.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestAdmin();
    });

    trigger?.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      holdFired = false;
      startX = event.clientX;
      startY = event.clientY;
      if (event.pointerType === "mouse") return;
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        holdFired = true;
        requestAdmin();
      }, HOLD_MS);
    });

    const clearHold = () => {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    trigger?.addEventListener("pointerup", clearHold);
    trigger?.addEventListener("pointercancel", clearHold);
    trigger?.addEventListener("pointerleave", clearHold);
    trigger?.addEventListener("pointermove", (event) => {
      if (!holdTimer) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (dx * dx + dy * dy > 144) clearHold();
    });
    trigger?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    trigger?.addEventListener("click", (event) => {
      if (holdFired) {
        event.preventDefault();
        event.stopPropagation();
        holdFired = false;
      }
    });

    lockForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const hash = hashPass(lockPass.value);
      if (hash !== expectedHash()) {
        lockMsg.textContent = "Contraseña incorrecta.";
        lockPass.select();
        return;
      }
      enterAdmin();
    });

    document.getElementById("admin-lock-cancel")?.addEventListener("click", hideLock);

    document.getElementById("admin-pass-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const a = document.getElementById("admin-new-pass");
      const b = document.getElementById("admin-new-pass-2");
      const msg = document.getElementById("admin-pass-msg");
      if (!a.value || a.value.length < 4) {
        msg.textContent = "Use al menos 4 caracteres.";
        return;
      }
      if (a.value !== b.value) {
        msg.textContent = "Las contraseñas no coinciden.";
        return;
      }
      localStorage.setItem(STORAGE_P, hashPass(a.value));
      a.value = "";
      b.value = "";
      msg.textContent = "Contraseña actualizada.";
    });

    document.getElementById("admin-section-switch")?.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-admin-section]");
      if (!btn) return;
      setAdminSection(btn.dataset.adminSection);
      document.getElementById("admin-section-switch")?.scrollIntoView({ block: "start" });
    });

    document.getElementById("resultados-refresh")?.addEventListener("click", () => {
      resultadosData = null;
      fetchResultados();
    });

    document.getElementById("resultados-export")?.addEventListener("click", exportCSV);
    document.getElementById("resultados-print")?.addEventListener("click", () => {
      const openResultados = document.querySelector('[data-admin-section="resultados"]');
      if (openResultados) openResultados.click();
      const go = () => {
        if (!document.querySelector(".apa-sheet")) {
          fetchResultados();
          setTimeout(go, 500);
          return;
        }
        document.body.classList.add("printing-resultados");
        const prev = document.title;
        document.title = "LITPA_Informe_resultados";
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-resultados");
          document.title = prev;
        }, 800);
      };
      if (!resultadosData) {
        fetchResultados();
        setTimeout(go, 700);
      } else {
        go();
      }
    });

    const qBox = document.getElementById("admin-questions");
    qBox?.addEventListener("input", (event) => {
      const area = event.target.closest("[data-q-text]");
      if (!area) return;
      const list = app.getPreguntas();
      const i = Number(area.dataset.qText);
      if (!list[i]) return;
      list[i].texto = area.value;
      persistPreguntas();
    });
    qBox?.addEventListener("change", (event) => {
      const sel = event.target.closest("[data-q-tipo]");
      if (!sel) return;
      const list = app.getPreguntas();
      const i = Number(sel.dataset.qTipo);
      if (!list[i]) return;
      list[i].tipo = sel.value === "texto" ? "texto" : "si-no";
      persistPreguntas();
    });
    qBox?.addEventListener("click", (event) => {
      const list = app.getPreguntas();
      const up = event.target.closest("[data-q-up]");
      const down = event.target.closest("[data-q-down]");
      const del = event.target.closest("[data-q-del]");
      if (up) {
        const i = Number(up.dataset.qUp);
        if (i > 0) {
          const [item] = list.splice(i, 1);
          list.splice(i - 1, 0, item);
          persistPreguntas();
          renderQuestionsEditor();
        }
      }
      if (down) {
        const i = Number(down.dataset.qDown);
        if (i < list.length - 1) {
          const [item] = list.splice(i, 1);
          list.splice(i + 1, 0, item);
          persistPreguntas();
          renderQuestionsEditor();
        }
      }
      if (del) {
        if (list.length < 2) {
          window.alert("Debe quedar al menos una pregunta.");
          return;
        }
        const i = Number(del.dataset.qDel);
        if (!window.confirm("¿Eliminar esta pregunta?")) return;
        list.splice(i, 1);
        persistPreguntas();
        renderQuestionsEditor();
      }
    });

    document.getElementById("admin-add-q")?.addEventListener("click", () => {
      const list = app.getPreguntas();
      if (list.length >= 40) {
        window.alert("El máximo es 40 preguntas.");
        return;
      }
      list.push({ texto: "Nueva pregunta.", tipo: "si-no" });
      persistPreguntas();
      renderQuestionsEditor();
    });

    document.getElementById("admin-reset-q")?.addEventListener("click", () => {
      if (!window.confirm("¿Restaurar las preguntas originales de la encuesta?")) return;
      app.setPreguntas(app.originalsPreguntas());
      renderQuestionsEditor();
      markSaved("Preguntas originales restauradas");
    });

    document.getElementById("admin-export")?.addEventListener("click", () => {
      const blob = new Blob(
        [JSON.stringify({ preguntas: app.getPreguntas() }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "litpa-admin.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("admin-import")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ""));
          if (!window.confirm("Esto reemplaza los datos actuales de este dispositivo. ¿Continuar?")) {
            return;
          }
          if (Array.isArray(parsed)) {
            app.setPreguntas(parsed);
          } else if (parsed.preguntas) {
            app.setPreguntas(parsed.preguntas);
          } else {
            throw new Error("sin preguntas");
          }
          renderAll();
          markSaved("Datos importados");
        } catch {
          window.alert("El archivo no es un JSON válido de preguntas.");
        }
      };
      reader.readAsText(file);
    });
  };

  waitApp();
})();
