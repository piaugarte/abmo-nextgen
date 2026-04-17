# Family Entrepreneur Spotlight Portal

A portal for collecting, reviewing, and publishing family business profiles.

## What's in here

```
family-portal/
├── index.html              ← Public questionnaire (magic-link save/resume)
├── admin.html              ← Team dashboard (password-gated)
├── profile.html            ← Sample public profile page
├── config.js               ← Fill in Supabase keys
├── schema.sql              ← Run once in Supabase SQL editor
├── api/
│   └── generate-profile.js ← Serverless function for AI copy drafting
├── package.json
├── vercel.json
└── README.md
```

## Setup — Step by step

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → paste contents of `schema.sql` → run.
3. Go to **Authentication → URL Configuration**: add your Vercel domain (e.g. `https://yourproject.vercel.app`) to both **Site URL** and **Redirect URLs**. (Also add `http://localhost:3000` for local testing.)
4. Go to **Authentication → Providers → Email**: make sure "Enable Email Provider" is on and "Enable Email Signup" is on.
5. Go to **Project Settings → API**: copy your **Project URL** and your **anon public key**.

### 2. Fill in `config.js`

Open `config.js` and paste the values from step 1.5:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  ADMIN_PASSWORD_SHA256: "",  // fill this in next (optional but recommended)
};
```

#### Set the admin password (optional but recommended)

By default, any non-empty password unlocks the admin page. To lock it down:

1. Choose a password.
2. In your browser console (anywhere), run:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_PASSWORD')).then(buf => console.log(Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')))
   ```
3. Copy the resulting hash into `ADMIN_PASSWORD_SHA256` in `config.js`.

### 3. GitHub

```bash
cd family-portal
git init
git add .
git commit -m "Initial family portal"
# create repo on github.com, then:
git remote add origin https://github.com/YOUR-USERNAME/family-portal.git
git branch -M main
git push -u origin main
```

### 4. Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
2. Framework Preset: **Other** (it's plain HTML + serverless functions).
3. Root directory: leave blank.
4. **Environment Variables** — add:
   - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
5. Deploy. Vercel will give you a URL like `family-portal.vercel.app`.
6. Go back to Supabase → **Authentication → URL Configuration** and make sure this URL is in both Site URL and Redirect URLs.

### 5. Test it end-to-end

1. Open your Vercel URL → click **Begin the questionnaire**.
2. Enter your email → check inbox for magic link → click it.
3. Fill out a few steps. Close the tab. Come back. Click **Resume progress** → enter the same email. You're back where you left off.
4. Complete the questionnaire → submit.
5. Open `/admin.html` → enter password → see your submission.
6. Click the submission → click **Generate profile draft** → wait a few seconds → AI draft appears under the "Profile Copy" tab.
7. Edit anything you want. Click **Save changes**. Preview under the "Preview" tab.
8. Click **Export HTML** → copy or download. Paste into your main family website.
9. Optionally click **Publish** to mark it live.

## Notes on security

- The **anon key** is safe to expose in the browser. RLS policies protect the data.
- Business owners can only read/write their own submissions (matched by authenticated email).
- Published profiles are publicly readable.
- The admin password is a **soft gate** — for strong protection, the admin dashboard should eventually move to Supabase Auth with an allowlist of admin emails, or the data queries should go through a Vercel serverless function using the `service_role` key. For a family-internal tool, the soft gate is usually fine.

## Admin data access — an important note

The admin dashboard currently reads submissions using the **anon key**, which is subject to RLS. The policies in `schema.sql` only let users see their own rows. That means the admin page as-shipped will return 0 rows.

You have two options:

### Option A (simplest): let admins read everything via an extra policy

Add this to your Supabase SQL editor, so admin reads work directly:

```sql
-- Allow anyone to read all submissions (fine if admin URL is unlisted)
create policy "admin read all submissions" on public.submissions
  for select using (true);

create policy "admin update all submissions" on public.submissions
  for update using (true);

create policy "admin read all profiles" on public.profiles
  for select using (true);

create policy "admin write all profiles" on public.profiles
  for all using (true);
```

**Caveat:** with these policies, anyone who finds your Supabase URL could read/write. Relies entirely on your admin password being secret.

### Option B (more secure): route admin queries through serverless functions

Add an `/api/admin-list.js` and similar endpoints that use `SUPABASE_SERVICE_ROLE_KEY` (set as a Vercel env var) and verify the admin password server-side. This is more code but keeps data locked down.

Option A is fine for a small family tool. Pick B once the portal is live and the family is actively using it.

## Customizing

- **The questions**: edit the `QUESTIONS` array at the top of `<script>` in `index.html`. Change wording, add steps, remove steps — the progress bar auto-adjusts.
- **Visual style**: all colors and fonts live in `:root { --var: ... }` at the top of the `<style>` block in each page. Change `--accent` (the red) and `--paper` (the cream) to shift the whole feel.
- **Profile layout**: the exported HTML is generated by `buildProfileHTML()` in `admin.html`. Change that template and every future export will use the new layout.

## Running locally

```bash
npx vercel dev
```

This runs the serverless function locally too, so AI generation works.

Or for quick UI-only tweaks:

```bash
python3 -m http.server 3000
```

(but `/api/generate-profile` won't work without `vercel dev`).

## Troubleshooting

- **Magic link email never arrives** → Supabase free tier uses a shared SMTP with aggressive rate limits. Add a custom SMTP (Resend, SendGrid) under Auth → Email Templates → SMTP Settings.
- **Magic link redirects to localhost** → you forgot to add your Vercel URL to Supabase's Auth URL Configuration.
- **Admin page shows 0 submissions** → see "Admin data access" section above.
- **AI generation fails** → check Vercel logs; most likely `ANTHROPIC_API_KEY` isn't set or is invalid.
