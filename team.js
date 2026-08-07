// ════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT — seats capped per plan (Starter 1, Creator 1,
// Professional 10 — includes the account owner as seat 1). Real,
// server-persisted members (server.js /api/team/members, /api/send-invite)
// — the server enforces the same limit independently, so this UI cap is
// UX only, not the actual gate.
// ════════════════════════════════════════════════════════════════

// Cached in-memory after the first fetch this page-view; refreshed by
// initTeamPage() each time the Team page is opened.
var _teamMembersCache = [];
var TEAM_MAX = 1; // corrected from the real plan before first render — see _teamMax()

async function _teamMax(){
  var plan = (typeof _getCachedPlan === "function") ? await _getCachedPlan() : "free";
  var cfg  = (typeof ORIVEN_PLANS !== "undefined") ? ORIVEN_PLANS[plan] : null;
  return (cfg && cfg.teamMembers) ? cfg.teamMembers : 1;
}

async function _fetchTeam(){
  try {
    var res = await apiFetch("/api/team/members");
    if(res.ok && res.data && Array.isArray(res.data.members)){
      // Server rows use invitee_name/invitee_email -- map to the name/email
      // shape the rest of this file already renders.
      return res.data.members.map(function(m){
        return { id: m.id, name: m.invitee_name, email: m.invitee_email, role: m.role, status: m.status, addedAt: m.created_at };
      });
    }
  } catch(_){}
  return [];
}

