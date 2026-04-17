// ============================================================
// config.js — Fill in with your own values
// ============================================================
// 1. Create a project at https://supabase.com
// 2. Project Settings → API → copy the values below
// 3. In Supabase Auth → URL Configuration, add your Vercel URL
//    to "Site URL" and "Redirect URLs" (so magic links work)
// ============================================================

window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  // Admin gate — this is NOT real security, just a soft gate for your team.
  // The actual protection is on the serverless function (see /api/admin.js)
  // which uses the ADMIN_PASSWORD env var set in Vercel.
  ADMIN_PASSWORD_HINT: "Ask Pia for the password",
};
