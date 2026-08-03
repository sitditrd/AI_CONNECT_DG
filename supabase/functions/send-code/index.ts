// Connect DG — 이메일 인증코드 발송 Edge Function (오픈소스 denomailer + 본인 SMTP)
// 배포: supabase functions deploy send-code --no-verify-jwt (자체 레이트리밋 내장)
// 시크릿: SMTP_HOST, SMTP_PORT(465), SMTP_USER, SMTP_PASS, SMTP_FROM
// ※ 메일 제목/본문은 ASCII로 유지 — denomailer가 비Latin1(한글)을 btoa로 인코딩하다 실패하는 이슈 회피.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "method" }, 405);
  try {
    const { login, purpose = "signup" } = await req.json();
    const email = String(login ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ error: "invalid email" }, 400);
    if (purpose !== "signup" && purpose !== "reset") return j({ error: "invalid purpose" }, 400);

    const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    // ① 주소별 레이트리밋 — 목적 무관 60초 1회 (purpose 번갈아 우회 차단).
    //    조회 자체가 실패하면 차단(fail-closed) — 예전에는 오류 응답 시 통과했다.
    const since = new Date(Date.now() - 60000).toISOString();
    const rl = await fetch(`${SUPABASE_URL}/rest/v1/dg_email_codes?login_id=eq.${encodeURIComponent(email)}&created_at=gt.${since}&select=id`, { headers: svc });
    if (!rl.ok) return j({ error: "rate check failed" }, 503);
    const recent = await rl.json();
    if (!Array.isArray(recent)) return j({ error: "rate check failed" }, 503);
    if (recent.length > 0) return j({ error: "Please wait a minute before requesting a new code." }, 429);

    // ② 전역 발송량 상한 — 임의 주소로 무한 발송(이메일 폭탄·SMTP 평판 훼손) 차단
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const gl = await fetch(`${SUPABASE_URL}/rest/v1/dg_email_codes?created_at=gt.${hourAgo}&select=id`, { headers: svc });
    if (!gl.ok) return j({ error: "rate check failed" }, 503);
    const hourly = await gl.json();
    if (!Array.isArray(hourly)) return j({ error: "rate check failed" }, 503);
    if (hourly.length >= 30) return j({ error: "Too many requests right now. Please try again later." }, 429);

    // ③ 같은 주소·목적의 기존 미사용 코드는 무효화 — 동시에 유효한 코드를 항상 1개로 유지
    //    (여러 개가 살아 있으면 무차별 대입 1회당 적중 확률이 개수만큼 올라간다)
    await fetch(`${SUPABASE_URL}/rest/v1/dg_email_codes?login_id=eq.${encodeURIComponent(email)}&purpose=eq.${purpose}&consumed=is.false`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ consumed: true }),
    });

    // 인증코드 — 암호학적 난수 사용
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(100000 + (buf[0] % 900000));
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/dg_email_codes`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ login_id: email, code, purpose }),
    });
    if (!ins.ok) return j({ error: "code save failed" }, 500);

    const host = Deno.env.get("SMTP_HOST");
    if (!host) return j({ error: "SMTP not configured" }, 503);
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
        tls: true,
        auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASS")! },
      },
    });
    const kind = purpose === "reset" ? "Password Reset" : "Sign-up";
    await client.send({
      from: Deno.env.get("SMTP_FROM") ?? Deno.env.get("SMTP_USER")!,
      to: email,
      subject: `[Connect DG] ${kind} Verification Code: ${code}`,
      content: "text/html",
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:460px;margin:auto;padding:10px">
        <h2 style="color:#7a4a00;margin:0 0 6px">Connect DG</h2>
        <p style="color:#333;margin:0 0 14px">Your ${kind} verification code is below.</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#b3731a;background:#fff7ea;border-radius:12px;padding:18px;text-align:center">${code}</div>
        <p style="color:#999;font-size:12px;margin:16px 0 0">This code expires in 10 minutes. If you did not request it, please ignore this email.</p>
      </div>`,
    });
    await client.close();
    return j({ ok: true });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
