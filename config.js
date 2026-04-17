// ============================================================
// config.js — Fill in with your own values
// ============================================================
// 1. Create a project at https://supabase.com
// 2. Project Settings → API → copy the values below
// 3. In Supabase Auth → URL Configuration, add your Vercel URL
//    to "Site URL" and "Redirect URLs" (so magic links work)
// ============================================================

window.APP_CONFIG = {
  SUPABASE_URL: "https://foojejwfvbblvozlffmt.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb2plandmdmJibHZvemxmZm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODAzMTIsImV4cCI6MjA5MTk1NjMxMn0.Q3JKRL3ibRx41vRtPqSal1BqK1FZvw6JWeXSoLqrhPs",

  // Admin gate — this is NOT real security, just a soft gate for your team.
  // The actual protection is on the serverless function (see /api/admin.js)
  // which uses the ADMIN_PASSWORD env var set in Vercel.
  ADMIN_PASSWORD_HINT: "Ask Pia for the password",
};