function _getInitials(str){
  if(!str) return "?";
  var parts = str.trim().split(/\s+/);
  if(parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.charAt(0).toUpperCase();
}

// ── Render member list ────────────────────────────────────────
function renderTeamPage(){
  var container = document.getElementById("teamMemberList");
  if(!container) return;

  var members = _teamMembersCache;
  var roleClass = {
    admin:  "tm-mbadge-admin",
    editor: "tm-mbadge-editor",
    member: "tm-mbadge-member",
    viewer: "tm-mbadge-viewer"
  };

  var html = "";

  var selfName = "";
  try { if(S && S.user) selfName = S.user.name || S.user.email || ""; } catch(_){}
  var selfInitials = _getInitials(selfName || "You");
  html +=
    '<div class="tm-member-row">' +
      '<div class="tm-mavatar tm-mavatar-self">' + _teamEsc(selfInitials) + '</div>' +
      '<div class="tm-minfo"><div class="tm-mname">' + _teamEsc(selfName || "You") + '</div></div>' +
      '<span class="tm-mbadge tm-mbadge-admin">Admin</span>' +
    '</div>';

  members.forEach(function(m, i){
    var initials = _getInitials(m.name || m.email);
    var rk = (m.role || "member").toLowerCase();
    var rl = m.role || "Member";
    var rc = roleClass[rk] || "tm-mbadge-member";
    html +=
      '<div class="tm-member-row">' +
        '<div class="tm-mavatar">' + _teamEsc(initials) + '</div>' +
        '<div class="tm-minfo">' +
          '<div class="tm-mname">' + _teamEsc(m.name || m.email.split("@")[0]) + '</div>' +
          '<div class="tm-memail">' + _teamEsc(m.email) + '</div>' +
        '</div>' +
        '<span class="tm-mbadge ' + rc + '">' + _teamEsc(rl) + '</span>' +
        '<button class="tm-mremove" onclick="removeTeamMember(\'' + _teamEsc(m.id) + '\')" title="Remove member">' +
          '<svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
            '<path d="M2 2l8 8M10 2L2 10"/>' +
          '</svg>' +
        '</button>' +
      '</div>';
  });

  if(members.length + 1 < TEAM_MAX){
    html +=
      '<div class="tm-invite-row" onclick="openInviteModal()" role="button" tabindex="0">' +
        '<div class="tm-invite-row-icon">' +
          '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
            '<path d="M6 1v10M1 6h10"/>' +
          '</svg>' +
        '</div>' +
        '<div class="tm-invite-row-txt">Invite a team member</div>' +
      '</div>';
  }

  container.innerHTML = html;
  _updateTeamCounter(members.length);
}

function _updateTeamCounter(count){
  var countEl  = document.getElementById("teamMemberCount");
  var countBdg = document.getElementById("teamCountBadge");
  if(countEl)  countEl.textContent  = (count + 1) + " / " + TEAM_MAX + " members";
  if(countBdg) countBdg.textContent = count + 1;
}

// ── Hero stats ────────────────────────────────────────────────
function _renderTeamHero(){
  var members  = _teamMembersCache;
  var intelPct = "—";
  if(typeof _dashComputeIntel === "function"){
    var intel = _dashComputeIntel();
    if(intel) intelPct = intel.pct + "%";
  }
  var sm = document.getElementById("tmStatMembers");
  var si = document.getElementById("tmStatIntel");
  var ss = document.getElementById("tmStatStatus");
  if(sm) sm.textContent = members.length + 1;
  if(si) si.textContent = intelPct;
  if(ss){
    var hasBC = (typeof S !== "undefined" && S.brandCore && Object.keys(S.brandCore).length > 0);
    ss.textContent = hasBC ? "Active" : "Setup";
  }
}

// ── Active projects ───────────────────────────────────────────
function _renderTeamProjects(){
  var el = document.getElementById("tmProjGrid");
  if(!el) return;

  var campaigns = (typeof S !== "undefined" && S.campaigns) ? S.campaigns : [];
  var tc = {
    campaign: {bg:"rgba(167,139,250,.1)", color:"#A78BFA", label:"Campaign"},
    ugc:      {bg:"rgba(255,94,58,.1)",   color:"#FF5E3A", label:"UGC"},
    visual:   {bg:"rgba(245,158,11,.1)",  color:"#F59E0B", label:"Visual"},
    content:  {bg:"rgba(59,130,246,.1)",  color:"#3B82F6", label:"Content"}
  };

  if(!campaigns.length){
    el.innerHTML =
      '<div class="tm-proj-empty">' +
        '<strong>No active projects yet</strong>' +
        '<span>Create your first campaign to see it here.</span>' +
      '</div>';
    return;
  }

  el.innerHTML = campaigns.slice(0,5).map(function(c){
    var t   = tc[c.type] || tc.campaign;
    var pct = c.assets ? Math.min(100, c.assets.length * 20) : 0;
    return '<div class="tm-proj-row">' +
      '<div class="tm-proj-type" style="background:'+t.bg+';color:'+t.color+'">'+t.label+'</div>' +
      '<div class="tm-proj-name">' + _teamEsc(c.name || "Untitled") + '</div>' +
      '<div class="tm-proj-meta">' + (c.assets ? c.assets.length : 0) + ' assets · Active</div>' +
      '<div class="tm-proj-bar-wrap"><div class="tm-proj-bar"><div class="tm-proj-fill" style="width:'+pct+'%;background:'+t.color+'"></div></div></div>' +
    '</div>';
  }).join("");
}

// ── Activity feed ─────────────────────────────────────────────
function _renderTeamActivity(){
  var el = document.getElementById("tmActivity");
  if(!el) return;

  var assets    = (typeof S !== "undefined" && S.assets)    ? S.assets    : [];
  var campaigns = (typeof S !== "undefined" && S.campaigns) ? S.campaigns : [];
  var bc        = (typeof S !== "undefined" && S.brandCore) ? S.brandCore : null;

  var items = [];
  assets.slice(-3).reverse().forEach(function(a){
    items.push({color:"#B7FF2A", text:"<strong>" + _teamEsc(a.name||"Asset") + "</strong> was created and saved as an asset", time:a.createdAt||""});
  });
  campaigns.slice(-2).reverse().forEach(function(c){
    items.push({color:"#A78BFA", text:"<strong>" + _teamEsc(c.name||"Campaign") + "</strong> campaign was launched", time:""});
  });
  if(bc && Object.keys(bc).length > 0){
    items.push({color:"#3B82F6", text:"<strong>Brand Core</strong> is configured — AI is learning your brand", time:""});
  }

  if(!items.length){
    el.innerHTML = '<div class="tm-act-empty">No recent activity yet.<br>Create content to see it here.</div>';
    return;
  }

  el.innerHTML = items.slice(0,5).map(function(item){
    return '<div class="tm-act-item">' +
      '<div class="tm-act-dot" style="background:'+item.color+'"></div>' +
      '<div class="tm-act-body">'+item.text+'</div>' +
      (item.time ? '<div class="tm-act-time">'+item.time+'</div>' : '') +
    '</div>';
  }).join("");
}

// ── AI insights (hidden panel) ────────────────────────────────
function _renderTeamAiInsights(){}

// ── Open invite modal ─────────────────────────────────────────
async function openInviteModal(){
  TEAM_MAX = await _teamMax();
  // +1 -- the account owner is always seat 1, same accounting as the
  // server's own check in /api/send-invite.
  if(_teamMembersCache.length + 1 >= TEAM_MAX){
    if(typeof toast === "function") toast("Team is full — your plan allows " + TEAM_MAX + " member" + (TEAM_MAX === 1 ? "" : "s") + " (including you)", "warn");
    return;
  }
  var nameEl  = document.getElementById("teamInviteName");
  var emailEl = document.getElementById("teamInviteEmail");
  var roleEl  = document.getElementById("teamInviteRole");
  var msgEl   = document.getElementById("teamInviteMsg");
  var sendBtn = document.getElementById("teamInviteSendBtn");
  if(nameEl)  nameEl.value  = "";
  if(emailEl) emailEl.value = "";
  if(roleEl)  roleEl.value  = "Member";
  if(msgEl)   msgEl.value   = "";
  if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = "Send Invite"; }
  _updateRoleDesc("Member");
  if(typeof openModal === "function") openModal("modal-invite");
}

