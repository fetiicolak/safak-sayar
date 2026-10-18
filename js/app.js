/* ================== Sabitler ================== */
const BASE_TERHIS = new Date(2026, 9, 28, 9, 0, 0); // 28 Ekim 2026 09:00 (yerel saat)
const SILA_HAKKI = 6;
const STORAGE_KEY = "safak-sayar-v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ================== Zaman (debugDate desteğiyle) ================== */
const debugParam = new URLSearchParams(location.search).get("debugDate");
const DEBUG_DATE = debugParam ? new Date(debugParam) : null;
function now() {
  return DEBUG_DATE && !isNaN(DEBUG_DATE) ? new Date(DEBUG_DATE) : new Date();
}

/* ================== Durum ================== */
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        silaEntries: Array.isArray(s.silaEntries) ? s.silaEntries : [],
        cezaEntries: Array.isArray(s.cezaEntries) ? s.cezaEntries : [],
        dayNotes: s.dayNotes && typeof s.dayNotes === "object" ? s.dayNotes : {},
      };
    }
  } catch (e) { /* bozuk veri -> sıfırla */ }
  return { silaEntries: [], cezaEntries: [], dayNotes: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ================== Hesaplama ================== */
function silaUsed() {
  return state.silaEntries.reduce((t, e) => t + e.days, 0);
}
function cezaTotal() {
  return state.cezaEntries.reduce((t, e) => t + e.days, 0);
}
function extraDays() {
  return silaUsed() + cezaTotal();
}
function effectiveTerhis() {
  const d = new Date(BASE_TERHIS);
  d.setDate(d.getDate() + extraDays());
  return d;
}
function safakCount() {
  const diff = effectiveTerhis().getTime() - now().getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

/* ================== Yardımcılar ================== */
const fmtLong = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const fmtWeekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" });
const fmtMonthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function esc(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================== Ana ekran ================== */
function renderHome() {
  const safak = safakCount();
  const terhis = effectiveTerhis();
  const numberEl = document.getElementById("safakNumber");
  const labelEl = document.getElementById("safakLabel");
  const quoteBox = document.getElementById("quoteBox");

  document.getElementById("todayLine").textContent = fmtWeekday.format(now());

  if (safak <= 0) {
    numberEl.textContent = "TERHİS! 🎉";
    numberEl.classList.add("done");
    labelEl.textContent = "";
    quoteBox.hidden = false;
    quoteBox.textContent = TERHIS_MESSAGE;
  } else {
    numberEl.textContent = safak;
    numberEl.classList.remove("done");
    labelEl.textContent = safak === 1 ? "ŞAFAK KALDI" : "ŞAFAK";
    if (safak <= 10) {
      quoteBox.hidden = false;
      quoteBox.textContent = MOTIVATION_QUOTES[10 - safak] || MOTIVATION_QUOTES[0];
    } else {
      quoteBox.hidden = true;
    }
  }

  document.getElementById("terhisLine").textContent =
    `Terhis: ${fmtLong.format(terhis)} · 09.00`;

  const extra = extraDays();
  const extraLine = document.getElementById("extraLine");
  if (extra > 0) {
    extraLine.hidden = false;
    const parts = [];
    if (silaUsed() > 0) parts.push(`${silaUsed()} gün sıla`);
    if (cezaTotal() > 0) parts.push(`${cezaTotal()} gün ceza`);
    extraLine.textContent = `+${extra} gün (${parts.join(" + ")})`;
  } else {
    extraLine.hidden = true;
  }

  document.getElementById("silaChip").textContent =
    `🏠 Sıla: ${SILA_HAKKI - silaUsed()}/${SILA_HAKKI} gün hakkın var`;
  const cezaChip = document.getElementById("cezaChip");
  if (cezaTotal() > 0) {
    cezaChip.hidden = false;
    cezaChip.textContent = `⚠️ Ceza: +${cezaTotal()} gün`;
  } else {
    cezaChip.hidden = true;
  }

  updateBadge(safak);
}

/* ================== Rozet (ikon üzerindeki sayı) ================== */
async function updateBadge(count) {
  if (!("setAppBadge" in navigator)) return;
  try {
    if (count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch (e) { /* izin yoksa sessizce geç */ }
}

// iOS'ta rozet için bildirim izni gerekir; yüklü uygulamada ilk dokunuşta bir kez iste.
function maybeRequestBadgePermission() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (!standalone || !("Notification" in window) || Notification.permission !== "default") return;
  const ask = () => {
    Notification.requestPermission().then(() => updateBadge(safakCount()));
    window.removeEventListener("pointerdown", ask);
  };
  window.addEventListener("pointerdown", ask, { once: true });
}

/* ================== Sıla ================== */
function renderSila() {
  const used = silaUsed();
  document.getElementById("silaRemaining").textContent = `${SILA_HAKKI - used} gün`;
  document.getElementById("silaTotal").textContent = SILA_HAKKI;

  const list = document.getElementById("silaList");
  if (state.silaEntries.length === 0) {
    list.innerHTML = `<div class="list-empty">Henüz sıla izni kullanılmadı.</div>`;
    return;
  }
  list.innerHTML = state.silaEntries.map(e => `
    <div class="list-item">
      <div class="li-days">+${e.days}<small>gün</small></div>
      <div class="li-body">
        <div class="li-title">${e.note ? esc(e.note) : "Sıla izni"}</div>
        <div class="li-sub">${e.date ? fmtLong.format(new Date(e.date + "T12:00")) : "tarih girilmedi"}</div>
      </div>
      <button class="li-del" data-type="sila" data-id="${e.id}" aria-label="Sil">🗑</button>
    </div>
  `).join("");
}

document.getElementById("silaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const daysInput = document.getElementById("silaDays");
  const days = parseInt(daysInput.value, 10);
  const remaining = SILA_HAKKI - silaUsed();
  if (!days || days < 1) return;
  if (days > remaining) {
    alert(`Kalan sıla hakkın ${remaining} gün. Bundan fazlasını giremezsin.`);
    return;
  }
  state.silaEntries.push({
    id: uid(),
    days,
    date: document.getElementById("silaDate").value || null,
    note: document.getElementById("silaNote").value.trim() || null,
  });
  saveState();
  ev.target.reset();
  renderAll();
});

/* ================== Ceza ================== */
function renderCeza() {
  document.getElementById("cezaTotalDays").textContent = cezaTotal();
  const list = document.getElementById("cezaList");
  if (state.cezaEntries.length === 0) {
    list.innerHTML = `<div class="list-empty">Ceza yok — böyle devam! 👏</div>`;
    return;
  }
  list.innerHTML = state.cezaEntries.map(e => `
    <div class="list-item">
      <div class="li-days">+${e.days}<small>gün</small></div>
      <div class="li-body">
        <div class="li-title">${esc(e.title)}</div>
        <div class="li-sub">${fmtLong.format(new Date(e.date))}</div>
      </div>
      <button class="li-del" data-type="ceza" data-id="${e.id}" aria-label="Sil">🗑</button>
    </div>
  `).join("");
}

document.getElementById("cezaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const title = document.getElementById("cezaTitle").value.trim();
  const days = parseInt(document.getElementById("cezaDays").value, 10);
  if (!title || !days || days < 1) return;
  state.cezaEntries.push({ id: uid(), title, days, date: now().toISOString() });
  saveState();
  ev.target.reset();
  renderAll();
});

/* Silme (sıla + ceza ortak) */
document.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".li-del");
  if (!btn) return;
  const { type, id } = btn.dataset;
  const msg = type === "sila"
    ? "Bu sıla kaydı silinsin mi? (Hak geri gelir, terhis tarihi geri çekilir)"
    : "Bu ceza silinsin mi? (Terhis tarihi geri çekilir)";
  if (!confirm(msg)) return;
  if (type === "sila") state.silaEntries = state.silaEntries.filter(e => e.id !== id);
  else state.cezaEntries = state.cezaEntries.filter(e => e.id !== id);
  saveState();
  renderAll();
});

