/**
 * LITPA — backend de Google Sheets (cuestionario anónimo + informe semanal).
 *
 * Pegue este archivo en: Hoja → Extensiones → Apps Script → Guardar.
 * 1. Ejecute setup y autorice.
 * 2. Implementar → Aplicación web → Ejecutar como: Yo → Acceso: Cualquier persona.
 * 3. Use SOLO la URL de "Aplicación web" (termina en /exec).
 *    No use la URL de "Biblioteca": este proyecto no es una librería.
 * 4. Informe semanal: ejecute setupInformeSemanal una vez.
 *    Prueba inmediata: probarInformeSemanal.
 *
 * Si el script no está unido a la hoja, ponga el ID en SPREADSHEET_ID.
 */

var SHEET_NAME = "Respuestas";
var TOTAL_PREGUNTAS = 21; // q0..q20
var MAX_PREGUNTAS = 40;
var MAX_TEXTO = 2000;
var MAX_BODY = 80000;
var SPREADSHEET_ID = "";

/* Informe semanal (PDF + correo). Deje el correo institucional. */
var REPORT_EMAIL = "liceotecnologicoprofesional02@gmail.com";
var REPORT_FOLDER = "Informes LITPA";
/* Opcional Telegram: cree un bot con @BotFather y ponga el chat_id. */
var TELEGRAM_BOT_TOKEN = "";
var TELEGRAM_CHAT_ID = "";

function setup() {
  var sheet = ensureSheet_();
  return "Listo: hoja \"" + sheet.getName() + "\". Ahora implemente como Aplicación web.";
}

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === "resultados") {
      return jsonpOrJson_(getResultados_(), e);
    }
    return jsonpOrJson_({ ok: true, total: countRows_() }, e);
  } catch (err) {
    return jsonpOrJson_({ ok: false, error: String(err.message || err) }, e);
  }
}

function getResultados_() {
  return getResultadosDesde_(0);
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    return jsonpOrJson_(saveRow_(payload), e);
  } catch (err) {
    return jsonpOrJson_({ ok: false, error: String(err.message || err) }, e);
  }
}

function parsePayload_(e) {
  var raw = "";
  if (e && e.postData && e.postData.contents) {
    raw = e.postData.contents;
  } else if (e && e.parameter && e.parameter.payload) {
    raw = e.parameter.payload;
  }
  if (!raw) {
    throw new Error("Sin datos");
  }
  if (raw.length > MAX_BODY) {
    throw new Error("Envío demasiado largo");
  }
  var payload = JSON.parse(raw);
  if (!payload || typeof payload !== "object") {
    throw new Error("JSON inválido");
  }
  return payload;
}

function saveRow_(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = ensureSheet_();
    SpreadsheetApp.flush();

    var numero = countRows_() + 1;
    var servidor = new Date();
    var isoServidor = Utilities.formatDate(servidor, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    var id = String((payload && payload.id) || Utilities.getUuid());
    var isoCliente = safeCell_((payload && payload.fecha_cliente) || "");
    var epochCliente = Number((payload && payload.epoch_cliente) || 0);
    var observacion = safeCell_((payload && payload.observacion) || "").slice(0, MAX_TEXTO);

    var answers = (payload && payload.respuestas) || {};
    var tipos = (payload && payload.tipos) || [];
    var enviadas = Number(payload && payload.total);
    if (!enviadas || enviadas < 1) {
      enviadas = TOTAL_PREGUNTAS;
    }
    if (enviadas > MAX_PREGUNTAS) {
      enviadas = MAX_PREGUNTAS;
    }

    ensureQuestionHeaders_(sheet, enviadas);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var obs = indexOfHeader_(headers, "observacion");
    var qCount = obs >= 6 ? obs - 6 : enviadas;

    var row = [id, numero, isoServidor, servidor.getTime(), isoCliente, epochCliente];

    // El formulario numera desde q0 (maestros, texto o sí/no).
    for (var i = 0; i < qCount; i++) {
      if (i >= enviadas) {
        row.push("");
        continue;
      }
      var rawAns = String(answers["q" + i] || "");
      var tipo = String(tipos[i] || "si-no");
      if (tipo === "texto" || tipo === "maestros") {
        row.push(safeCell_(rawAns).slice(0, MAX_TEXTO));
        continue;
      }
      var value = rawAns.toLowerCase();
      if (value !== "si" && value !== "no") {
        throw new Error("Cuestionario incompleto");
      }
      row.push(value);
    }

    // Comentario opcional de la pregunta de maestros (si viene).
    var comMaestros = "";
    for (var c = 0; c < enviadas; c++) {
      if (tipos[c] === "maestros") {
        comMaestros = safeCell_(String(answers["q" + c + "_comentario"] || "")).slice(0, MAX_TEXTO);
        break;
      }
    }
    if (comMaestros && observacion) {
      observacion = "[Maestros] " + comMaestros + " | " + observacion;
    } else if (comMaestros) {
      observacion = "[Maestros] " + comMaestros;
    }
    row.push(observacion);

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    var recibidos = countRows_();
    return { ok: true, numero: numero, total: recibidos, id: id, recibido: isoServidor };
  } finally {
    lock.releaseLock();
  }
}

