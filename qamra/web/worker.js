"use strict";
const I18N = {
  ar: {
    brand: "دوام شاهي قمرا", login: "تسجيل الدخول", empNo: "رقم الموظف", pin: "الرقم السري (PIN)", enter: "دخول",
    hello: "مرحبًا، {n}", status: "الحالة", s_off: "خارج الدوام", s_working: "على رأس العمل", s_break: "في البريك",
    start_work: "بدء الدوام", start_break: "بدء البريك", back_work: "رجعت للعمل", end_work: "إنهاء الدوام",
    confirm_end: "هل تريد إنهاء الدوام؟", yes_end: "نعم، إنهاء الدوام", cancel: "إلغاء",
    remaining: "متبقي", elapsed: "مضى من البريك", break_end_msg: "انتهى وقت البريك", over_by: "تجاوز البريك بـ",
    left_label: "الوقت المتبقي", late: "تأخير {m}", shift: "الدوام", since: "بدأ الدوام", offline: "لا يوجد اتصال بالإنترنت",
    logout: "تسجيل الخروج", break_used: "تم استخدام البريك اليوم",
    setup: "إعداد التطبيق", install: "تثبيت التطبيق", enable_push: "تفعيل التنبيهات", enable_loc: "تفعيل الموقع",
    ios_title: "ثبّت التطبيق على الآيفون",
    ios: ["افتح الموقع في Safari.", "اضغط مشاركة.", "اختر «إضافة إلى الشاشة الرئيسية».", "افتح التطبيق من الأيقونة.", "فعّل الموقع والتنبيهات."],
    ios_note: "سجّل الدخول من الأيقونة فقط.",
    n_pre10: "باقي 10 دقائق على نهاية البريك", n_pre5: "باقي 5 دقائق على نهاية البريك",
    n_end: "انتهى وقت البريك، الرجاء العودة للعمل", n_over: "تجاوزت وقت البريك بـ {m}",
    break_res: "مدة البريك {a} — المسموح {b}", break_res_over: "تجاوزت البريك بـ {c}",
    e_invalid_credentials: "رقم الموظف أو الرقم السري غير صحيح", e_rate_limited: "محاولات كثيرة خاطئة. حاول بعد 15 دقيقة",
    e_device_mismatch: "هذا الحساب مرتبط بجوال آخر. تواصل مع المدير", e_network: "لا يوجد اتصال بالإنترنت",
    e_generic: "حدث خطأ، حاول مرة أخرى", e_unauthorized: "سجّل الدخول من جديد", e_break_limit: "تم استخدام البريك اليوم",
    e_already_clocked_in: "أنت على رأس العمل بالفعل", e_not_clocked_in: "لم تبدأ الدوام بعد",
  },
  bn: {
    brand: "শাহী কামরা হাজিরা", login: "লগইন", empNo: "কর্মী নম্বর", pin: "পিন", enter: "প্রবেশ",
    hello: "স্বাগতম, {n}", status: "অবস্থা", s_off: "ডিউটির বাইরে", s_working: "কাজে আছেন", s_break: "বিরতিতে আছেন",
    start_work: "কাজ শুরু করুন", start_break: "বিরতি শুরু করুন", back_work: "কাজে ফিরেছি", end_work: "কাজ শেষ করুন",
    confirm_end: "আপনি কি কাজ শেষ করতে চান?", yes_end: "হ্যাঁ, কাজ শেষ করুন", cancel: "বাতিল",
    remaining: "বাকি", elapsed: "বিরতির সময় কেটেছে", break_end_msg: "বিরতির সময় শেষ", over_by: "বিরতি ছাড়িয়েছে",
    left_label: "বাকি সময়", late: "{m} দেরি", shift: "শিফট", since: "কাজ শুরু", offline: "ইন্টারনেট সংযোগ নেই",
    logout: "লগআউট", break_used: "আজকের বিরতি নেওয়া হয়ে গেছে",
    setup: "অ্যাপ সেটআপ", install: "অ্যাপ ইনস্টল করুন", enable_push: "নোটিফিকেশন চালু করুন", enable_loc: "লোকেশন চালু করুন",
    ios_title: "আইফোনে অ্যাপ ইনস্টল করুন",
    ios: ["Safari-তে সাইটটি খুলুন।", "শেয়ার বাটনে চাপ দিন।", "«হোম স্ক্রিনে যোগ করুন» চাপ দিন।", "আইকন থেকে অ্যাপটি খুলুন।", "লোকেশন ও নোটিফিকেশন চালু করুন।"],
    ios_note: "শুধু আইকন থেকে লগইন করুন।",
    n_pre10: "বিরতি শেষ হতে আর ১০ মিনিট বাকি", n_pre5: "বিরতি শেষ হতে আর ৫ মিনিট বাকি",
    n_end: "বিরতির সময় শেষ, অনুগ্রহ করে কাজে ফিরুন", n_over: "আপনি বিরতির সময় {m} ছাড়িয়ে গেছেন",
    break_res: "বিরতি {a} — অনুমোদিত {b}", break_res_over: "{c} বেশি নিয়েছেন",
    e_invalid_credentials: "কর্মী নম্বর বা পিন ভুল", e_rate_limited: "অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে চেষ্টা করুন",
    e_device_mismatch: "এই অ্যাকাউন্ট অন্য ফোনের সাথে যুক্ত। ম্যানেজারের সাথে কথা বলুন", e_network: "ইন্টারনেট সংযোগ নেই",
    e_generic: "সমস্যা হয়েছে, আবার চেষ্টা করুন", e_unauthorized: "আবার লগইন করুন", e_break_limit: "আজকের বিরতি নেওয়া হয়ে গেছে",
    e_already_clocked_in: "আপনি ইতিমধ্যে কাজে আছেন", e_not_clocked_in: "আপনি এখনও কাজ শুরু করেননি",
  },
};

