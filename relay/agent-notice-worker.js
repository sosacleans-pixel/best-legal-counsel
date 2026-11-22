/* Tiny Cloudflare Worker that sends the bare Best Legal Net agent notice.
   Store agent addresses only in Worker secrets, never in this file or the public site.
   Expected secrets / vars:
     AGENT_EMAIL_1  (secret)  inbox for agent id 1
     AGENT_EMAIL_2  (secret, optional)
     RESEND_API_KEY (secret)  or another mail API key
     MAIL_FROM      (var)     a from-address on the sending domain
     ALLOWED_ORIGINS (var)    comma-separated origins, e.g. https://bestlegalnet.com,https://blc.salimheyaime.com
   The worker accepts only { "agent": "1" }. It ignores and never forwards any other fields.
*/

var SUBJECT = "New submission through your Best Legal Net link";

function corsHeaders(origin, allowed) {
  var headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store"
  };
  if (origin && allowed.indexOf(origin) !== -1) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function noticeDate() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function noticeBody(date) {
  return "A submission came through your link on " + date + ". Do not contact the person. You will not receive their information.";
}

function json(body, status, origin, allowed) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin, allowed))
  });
}

export default {
  async fetch(request, env) {
    var allowed = allowedOrigins(env);
    var origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }
    if (request.method !== "POST") {
      return json({ ok: false }, 405, origin, allowed);
    }
    if (origin && allowed.length && allowed.indexOf(origin) === -1) {
      return json({ ok: false }, 403, origin, allowed);
    }

    var data;
    try { data = await request.json(); }
    catch (e) { return json({ ok: false }, 400, origin, allowed); }

    if (!data || typeof data !== "object") {
      return json({ ok: false }, 400, origin, allowed);
    }
    var keys = Object.keys(data);
    if (keys.length !== 1 || keys[0] !== "agent") {
      return json({ ok: false }, 400, origin, allowed);
    }

    var agentId = String(data.agent || "").trim();
    if (!/^\d+$/.test(agentId)) {
      return json({ ok: false }, 400, origin, allowed);
    }

    var email = env["AGENT_EMAIL_" + agentId];
    if (!email) {
      /* Unknown or not-yet-configured agent: accept but do not send. */
      return json({ ok: true }, 202, origin, allowed);
    }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      return json({ ok: false }, 500, origin, allowed);
    }

    var body = noticeBody(noticeDate());
    var res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [email],
        subject: SUBJECT,
        text: body
      })
    });

    if (!res.ok) {
      return json({ ok: false }, 502, origin, allowed);
    }
    return json({ ok: true }, 200, origin, allowed);
  }
};