function countRows_() {
  var sheet = ensureSheet_();
  return Math.max(sheet.getLastRow() - 1, 0);
}

function indexOfHeader_(headers, name) {
  var i;
  for (i = 0; i < headers.length; i++) {
    if (String(headers[i]) === name) {
      return i;
    }
  }
  return -1;
}

function ensureQuestionHeaders_(sheet, total) {
  if (sheet.getLastRow() === 0) {
    return;
  }
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var obs = indexOfHeader_(headers, "observacion");
  var existing = obs >= 6 ? obs - 6 : Math.max(lastCol - 7, 0);
  if (total <= existing) {
    return;
  }
  var need = total - existing;
  var i;
  if (obs >= 0) {
    sheet.insertColumnsBefore(obs + 1, need);
    for (i = 0; i < need; i++) {
      sheet.getRange(1, obs + 1 + i).setValue("pregunta_" + (existing + i));
    }
  } else {
    for (i = 0; i < need; i++) {
      sheet.getRange(1, lastCol + 1 + i).setValue("pregunta_" + (existing + i));
    }
  }
}

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    return ss;
  }
  var id = String(SPREADSHEET_ID || "").trim();
  if (!id) {
    id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
  }
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  throw new Error(
    "Abra este archivo desde la Hoja (Extensiones > Apps Script) o ponga el ID en SPREADSHEET_ID."
  );
}

function ensureSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    var headers = [
      "id_unico",
      "numero",
      "recibido_iso",
      "epoch_ms",
      "cliente_iso",
      "cliente_epoch_ms",
    ];
    var i;
    for (i = 0; i < TOTAL_PREGUNTAS; i++) {
      headers.push("pregunta_" + i);
    }
    headers.push("observacion");
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function safeCell_(value) {
  var text = String(value == null ? "" : value);
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function jsonpOrJson_(obj, e) {
  var json = JSON.stringify(obj);
  var callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[A-Za-z_][A-Za-z0-9_]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ")").setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/**
 * RESET de encuestas: borra todas las filas de respuestas y deja solo encabezados.
 * En Apps Script: elija limpiarRespuestas → ▶ Ejecutar.
 * No toca la URL /exec, ni el correo, ni el disparador semanal.
 */
function limpiarRespuestas() {
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  SpreadsheetApp.flush();
  return "Listo: hoja limpia (0 encuestas). Encabezados intactos.";
}

/** Una vez: disparador semanal (viernes 16:00, zona horaria del script). */
function setupInformeSemanal() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "enviarInformeSemanal") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("enviarInformeSemanal")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .create();
  return "Listo: cada viernes a las 16:00 se generará el PDF y se enviará a REPORT_EMAIL.";
}

/** Prueba inmediata del PDF + correo (sin esperar al viernes). */
function probarInformeSemanal() {
  return enviarInformeSemanal();
}

function enviarInformeSemanal() {
  var tz = Session.getScriptTimeZone() || "America/Guatemala";
  var hoy = new Date();
  /* Informe COMPLETO (todas las encuestas), regenerado cada semana. */
  var data = getResultados_();
  var periodo =
    "Corte al " + Utilities.formatDate(hoy, tz, "yyyy-MM-dd") + " · informe completo";
  var html = buildInformeHtml_(data, periodo);
  var nombre =
    "LITPA_informe_completo_" + Utilities.formatDate(hoy, tz, "yyyy-MM-dd") + ".pdf";
  var pdf = htmlToPdf_(html, nombre);
  var folder = ensureReportFolder_();
  var file = folder.createFile(pdf);
  var email = String(REPORT_EMAIL || "").trim();
  if (email) {
    GmailApp.sendEmail(
      email,
      "LITPA · Informe completo de encuestas (" +
        Utilities.formatDate(hoy, tz, "yyyy-MM-dd") +
        ")",
      "Adjunto el informe COMPLETO de evaluación docente (todas las encuestas acumuladas), con gráficas de pastel.\n\n" +
        periodo +
        "\nN = " +
        data.total +
        "\nArchivo en Drive: " +
        file.getUrl() +
        "\n\nLiceo Tecnológico Profesional de Palencia",
      { attachments: [pdf], name: "Portafolio LITPA" }
    );
  }
  sendTelegramDocument_(
    pdf,
    "Informe completo LITPA · " + periodo + " · N=" + data.total
  );
  return {
    ok: true,
    n: data.total,
    file: file.getUrl(),
    email: email || "(sin REPORT_EMAIL)",
  };
}

