// ════ EVENT TRACKING ════════════════════════════════════════════
// Inserts into Supabase "events" table.
// Session ID persists across visits; linked to user_id on login/signup.

function _getSessionId(){
  var id = localStorage.getItem("session_id");
  if(!id){
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem("session_id", id);
  }
  return id;
}

function trackEvent(eventName, user){
  if(typeof SB === "undefined") return;
  var payload = {
    event_name: eventName,
    session_id: _getSessionId(),
    user_id:    (user && user.id) ? user.id : null
  };
  SB.from("events").insert(payload).then(function(result){
    if(result.error) console.warn("[Track] Insert error:", eventName, result.error.message);
    else console.log("[Track]", eventName, payload.session_id.slice(0, 8));
  });
}

function linkSessionToUser(userId){
  if(typeof SB === "undefined" || !userId) return;
  var sessionId = _getSessionId();
  SB.from("events")
    .update({ user_id: userId })
    .eq("session_id", sessionId)
    .is("user_id", null)
    .then(function(result){
      if(result.error) console.warn("[Track] Link session error:", result.error.message);
      else console.log("[Track] Session linked to user:", userId);
    });
}
