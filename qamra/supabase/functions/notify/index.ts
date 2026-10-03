// Runs every minute (pg_cron -> pg_net). Sends break reminders via Web Push. No AI, no tokens.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const T: Record<string, Record<string, (m: number) => string>> = {
  ar: {
    title: () => "دوام شاهي قمرا",
    pre10: () => "باقي 10 دقائق على نهاية البريك",
    pre5: () => "باقي 5 دقائق على نهاية البريك",
    end: () => "انتهى وقت البريك، الرجاء العودة للعمل",
    over: (m) => `تجاوزت وقت البريك بـ ${m} دقائق`,
  },
  bn: {
    title: () => "শাহী কামরা হাজিরা",
    pre10: () => "বিরতি শেষ হতে আর ১০ মিনিট বাকি",
    pre5: () => "বিরতি শেষ হতে আর ৫ মিনিট বাকি",
    end: () => "বিরতির সময় শেষ, অনুগ্রহ করে কাজে ফিরুন",
    over: (m) => `আপনি বিরতির সময় ${m} মিনিট ছাড়িয়ে গেছেন`,
  },
};

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("due_break_notifications");
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const row of data ?? []) {
    const L = T[row.lang] ?? T.ar;
    const payload = JSON.stringify({ title: L.title(0), body: L[row.kind](row.minutes), tag: "break" });
    for (const s of row.subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 120, urgency: "high" });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await sb.rpc("drop_push", { p_endpoint: s.endpoint });
      }
    }
  }
  return new Response(JSON.stringify({ due: data?.length ?? 0, sent }), { headers: { "Content-Type": "application/json" } });
});