let lang = store.get("lang") === "bn" ? "bn" : "ar";
let token = store.get("tok");
let S = null, busy = false, offline = false, lastKey = null, lastView = "", deferredPrompt = null, pushOK = false, locOK = null;
const app = $("#app");

const t = (k, v = {}) => {
  let s = I18N[lang][k] ?? k;
  for (const x in v) s = s.replace(`{${x}}`, v[x]);
  return s;
};
const dg = (s) => (lang === "bn" ? bnDigits(s) : String(s));
const nm = (e) => (lang === "bn" && e.name_bn ? e.name_bn : e.name_ar);

// "7 دقائق و42 ثانية"
const AR = { h: ["ساعة", "ساعتان", "ساعات", "ساعة"], m: ["دقيقة", "دقيقتان", "دقائق", "دقيقة"], s: ["ثانية", "ثانيتان", "ثوانٍ", "ثانية"] };
const BN = { h: "ঘণ্টা", m: "মিনিট", s: "সেকেন্ড" };
function unit(n, u) {
  if (lang === "bn") return dg(`${n} ${BN[u]}`);
  if (n === 2) return AR[u][1];
  return `${n} ${AR[u][n >= 3 && n <= 10 ? 2 : n === 1 ? 0 : 3]}`;
}
function dur(sec, withSec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = [];
  if (h) p.push(unit(h, "h"));
  if (m || (!h && !withSec)) p.push(unit(m, "m"));
  if (withSec) p.push(unit(s, "s"));
  return p.join(lang === "bn" ? " " : " و");
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const devId = () => { let d = store.get("dev"); if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now() + "xxxxxxxx"); store.set("dev", d); } return d; };

function setLang(l) {
  lang = l; store.set("lang", l);
  document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  if (token) rpc("set_lang", { p_token: token, p_lang: l }).catch(() => {});
  lastView = ""; render();
}
const langBar = () => `<div class="lang"><button data-l="ar" class="${lang === "ar" ? "on" : ""}">العربية</button><button data-l="bn" class="${lang === "bn" ? "on" : ""}">বাংলা</button></div>`;
const bindLang = () => app.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => setLang(b.dataset.l)));

