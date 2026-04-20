// ════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT — Business plan only, max 10 members
// ════════════════════════════════════════════════════════════════

var TEAM_MAX = 10;

var ROLE_DESCRIPTIONS = {
  "Admin":  "Full access — manage team, invite and remove members, generate content",
  "Editor": "Generate content and use all tools — cannot manage team members",
  "Member": "Standard collaborative access — generate content and view assets",
  "Viewer": "Read-only access — view content and assets, cannot generate"
};

// ── Storage key (per-owner) ───────────────────────────────────
function _teamKey(){
  try {
    if(S && S.user && S.user.id) return "oriven_team_" + S.user.id;
  } catch(_){}
  return "oriven_team_anon";
}

// ── Read / write team roster from localStorage ────────────────
function _readTeam(){
  try {
    var raw = localStorage.getItem(_teamKey());
    return raw ? JSON.parse(raw) : [];
  } catch(_){ return []; }
}

function _writeTeam(members){
  try { localStorage.setItem(_teamKey(), JSON.stringify(members)); } catch(_){}
}

// ── Get initials from name or email ──────────────────────────
function _getInitials(str){
  if(!str) return "?";
  var parts = str.trim().split(/\s+/);
  if(parts.length >= 2){
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return str.charAt(0).toUpperCase();
}

// ── Render team card grid ────────────────────────────────────
function renderTeamPage(){
  var container = document.getElementById("teamMemberList");
  if(!container) return;

  var members = _readTeam();
  var html = '<div class="team-grid">';

  members.forEach(function(m, i){
    var initials  = _getInitials(m.name || m.email);
    var roleClass = (m.role || "member").toLowerCase();
    var roleLabel = m.role || "Member";

    html +=
      '<div class="team-card">' +
        '<div class="tc-header">' +
          '<div class="tc-avatar">' + _teamEsc(initials) + '</div>' +
          '<button class="team-remove-btn" onclick="removeTeamMember(' + i + ')" title="Remove member">' +
            '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
              '<path d="M2 2l8 8M10 2L2 10"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="tc-name">' + _teamEsc(m.name || m.email.split("@")[0]) + '</div>' +
        '<div class="tc-email">' + _teamEsc(m.email) + '</div>' +
        '<div class="tc-footer">' +
          '<span class="team-role-badge team-role-' + roleClass + '">' + _teamEsc(roleLabel) + '</span>' +
        '</div>' +
      '</div>';
  });

  // Invite card — always last in the grid
  var remaining = TEAM_MAX - members.length;
  html +=
    '<div class="team-card team-card-invite" onclick="openInviteModal()" role="button" tabindex="0">' +
      '<div class="tc-invite-icon">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
          '<path d="M12 5v14M5 12h14"/>' +
        '</svg>' +
      '</div>' +
      '<div class="tc-invite-label">Invite Member</div>' +
      '<div class="tc-invite-sub">' + members.length + ' of ' + TEAM_MAX + ' members</div>' +
    '</div>';

  html += '</div>';
  container.innerHTML = html;
  _updateTeamCounter(members.length);
}

// ── Update counter ────────────────────────────────────────────
function _updateTeamCounter(count){
  var countEl  = document.getElementById("teamMemberCount");
  var countBdg = document.getElementById("teamCountBadge");
  if(countEl)  countEl.textContent  = count + " / " + TEAM_MAX + " members";
  if(countBdg) countBdg.textContent = count;
}

// ── Open invite modal ─────────────────────────────────────────
function openInviteModal(){
  var members = _readTeam();
  if(members.length >= TEAM_MAX){
    if(typeof toast === "function") toast("Team is full — max " + TEAM_MAX + " members", "warn");
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

// ── Update role description text in modal ─────────────────────
function _updateRoleDesc(role){
  var el = document.getElementById("teamRoleDesc");
  if(el) el.textContent = ROLE_DESCRIPTIONS[role] || "";
}

// ── Add member — calls backend to send real invite email ──────
async function addTeamMember(){
  var nameEl  = document.getElementById("teamInviteName");
  var emailEl = document.getElementById("teamInviteEmail");
  var roleEl  = document.getElementById("teamInviteRole");
  var msgEl   = document.getElementById("teamInviteMsg");
  var sendBtn = document.getElementById("teamInviteSendBtn");

  var name    = nameEl  ? nameEl.value.trim()  : "";
  var email   = emailEl ? emailEl.value.trim()  : "";
  var role    = roleEl  ? roleEl.value          : "Member";
  var message = msgEl   ? msgEl.value.trim()    : "";

  if(!email){
    if(typeof toast === "function") toast("Enter an email address", "warn");
    return;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(typeof toast === "function") toast("Enter a valid email address", "warn");
    return;
  }

  var members = _readTeam();

  if(members.length >= TEAM_MAX){
    if(typeof toast === "function") toast("Team is full — max " + TEAM_MAX + " members", "warn");
    return;
  }

  if(members.some(function(m){ return m.email.toLowerCase() === email.toLowerCase(); })){
    if(typeof toast === "function") toast("This email is already on your team", "warn");
    return;
  }

  // Get workspace name from settings
  var wsName = "ORIVEN Workspace";
  try {
    if(typeof loadSettings === "function"){
      var cfg = loadSettings();
      if(cfg && cfg.wsName) wsName = cfg.wsName;
    }
  } catch(_){}

  // Disable send button
  if(sendBtn){ sendBtn.disabled = true; sendBtn.textContent = "Sending…"; }

  // Send invite via backend
  try {
    var res = await fetch("/api/send-invite", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: name, email: email, role: role, message: message, workspaceName: wsName })
    });

    if(!res.ok){
      var errData = {};
      try { errData = await res.json(); } catch(_){}
      var errMsg = errData.error || "Failed to send invite email";
      if(typeof toast === "function") toast(errMsg, "warn");
      if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = "Send Invite"; }
      return;
    }
  } catch(e){
    if(typeof toast === "function") toast("Could not reach server — invite not sent", "warn");
    if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = "Send Invite"; }
    return;
  }

  // Save to local roster
  members.push({
    name:    name || email.split("@")[0],
    email:   email,
    role:    role,
    addedAt: new Date().toISOString()
  });

  _writeTeam(members);
  if(typeof closeModal === "function") closeModal("modal-invite");
  renderTeamPage();
  if(typeof toast === "function") toast("Invite sent to " + email);
}

// ── Remove member ─────────────────────────────────────────────
function removeTeamMember(index){
  var members = _readTeam();
  if(index < 0 || index >= members.length) return;
  var removed = members.splice(index, 1)[0];
  _writeTeam(members);
  renderTeamPage();
  if(typeof toast === "function") toast("Removed " + (removed.name || removed.email));
}

// ── Called by navigate("team") ────────────────────────────────
function initTeamPage(){
  renderTeamPage();
}

// ── HTML-escape helper (local) ────────────────────────────────
function _teamEsc(s){
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
