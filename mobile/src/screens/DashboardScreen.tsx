import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { User } from 'firebase/auth';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry, RunEntry, CrossEntry, StrengthEntry } from '../types';
import { isInSkiSeason, isSkiSubtype } from './SkiSeasonScreen';

interface Props {
  user: User;
  db: TrainingDB;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function fmtDist(n: number) {
  return n > 0 ? `${n.toFixed(1)} km` : '—';
}
function fmtHours(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtVert(m: number) {
  return m > 0 ? `${Math.round(m)} m` : '—';
}

function actLabel(act: ActivityEntry) {
  if (act.actType === 'run') {
    const r = act as RunEntry;
    if (!r.runType) return 'Run';
    const cap = r.runType.charAt(0).toUpperCase() + r.runType.slice(1);
    return (cap.endsWith('Run') || cap === 'Hike') ? cap : cap + ' Run';
  }
  if (act.actType === 'cross') return (act as CrossEntry).subtype || 'Cross-Training';
  if (act.actType === 'strength') return (act as StrengthEntry).subtype || 'Strength';
  if (act.actType === 'recovery') return 'Recovery';
  return 'Workout';
}

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function DashboardScreen({ user, db }: Props) {
  const { monday, sunday } = useMemo(getWeekRange, []);
  const isCycling = db.primarySport === 'cycling';
  const todayISO = new Date().toISOString().slice(0, 10);

  const allActivities: ActivityEntry[] = useMemo(() => (
    [...db.runs, ...db.crosses, ...db.strengths, ...db.recoveries]
      .sort((a, b) => b.date.localeCompare(a.date))
  ), [db]);

  const inWeek = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d >= monday && d <= sunday;
  };

  const weekRuns      = useMemo(() => db.runs.filter(r => inWeek(r.date)),      [db, monday]);
  const weekCross     = useMemo(() => db.crosses.filter(c => inWeek(c.date)),   [db, monday]);
  const weekStrength  = useMemo(() => db.strengths.filter(s => inWeek(s.date)), [db, monday]);

  // Running / cycling weekly stats
  const runStats = useMemo(() => {
    const dist     = weekRuns.reduce((s, r) => s + (Number(r.dist) || 0), 0);
    const vert     = weekRuns.reduce((s, r) => s + (Number(r.vert) || 0), 0);
    const mins     = weekRuns.reduce((s, r) => s + (Number(r.dur)  || 0), 0);
    const longest  = weekRuns.reduce((max, r) => Math.max(max, Number(r.dist) || 0), 0);
    return { dist, vert, mins, longest };
  }, [weekRuns]);

  const skiActive = isInSkiSeason(db.seasonalSport);

  // Cross-training weekly stats (exclude ski if ski season active, matching web app)
  const crossStats = useMemo(() => {
    const nonSkiCross = skiActive ? weekCross.filter(c => !isSkiSubtype(c.subtype)) : weekCross;
    const dist     = nonSkiCross.reduce((s, c) => s + (Number(c.dist) || 0), 0);
    const vert     = nonSkiCross.reduce((s, c) => s + (Number(c.vert) || 0), 0);
    const crossMin = nonSkiCross.reduce((s, c) => s + (Number(c.dur)  || 0), 0);
    const strMin   = weekStrength.reduce((s, x) => s + (Number(x.dur) || 0), 0);
    return { dist, vert, totalMins: crossMin + strMin, strengthCount: weekStrength.length };
  }, [weekCross, weekStrength, skiActive]);

  // Ski stats (only calculated when ski season is active)
  const skiStats = useMemo(() => {
    if (!skiActive) return null;
    const ss  = db.seasonalSport;
    const weekSki = weekCross.filter(c => isSkiSubtype(c.subtype));
    const [sm, sd] = ss.startMD.split('-').map(Number);
    const [em, ed] = ss.endMD.split('-').map(Number);
    const startN = sm * 100 + sd;
    const endN   = em * 100 + ed;
    const inRange = (d: string) => {
      const dt  = new Date(d + 'T12:00:00');
      const cur = (dt.getMonth() + 1) * 100 + dt.getDate();
      return startN <= endN ? cur >= startN && cur <= endN : cur >= startN || cur <= endN;
    };
    const seasonSki = db.crosses.filter(c => isSkiSubtype(c.subtype) && inRange(c.date));
    return {
      days:       weekSki.length,
      weekVert:   weekSki.reduce((s, c) => s + (Number(c.vert) || 0), 0),
      weekMins:   weekSki.reduce((s, c) => s + (Number(c.dur)  || 0), 0),
      seasonVert: seasonSki.reduce((s, c) => s + (Number(c.vert) || 0), 0),
    };
  }, [skiActive, weekCross, db.crosses, db.seasonalSport]);

  // Activity dot map for mini calendar (by weekday index 0=Mon)
  const weekDotMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    const addDot = (dateStr: string, color: string) => {
      const d = new Date(dateStr + 'T12:00:00');
      if (d < monday || d > sunday) return;
      const idx = (d.getDay() + 6) % 7; // 0=Mon
      if (!map[idx]) map[idx] = [];
      if (!map[idx].includes(color)) map[idx].push(color);
    };
    db.runs.forEach(r       => addDot(r.date, colors.pink));
    db.crosses.forEach(c    => addDot(c.date, colors.blue));
    db.strengths.forEach(s  => addDot(s.date, colors.amber));
    db.recoveries.forEach(r => addDot(r.date, colors.green));
    return map;
  }, [db, monday, sunday]);

  // Week day labels + ISO dates
  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { iso: d.toISOString().slice(0, 10), num: d.getDate() };
    })
  ), [monday]);

  const weekRangeLabel = (() => {
    const start = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const end   = sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${start} – ${end}`;
  })();

  const firstName = user.displayName?.split(' ')[0] ?? 'Athlete';
  const recentActivities = allActivities.slice(0, 6);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
          <Text style={styles.subGreeting}>{weekRangeLabel}</Text>
        </View>
      </View>

      {/* ── Running / Cycling ──────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isCycling ? 'CYCLING' : 'RUNNING'}</Text>
      <View style={styles.grid}>
        <StatCard label="Weekly Distance" value={fmtDist(runStats.dist)}    color={colors.pink}  />
        <StatCard label="Weekly Vert"     value={fmtVert(runStats.vert)}    color={colors.blue}  />
        <StatCard label="Time on Feet"    value={fmtHours(runStats.mins)}   color={colors.purple} />
        <StatCard label={isCycling ? 'Longest Ride' : 'Longest Run'} value={fmtDist(runStats.longest)} color={colors.amber} />
      </View>

      {/* ── Cross-Training ─────────────────────────────────── */}
      <Text style={styles.sectionLabel}>CROSS-TRAINING</Text>
      <View style={styles.grid}>
        <StatCard label="Total Hours"     value={fmtHours(crossStats.totalMins)}       color={colors.pink}  />
        <StatCard label="Total Distance"  value={fmtDist(crossStats.dist)}             color={colors.blue}  />
        <StatCard label="Total Vert"      value={fmtVert(crossStats.vert)}             color={colors.green} />
        <StatCard label="Strength"        value={`${crossStats.strengthCount} sessions`} color={colors.amber} />
      </View>

      {/* ── Ski Season ─────────────────────────────────────── */}
      {skiActive && skiStats && (
        <>
          <Text style={styles.sectionLabel}>SKI SEASON</Text>
          <View style={styles.grid}>
            <StatCard label="Days on Snow"  value={String(skiStats.days)}                       color={colors.blue}   />
            <StatCard label="Weekly Vert"   value={fmtVert(skiStats.weekVert)}                  color={colors.purple} />
            <StatCard label="Hours on Snow" value={fmtHours(skiStats.weekMins)}                 color={colors.pink}   />
            <StatCard label="Season Vert"   value={`${skiStats.seasonVert.toLocaleString()} m`} color={colors.green}  />
          </View>
        </>
      )}

      {/* ── This Week mini-calendar ────────────────────────── */}
      <Text style={styles.sectionLabel}>THIS WEEK</Text>
      <View style={styles.miniCal}>
        {weekDays.map((day, i) => {
          const isToday = day.iso === todayISO;
          const dots    = weekDotMap[i] ?? [];
          return (
            <View key={day.iso} style={[styles.miniDay, isToday && styles.miniDayToday]}>
              <Text style={[styles.miniDayName, isToday && styles.miniDayNameToday]}>
                {WEEK_DAYS[i]}
              </Text>
              <Text style={[styles.miniDayNum, isToday && styles.miniDayNumToday]}>
                {day.num}
              </Text>
              <View style={styles.miniDots}>
                {dots.slice(0, 2).map((c, di) => (
                  <View key={di} style={[styles.miniDot, { backgroundColor: c }]} />
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Recent Activities ──────────────────────────────── */}
      <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

      {recentActivities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No activities yet.</Text>
          <Text style={styles.emptySubText}>Tap "+ Log" to record your first workout.</Text>
        </View>
      ) : (
        recentActivities.map(act => <ActivityRow key={act.id} act={act} />)
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({ act }: { act: ActivityEntry }) {
  const dotColor = actColors[act.actType] ?? colors.muted;
  const dist = 'dist' in act && Number((act as any).dist) > 0
    ? `${Number((act as any).dist).toFixed(1)} km` : '';
  const dur = 'dur' in act ? fmtHours(Number((act as any).dur)) : '';
  const meta = [dist, dur === '—' ? '' : dur].filter(Boolean).join(' · ');
  const dateStr = new Date(act.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <View style={styles.actRow}>
      <View style={[styles.actDot, { backgroundColor: dotColor }]} />
      <View style={styles.actInfo}>
        <Text style={styles.actLabel}>{actLabel(act)}</Text>
        <Text style={styles.actMeta}>{dateStr}{meta ? '  ·  ' + meta : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting:    { fontSize: 22, fontWeight: '800', color: colors.text },
  subGreeting: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, borderTopWidth: 3, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  miniCal: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginBottom: 16, overflow: 'hidden',
  },
  miniDay: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRightWidth: 0.5, borderRightColor: colors.border,
  },
  miniDayToday:     { backgroundColor: colors.pink + '18' },
  miniDayName:      { fontSize: 10, color: colors.muted, fontWeight: '600', marginBottom: 4 },
  miniDayNameToday: { color: colors.pink },
  miniDayNum:       { fontSize: 13, fontWeight: '600', color: colors.text },
  miniDayNumToday:  { color: colors.pink, fontWeight: '800' },
  miniDots:         { flexDirection: 'row', gap: 2, marginTop: 4, height: 8, alignItems: 'center' },
  miniDot:          { width: 4, height: 4, borderRadius: 2 },

  emptyCard: {
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  emptyText:    { fontSize: 15, color: colors.text, fontWeight: '600', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.muted },

  actRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  actDot:  { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  actInfo: { flex: 1 },
  actLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  actMeta:  { fontSize: 12, color: colors.muted, marginTop: 2 },
});
