# Ultra Training App

A single-file, browser-based training log built for endurance athletes. Log workouts, track weekly goals, plan your race calendar, and analyze volume trends — all from one page.

**Live app:** hosted on Vercel (previously [wrazej-training-app.netlify.app](https://wrazej-training-app.netlify.app/)). On iPhone, open it in Safari and use Share → Add to Home Screen to install it like an app.

---

## Features

### Dashboard
- Weekly summary stats: distance, elevation, time, and activity count
- Volume bar chart with toggleable views — weekly or monthly, distance or time
- Overlay goal bands on the chart to visualize progress against targets
- Strength and stretch/recovery time shown separately from cross-training
- Coming Up: planned workouts, races and events for the next 7 days
- Recent activity feed with a 7-day week strip (dots for activities, plans, races and events; tap a day to open it)

### Training Log
- Log runs, rides, cross-training, strength sessions, and recovery activities
- Fields: date, distance, duration, elevation, heart rate, terrain (trail / road / treadmill), run type (easy, long, workout, race, recovery), and notes
- Filter the log by activity type
- Click any entry to view full details or edit/delete it

### Calendar
- Monthly calendar view showing completed workouts, planned sessions, races, and registration / lottery dates
- Tap any day to see everything on it and add an activity, a planned workout, or an event
- Training events: mark travel, backcountry trips, sick or injured days as a date range
- Planned workouts can be edited (including moving the date) and marked complete

### Goals
- Set weekly targets for distance, time, and elevation — separately for running and cross-training
- Navigate back through past weeks to review goal history
- Progress bars update in real time as you log activities

### Races
- Track upcoming races and past results
- Supports running, cycling (road, gravel, mountain, fat bike), and skimo races
- Tap a race for its page: countdown, goal time and goal pace, registration status, fuel plan (carbs / water / sodium per hour at your goal time), and after the race your result and placement next to your goal
- Registration reminders: add the date (and time) registration opens and whether it's a lottery. The dashboard shows a reminder from two weeks out until you mark yourself registered, and "Add reminder to my calendar" downloads a calendar event with phone alerts the day before and on the day
- Lottery races ask whether you got in once the draw date passes
- Next-race countdown on the dashboard; a "How did it go?" prompt for races with no result yet
- Confetti and a finish-time / placement prompt when you finish a race (including from Strava sync)

### Stats
- Year totals and a month-by-month table (distance, hours, vert, cross-training, recovery) plus cross-training by type

### Nutrition Database
- Build a personal fuel database (gels, bars, drink mixes, etc.)
- Attach nutrition entries to individual workouts to track fueling
- Items have a category (Fuel, Hydration, Electrolyte, …), carbs, water, sodium, calories and caffeine
- Each activity shows carbs / water / sodium per hour, using elapsed time when you've entered it

### Calculator
- Pace calculator: enter distance + time to get pace in min/km and min/mi
- Pace converter: convert between min/km and min/mi
- Quick presets for common race distances (5 km, 10 km, half marathon, marathon, 50 km, 100 km)

---

## Sport Modes

On first launch the app asks you to choose a primary sport:

- **Running** — dashboard shows run stats; cross-training (cycling, ski, etc.) tracked separately
- **Cycling** — dashboard pivots to ride stats with bike-type breakdowns

A **seasonal sport** overlay (e.g. ski mountaineering / skimo) can be enabled with custom season dates. When active, the dashboard shows a dedicated ski stats section.

---

## Data & Sync

| Feature | Details |
|---|---|
| **Storage** | Data is saved to your browser's `localStorage` by default — no account required |
| **Cloud sync** | Sign in with Google (via Firebase) to sync data across devices |
| **Strava import** | Connect Strava to pull in recent activities automatically |
| **Export / Import** | Download your full log as a JSON file; re-import to restore or migrate |

### Google / Firebase sync
Click **Sign in with Google** in the sidebar footer. Once authenticated, all data reads and writes go to Firestore and stay in sync across any browser where you're signed in.

### Strava integration
1. Click **Connect Strava** in the sidebar.
2. Authorize the app on Strava's OAuth page.
3. Click **Sync Activities** to fetch recent workouts.
4. Select which activities to import and confirm.

Already-synced activities remain in your log if you later disconnect Strava.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript (single file, no build step) |
| Auth & database | Firebase 10 (Auth + Firestore) |
| Strava OAuth | Serverless functions in `netlify/functions/`, served on Vercel through the thin wrappers in `api/` |
| Plan import | `api/parse-plan.js` (Vercel only) sends an uploaded PDF to the Claude API and returns the workouts; the PDF is never stored |
| Hosting | Vercel (`vercel.json`); `netlify.toml` still works if you deploy to Netlify |

The entire UI lives in `mwrazej_training_log.html`. There is no framework, no bundler, and no npm install — open the file in a browser and it runs.

---

## Light & Dark Mode

A theme toggle in the sidebar switches between a dark (default) navy palette and a light mode. The preference is persisted in `localStorage`.

---

## Self-Hosting

1. Fork or clone this repo.
2. Deploy to Netlify (or any static host).
3. Create a Firebase project, enable Google Auth and Firestore, and paste your config into the `firebaseConfig` block near the top of the JS section.
4. (Optional) Create a Strava API app, add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` as Netlify environment variables, and set the redirect URI to `https://<your-domain>/`.
5. Update `STRAVA_CLIENT_ID` in the HTML file to match your Strava app.

---

## Deploying on Vercel

1. In Vercel, **Add New → Project**, import this GitHub repo. Leave Framework Preset as **Other** and leave the build command and output directory empty.
2. In **Settings → Environment Variables**, add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.
3. In **Firebase Console → Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `your-app.vercel.app`).
4. In **Google Cloud Console → APIs & Services → Credentials**, open the *Web client* OAuth client and add `https://your-app.vercel.app/__/auth/handler` under **Authorized redirect URIs**. Sign-in runs through this site's own domain (see the `/__/auth` rewrite in `vercel.json`) so it works in the iPhone home-screen app.
5. In **Strava → Settings → My API Application**, set **Authorization Callback Domain** to your Vercel domain. Strava allows only one domain, so Strava connect on any other host stops working after this.
6. (For **Calendar → Import plan**) Create an API key at [platform.claude.com](https://platform.claude.com), add some prepaid credit and a monthly spend limit, then add these environment variables and redeploy:
   - `ANTHROPIC_API_KEY`: the key.
   - `ALLOWED_EMAILS`: the Google sign-in email(s) allowed to import plans, comma-separated. Without it, the import refuses every request, so strangers can't spend your credit.
   - `PLAN_MODEL` (optional): a different Claude model, e.g. `claude-sonnet-5-5` to halve the cost.

Every push to `main` deploys automatically; pull requests get their own preview link. Google sign-in and Strava only work on the production domain, not on preview links.