function getResultadosDesde_(fromMs) {
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { ok: true, total: 0, preguntas: [], observaciones: [] };
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var all = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var data = [];
  var r;
  for (r = 0; r < all.length; r++) {
    var epoch = Number(all[r][3] || 0);
    if (!fromMs || epoch >= fromMs) data.push(all[r]);
  }
  var total = data.length;
  var obsIdx = indexOfHeader_(headers, "observacion");
  var qStart = 6;
  var qEnd = obsIdx >= 0 ? obsIdx : lastCol;
  var preguntas = [];
  var col;
  for (col = qStart; col < qEnd; col++) {
    var si = 0,
      no = 0;
    var respuestas = [];
    var esTexto = false;
    for (r = 0; r < data.length; r++) {
      var val = String(data[r][col] || "").trim().toLowerCase();
      if (!val) continue;
      if (val === "si" || val === "sí") si++;
      else if (val === "no") no++;
      else {
        esTexto = true;
        respuestas.push(String(data[r][col] || "").trim());
      }
    }
    if (esTexto && respuestas.length > 0) {
      preguntas.push({
        texto: String(headers[col] || "pregunta_" + (col - qStart)),
        tipo: "texto",
        respuestas: respuestas,
      });
    } else {
      preguntas.push({
        texto: String(headers[col] || "pregunta_" + (col - qStart)),
        tipo: "si-no",
        si: si,
        no: no,
      });
    }
  }
  var observaciones = [];
  if (obsIdx >= 0) {
    for (r = 0; r < data.length; r++) {
      var obs = String(data[r][obsIdx] || "").trim();
      if (obs) observaciones.push(obs);
    }
  }
  return { ok: true, total: total, preguntas: preguntas, observaciones: observaciones };
}

function buildInformeHtml_(data, periodo) {
  var N = Number(data.total) || 0;
  var html =
    "<html><head><meta charset='UTF-8'><style>" +
    "body{font-family:Georgia,serif;color:#1a1a1a;margin:24px;}" +
    "h1{font-size:18px;margin:8px 0 4px;text-align:center;}" +
    "h2{font-size:13px;margin:18px 0 8px;}" +
    "table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 12px;}" +
    "th,td{border:1px solid #777;padding:5px 7px;text-align:left;}" +
    "th{background:#f4ece3;}" +
    ".note{font-size:11px;color:#444;margin:0 0 18px;}" +
    ".head{text-align:center;border-bottom:2px solid #882028;padding-bottom:12px;margin-bottom:16px;}" +
    ".k{letter-spacing:.12em;font-size:10px;color:#882028;font-weight:bold;}" +
    ".pie-wrap{display:flex;align-items:center;gap:16px;margin:8px 0 12px;}" +
    ".leg{list-style:none;padding:0;margin:0;font-size:12px;}" +
    ".leg li{margin:3px 0;}" +
    ".sw{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid #666;}" +
    "</style></head><body>" +
    "<div class='head'><p class='k'>DOCUMENTO INSTITUCIONAL · CONFIDENCIAL</p>" +
    "<h1>Liceo Tecnológico Profesional de Palencia</h1>" +
    "<h1>Informe completo de evaluación docente</h1>" +
    "<p>" +
    periodo +
    " · N = " +
    N +
    "</p><p>Gráficas de pastel generadas al momento del envío</p></div>";
  var i;
  for (i = 0; i < (data.preguntas || []).length; i++) {
    var p = data.preguntas[i];
    html += "<h2>Ítem " + i + ". " + escapeHtml_(p.texto) + "</h2>";
    if (p.tipo === "texto") {
      if (p.respuestas && p.respuestas.length) {
        var counts = {};
        var r;
        var maxLabel = 0;
        for (r = 0; r < p.respuestas.length; r++) {
          var parts = String(p.respuestas[r] || "").split(/,\s*/);
          var k;
          for (k = 0; k < parts.length; k++) {
            var t = parts[k].replace(/^\s+|\s+$/g, "");
            if (!t) continue;
            counts[t] = (counts[t] || 0) + 1;
            if (t.length > maxLabel) maxLabel = t.length;
          }
        }
        var labels = [];
        var values = [];
        for (var key in counts) {
          if (counts.hasOwnProperty(key)) {
            labels.push(key);
            values.push(counts[key]);
          }
        }
        /* Pastel solo si parece categorías cortas (ej. maestros), no ensayos largos. */
        if (labels.length && labels.length <= 20 && maxLabel < 45) {
          html += pieSvgHtml_(labels, values);
        }
        html += "<ol>";
        for (r = 0; r < p.respuestas.length; r++) {
          html += "<li>" + escapeHtml_(p.respuestas[r]) + "</li>";
        }
        html += "</ol>";
      }
    } else {
      var tot = (p.si || 0) + (p.no || 0);
      var ps = tot ? ((p.si / tot) * 100).toFixed(1) : "0.0";
      var pn = tot ? ((p.no / tot) * 100).toFixed(1) : "0.0";
      html += pieSvgHtml_(["Sí", "No"], [p.si || 0, p.no || 0], ["#2e7d32", "#8b1e1e"]);
      html +=
        "<table><thead><tr><th>Respuesta</th><th>f</th><th>%</th></tr></thead><tbody>" +
        "<tr><td>Sí</td><td>" +
        (p.si || 0) +
        "</td><td>" +
        ps +
        "</td></tr>" +
        "<tr><td>No</td><td>" +
        (p.no || 0) +
        "</td><td>" +
        pn +
        "</td></tr>" +
        "<tr><td>Total</td><td>" +
        tot +
        "</td><td>" +
        (tot ? "100.0" : "0.0") +
        "</td></tr></tbody></table>";
    }
    html +=
      "<p class='note'><i>Nota.</i> Datos anónimos. Liceo Tecnológico Profesional de Palencia. N = " +
      N +
      ".</p>";
  }
  if (data.observaciones && data.observaciones.length) {
    html += "<h2>Observaciones generales</h2><ol>";
    for (i = 0; i < data.observaciones.length; i++) {
      html += "<li>" + escapeHtml_(data.observaciones[i]) + "</li>";
    }
    html += "</ol>";
  }
  html +=
    "<p class='note'>Uso interno. Informe completo regenerado semanalmente. No contiene nombres de estudiantes.</p></body></html>";
  return html;
}

