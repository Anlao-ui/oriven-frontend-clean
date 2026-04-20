// ═══ SUPABASE CLIENT ══════════════════════════════════════════
// Initialized once — available globally as SB across all scripts.
// The anon key is intentionally public (publishable key).

var SUPABASE_URL  = "https://rsqfoqitooxmkyrkuyzi.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_O7XoiC1YmV94lhwV5o8YBA_7zJ2HA7K";

var SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("[Supabase] Client initialized →", SUPABASE_URL);
