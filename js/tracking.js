// ════ EVENT TRACKING ════════════════════════════════════════════
// Activation events go to POST /api/events (server.js → `events` table via
// the service role). The server accepts only allowlisted event names and
// keeps only short allowlisted props (goal, action, plan, …), so never pass
// prompts, business details or anything personal here.
// Session ID persists across visits; linked to the user on login/signup.
// Fire-and-forget: tracking can never break or slow the product.

function _getSessionId(){
  var id = null;
  try { id = localStorage.getItem("session_id"); } catch(_){}
  if(!id){
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    try { localStorage.setItem("session_id", id); } catch(_){}
  }
  return id;
}

function _postEvent(body){
  if(typeof API_BASE_URL === "undefined" || typeof fetch !== "function") return;
  try {
    // window.fetch (supabase.js) attaches the signed-in user's bearer token.
    fetch(API_BASE_URL + "/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true // survives a navigation to Stripe Checkout
    }).catch(function(){});
  } catch(_){}
}

// user: kept for existing call sites (identity comes from the session token).
function trackEvent(eventName, user, props){
  _postEvent({ event: eventName, sessionId: _getSessionId(), props: props || undefined });
}

function linkSessionToUser(userId){
  if(!userId) return;
  // Shortly after sign-in, once supabase.js has the session token.
  setTimeout(function(){ _postEvent({ event: "session_linked", sessionId: _getSessionId() }); }, 1500);
}
