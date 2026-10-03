"use strict";
const CFG = window.CFG;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const TZ = "Asia/Riyadh";
let clockOffset = 0; // server time - device time (ms)
const syncClock = (iso) => { clockOffset = Date.parse(iso) - Date.now(); };
const srvNow = () => Date.now() + clockOffset;

async function rpc(fn, args = {}, signal) {
  let r;
  try {
    r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", signal,
      headers: { apikey: CFG.ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch { throw Object.assign(new Error("network"), { code: "network" }); }
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  if (!r.ok) throw Object.assign(new Error(body?.message || "error"), { code: body?.message || "error", status: r.status });
  return body;
}

// time helpers (always Riyadh time)
const fTime = (v) => v ? new Date(v).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "—";
const fTimeS = (v) => new Date(v).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });
const pad = (n) => String(n).padStart(2, "0");
const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
const bnDigits = (s) => String(s).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
