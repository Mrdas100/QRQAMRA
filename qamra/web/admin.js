"use strict";
const LS = { get: () => { try { return localStorage.getItem("atok"); } catch { return null; } }, set: (v) => { try { localStorage.setItem("atok", v); } catch {} }, del: () => { try { localStorage.removeItem("atok"); } catch {} } };
let tok = LS.get();
let tab = "live", live = null, emps = [], shifts = [], timer = null, cur = null;
const app = $("#app");
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ERR = { invalid_credentials: "بيانات الدخول غير صحيحة", rate_limited: "محاولات كثيرة. حاول بعد 15 دقيقة", emp_no_exists: "رقم الموظف مستخدم", bad_pin: "الـPIN يجب أن يكون 4 إلى 6 أرقام", bad_emp_no: "رقم الموظف: حروف/أرقام إنجليزية 2–12", bad_name: "الاسم مطلوب", bad_times: "الأوقات غير منطقية", network: "لا يوجد اتصال", bad_range: "نطاق التاريخ غير صحيح", overlap: "يتعارض مع سجل موجود لنفس الموظف", bad_rate: "سعر الساعة غير صحيح", bad_input: "مدخلات غير صحيحة" };
const eMsg = (e) => ERR[e.code] || "حدث خطأ";
const dm = (min) => { min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} س ${m} د` : `${m} د`; };
const fDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
const toLocalInput = (iso) => iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T").slice(0, 16) : "";
const fromLocalInput = (v) => v ? v + ":00+03:00" : "";
const call = async (fn, a = {}) => { try { return await rpc(fn, { p_token: tok, ...a }); } catch (e) { if (e.status === 401) { logout(true); } throw e; } };
const toastA = (m) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); };

function modal(html) {
  const m = document.createElement("div"); m.className = "modal noprint"; m.innerHTML = `<div>${html}</div>`;
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
  document.body.appendChild(m); return m;
}

// ───────── admin push ─────────
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function adminPush(ask) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { if (ask) toastA("هذا المتصفح لا يدعم التنبيهات"); return; }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (ask) {
    if (ios && !standalone) { modal(`<h3>ثبّت لوحة الإدارة أولًا</h3><p style="margin:0;line-height:1.9">1. افتح هذه الصفحة في Safari.<br>2. اضغط مشاركة ← «إضافة إلى الشاشة الرئيسية».<br>3. افتح «إدارة قمرا» من الأيقونة وسجّل الدخول.<br>4. اضغط «تنبيهات المدير» ووافق.</p>`); return; }
    if ((await Notification.requestPermission()) !== "granted") { toastA("لم يتم السماح بالتنبيهات"); return; }
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  await call("admin_save_push", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (ask) toastA("تم تفعيل تنبيهات المدير ✅");
}

// ───────── login ─────────
function loginView(msg = "") {
  clearInterval(timer);
  app.innerHTML = `<div class="card" style="max-width:420px;margin:12vh auto 0;width:100%"><h1 class="hello" style="margin-bottom:16px">لوحة الإدارة</h1>
  <div class="field"><label>اسم المستخدم</label><input class="inp" id="u" autocomplete="username" autocapitalize="off"></div>
  <div class="field"><label>كلمة المرور</label><input class="inp" id="p" type="password" autocomplete="current-password"></div>
  <p class="err" id="e">${esc(msg)}</p><button class="btn green" id="go" style="min-height:72px;font-size:22px">دخول</button></div>`;
  $("#go").onclick = async () => {
    $("#go").disabled = true;
    try { const r = await rpc("admin_login", { p_user: $("#u").value, p_pass: $("#p").value }); if (r.error) { $("#e").textContent = ERR[r.error]; return; } tok = r.token; LS.set(tok); shell(); }
    catch (e) { $("#e").textContent = eMsg(e); } finally { const g = $("#go"); if (g) g.disabled = false; }
  };
}
function logout(silent) { rpc("logout", { p_token: tok }).catch(() => {}); tok = null; LS.del(); loginView(silent ? "انتهت الجلسة، سجّل الدخول" : ""); }

// ───────── shell ─────────
async function shell() {
  app.innerHTML = `<div class="top noprint"><div class="brand">دوام شاهي قمرا — الإدارة</div><div class="row" style="margin:0"><button class="sm" id="bell">🔔 تنبيهات المدير</button><button class="sm" id="lo">خروج</button></div></div>
  <div class="nav noprint">${[["live", "الرئيسية"], ["emps", "الموظفون"], ["rep", "التقارير"], ["set", "الإعدادات"]].map(([k, n]) => `<button data-t="${k}">${n}</button>`).join("")}</div>
  <div id="view" class="page printing"></div>`;
  $("#lo").onclick = () => logout();
  $("#bell").onclick = () => adminPush(true).catch(() => toastA("تعذّر تفعيل التنبيهات"));
  if ("Notification" in window && Notification.permission === "granted") adminPush(false).catch(() => {});
  app.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => go(b.dataset.t)));
  try { [shifts, emps] = await Promise.all([call("admin_list_shifts"), call("admin_list_employees")]); } catch {}
  go(tab);
}
function go(t) {
  tab = t; clearInterval(timer); cur = null;
  app.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
  ({ live: liveView, emps: empsView, rep: repView, set: setView })[t]();
}

// ───────── live ─────────
async function liveView() {
  $("#view").innerHTML = `<div class="counters" id="cnt"></div><h2 class="sec-t">حالة الموظفين مباشرة</h2><div class="grid" id="cards"></div>`;
  const load = async () => { try { live = await call("admin_live"); syncClock(live.now); drawLive(); } catch {} };
  await load(); timer = setInterval(load, 5000); const tk = setInterval(() => { if (tab !== "live") clearInterval(tk); else drawLive(); }, 1000);
}
function drawLive() {
  if (!live || !$("#cnt")) return;
  const c = live.counts, now = srvNow();
  $("#cnt").innerHTML = [["عدد الموظفين", c.total, ""], ["على رأس العمل", c.working, "c-g"], ["في البريك", c.break, "c-y"], ["خارج الدوام", c.off, ""]].map(([l, n, k]) => `<div class="counter"><b class="${k}">${n}</b><span>${l}</span></div>`).join("") + (c.overrun ? `<div class="counter" style="grid-column:1/-1"><b class="c-r">${c.overrun}</b><span>تجاوز البريك الآن</span></div>` : "");
  $("#cards").innerHTML = live.employees.map((e) => {
    let cls = e.st, badge = { off: "⚪ خارج الدوام", working: "🟢 على رأس العمل", break: "🟡 في البريك" }[e.st], body = "";
    if (e.st === "working") body = `<p>بدأ الدوام: <b>${fTime(e.clock_in)}</b></p>` + (e.late_min > 0 ? `<p><span class="pill o">تأخير ${dm(e.late_min)}</span></p>` : "");
    if (e.st === "break") {
      const A = e.allowed * 60, el = (now - Date.parse(e.break_start)) / 1000, rem = A - el;
      if (el >= A) { cls = "over"; badge = "🔴 تجاوز البريك"; body = `<p>بدأ البريك: <b>${fTime(e.break_start)}</b></p><p>التجاوز: <b class="c-r">${dm((el - A) / 60)}</b></p>`; }
      else { if (rem <= 300) { cls = "warn"; badge = "🟠 قرب انتهاء البريك"; } body = `<p>بدأ البريك: <b>${fTime(e.break_start)}</b></p><p>مضى: ${dm(el / 60)}</p><p>متبقي: <b>${dm(rem / 60)}</b></p>`; }
    }
    if (e.geo === false) body += `<p><span class="pill r">📍 خارج نطاق المحل عند الحضور</span></p>`;
    return `<div class="ecard ${cls}"><h4>${esc(e.name_ar)}</h4><p>${badge}</p>${body}</div>`;
  }).join("") || `<p>لا يوجد موظفون. أضف موظفًا من تبويب «الموظفون».</p>`;
}

// ───────── employees ─────────
async function empsView() {
  try { emps = await call("admin_list_employees"); } catch {}
  $("#view").innerHTML = `<div class="row noprint" style="margin:0 0 12px"><button class="sm pri" id="add">＋ إضافة موظف</button></div><div class="grid" id="list"></div>`;
  $("#add").onclick = () => empForm();
  $("#list").innerHTML = emps.map((e) => `<div class="ecard ${e.active ? "working" : ""}" ${e.active ? "" : 'style="opacity:.6"'}>
    <h4>${esc(e.name_ar)} ${e.name_bn ? `<small style="color:var(--mut)">${esc(e.name_bn)}</small>` : ""}</h4>
    <p>رقم الموظف: <b>${esc(e.emp_no)}</b> · ${e.active ? "نشط" : "معطّل"}</p>
    <p>${e.device_bound ? "📱 جهاز مرتبط" : "لا يوجد جهاز مرتبط"}</p>
    <div class="row"><button class="sm" data-a="edit" data-id="${e.id}">تعديل</button><button class="sm" data-a="log" data-id="${e.id}">السجل</button>
    <button class="sm" data-a="leaves" data-id="${e.id}">الإجازات</button><button class="sm" data-a="pin" data-id="${e.id}">تغيير PIN</button>${e.device_bound ? `<button class="sm" data-a="unbind" data-id="${e.id}">فك ربط الجهاز</button>` : ""}
    <button class="sm danger" data-a="act" data-id="${e.id}">${e.active ? "تعطيل" : "إعادة تفعيل"}</button></div></div>`).join("");
  $("#list").onclick = async (ev) => {
    const b = ev.target.closest("[data-a]"); if (!b) return; const e = emps.find((x) => x.id == b.dataset.id);
    try {
      if (b.dataset.a === "edit") empForm(e);
      if (b.dataset.a === "log") logView(e);
      if (b.dataset.a === "pin") pinForm(e);
      if (b.dataset.a === "leaves") leavesView(e);
      if (b.dataset.a === "unbind" && confirm(`فك ربط جهاز ${e.name_ar}؟`)) { await call("admin_unbind_device", { p_id: e.id }); toastA("تم فك الربط"); empsView(); }
      if (b.dataset.a === "act" && confirm(`${e.active ? "تعطيل" : "تفعيل"} ${e.name_ar}؟`)) { await call("admin_set_active", { p_id: e.id, p_active: !e.active }); empsView(); }
    } catch (x) { toastA(eMsg(x)); }
  };
}
function empForm(e) {
  const wk = e?.week || {};
  const opts = (v) => `<option value="">افتراضي</option><option value="off" ${v === "off" ? "selected" : ""}>إجازة</option>` + shifts.map((s) => `<option value="${s.id}" ${String(v) === String(s.id) ? "selected" : ""}>${esc(s.name)} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})</option>`).join("");
  const m = modal(`<h3>${e ? "تعديل موظف" : "إضافة موظف"}</h3>
  <div class="field"><label>رقم الموظف</label><input class="inp" id="f_no" value="${esc(e?.emp_no)}" inputmode="numeric" style="font-size:18px"></div>
  <div class="field"><label>الاسم بالعربية</label><input class="inp" id="f_ar" value="${esc(e?.name_ar)}" style="font-size:18px"></div>
  <div class="field"><label>الاسم بالبنغالية</label><input class="inp" id="f_bn" value="${esc(e?.name_bn)}" style="font-size:18px"></div>
  ${e ? "" : `<div class="field"><label>PIN (4–6 أرقام)</label><input class="inp" id="f_pin" inputmode="numeric" maxlength="6" style="font-size:18px"></div>`}
  <div class="field"><label>الشفت الافتراضي</label><select class="inp" id="f_sh" style="font-size:18px"><option value="">بدون شفت</option>${shifts.map((s) => `<option value="${s.id}" ${e?.shift_id == s.id ? "selected" : ""}>${esc(s.name)} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})</option>`).join("")}</select></div>
  <div class="field"><label>يوم الإجازة الأسبوعية</label><select class="inp" id="f_off" style="font-size:18px"><option value="">لا يوجد</option>${DAYS.map((d, i) => `<option value="${i}" ${e?.weekly_off === i ? "selected" : ""}>${d}</option>`).join("")}</select></div>
  <div class="field"><label>سعر الساعة (اختياري، لحساب المستحق)</label><input class="inp" id="f_rate" inputmode="decimal" value="${esc(e?.hourly_rate ?? "")}" style="font-size:18px"></div>
  <details><summary style="font-weight:700;cursor:pointer;padding:6px 0">جدول مخصص حسب اليوم (اختياري)</summary>
  ${DAYS.map((d, i) => `<div class="field" style="margin:8px 0"><label>${d}</label><select class="inp" id="w_${i}" style="font-size:16px">${opts(wk[i])}</select></div>`).join("")}</details>
  <p class="err" id="f_e"></p><button class="btn green" id="f_ok" style="min-height:64px;font-size:20px">حفظ</button>`);
  $("#f_ok", m).onclick = async () => {
    const week = {}; for (let i = 0; i < 7; i++) week[i] = $("#w_" + i, m).value;
    try {
      await call("admin_save_employee", { p: { id: e?.id ?? null, emp_no: $("#f_no", m).value, name_ar: $("#f_ar", m).value, name_bn: $("#f_bn", m).value, pin: $("#f_pin", m)?.value, shift_id: $("#f_sh", m).value, weekly_off: $("#f_off", m).value, hourly_rate: $("#f_rate", m).value, week } });
      m.remove(); empsView();
    } catch (x) { $("#f_e", m).textContent = eMsg(x); }
  };
}
function pinForm(e) {
  const m = modal(`<h3>تغيير PIN — ${esc(e.name_ar)}</h3><div class="field"><input class="inp" id="np" inputmode="numeric" maxlength="6" placeholder="4–6 أرقام"></div><p class="err" id="pe"></p><button class="btn green" id="pk" style="min-height:64px;font-size:20px">حفظ</button>`);
  $("#pk", m).onclick = async () => { try { await call("admin_set_pin", { p_id: e.id, p_pin: $("#np", m).value }); m.remove(); toastA("تم تغيير الـPIN"); } catch (x) { $("#pe", m).textContent = eMsg(x); } };
}

// ───────── employee log (+ admin edit) ─────────
function logView(e) {
  cur = e; const now = new Date(srvNow()).toLocaleDateString("sv-SE", { timeZone: TZ }).slice(0, 7);
  $("#view").innerHTML = `<div class="ctrl noprint" style="margin-bottom:12px"><button class="sm" id="back">→ رجوع</button><input class="inp" type="month" id="mo" value="${now}"><button class="sm pri" id="addday">＋ إضافة يوم</button></div><h2 class="sec-t">سجل ${esc(e.name_ar)}</h2><div id="days"></div>`;
  $("#back").onclick = () => go("emps");
  $("#addday").onclick = () => addSessionForm(e, () => load());
  const load = async () => {
    const [y, m] = $("#mo").value.split("-").map(Number), last = new Date(y, m, 0).getDate();
    const r = await call("admin_report", { p_from: `${y}-${pad(m)}-01`, p_to: `${y}-${pad(m)}-${pad(last)}`, p_emp: e.id });
    $("#days").innerHTML = r.days.slice().reverse().map((d) => dayCard(d)).join("") || "<p>لا توجد سجلات.</p>";
    $("#days").onclick = async (ev) => {
      const b = ev.target.closest("[data-s],[data-p],[data-x]"); if (!b) return;
      if (b.dataset.s) editSession(r.days.find((x) => x.session_id == b.dataset.s), load);
      if (b.dataset.p) showPhoto(b.dataset.p);
      if (b.dataset.x && confirm("حذف هذا السجل نهائيًا؟ (يُسجَّل في سجل التدقيق)")) { try { await call("admin_delete_session", { p_session: b.dataset.x }); toastA("تم الحذف"); load(); } catch (x) { toastA(eMsg(x)); } }
    };
  };
  $("#mo").onchange = load; load();
}
function dayCard(d) {
  return `<div class="dcard"><b>${fDate(d.date)}</b> ${d.open ? '<span class="pill">مفتوح</span>' : ""}${d.auto_closed ? '<span class="pill r">أُغلق تلقائيًا</span>' : ""}${d.manual ? '<span class="pill">أُضيف يدويًا</span>' : ""}${d.geo === false ? '<span class="pill r">خارج النطاق</span>' : ""}<br>
  الحضور: <b>${fTime(d.clock_in)}</b> · البريك: <b>${fTime(d.break_start)}</b> · العودة: <b>${d.break_end ? fTime(d.break_end) : "—"}</b> · الانصراف: <b>${fTime(d.clock_out)}</b><br>
  مدة العمل: ${dm(d.work_min)} · مدة البريك: ${dm(d.break_min)} · المسموح: ${dm(d.allowed_min)} · التجاوز: <b class="${d.over_min ? "c-r" : ""}">${dm(d.over_min)}</b>
  ${d.late_min ? `· تأخير ${dm(d.late_min)}` : ""}${d.early_min ? ` · خروج مبكر ${dm(d.early_min)}` : ""}
  <div class="row noprint"><button class="sm" data-s="${d.session_id}">تعديل إداري</button><button class="sm" data-p="${d.session_id}">📷 الصورة</button><button class="sm danger" data-x="${d.session_id}">حذف</button></div></div>`;
}
async function showPhoto(sid) {
  try { const r = await call("admin_get_photo", { p_session: sid }); modal(r.photo ? `<h3>صورة الحضور</h3><img src="${r.photo}" alt="" style="width:100%;border-radius:16px">` : `<h3>لا توجد صورة لهذا السجل</h3>`); } catch (x) { toastA(eMsg(x)); }
}
function addSessionForm(e, done) {
  const m = modal(`<h3>إضافة يوم — ${esc(e.name_ar)}</h3><p style="margin:0;color:var(--mut)">التوقيت: الرياض. يُسجَّل في سجل التدقيق ويظهر «أُضيف يدويًا».</p>
  ${[["clock_in", "الحضور (مطلوب)"], ["break_start", "بداية البريك"], ["break_end", "العودة من البريك"], ["clock_out", "الانصراف"]].map(([k, l]) => `<div class="field"><label>${l}</label><input class="inp" style="font-size:17px" type="datetime-local" id="a_${k}"></div>`).join("")}
  <p class="err" id="ae"></p><button class="btn green" id="ak" style="min-height:64px;font-size:20px">إضافة</button>`);
  $("#ak", m).onclick = async () => {
    const p = {}; ["clock_in", "break_start", "break_end", "clock_out"].forEach((k) => (p[k] = fromLocalInput($("#a_" + k, m).value)));
    if (!p.clock_in) { $("#ae", m).textContent = "وقت الحضور مطلوب"; return; }
    try { await call("admin_add_session", { p_emp: e.id, p }); m.remove(); toastA("تمت الإضافة"); done(); } catch (x) { $("#ae", m).textContent = eMsg(x); }
  };
}
async function leavesView(e) {
  const KIND = { excused: "غياب بعذر", annual: "إجازة سنوية", sick: "إجازة مرضية" };
  const m = modal(`<h3>إجازات ${esc(e.name_ar)}</h3><div id="lv_list"></div>
  <div class="field"><label>من</label><input class="inp" type="date" id="lv_a" style="font-size:17px"></div>
  <div class="field"><label>إلى</label><input class="inp" type="date" id="lv_b" style="font-size:17px"></div>
  <div class="field"><label>النوع</label><select class="inp" id="lv_k" style="font-size:17px">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
  <div class="field"><label>ملاحظة (اختياري)</label><input class="inp" id="lv_n" style="font-size:17px"></div>
  <p class="err" id="lv_e"></p><button class="btn green" id="lv_ok" style="min-height:64px;font-size:20px">إضافة إجازة</button>`);
  const load = async () => {
    try { const l = await call("admin_list_leaves", { p_emp: e.id });
      $("#lv_list", m).innerHTML = l.map((x) => `<div class="dcard" style="margin:0 0 8px">${KIND[x.kind]}: <b>${x.from_date}</b> ← <b>${x.to_date}</b>${x.note ? `<br>${esc(x.note)}` : ""}<div class="row"><button class="sm danger" data-del="${x.id}">حذف</button></div></div>`).join("") || '<p style="margin:0;color:var(--mut)">لا توجد إجازات مسجلة</p>';
    } catch {}
  };
  $("#lv_list", m).onclick = async (ev) => { const b = ev.target.closest("[data-del]"); if (b && confirm("حذف هذه الإجازة؟")) { try { await call("admin_delete_leave", { p_id: +b.dataset.del }); load(); } catch (x) { toastA(eMsg(x)); } } };
  $("#lv_ok", m).onclick = async () => {
    const a = $("#lv_a", m).value, b = $("#lv_b", m).value || a;
    if (!a) { $("#lv_e", m).textContent = "حدد تاريخ البداية"; return; }
    try { await call("admin_save_leave", { p: { employee_id: e.id, from_date: a, to_date: b, kind: $("#lv_k", m).value, note: $("#lv_n", m).value } }); $("#lv_e", m).textContent = ""; $("#lv_a", m).value = ""; $("#lv_b", m).value = ""; $("#lv_n", m).value = ""; load(); }
    catch (x) { $("#lv_e", m).textContent = eMsg(x); }
  };
  load();
}
function editSession(d, done) {
  const m = modal(`<h3>تعديل إداري — ${fDate(d.date)}</h3><p style="margin:0;color:var(--mut)">التوقيت: الرياض. كل تعديل يُسجَّل في سجل التدقيق.</p>
  ${[["clock_in", "الحضور", d.clock_in], ["break_start", "بداية البريك", d.break_start], ["break_end", "العودة من البريك", d.break_end], ["clock_out", "الانصراف", d.clock_out]].map(([k, l, v]) => `<div class="field"><label>${l}</label><input class="inp" style="font-size:17px" type="datetime-local" id="e_${k}" value="${toLocalInput(v)}"></div>`).join("")}
  <p class="err" id="ee"></p><button class="btn green" id="ek" style="min-height:64px;font-size:20px">حفظ التعديل</button>`);
  $("#ek", m).onclick = async () => {
    const p = {}; ["clock_in", "break_start", "break_end", "clock_out"].forEach((k) => (p[k] = fromLocalInput($("#e_" + k, m).value)));
    try { await call("admin_edit_session", { p_session: d.session_id, p }); m.remove(); toastA("تم الحفظ"); done(); } catch (x) { $("#ee", m).textContent = eMsg(x); }
  };
}

// ───────── reports ─────────
let rep = null;
function repView() {
  const today = new Date(srvNow()).toLocaleDateString("sv-SE", { timeZone: TZ });
  $("#view").innerHTML = `<div class="ctrl noprint"><div class="field" style="margin:0"><label>النوع</label><select class="inp" id="rt"><option value="d">يومي</option><option value="w">أسبوعي (7 أيام)</option><option value="m" selected>شهري</option></select></div>
  <div class="field" style="margin:0"><label>التاريخ / الشهر</label><span id="rdw"></span></div>
  <div class="field" style="margin:0"><label>الموظف</label><select class="inp" id="re"><option value="">جميع الموظفين</option>${emps.map((e) => `<option value="${e.id}">${esc(e.name_ar)}</option>`).join("")}</select></div>
  <button class="sm pri" id="rg">عرض</button><button class="sm" id="rc">تحميل Excel / CSV</button><button class="sm" id="rp">تحميل PDF / طباعة</button></div>
  <div id="rout"></div>`;
  const draw = () => { $("#rdw").innerHTML = $("#rt").value === "m" ? `<input class="inp" type="month" id="rd" value="${today.slice(0, 7)}">` : `<input class="inp" type="date" id="rd" value="${today}">`; };
  $("#rt").onchange = draw; draw();
  $("#rg").onclick = runReport; $("#rc").onclick = csv; $("#rp").onclick = () => { if (!rep) return toastA("اعرض التقرير أولًا"); window.print(); };
  runReport();
}
async function runReport() {
  const ty = $("#rt").value, v = $("#rd").value; let from, to;
  if (ty === "m") { const [y, m] = v.split("-").map(Number); from = `${v}-01`; to = `${v}-${pad(new Date(y, m, 0).getDate())}`; }
  else { from = v; to = ty === "d" ? v : new Date(Date.parse(v + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10); }
  try { rep = await call("admin_report", { p_from: from, p_to: to, p_emp: $("#re").value || null }); } catch (x) { return toastA(eMsg(x)); }
  const S = rep.summary;
  $("#rout").innerHTML = `<h2 class="sec-t">تقرير الحضور — شاهي قمرا</h2><p class="print-only" style="margin:0">الفترة: ${rep.from} → ${rep.to}</p><p class="noprint" style="margin:0;color:var(--mut)">الفترة: ${rep.from} → ${rep.to} · ساعات العمل = مدة الدوام − مدة البريك · المستحق = ساعات العمل الفعلية × سعر الساعة</p>
  <div class="scroll" style="margin:10px 0"><table><thead><tr><th>الموظف</th><th>أيام الحضور</th><th>ساعات العمل</th><th>وقت البريك</th><th>المسموح</th><th>تجاوز البريك</th><th>مرات التجاوز</th><th>أيام الغياب</th><th>مرات التأخير</th><th>إجمالي التأخير</th><th>خروج مبكر</th><th>أيام الإجازة</th><th>سعر الساعة</th><th>المستحق</th></tr></thead><tbody>
  ${S.map((s) => `<tr><td><b>${esc(s.name_ar)}</b></td><td>${s.days_present}</td><td>${dm(s.work_min)}</td><td>${dm(s.break_min)}</td><td>${dm(s.allowed_min)}</td><td>${dm(s.over_min)}</td><td>${s.over_count}</td><td>${s.absent_days}</td><td>${s.late_count}</td><td>${dm(s.late_min)}</td><td>${dm(s.early_min)} (${s.early_count})</td><td>${s.leave_days}</td><td>${s.hourly_rate ?? "—"}</td><td><b>${s.pay ?? "—"}</b></td></tr>`).join("") || '<tr><td colspan="14">لا توجد بيانات</td></tr>'}</tbody></table></div>
  <h2 class="sec-t">التفاصيل اليومية</h2><div class="scroll"><table><thead><tr><th>التاريخ</th><th>الموظف</th><th>الحضور</th><th>بداية البريك</th><th>العودة</th><th>الانصراف</th><th>العمل</th><th>البريك</th><th>المسموح</th><th>التجاوز</th><th>التأخير</th><th>خروج مبكر</th></tr></thead><tbody>
  ${rep.days.map((d) => `<tr><td>${d.date}</td><td>${esc(d.name_ar)}</td><td>${fTime(d.clock_in)}</td><td>${fTime(d.break_start)}</td><td>${d.break_end ? fTime(d.break_end) : "—"}</td><td>${fTime(d.clock_out)}</td><td>${dm(d.work_min)}</td><td>${dm(d.break_min)}</td><td>${dm(d.allowed_min)}</td><td>${dm(d.over_min)}</td><td>${dm(d.late_min)}</td><td>${dm(d.early_min)}</td></tr>`).join("") || '<tr><td colspan="12">لا توجد بيانات</td></tr>'}</tbody></table></div>`;
}
function csv() {
  if (!rep) return toastA("اعرض التقرير أولًا");
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, line = (a) => a.map(q).join(",");
  const out = [line(["الملخص"]), line(["الموظف", "أيام الحضور", "ساعات العمل (د)", "وقت البريك (د)", "المسموح (د)", "تجاوز البريك (د)", "مرات التجاوز", "أيام الغياب", "مرات التأخير", "إجمالي التأخير (د)", "خروج مبكر (د)", "أيام الإجازة", "سعر الساعة", "المستحق"])];
  rep.summary.forEach((s) => out.push(line([s.name_ar, s.days_present, s.work_min, s.break_min, s.allowed_min, s.over_min, s.over_count, s.absent_days, s.late_count, s.late_min, s.early_min, s.leave_days, s.hourly_rate ?? "", s.pay ?? ""])));
  out.push("", line(["التفاصيل"]), line(["التاريخ", "الموظف", "الحضور", "بداية البريك", "العودة", "الانصراف", "العمل (د)", "البريك (د)", "المسموح (د)", "التجاوز (د)", "التأخير (د)", "خروج مبكر (د)"]));
  rep.days.forEach((d) => out.push(line([d.date, d.name_ar, fTime(d.clock_in), fTime(d.break_start), d.break_end ? fTime(d.break_end) : "", fTime(d.clock_out), d.work_min, d.break_min, d.allowed_min, d.over_min, d.late_min, d.early_min])));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + out.join("\r\n")], { type: "text/csv;charset=utf-8" })); a.download = `attendance_${rep.from}_${rep.to}.csv`; a.click();
}

// ───────── settings ─────────
async function setView() {
  let st = {}, au = [];
  try { [shifts, st, au] = await Promise.all([call("admin_list_shifts"), call("admin_get_settings"), call("admin_audit", { p_limit: 40 })]); } catch {}
  $("#view").innerHTML = `<h2 class="sec-t">الشفتات</h2><div class="grid">${shifts.map((s) => `<div class="ecard working"><h4>${esc(s.name)}</h4><p>${s.start_time.slice(0, 5)} → ${s.end_time.slice(0, 5)} · بريك ${s.break_minutes} د</p><div class="row"><button class="sm" data-sh="${s.id}">تعديل</button></div></div>`).join("")}</div>
  <div class="row noprint"><button class="sm pri" id="nsh">＋ شفت جديد</button></div>
  <h2 class="sec-t">موقع المحل (GPS)</h2><div class="card"><div class="ctrl">
  <div class="field" style="margin:0"><label>Latitude</label><input class="inp" id="la" value="${esc(st.shop_lat)}"></div><div class="field" style="margin:0"><label>Longitude</label><input class="inp" id="lo" value="${esc(st.shop_lng)}"></div>
  <div class="field" style="margin:0"><label>النطاق (متر)</label><input class="inp" id="ra" value="${esc(st.radius_m || 150)}" style="width:110px"></div>
  <div class="field" style="margin:0"><label>عدد البريكات/دوام</label><input class="inp" id="mb" value="${esc(st.max_breaks || 1)}" style="width:110px"></div>
  <div class="field" style="margin:0"><label>إلزام صورة عند الحضور</label><select class="inp" id="rph"><option value="0" ${st.require_photo === "1" ? "" : "selected"}>لا</option><option value="1" ${st.require_photo === "1" ? "selected" : ""}>نعم</option></select></div></div>
  <div class="row"><button class="sm" id="here">📍 استخدم موقعي الحالي</button><button class="sm pri" id="sv">حفظ</button></div>
  <p style="color:var(--mut);margin:10px 0 0">GPS للتسجيل والتحقق الإضافي فقط؛ خارج النطاق يظهر كتنبيه ولا يمنع التسجيل.</p></div>
  <h2 class="sec-t">سجل التدقيق (Audit Log)</h2><div class="scroll"><table><thead><tr><th>الوقت</th><th>المدير</th><th>الإجراء</th><th>السابق</th><th>الجديد</th></tr></thead><tbody>
  ${au.map((a) => `<tr><td>${new Date(a.at).toLocaleString("en-GB", { timeZone: TZ })}</td><td>${esc(a.username)}</td><td>${esc(a.action)} #${esc(a.target_id)}</td><td style="white-space:normal;max-width:260px;direction:ltr;font-size:12px">${esc(a.old_value ? JSON.stringify(a.old_value) : "")}</td><td style="white-space:normal;max-width:260px;direction:ltr;font-size:12px">${esc(a.new_value ? JSON.stringify(a.new_value) : "")}</td></tr>`).join("") || '<tr><td colspan="5">—</td></tr>'}</tbody></table></div>`;
  $("#nsh").onclick = () => shiftForm();
  document.querySelectorAll("[data-sh]").forEach((b) => (b.onclick = () => shiftForm(shifts.find((s) => s.id == b.dataset.sh))));
  $("#here").onclick = () => navigator.geolocation?.getCurrentPosition((p) => { $("#la").value = p.coords.latitude.toFixed(6); $("#lo").value = p.coords.longitude.toFixed(6); }, () => toastA("تعذّر تحديد الموقع"), { enableHighAccuracy: true });
  $("#sv").onclick = async () => { try { await call("admin_save_settings", { p: { shop_lat: $("#la").value, shop_lng: $("#lo").value, radius_m: $("#ra").value, max_breaks: $("#mb").value, require_photo: $("#rph").value } }); toastA("تم الحفظ"); setView(); } catch (x) { toastA(eMsg(x)); } };
}
function shiftForm(s) {
  const m = modal(`<h3>${s ? "تعديل شفت" : "شفت جديد"}</h3><div class="field"><label>الاسم</label><input class="inp" id="s_n" value="${esc(s?.name)}" style="font-size:18px"></div>
  <div class="field"><label>بداية الشفت</label><input class="inp" type="time" id="s_a" value="${s ? s.start_time.slice(0, 5) : "16:00"}" style="font-size:18px"></div>
  <div class="field"><label>نهاية الشفت</label><input class="inp" type="time" id="s_b" value="${s ? s.end_time.slice(0, 5) : "02:00"}" style="font-size:18px"></div>
  <div class="field"><label>مدة البريك (دقيقة)</label><input class="inp" id="s_k" inputmode="numeric" value="${s?.break_minutes ?? 40}" style="font-size:18px"></div>
  <p class="err" id="s_e"></p><button class="btn green" id="s_ok" style="min-height:64px;font-size:20px">حفظ</button>`);
  $("#s_ok", m).onclick = async () => { try { await call("admin_save_shift", { p: { id: s?.id ?? null, name: $("#s_n", m).value, start_time: $("#s_a", m).value, end_time: $("#s_b", m).value, break_minutes: +$("#s_k", m).value } }); m.remove(); setView(); } catch (x) { $("#s_e", m).textContent = eMsg(x); } };
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
tok ? shell() : loginView();
