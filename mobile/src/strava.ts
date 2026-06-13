import * as WebBrowser from 'expo-web-browser';
import {
  StravaTokens, TrainingDB, Race, PlannedWorkout,
  ActivityEntry, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry,
} from './types';

const STRAVA_CLIENT_ID = '235428';
const NETLIFY_BASE = 'https://wrazej-training-app.netlify.app';
// Mobile redirect goes through our Netlify function, which bounces to the app scheme.
// This keeps the Strava callback domain as wrazej-training-app.netlify.app (same as web app).
export const STRAVA_MOBILE_REDIRECT = `${NETLIFY_BASE}/.netlify/functions/strava-mobile-callback`;
const APP_SCHEME_PREFIX = 'ultra-training://strava';

const RUN_TYPES   = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDE_TYPES  = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'Velomobile']);
const STR_TYPES   = new Set(['RockClimbing', 'WeightTraining', 'Crossfit', 'Yoga']);
const SKI_TYPES   = new Set(['NordicSki', 'BackcountrySki', 'AlpineSki']);
const HIKE_TYPES  = new Set(['Hike', 'Walk']);

// ── OAuth ─────────────────────────────────────────────────────────────────────

export async function connectStrava(): Promise<string | null> {
  const redirect = encodeURIComponent(STRAVA_MOBILE_REDIRECT);
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirect}&approval_prompt=force&scope=activity:read_all`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, APP_SCHEME_PREFIX);
  if (result.type !== 'success') return null;
  return parseParam(result.url, 'code');
}

export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const resp = await fetch(`${NETLIFY_BASE}/.netlify/functions/strava-exchange-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Token exchange failed');
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
    athleteId:    data.athlete_id,
    athleteName:  data.athlete_name || '',
  };
}

export async function getValidToken(
  tokens: StravaTokens,
): Promise<{ accessToken: string; refreshed?: StravaTokens }> {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt - now > 300) return { accessToken: tokens.accessToken };

  const resp = await fetch(`${NETLIFY_BASE}/.netlify/functions/strava-refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error('Token refresh failed — please reconnect Strava.');
  const refreshed: StravaTokens = {
    ...tokens,
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
  };
  return { accessToken: refreshed.accessToken, refreshed };
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  distance: number;        // meters
  moving_time: number;     // seconds
  total_elevation_gain: number; // meters
  average_heartrate?: number;
}

export type SyncRange = 'count5' | 'days7' | 'days14' | 'days30' | 'days60';

export async function fetchStravaActivities(accessToken: string, range: SyncRange = 'count5'): Promise<StravaActivity[]> {
  let url: string;
  if (range === 'count5') {
    url = 'https://www.strava.com/api/v3/athlete/activities?per_page=5';
  } else {
    const days: Record<string, number> = { days7: 7, days14: 14, days30: 30, days60: 60 };
    const after = Math.floor(Date.now() / 1000) - days[range] * 24 * 3600;
    url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`;
  }
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error('Failed to fetch Strava activities — please try again.');
  return resp.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
export function mToKm(m: number) { return Math.round((m / 1000) * 10) / 10; }
export function secToMin(s: number) { return Math.round(s / 60); }
export function actDate(isoDate: string) { return isoDate.slice(0, 10); }

export function formatRaceResult(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}
function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

