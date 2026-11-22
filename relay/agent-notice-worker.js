/* Tiny Cloudflare Worker that sends the bare Best Legal Net agent notice.
   Store agent addresses only in Worker secrets, never in this file or the public site.
   Expected secrets / vars:
     AGENT_EMAIL_1  (secret)  inbox for agent id 1
     AGENT_EMAIL_2  (secret, optional)
     RESEND_API_KEY (secret)
     MAIL_FROM      (var)     already-verified from-address, display name Best Legal Net
   The worker accepts only { "agent": "1" } (or another known numeric id).
   POST /dry-run returns the would-be message and never sends mail.
*/

var SUBJECT = "New submission through your Best Legal Net link";
var KNOWN_IDS = { "1": true, "2": true };
var ALLOWED_ORIGINS = [
  "https://bestlegalnet.com",
  "https://www.bestlegalnet.com",
  "https://blc.salimheyaime.com"
];
var RATE_WINDOW_MS = 10 * 60 * 1000;
var RATE_MAX = 20;
var hits = new Map();

function corsHeaders(origin) {
  var headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store"
  };
  if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
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

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin))
  });
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
}

function rateLimited(ip) {
  var now = Date.now();
  var arr = (hits.get(ip) || []).filter(function (t) { return now - t < RATE_WINDOW_MS; });
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function isDryRun(request) {
  try {
    var url = new URL(request.url);
    if (url.pathname === "/dry-run" || url.pathname === "/dry-run/") return true;
  } catch (e) {}
  return false;
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method === "GET") {
      var path = new URL(request.url).pathname;
      if (path === "/" || path === "/health") {
        return json({ ok: true }, 200, origin);
      }
      return json({ ok: false }, 404, origin);
    }
    if (request.method !== "POST") {
      return json({ ok: false }, 405, origin);
    }
    if (origin && ALLOWED_ORIGINS.indexOf(origin) === -1) {
      return json({ ok: false }, 403, origin);
    }
    if (rateLimited(clientIp(request))) {
      return json({ ok: false }, 429, origin);
    }

    var data;
    try { data = await request.json(); }
    catch (e) { return json({ ok: false }, 400, origin); }

    if (!data || typeof data !== "object") {
      return json({ ok: false }, 400, origin);
    }
    var keys = Object.keys(data);
    if (keys.length !== 1 || keys[0] !== "agent") {
      return json({ ok: false }, 400, origin);
    }

    var agentId = String(data.agent || "").trim();
    if (!/^\d+$/.test(agentId) || !KNOWN_IDS[agentId]) {
      return json({ ok: false }, 400, origin);
    }

    var subject = SUBJECT;
    var body = noticeBody(noticeDate());
    var email = env["AGENT_EMAIL_" + agentId];
    var canSend = !!(email && env.RESEND_API_KEY && env.MAIL_FROM);
    var dry = isDryRun(request);

    if (dry) {
      return json({
        ok: true,
        dryRun: true,
        subject: subject,
        body: body,
        wouldSend: canSend
      }, 200, origin);
    }

    if (!email) {
      /* Known id with no secret yet: accept but do not send. */
      return json({ ok: true }, 202, origin);
    }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      return json({ ok: false }, 500, origin);
    }

    var res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [email],
        subject: subject,
        text: body
      })
    });

    if (!res.ok) {
      return json({ ok: false }, 502, origin);
    }
    return json({ ok: true }, 200, origin);
  }
};
