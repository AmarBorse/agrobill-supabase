# 🌾 AgroBill Pro — Complete Setup Guide
### React + Supabase · Free Tier · Deploy on Vercel

---

## What You'll Have After This Guide

✅ Real login/register (email + password via Supabase Auth)  
✅ Each shop's data fully isolated in a PostgreSQL database  
✅ Products, bills, and shop details persisted forever  
✅ Hosted live on Vercel (free, custom domain support)  
✅ Supports unlimited users/shops  

**Total cost: ₹0 (free tier covers ~50,000 rows and 50,000 auth users)**

---

## Step 1 — Create a Supabase Project

1. Go to **https://supabase.com** → Sign up (free)
2. Click **"New Project"**
3. Fill in:
   - **Project Name:** `agrobill-pro`
   - **Database Password:** Choose a strong password (save it!)
   - **Region:** `Southeast Asia (Singapore)` ← closest to India
4. Click **Create new project** — wait ~2 minutes

---

## Step 2 — Run the Database Schema

1. In Supabase dashboard → click **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `schema.sql` from this project
4. Copy **all** the contents and paste into the SQL editor
5. Click **Run** (green button)

You should see: `Success. No rows returned`

This creates all 5 tables and sets up security rules automatically.

---

## Step 3 — Get Your API Keys

1. In Supabase dashboard → **Settings** (gear icon, left sidebar)
2. Click **API**
3. Copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long JWT string

4. Open `src/supabase.js` in this project and replace:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';   // ← paste URL
const SUPABASE_ANON = 'YOUR_ANON_KEY';                          // ← paste key
```

---

## Step 4 — Run Locally (Test First)

Make sure you have **Node.js 18+** installed.

```bash
# Install Node.js from https://nodejs.org if you don't have it

# In your terminal, navigate to this project folder
cd agrobill-supabase

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

Try registering a new account → it should work end-to-end!

---

## Step 5 — Deploy to Vercel (Free Hosting)

### Option A — GitHub (Recommended)

1. Create a free account at **https://github.com**
2. Create a new repository called `agrobill-pro`
3. Upload all files from this folder to that repo
4. Go to **https://vercel.com** → Sign up with GitHub
5. Click **"Add New Project"** → Import your `agrobill-pro` repo
6. Vercel auto-detects Vite → click **Deploy**
7. After deploy, go to **Settings → Environment Variables** and add:
   ```
   VITE_SUPABASE_URL     = https://your-project.supabase.co
   VITE_SUPABASE_ANON    = your-anon-key
   ```
   Then update `src/supabase.js` to use env vars:
   ```js
   const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
   const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
   ```

### Option B — Vercel CLI (Faster)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Your app will be live at `https://agrobill-pro.vercel.app` (or similar)

---

## Step 6 — Enable Email Confirmation (Optional)

By default, Supabase sends a confirmation email on registration.

**To disable it (easier for testing):**
1. Supabase Dashboard → **Authentication** → **Settings**
2. Turn OFF **"Enable email confirmations"**
3. Save

---

## Folder Structure

```
agrobill-supabase/
├── index.html              ← App entry point
├── package.json            ← Dependencies (React + Supabase)
├── vite.config.js          ← Build config
├── schema.sql              ← Run this in Supabase SQL Editor
├── SETUP_GUIDE.md          ← This file
└── src/
    ├── main.jsx            ← React root
    ├── App.jsx             ← App wrapper
    ├── supabase.js         ← ⚠️ Put your API keys here
    └── AgroBillPro.jsx     ← Full app component
```

---

## Database Tables Reference

| Table        | What it stores                          |
|-------------|------------------------------------------|
| `profiles`   | User name + phone (linked to auth)      |
| `shops`      | Shop name, address, GSTIN, phone        |
| `products`   | Product catalog per user                |
| `bills`      | Each generated tax invoice              |
| `bill_items` | Line items for each bill                |

All tables have **Row Level Security (RLS)** — users can only see their own data.

---

## Supabase Free Tier Limits

| Resource         | Free Limit       | Notes                          |
|-----------------|------------------|-------------------------------|
| Database rows    | 500 MB           | ~millions of rows              |
| Auth users       | 50,000           | More than enough               |
| API calls        | Unlimited         | No rate limits on free tier    |
| Storage          | 1 GB             | For future file uploads        |
| Bandwidth        | 5 GB/month       | Plenty for a billing app       |

---

## Common Issues

**"Invalid API key" error**
→ Double-check you pasted the `anon` key (not `service_role` key) in `supabase.js`

**"relation does not exist" error**
→ The schema.sql didn't run fully — go to SQL Editor and run it again

**Registration works but login fails**
→ Disable email confirmation in Supabase Auth settings (Step 6 above)

**Data not showing after refresh**
→ Check browser console for errors. Usually a wrong Supabase URL.

---

## Need Help?

- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs
- Vite docs: https://vitejs.dev/guide

---

*Built with React 18 + Supabase + Vite · Deployed on Vercel*