function toast(msg, ms = 3500) {
  const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
const errMsg = (e) => (I18N[lang]["e_" + e.code] ? t("e_" + e.code) : t("e_generic"));

// ───────── login ─────────
function renderLogin(msg = "") {
  lastView = "login";
  app.innerHTML = `<div class="top"><div class="brand">${t("brand")}</div>${langBar()}</div>
  <div class="card" style="margin-block:auto">
    <h1 class="hello" style="margin-bottom:18px">${t("login")}</h1>
    <div class="field"><label for="emp">${t("empNo")}</label><input class="inp" id="emp" inputmode="numeric" autocomplete="username" autocapitalize="off"></div>
    <div class="field"><label for="pin">${t("pin")}</label><input class="inp" id="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></div>
    <p class="err" id="err">${esc(msg)}</p>
    <button class="btn green" id="go" style="min-height:84px;font-size:26px">${t("enter")}</button>
  </div><div></div>`;
  bindLang();
  const go = $("#go");
  go.onclick = async () => {
    go.disabled = true; $("#err").textContent = "";
    try {
      const r = await rpc("login", { p_emp: $("#emp").value, p_pin: $("#pin").value, p_device: devId(), p_ua: navigator.userAgent });
      if (r.error) { $("#err").textContent = t("e_" + r.error); return; }
      token = r.token; store.set("tok", token); setLang(r.employee.lang === "bn" ? "bn" : lang === "bn" ? "bn" : r.employee.lang);
      applyStatus(r);
    } catch (e) { $("#err").textContent = errMsg(e); } finally { go.disabled = false; }
  };
}

// ───────── home ─────────
function applyStatus(r) {
  S = r; syncClock(r.now); offline = false;
  if (lastView !== "home:" + r.state) render();
}
function render() { if (!token || !S) return renderLogin(); renderHome(); tick(); }

function setupCard() {
  const items = [];
  if (isIOS && !standalone) {
    items.push(`<h3>${t("ios_title")}</h3><ol>${I18N[lang].ios.map((x) => `<li>${x}</li>`).join("")}</ol><p><b>${t("ios_note")}</b></p>`);
  } else {
    if (deferredPrompt && !standalone) items.push(`<button class="btn sec" id="inst">📲 ${t("install")}</button>`);
    if ("Notification" in window && "PushManager" in window && !pushOK) items.push(`<button class="btn sec" id="push">🔔 ${t("enable_push")}</button>`);
    if (locOK === false || locOK === null && navigator.geolocation) items.push(`<button class="btn sec" id="loc">📍 ${t("enable_loc")}</button>`);
  }
  return items.length ? `<div class="card setup"><h3>${t("setup")}</h3>${items.join("")}</div>` : "";
}

function renderHome() {
  lastView = "home:" + S.state;
  const st = S.state, e = S.employee;
  const onBreakAllowedMore = S.breaks_used < S.breaks_max;
  let main = "";
  if (st === "off") main = `<button class="btn green" data-a="clock_in"><span class="ic">🟢</span>${t("start_work")}</button>`;
  if (st === "working") main = (onBreakAllowedMore
    ? `<button class="btn yellow" data-a="break_start"><span class="ic">🟡</span>${t("start_break")}</button>`
    : `<div class="card" style="text-align:center;font-weight:700">☕ ${t("break_used")}</div>`) +
    `<button class="btn red" id="end"><span class="ic">🔴</span>${t("end_work")}</button>`;
  if (st === "break") main = `<button class="btn green" data-a="break_end"><span class="ic">🟢</span>${t("back_work")}</button>` +
    `<button class="btn red" id="end"><span class="ic">🔴</span>${t("end_work")}</button>`;

  app.innerHTML = `
  <div class="top"><div class="brand">${t("brand")}</div>${langBar()}</div>
  <div class="card">
    <h1 class="hello">${t("hello", { n: esc(nm(e)) })}</h1>
    <p class="date" id="date"></p><div class="clock" id="clock"></div>
    <span class="chip ${st}" id="chip"></span>
    <div class="sub" id="sub"></div>
  </div>
  ${st === "break" ? `<div class="card timer">
    <div class="over-msg hide" id="overMsg">🔴 ${t("break_end_msg")}</div>
    <div class="tlabel" id="tl"></div><div class="big" id="big"></div>
    <div class="bar"><i id="bar"></i></div>
    <div class="stats"><span id="elapsed"></span><span id="remain"></span></div></div>` : ""}
  <div class="banner bad ${offline ? "" : "hide"}" id="off">⚠️ ${t("offline")}</div>
  <div class="actions" id="actions">${main}</div>
  ${setupCard()}
  <button class="link" id="out">${t("logout")}</button>`;
  bindLang();
  app.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => act(b.dataset.a)));
  const end = $("#end"); if (end) end.onclick = confirmEnd;
  $("#out").onclick = logout;
  const bind = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  bind("#inst", async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; renderHome(); tick(); });
  bind("#push", async () => { await enablePush(); renderHome(); tick(); });
  bind("#loc", async () => { await getPos(true); renderHome(); tick(); });
}

