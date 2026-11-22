/* Bare agent notice after a successful case intake. Never includes person or case details. */
(function(){
var SUBJECT = "New submission through your Best Legal Net link";
var PENDING_KEY = "blnAgentNotice";
var PENDING_MS = 15 * 60 * 1000;

function cfg(){ return window.BLN_AGENT_NOTICE || {}; }

function normalizeAgent(raw){
  var v = (raw || "").toString().trim().toLowerCase();
  if(!v || v === "direct") return "";
  var map = cfg().agentIds || {};
  if(map[v]) return String(map[v]);
  if(map[raw]) return String(map[raw]);
  return "";
}

function isUtah(v){
  v = (v || "").toString().trim().toLowerCase().replace(/\./g, "");
  return v === "ut" || v === "utah";
}

function noticeDate(){
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date());
}

function noticeBody(date){
  return "A submission came through your link on " + date + ". Do not contact the person. You will not receive their information.";
}

function looksLikeEmail(v){ return /@/.test(v || ""); }

function utahNote(form){
  var resEl = form.querySelector("[name=addr_state], [name=residence_state]");
  var injEl = form.querySelector("[name=acc_state], [name=injury_state]");
  if(!resEl && !injEl) return;
  var residence = resEl ? resEl.value.trim() : "";
  var injury = injEl ? injEl.value.trim() : "";
  var noteEl = form.querySelector("#utah-note-field, [name=utah_note]");
  if(!noteEl) return;
  var missing = [];
  if(!residence) missing.push("state of residence was left blank");
  if(!injury) missing.push("injury location state was left blank");
  var outside = [];
  if(residence && !isUtah(residence)) outside.push("residence: " + residence);
  if(injury && !isUtah(injury)) outside.push("injury location: " + injury);
  if(outside.length){
    noteEl.value = "Note: state of residence or injury location is outside Utah (" + outside.join("; ") + ").";
  } else if(missing.length){
    noteEl.value = "Note: " + missing.join(", and ") + ".";
  } else {
    noteEl.value = "State of residence and injury location are Utah.";
  }
}

function stashPending(agentId){
  try{
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ agent: agentId, ts: Date.now() }));
  }catch(e){}
}

function readPending(){
  try{
    var raw = sessionStorage.getItem(PENDING_KEY);
    if(!raw) return null;
    var data = JSON.parse(raw);
    if(!data || !data.agent || !data.ts || (Date.now() - data.ts) > PENDING_MS) return null;
    return data;
  }catch(e){ return null; }
}

function clearPending(){
  try{ sessionStorage.removeItem(PENDING_KEY); }catch(e){}
}

window.BLN_prepareCaseSubmission = function(form){
  if(!form) return;
  utahNote(form);
  var ag = form.querySelector("#agent-field, [name=agent]");
  var q = new URLSearchParams(window.location.search).get("agent");
  var id = normalizeAgent((q && q.trim()) || (ag && ag.value) || "");
  if(ag && q && q.trim()) ag.value = q.trim();
  if(id) stashPending(id);
  else clearPending();
};

function sendViaRelay(url, agentId){
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ agent: String(agentId) })
  }).then(function(res){
    if(!res.ok) throw new Error("relay " + res.status);
  });
}

function sendViaFormsubmitAlias(alias, agentId){
  if(!alias || looksLikeEmail(alias) || /formsubmit\.co/i.test(alias)){
    return Promise.reject(new Error("alias looks unsafe"));
  }
  var endpoint = "https://formsubmit.co/ajax/" + encodeURIComponent(alias);
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      _subject: SUBJECT,
      _template: "box",
      _captcha: "false",
      message: noticeBody(noticeDate())
    })
  }).then(function(res){
    if(!res.ok) throw new Error("formsubmit " + res.status);
  });
}

window.BLN_sendPendingAgentNotice = function(){
  var pending = readPending();
  clearPending();
  if(!pending) return Promise.resolve("none");
  var c = cfg();
  if(!c.enabled) return Promise.resolve("disabled");
  var agentId = normalizeAgent(pending.agent);
  if(!agentId) return Promise.resolve("unknown");
  if(c.relayUrl){
    return sendViaRelay(c.relayUrl, agentId).then(function(){ return "sent-relay"; });
  }
  var alias = (c.formsubmitAliases || {})[agentId];
  if(alias){
    return sendViaFormsubmitAlias(alias, agentId).then(function(){ return "sent-alias"; });
  }
  return Promise.resolve("no-destination");
};

if(document.documentElement && /thanks|thank you|gracias/i.test(document.title)){
  window.BLN_sendPendingAgentNotice();
} else if(location.pathname && /thanks\.html$/i.test(location.pathname)){
  window.BLN_sendPendingAgentNotice();
}

/* Keep ?agent= on language switcher links so tracking is not dropped. */
(function(){
  var q = new URLSearchParams(window.location.search).get("agent");
  if(!q || !q.trim()) return;
  document.querySelectorAll(".lang a").forEach(function(a){
    try{
      var u = new URL(a.getAttribute("href"), window.location.href);
      u.searchParams.set("agent", q.trim());
      a.setAttribute("href", u.pathname + u.search + u.hash);
    }catch(e){}
  });
})();
})();
