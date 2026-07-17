// ═══ SUPABASE CLIENT ══════════════════════════════════════════
// Initialized once — available globally as SB across all scripts.
// The anon key is intentionally public (publishable key).

var SUPABASE_URL  = "https://rsqfoqitooxmkyrkuyzi.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_O7XoiC1YmV94lhwV5o8YBA_7zJ2HA7K";

// ── Dev mode flag ─────────────────────────────────────────────
// Detected once here — consumed by auth.js and usage.js to bypass
// all subscription and usage restrictions during local development.
// Never true on production (orivenai.com, Render, any non-localhost host).
var ORIVEN_DEV = (
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1"
);
if (ORIVEN_DEV) console.log("[ORIVEN] Dev mode active — subscription and usage limits bypassed");

// ── Backend base URL ──────────────────────────────────────────
// Single definition — every API fetch across all scripts uses this.
// Frontend (orivenai.com) and Express backend (Render) are separately hosted,
// so we cannot use window.location.origin — it would point to the static host.
//   Local:      http://localhost:5500
//   Production: https://oriven-backand-clean.onrender.com
var API_BASE_URL = ORIVEN_DEV
  ? "http://localhost:5500"
  : "https://oriven-backand-clean.onrender.com";

var SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("[Supabase] Client initialized →", SUPABASE_URL);

// ── Safe API fetch wrapper ─────────────────────────────────────
// All backend calls go through here. Catches HTML error pages (from
// Render cold starts, 404s, or proxy errors) before they crash JSON.parse.
// Returns: { ok, status, data }   Throws: readable Error
// ── Auth token cache (refreshed on auth state change) ─────────
var _apiToken = null;
SB.auth.onAuthStateChange(function(event, session){
  _apiToken = session && session.access_token ? session.access_token : null;
});
SB.auth.getSession().then(function(r){
  _apiToken = r.data && r.data.session ? r.data.session.access_token : null;
});

async function apiFetch(path, options) {
  var url    = API_BASE_URL + path;
  var method = (options && options.method) || "GET";
  // Auto-inject auth token so backend can verify subscription
  var headers = Object.assign({}, options && options.headers);
  if(!headers["Authorization"] && _apiToken){
    headers["Authorization"] = "Bearer " + _apiToken;
  }
  // Auto-set Content-Type for JSON bodies so express.json() parses req.body
  if(options && options.body && typeof options.body === "string" && !headers["Content-Type"]){
    headers["Content-Type"] = "application/json";
  }
  options = Object.assign({}, options, { headers: headers });
  console.log("[API] →", method, url, "| auth:", headers["Authorization"] ? "Bearer present" : "NO AUTH TOKEN", "| body size:", options.body ? options.body.length + " bytes" : "none");

  var resp;
  try {
    resp = await fetch(url, options);
  } catch (netErr) {
    console.error("[API] ✗ Network error on", url, ":", netErr.message);
    throw new Error("Could not reach ORIVEN services. Please check your connection and try again.");
  }

  console.log("[API] ←", resp.status, url, "| ok:", resp.ok);

  // Read body as text first — safe regardless of content-type
  var text = await resp.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    // Server returned HTML (404 page, Render startup page, proxy error, etc.)
    console.error("[API] ✗ Non-JSON body (HTTP " + resp.status + ") from:", url);
    console.error("[API]   Preview:", text.slice(0, 400));
    if (resp.status === 404) {
      throw new Error("API endpoint not found (" + path + "). Please ensure the backend is fully deployed.");
    }
    throw new Error("Server returned an unexpected response (HTTP " + resp.status + "). The service may be starting — please try again in a moment.");
  }

  return { ok: resp.ok, status: resp.status, data: data };
}

// ── Global fetch interceptor ──────────────────────────────────
// Injects the session Bearer token on any raw fetch() call that
// goes to our own backend (API_BASE_URL), so every generation
// route receives auth even when called with plain fetch().
(function(){
  var _orig = window.fetch.bind(window);
  window.fetch = function(input, init){
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if(url && url.indexOf(API_BASE_URL) === 0 && _apiToken){
      init = init ? Object.assign({}, init) : {};
      init.headers = Object.assign({}, init.headers || {});
      if(!init.headers["Authorization"]){
        init.headers["Authorization"] = "Bearer " + _apiToken;
      }
    }
    return _orig(input, init);
  };
})();