function parseParam(url: string, key: string): string | null {
  const qi = url.indexOf('?');
  if (qi < 0) return null;
  for (const part of url.slice(qi + 1).split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (decodeURIComponent(part.slice(0, eq)) === key) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

// ── Activity mapping ──────────────────────────────────────────────────────────

export function mapToEntry(act: StravaActivity, primarySport: string): ActivityEntry {
  const type = act.sport_type || act.type;
  const date = actDate(act.start_date_local);
  const dist = mToKm(act.distance);
  const dur  = secToMin(act.moving_time);
  const vert = Math.round(act.total_elevation_gain);
  const hr   = act.average_heartrate ?? 0;
  const notes    = act.name || '';
  const stravaId = String(act.id);

  if (RUN_TYPES.has(type)) {
    const terrain = type === 'TrailRun' ? 'trail' : type === 'VirtualRun' ? 'treadmill' : 'road';
    return { id: uid(), date, actType: 'run', runType: 'easy', terrain, dist, dur, vert, hr, notes, stravaId } as RunEntry;
  }
  if (HIKE_TYPES.has(type)) {
    if (primarySport === 'cycling') {
      return { id: uid(), date, actType: 'cross', subtype: 'Hiking', dist, dur, vert, rpe: 0, notes, stravaId } as CrossEntry;
    }
    return { id: uid(), date, actType: 'run', runType: 'hike', terrain: 'trail', dist, dur, vert, hr, notes, stravaId } as RunEntry;
  }
  if (RIDE_TYPES.has(type)) {
    if (primarySport === 'cycling') {
      const bikeType = type === 'GravelRide' ? 'Gravel' : type === 'MountainBikeRide' ? 'Mountain' : 'Road';
      return { id: uid(), date, actType: 'run', runType: 'easy', terrain: 'road', bikeType, dist, dur, vert, hr, notes, stravaId } as RunEntry;
    }
    const subtype = type === 'GravelRide' ? 'Gravel Bike' : type === 'MountainBikeRide' ? 'Mountain Bike' : 'Road Bike';
    return { id: uid(), date, actType: 'cross', subtype, dist, dur, vert, rpe: 0, notes, stravaId } as CrossEntry;
  }
  if (STR_TYPES.has(type)) {
    const subtype = type === 'Yoga' ? 'Yoga' : type === 'RockClimbing' ? 'Indoor Climbing' : 'Gym Strength';
    return { id: uid(), date, actType: 'strength', subtype, dur, notes, stravaId } as StrengthEntry;
  }
  if (SKI_TYPES.has(type)) {
    return { id: uid(), date, actType: 'cross', subtype: 'Skate Ski', dist, dur, vert, rpe: 0, notes, stravaId } as CrossEntry;
  }
  return { id: uid(), date, actType: 'cross', subtype: type || 'Cross-Training', dist, dur, vert, rpe: 0, notes, stravaId } as CrossEntry;
}

export function addEntryToDB(db: TrainingDB, entry: ActivityEntry): TrainingDB {
  switch (entry.actType) {
    case 'run':      return { ...db, runs:       [...db.runs,       entry as RunEntry]       };
    case 'cross':    return { ...db, crosses:    [...db.crosses,    entry as CrossEntry]     };
    case 'strength': return { ...db, strengths:  [...db.strengths,  entry as StrengthEntry]  };
    default:         return { ...db, recoveries: [...db.recoveries, entry as RecoveryEntry]  };
  }
}

// ── Matching ──────────────────────────────────────────────────────────────────

export function findRaceMatch(act: StravaActivity, db: TrainingDB): Race | null {
  const type   = act.sport_type || act.type;
  const date   = actDate(act.start_date_local);
  const distKm = mToKm(act.distance);

  return db.races.find(r => {
    if (r.date !== date || r.result) return false;
    const tol = Math.max(1, (Number(r.dist) || 0) * 0.1);
    if (Math.abs(distKm - (Number(r.dist) || 0)) > tol) return false;
    if (r.raceType === 'run'   && (RUN_TYPES.has(type) || HIKE_TYPES.has(type))) return true;
    if (r.raceType === 'bike'  && RIDE_TYPES.has(type)) return true;
    if (r.raceType === 'skimo' && SKI_TYPES.has(type))  return true;
    return false;
  }) ?? null;
}

export function findPlanMatches(act: StravaActivity, db: TrainingDB): PlannedWorkout[] {
  const date = actDate(act.start_date_local);
  return db.plans.filter(p => p.date === date && !p.completed);
}

// ── Sync queue ────────────────────────────────────────────────────────────────

export interface SyncItem  { activity: StravaActivity; entry: ActivityEntry }
export interface RaceMatch extends SyncItem { race: Race }
export interface PlanMatch extends SyncItem { plans: PlannedWorkout[] }

export interface SyncQueue {
  raceQueue:   RaceMatch[];
  planQueue:   PlanMatch[];
  directAdds:  SyncItem[];
  newIds:      string[];
  totalNew:    number;
}

export function buildSyncQueue(activities: StravaActivity[], db: TrainingDB): SyncQueue {
  const processed = new Set(db.stravaProcessedIds ?? []);
  const q: SyncQueue = { raceQueue: [], planQueue: [], directAdds: [], newIds: [], totalNew: 0 };

  for (const act of activities) {
    const id = String(act.id);
    if (processed.has(id)) continue;

    q.newIds.push(id);
    q.totalNew++;
    const entry = mapToEntry(act, db.primarySport);
    const race  = findRaceMatch(act, db);
    const plans = findPlanMatches(act, db);

    if (race)          q.raceQueue.push({ activity: act, entry, race });
    else if (plans.length) q.planQueue.push({ activity: act, entry, plans });
    else               q.directAdds.push({ activity: act, entry });
  }

  return q;
}