function tick() {
  if (!S || !token || !lastView.startsWith("home")) return;
  const now = srvNow(), d = new Date(now);
  const loc = lang === "bn" ? "bn-BD-u-ca-gregory-nu-latn" : "ar-SA-u-ca-gregory-nu-latn";
  $("#date").textContent = dg(d.toLocaleDateString(loc, { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  $("#clock").textContent = dg(fTimeS(now));
  const st = S.state; let chipCls = st, label = t("s_" + st), icon = { off: "⚪", working: "🟢", break: "🟡" }[st];
  const sub = [];
  if (S.shift && st === "off") sub.push(`<span class="tag">${t("shift")}: ${dg(fmtShift(S.shift.start))} – ${dg(fmtShift(S.shift.end))}</span>`);
  if (S.session) {
    sub.push(`<span class="tag">${t("since")}: ${dg(fTime(S.session.clock_in))}</span>`);
    if (S.session.late_min > 0) sub.push(`<span class="tag late">⏱ ${t("late", { m: dur(S.session.late_min * 60) })}</span>`);
  }
  if (st === "break") {
    const A = S.break.allowed_min * 60, el = (now - Date.parse(S.break.start_at)) / 1000, rem = A - el, over = rem < 0;
    const cls = el >= A ? "r" : el >= A - 300 ? "o" : el >= A - 600 ? "y" : "g";
    chipCls = cls === "r" ? "over" : cls === "o" ? "warn" : "break";
    if (cls === "r") icon = "🔴"; else if (cls === "o") icon = "🟠";
    $("#big").textContent = dg(mmss(over ? -rem : rem)); $("#big").className = "big c-" + cls;
    $("#tl").textContent = over ? t("over_by") : t("left_label");
    $("#overMsg").classList.toggle("hide", !over);
    $("#bar").style.width = Math.min(100, (el / A) * 100) + "%"; $("#bar").className = "b-" + cls;
    $("#elapsed").textContent = `${t("elapsed")}: ${dur(el, true)}`;
    $("#remain").textContent = over ? "" : `${t("remaining")}: ${dur(rem)}`;
    foregroundAlert(el, A);
  } else lastKey = null;
  const chip = $("#chip"); chip.className = "chip " + chipCls; chip.textContent = `${icon} ${label}`;
  $("#sub").innerHTML = sub.join("");
}
const fmtShift = (hhmmss) => { const [h, m] = hhmmss.split(":"); const H = +h; return `${H % 12 || 12}:${m} ${H >= 12 ? "PM" : "AM"}`; };

function foregroundAlert(el, A) {
  const key = el >= A ? "o" + Math.floor((el - A) / 600) : el >= A - 300 ? "p5" : el >= A - 600 ? "p10" : "";
  if (lastKey === null) { lastKey = key; return; }
  if (key && key !== lastKey) {
    lastKey = key;
    const m = key[0] === "o" ? dur(Math.floor((el - A) / 600) * 600) : "";
    const msg = key === "p10" ? t("n_pre10") : key === "p5" ? t("n_pre5") : key === "o0" ? t("n_end") : t("n_over", { m });
    navigator.vibrate?.([300, 120, 300, 120, 300]); toast(msg, 8000);
  }
}

// ───────── actions ─────────
async function getPos(ask) {
  if (!navigator.geolocation) return null;
  return new Promise((res) => navigator.geolocation.getCurrentPosition(
    (p) => { locOK = true; res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
    () => { locOK = false; res(null); },
    { enableHighAccuracy: true, timeout: ask ? 15000 : 6000, maximumAge: 0 }));
}
async function act(fn) {
  if (busy) return; busy = true;
  document.querySelectorAll(".btn").forEach((b) => (b.disabled = true));
  try {
    const p = await getPos();
    const r = await rpc(fn, { p_token: token, p_lat: p?.lat ?? null, p_lng: p?.lng ?? null, p_acc: p?.acc ?? null });
    navigator.vibrate?.(60); lastKey = null;
    if (r.result) {
      const rs = r.result, msg = t("break_res", { a: dur(rs.break_min * 60), b: dur(rs.allowed_min * 60) }) + (rs.over_min ? " — " + t("break_res_over", { c: dur(rs.over_min * 60) }) : "");
      toast(msg, 6000);
    }
    applyStatus(r); if (lastView !== "home:" + r.state) render(); tick();
  } catch (e) {
    if (e.status === 401) return forceLogout();
    if (e.code === "network") { offline = true; $("#off")?.classList.remove("hide"); } else toast(errMsg(e));
    if (e.status === 409) refresh();
    document.querySelectorAll(".btn").forEach((b) => (b.disabled = false));
  } finally { busy = false; }
}
function confirmEnd() {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div><h3>${t("confirm_end")}</h3><button class="btn red" id="y" style="min-height:84px">${t("yes_end")}</button><button class="btn sec" id="n" style="min-height:76px;font-size:20px">${t("cancel")}</button></div>`;
  document.body.appendChild(m);
  $("#n", m).onclick = () => m.remove();
  $("#y", m).onclick = () => { m.remove(); act("clock_out"); };
}
function forceLogout() { token = null; S = null; store.del("tok"); renderLogin(t("e_unauthorized")); }
async function logout() { try { await rpc("logout", { p_token: token }); } catch {} forceLogout(); renderLogin(); }

async function refresh() {
  if (!token || busy) return;
  try { applyStatus(await rpc("me", { p_token: token })); tick(); } catch (e) {
    if (e.status === 401) return forceLogout();
    if (e.code === "network") { offline = true; $("#off")?.classList.remove("hide"); }
  }
}

// ───────── push / install ─────────
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function enablePush() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission(); if (perm !== "granted") return;
    await savePush();
  } catch { toast(t("e_generic")); }
}
async function savePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  await rpc("save_push", { p_token: token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  pushOK = true;
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (S) { renderHome(); tick(); } });
window.addEventListener("online", () => { offline = false; $("#off")?.classList.add("hide"); refresh(); });
window.addEventListener("offline", () => { offline = true; $("#off")?.classList.remove("hide"); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

// ───────── boot ─────────
document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.permissions?.query({ name: "geolocation" }).then((p) => { locOK = p.state === "granted" ? true : p.state === "denied" ? false : null; p.onchange = () => { locOK = p.state === "granted"; }; }).catch(() => {});
(async () => {
  if ("Notification" in window && Notification.permission === "granted" && token) setTimeout(() => savePush().catch(() => {}), 1500);
  if (token) { try { applyStatus(await rpc("me", { p_token: token })); render(); } catch (e) { if (e.status === 401) forceLogout(); else renderLogin(); } } else renderLogin();
})();
setInterval(tick, 500);
setInterval(refresh, 15000);
