# Dashboard V22 — Department Management

A responsive React + Vite department dashboard with Supabase authentication, shared online data, and realtime updates.

## Included modules
- Department login and department account creation (initial password is the department name)
- Change password
- Employee add, edit, delete
- Daily present/absent attendance
- IN / OUT time, total working hours, and overtime after 8.5 hours
- Daily production: Orders, IDC, Rejection, Total, and good-output percentage
- Realtime data refresh across signed-in devices
- Department-level row security in Supabase

## 1. Create Supabase database
1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**.
3. Copy and run the full script from `supabase/schema.sql`.
4. In **Authentication → Providers → Email**, disable email confirmations for this first version. The app uses a generated internal email from the department name, so no email inbox is used.
5. Copy the **Project URL** and **anon / publishable key** from **Project Settings → API**.

## 2. Configure GitHub Pages
In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:
- `VITE_SUPABASE_URL` = your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon / publishable key

The GitHub Actions deployment workflow reads these secrets during the Vite build. Never add the Supabase service-role key to the website or GitHub Pages.

## 3. First department login
1. Open the deployed website.
2. Select **Create department**.
3. Enter a department name such as `Production`, `Quality`, or `Packing`.
4. Its initial password is the exact department name. Sign in and immediately change it under **Settings**.
5. Each department gets isolated employee, attendance, and production records. Devices signed into the same department share its data.

Department names are converted to a lowercase account ID for login; use distinct names (for example, `Quality` and `Packing`).

## Local development
```bash
npm install
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm run dev
```

## Build
```bash
npm run build
```