function _updateRoleDesc(role){
  var el = document.getElementById("teamRoleDesc");
  if(el) el.textContent = ROLE_DESCRIPTIONS[role] || "";
}

// ── Add member — sends real invite email via backend ──────────
async function addTeamMember(){
  var nameEl  = document.getElementById("teamInviteName");
  var emailEl = document.getElementById("teamInviteEmail");
  var roleEl  = document.getElementById("teamInviteRole");
  var msgEl   = document.getElementById("teamInviteMsg");
  var sendBtn = document.getElementById("teamInviteSendBtn");

  var name    = nameEl  ? nameEl.value.trim()  : "";
  var email   = emailEl ? emailEl.value.trim() : "";
  var role    = roleEl  ? roleEl.value         : "Member";
  var message = msgEl   ? msgEl.value.trim()   : "";

  if(!email){
    if(typeof toast === "function") toast("Enter an email address", "warn");
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(typeof toast === "function") toast("Enter a valid email address", "warn");
    return;
  }

  var members = _teamMembersCache;
  TEAM_MAX = await _teamMax();
  if(members.length + 1 >= TEAM_MAX){
    if(typeof toast === "function") toast("Team is full — your plan allows " + TEAM_MAX + " member" + (TEAM_MAX === 1 ? "" : "s") + " (including you)", "warn");
    return;
  }
  if(members.some(function(m){ return m.email.toLowerCase() === email.toLowerCase(); })){
    if(typeof toast === "function") toast("This email is already on your team", "warn");
    return;
  }

  var wsName = "ORIVEN Workspace";
  try {
    if(typeof loadSettings === "function"){
      var cfg = loadSettings();
      if(cfg && cfg.wsName) wsName = cfg.wsName;
    }
  } catch(_){}

  if(sendBtn){ sendBtn.disabled = true; sendBtn.textContent = "Sending…"; }

  try {
    var result = await apiFetch("/api/send-invite", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name:name, email:email, role:role, message:message, workspaceName:wsName })
    });
    if(!result.ok){
      // The server's own seat-limit check (403 / TEAM_SEAT_LIMIT) lands here
      // too -- same message shown either way, since the server is the real
      // gate and this client check is just a faster first line.
      var errMsg = (result.data && result.data.error) || "Failed to send invite email";
      if(typeof toast === "function") toast(errMsg, "warn");
      if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = "Send Invite"; }
      return;
    }
  } catch(e){
    if(typeof toast === "function") toast("Could not reach server — invite not sent. " + e.message, "warn");
    if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = "Send Invite"; }
    return;
  }

  if(typeof closeModal === "function") closeModal("modal-invite");
  await initTeamPage(); // re-fetch from the server -- the new row is now real and persisted
  if(typeof toast === "function") toast("Invite sent to " + email);
}

// ── Remove member ─────────────────────────────────────────────
async function removeTeamMember(id){
  try {
    var result = await apiFetch("/api/team/members/" + encodeURIComponent(id), { method: "DELETE" });
    if(!result.ok){
      if(typeof toast === "function") toast((result.data && result.data.error) || "Could not remove that team member", "warn");
      return;
    }
  } catch(e){
    if(typeof toast === "function") toast("Could not reach server — member not removed. " + e.message, "warn");
    return;
  }
  await initTeamPage();
  if(typeof toast === "function") toast("Team member removed");
}

// ── Entry point called by navigate("team") ────────────────────
async function initTeamPage(){
  TEAM_MAX = await _teamMax();
  _teamMembersCache = await _fetchTeam();
  _renderTeamHero();
  renderTeamPage();
  _renderTeamProjects();
  _renderTeamActivity();
  _renderTeamAiInsights();
}

// ── HTML-escape helper ────────────────────────────────────────
function _teamEsc(s){
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
