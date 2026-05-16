# Ultra Training App

A single-file, browser-based training log built for endurance athletes. Log workouts, track weekly goals, plan your race calendar, and analyze volume trends — all from one page.

**Live app:** [https://wrazej-training-app.netlify.app/](https://wrazej-training-app.netlify.app/)

---

## Features

### Dashboard
- Weekly summary stats: distance, elevation, time, and activity count
- Volume bar chart with toggleable views — weekly or monthly, distance or time
- Overlay goal bands on the chart to visualize progress against targets
- Recent activity feed with a mini 7-day week strip

### Training Log
- Log runs, rides, cross-training, strength sessions, and recovery activities
- Fields: date, distance, duration, elevation, heart rate, terrain (trail / road / treadmill), run type (easy, long, workout, race, recovery), and notes
- Filter the log by activity type
- Click any entry to view full details or edit/delete it

### Calendar
- Monthly calendar view showing completed workouts and planned sessions
- Add planned workouts to future dates; mark them complete when done
- Color-coded dots distinguish run types and cross-training

### Goals
- Set weekly targets for distance, time, and elevation — separately for running and cross-training
- Navigate back through past weeks to review goal history
- Progress bars update in real time as you log activities

### Races
- Track upcoming races and past results
- Supports running, cycling (road, gravel, mountain, fat bike), and skimo races
- Fields: date, distance, elevation, finish time, place, and notes
- Toggle between upcoming and completed race views

### Nutrition Database
- Build a personal fuel database (gels, bars, drink mixes, etc.)
- Attach nutrition entries to individual workouts to track fueling
- Customize item names, calories, and carb content

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
| Strava OAuth | Netlify serverless functions (`strava-exchange-token`, `strava-refresh-token`) |
| Hosting | Netlify |

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