function pieSvgHtml_(labels, values, colors) {
  colors = colors || [
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
  ];
  var total = 0;
  var i;
  for (i = 0; i < values.length; i++) total += Number(values[i]) || 0;
  var cx = 80;
  var cy = 80;
  var r = 70;
  var angle = -Math.PI / 2;
  var paths = "";
  if (!total) {
    paths = '<circle cx="80" cy="80" r="70" fill="#ddd"/>';
  } else {
    for (i = 0; i < values.length; i++) {
      var v = Number(values[i]) || 0;
      if (v <= 0) continue;
      var frac = v / total;
      var a0 = angle;
      var a1 = angle + frac * Math.PI * 2;
      angle = a1;
      var color = colors[i % colors.length];
      if (frac >= 0.999) {
        paths +=
          '<circle cx="80" cy="80" r="70" fill="' + color + '"/>';
        continue;
      }
      var x0 = cx + r * Math.cos(a0);
      var y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1);
      var y1 = cy + r * Math.sin(a1);
      var large = frac > 0.5 ? 1 : 0;
      paths +=
        '<path d="M ' +
        cx +
        " " +
        cy +
        " L " +
        x0.toFixed(2) +
        " " +
        y0.toFixed(2) +
        " A " +
        r +
        " " +
        r +
        " 0 " +
        large +
        " 1 " +
        x1.toFixed(2) +
        " " +
        y1.toFixed(2) +
        ' Z" fill="' +
        color +
        '"/>';
    }
  }
  var leg = "<ul class='leg'>";
  for (i = 0; i < labels.length; i++) {
    var vv = Number(values[i]) || 0;
    var pct = total ? ((vv / total) * 100).toFixed(1) : "0.0";
    leg +=
      "<li><span class='sw' style='background:" +
      colors[i % colors.length] +
      "'></span>" +
      escapeHtml_(labels[i]) +
      ": " +
      vv +
      " (" +
      pct +
      "%)</li>";
  }
  leg += "</ul>";
  return (
    "<div class='pie-wrap'><svg width='160' height='160' viewBox='0 0 160 160'>" +
    paths +
    "</svg>" +
    leg +
    "</div>"
  );
}

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function htmlToPdf_(html, filename) {
  var blob = HtmlService.createHtmlOutput(html).getAs("application/pdf");
  blob.setName(filename);
  return blob;
}

function ensureReportFolder_() {
  var it = DriveApp.getFoldersByName(REPORT_FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(REPORT_FOLDER);
}

function sendTelegramDocument_(blob, caption) {
  var token = String(TELEGRAM_BOT_TOKEN || "").trim();
  var chat = String(TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) return;
  var url = "https://api.telegram.org/bot" + token + "/sendDocument";
  UrlFetchApp.fetch(url, {
    method: "post",
    payload: {
      chat_id: chat,
      caption: caption,
      document: blob,
    },
  });
}