/* ================== Takvim ================== */
let calCursor = (() => { const d = now(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

function renderCalendar() {
  const grid = document.getElementById("calGrid");
  const today = now();
  const terhis = effectiveTerhis();
  document.getElementById("calMonth").textContent = fmtMonthYear.format(calCursor);

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Pazartesi başlangıçlı hafta: JS'te Pazar=0
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  let html = "";
  for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = dateKey(date);
    const cls = ["cal-day"];
    if (sameDay(date, today)) cls.push("today");
    if (sameDay(date, terhis)) cls.push("terhis");
    if (date < today && !sameDay(date, today)) cls.push("past");
    if (state.dayNotes[key]) cls.push("has-note");
    html += `<div class="${cls.join(" ")}" data-date="${key}">${d}</div>`;
  }
  grid.innerHTML = html;
}

document.getElementById("calPrev").addEventListener("click", () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
  renderCalendar();
});

/* ---- Not modalı ---- */
const noteModal = document.getElementById("noteModal");
const noteText = document.getElementById("noteText");
let noteModalKey = null;

document.getElementById("calGrid").addEventListener("click", (ev) => {
  const cell = ev.target.closest(".cal-day");
  if (!cell || cell.classList.contains("empty")) return;
  noteModalKey = cell.dataset.date;
  const [y, m, d] = noteModalKey.split("-").map(Number);
  document.getElementById("noteModalDate").textContent = fmtWeekday.format(new Date(y, m - 1, d)) + ` ${y}`;
  noteText.value = state.dayNotes[noteModalKey] || "";
  document.getElementById("noteDelete").hidden = !state.dayNotes[noteModalKey];
  noteModal.hidden = false;
  noteText.focus();
});

document.getElementById("noteCancel").addEventListener("click", () => { noteModal.hidden = true; });
noteModal.addEventListener("click", (ev) => { if (ev.target === noteModal) noteModal.hidden = true; });

document.getElementById("noteSave").addEventListener("click", () => {
  const text = noteText.value.trim();
  if (text) state.dayNotes[noteModalKey] = text;
  else delete state.dayNotes[noteModalKey];
  saveState();
  noteModal.hidden = true;
  renderCalendar();
});

document.getElementById("noteDelete").addEventListener("click", () => {
  if (!confirm("Bu günün notu silinsin mi?")) return;
  delete state.dayNotes[noteModalKey];
  saveState();
  noteModal.hidden = true;
  renderCalendar();
});

/* ================== Sekmeler ================== */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    document.body.classList.toggle("tab-not-home", btn.dataset.tab !== "home");
    window.scrollTo(0, 0);
  });
});

/* ================== Genel ================== */
function renderAll() {
  renderHome();
  renderSila();
  renderCeza();
  renderCalendar();
}

renderAll();
maybeRequestBadgePermission();

// Gece yarısı / uygulama öne gelince sayıyı tazele
setInterval(renderHome, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderHome();
});

/* ================== Service Worker ================== */
if ("serviceWorker" in navigator) {
  // Yeni sürüm devreye girince sayfayı yenile; not yazılıyorsa yazı kaybolmasın diye sonraya bırak.
  const hadController = !!navigator.serviceWorker.controller;
  let pendingReload = false;
  const reloadIfSafe = () => {
    if (!noteModal.hidden) { pendingReload = true; return; }
    location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reloadIfSafe();
  });
  new MutationObserver(() => {
    if (pendingReload && noteModal.hidden) location.reload();
  }).observe(noteModal, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
      // Ana ekran uygulaması çoğu zaman yeniden başlamaz, arka plandan döner: o an da güncelleme ara.
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
