/* ── Theme Selector (easter egg) ────────────────────────── */
(function () {
  "use strict";

  const THEMES = {
    profesional: {
      label: "Profesional",
      color: "#882028",
      vars: {},
    },
    cute: {
      label: "Cute",
      color: "#e8a0bf",
      vars: {
        "--maroon": "#c97b9e",
        "--maroon-dark": "#b0658a",
        "--maroon-soft": "#f9e0ee",
        "--cream": "#fce4f2",
        "--cream-page": "#fdf0f7",
        "--paper": "#fff8fc",
        "--ink": "#3d2232",
        "--muted": "#8a5e78",
        "--line": "#f0c6dd",
        "--gold": "#d4a5e5",
      },
    },
    oscuro: {
      label: "Oscuro",
      color: "#1a1a2e",
      vars: {
        "--maroon": "#c2404a",
        "--maroon-dark": "#a83238",
        "--maroon-soft": "#2e1f2f",
        "--cream": "#0f0f1a",
        "--cream-page": "#1a1a2e",
        "--paper": "#16213e",
        "--ink": "#e0d8e0",
        "--muted": "#9a8fa0",
        "--line": "#2c2c48",
        "--gold": "#c89b3c",
      },
    },
    naturaleza: {
      label: "Naturaleza",
      color: "#2d6a4f",
      vars: {
        "--maroon": "#2d6a4f",
        "--maroon-dark": "#1b4332",
        "--maroon-soft": "#d8f3dc",
        "--cream": "#f0ead2",
        "--cream-page": "#f5f0e1",
        "--paper": "#fefae0",
        "--ink": "#1b2a1b",
        "--muted": "#52796f",
        "--line": "#c9d5a0",
        "--gold": "#a98307",
      },
    },
    oceano: {
      label: "Océano",
      color: "#0077b6",
      vars: {
        "--maroon": "#0077b6",
        "--maroon-dark": "#005f8a",
        "--maroon-soft": "#caf0f8",
        "--cream": "#d4f1f9",
        "--cream-page": "#e8f8fd",
        "--paper": "#f0faff",
        "--ink": "#0a1628",
        "--muted": "#457b9d",
        "--line": "#a8dadc",
        "--gold": "#00b4d8",
      },
    },
    retro: {
      label: "Retro",
      color: "#e76f51",
      vars: {
        "--maroon": "#e76f51",
        "--maroon-dark": "#c45a3c",
        "--maroon-soft": "#fde8d8",
        "--cream": "#f4a261",
        "--cream-page": "#faf3e0",
        "--paper": "#fefae0",
        "--ink": "#2b1f14",
        "--muted": "#7a5c44",
        "--line": "#e6c99a",
        "--gold": "#f4a261",
      },
    },
  };

  const STORAGE_KEY = "litpa_tema_v2";
  const THEME_VAR_KEYS = [];
  Object.keys(THEMES).forEach((id) => {
    Object.keys(THEMES[id].vars || {}).forEach((k) => {
      if (THEME_VAR_KEYS.indexOf(k) === -1) THEME_VAR_KEYS.push(k);
    });
  });

  try {
    localStorage.removeItem("litpa_tema");
    localStorage.removeItem("litpa_aa_unlocked");
    if (localStorage.getItem(STORAGE_KEY) === "aa") {
      localStorage.setItem(STORAGE_KEY, "profesional");
    }
  } catch (e) {
    /* ignore */
  }

  const picker = document.createElement("div");
  picker.className = "theme-picker";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", "Selector de temas");
  picker.setAttribute("aria-hidden", "true");

  function isOpen() {
    return picker.classList.contains("is-open");
  }

  function applyTheme(id) {
    const theme = THEMES[id] || THEMES.profesional;
    const root = document.documentElement;
    THEME_VAR_KEYS.forEach((k) => root.style.removeProperty(k));
    Object.keys(theme.vars || {}).forEach((k) => root.style.setProperty(k, theme.vars[k]));
    root.setAttribute("data-theme", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      /* ignore */
    }
    picker.querySelectorAll(".theme-dot").forEach((d) => {
      d.classList.toggle("is-active", d.dataset.theme === id);
    });
  }

  function togglePicker(show) {
    const next = show === undefined ? !isOpen() : !!show;
    picker.classList.toggle("is-open", next);
    picker.setAttribute("aria-hidden", next ? "false" : "true");
  }

  function paintDots() {
    let saved = "profesional";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "profesional";
    } catch (e) {
      saved = "profesional";
    }
    if (!THEMES[saved]) saved = "profesional";
    const dots = Object.keys(THEMES)
      .map((id) => {
        const t = THEMES[id];
        const active = saved === id ? " is-active" : "";
        return (
          '<button type="button" class="theme-dot' +
          active +
          '" data-theme="' +
          id +
          '" style="--dot:' +
          t.color +
          '" title="' +
          t.label +
          '"><span class="theme-tip">' +
          t.label +
          "</span></button>"
        );
      })
      .join("");
    picker.innerHTML =
      '<button type="button" class="theme-close" aria-label="Cerrar">✕</button>' +
      '<span class="theme-title">Tema</span>' +
      '<div class="theme-dots">' +
      dots +
      "</div>";
  }

  paintDots();
  document.body.appendChild(picker);

  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme && THEMES[savedTheme]) applyTheme(savedTheme);
    else applyTheme("profesional");
  } catch (e) {
    applyTheme("profesional");
  }

  picker.addEventListener("click", function (e) {
    e.stopPropagation();
    if (e.target.closest(".theme-close")) {
      togglePicker(false);
      return;
    }
    const dot = e.target.closest(".theme-dot");
    if (dot) applyTheme(dot.dataset.theme);
  });

  let footerTaps = [];
  let ignoreOutsideUntil = 0;
  const footer = document.querySelector(".site-footer");
  if (footer) {
    footer.style.cursor = "pointer";
    footer.addEventListener("click", function (e) {
      e.stopPropagation();
      const now = Date.now();
      footerTaps.push(now);
      footerTaps = footerTaps.filter((t) => now - t < 2500);
      if (footerTaps.length >= 3) {
        footerTaps = [];
        ignoreOutsideUntil = now + 400;
        togglePicker();
      }
    });
  }

  document.addEventListener("click", function (e) {
    if (!isOpen()) return;
    if (Date.now() < ignoreOutsideUntil) return;
    if (picker.contains(e.target)) return;
    if (e.target.closest(".site-footer")) return;
    togglePicker(false);
  });
})();
