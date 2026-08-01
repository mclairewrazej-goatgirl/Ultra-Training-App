import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDB } from '../config/firebase';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry, RunEntry, CrossEntry, StrengthEntry } from '../types';
import { isInSkiSeason, isSkiSubtype } from './SkiSeasonScreen';
import { normalizeGoal } from './GoalsScreen';
import ActivityDetailModal from './ActivityDetailModal';

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (db: TrainingDB) => void;
  onEditEntry: (entry: ActivityEntry) => void;
}

function getWeekRange(weeksBack = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) - weeksBack * 7);
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

export default function DashboardScreen({ user, db, onSaved, onEditEntry }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showHeaderPicker, setShowHeaderPicker] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<ActivityEntry | null>(null);
  const { monday, sunday } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);
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

  const weekRuns       = useMemo(() => db.runs.filter(r => inWeek(r.date)),       [db, monday]);
  const weekCross      = useMemo(() => db.crosses.filter(c => inWeek(c.date)),    [db, monday]);
  const weekStrength   = useMemo(() => db.strengths.filter(s => inWeek(s.date)),  [db, monday]);
  const weekRecoveries = useMemo(() => db.recoveries.filter(r => inWeek(r.date)), [db, monday]);

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

  // Recovery (yoga, massage, physio, etc.) — kept separate from Cross-Training
  const recoveryStats = useMemo(() => {
    const totalMins = weekRecoveries.reduce((s, r) => s + (Number(r.dur) || 0), 0);
    return { totalMins, count: weekRecoveries.length };
  }, [weekRecoveries]);

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

  const handleDeleteEntry = () => {
    if (!viewingEntry) return;
    const id = viewingEntry.id;
    Alert.alert('Delete workout', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const newDB: TrainingDB = {
          ...db,
          runs:       db.runs.filter(r => r.id !== id),
          crosses:    db.crosses.filter(r => r.id !== id),
          strengths:  db.strengths.filter(r => r.id !== id),
          recoveries: db.recoveries.filter(r => r.id !== id),
        };
        try {
          await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
          onSaved(newDB);
          setViewingEntry(null);
        } catch (err: any) {
          Alert.alert('Delete failed', err.message);
        }
      }},
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
        <View style={styles.weekNavRow}>
          <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)} style={styles.weekNavBtn}>
            <Text style={styles.weekNavArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.weekLabelBtn} onPress={() => setShowHeaderPicker(true)}>
            <Text style={styles.subGreeting}>{weekRangeLabel}</Text>
            <Text style={styles.weekLabelCaret}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => Math.max(0, w - 1))}
            style={styles.weekNavBtn}
            disabled={weekOffset === 0}
          >
            <Text style={[styles.weekNavArrow, weekOffset === 0 && { opacity: 0.2 }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <WeekPickerModal
        visible={showHeaderPicker}
        weekOffset={weekOffset}
        onSelect={(n) => { setWeekOffset(n); setShowHeaderPicker(false); }}
        onClose={() => setShowHeaderPicker(false)}
      />

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

      {/* ── Recovery ────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>RECOVERY</Text>
      <View style={styles.grid}>
        <StatCard label="Recovery Time"    value={fmtHours(recoveryStats.totalMins)} color={colors.green} />
        <StatCard label="Recovery Sessions" value={`${recoveryStats.count} sessions`} color={colors.green} />
      </View>

      {/* ── Volume History ─────────────────────────────────── */}
      <VolumeChart db={db} isCycling={isCycling} skiActive={skiActive} weekOffset={weekOffset} onChangeWeek={setWeekOffset} />

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
      <Text style={styles.sectionLabel}>{weekOffset === 0 ? 'THIS WEEK' : 'THAT WEEK'}</Text>
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
        recentActivities.map(act => (
          <ActivityRow key={act.id} act={act} onPress={() => setViewingEntry(act)} />
        ))
      )}
    </ScrollView>

    <ActivityDetailModal
      visible={!!viewingEntry}
      entry={viewingEntry}
      nutrition={db.nutrition}
      onEdit={() => {
        if (viewingEntry) onEditEntry(viewingEntry);
        setViewingEntry(null);
      }}
      onDelete={handleDeleteEntry}
      onClose={() => setViewingEntry(null)}
    />
    </>
  );
}

// ─── Volume History Chart ─────────────────────────────────────────────────────

type Metric = 'dist' | 'time' | 'vert';

function getMondayOfWeek(weeksBack: number): Date {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7) - weeksBack * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function getVolumeData(db: TrainingDB, monday: Date, metric: Metric, skiActive: boolean) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const inW = (d: string) => { const dt = new Date(d + 'T12:00:00'); return dt >= monday && dt <= sunday; };
  const runs   = db.runs.filter(r => inW(r.date));
  const crosses = skiActive
    ? db.crosses.filter(c => inW(c.date) && !isSkiSubtype(c.subtype))
    : db.crosses.filter(c => inW(c.date));
  const key = metric === 'time' ? 'dur' : metric;
  const sum = (arr: any[]) => arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  // dur is stored in minutes, but "time" goals are entered/stored in hours — convert to match.
  const divisor = metric === 'time' ? 60 : 1;
  return { run: sum(runs) / divisor, cross: sum(crosses) / divisor };
}

// "Nice" round numbers (à la D3's axis ticks) so the Y axis reads e.g. 0 / 25 / 50 / 75
// instead of whatever the raw weekly total or goal happens to be.
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

// Evenly spaced ticks from 0 up to (at least) maxValue — scales to whichever is
// larger of the week's actual totals or the configured goal range.
function niceTicks(maxValue: number, tickCount = 4): number[] {
  if (maxValue <= 0) return [0, 1];
  const step = niceNum(maxValue / (tickCount - 1), true);
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function buildWeekOptions(count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const mon = getMondayOfWeek(i);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const label = i === 0
      ? 'Current Week'
      : `${mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    return { weeksBack: i, label };
  });
}

// Shared week-select dropdown — used by the header date range and the Volume History chart.
function WeekPickerModal({ visible, weekOffset, onSelect, onClose }: {
  visible: boolean; weekOffset: number; onSelect: (n: number) => void; onClose: () => void;
}) {
  const weekOptions = useMemo(() => buildWeekOptions(12), []);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={vcStyles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={vcStyles.pickerSheet}>
          <Text style={vcStyles.pickerTitle}>Select Week</Text>
          {weekOptions.map(opt => (
            <TouchableOpacity
              key={opt.weeksBack}
              style={[vcStyles.pickerRow, weekOffset === opt.weeksBack && vcStyles.pickerRowActive]}
              onPress={() => onSelect(opt.weeksBack)}
            >
              <Text style={[vcStyles.pickerRowText, weekOffset === opt.weeksBack && vcStyles.pickerRowTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function VolumeChart({ db, isCycling, skiActive, weekOffset, onChangeWeek }: {
  db: TrainingDB; isCycling: boolean; skiActive: boolean;
  weekOffset: number; onChangeWeek: (n: number) => void;
}) {
  const [metric,         setMetric]         = useState<Metric>('dist');
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [showTooltip,    setShowTooltip]    = useState(false);

  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const { run, cross } = useMemo(
    () => getVolumeData(db, monday, metric, skiActive),
    [db, monday, metric, skiActive],
  );
  const total = run + cross;

  // Look up per-week goal first, fall back to default
  const mondayKey = localDateKey(monday);
  const goals      = normalizeGoal((db.weeklyGoals as any)?.[mondayKey] ?? db.goals);
  const runGoal    = goals.run[metric]   as { min: number; max: number };
  const crossGoal  = goals.cross[metric] as { min: number; max: number };

  // Combined goal for the Total bar — sum of whichever of run/cross goals are enabled.
  const totalGoal: { min: number; max: number } | null = (goals.run.enabled || goals.cross.enabled) ? {
    min: (goals.run.enabled ? runGoal.min : 0) + (goals.cross.enabled ? crossGoal.min : 0),
    max: (goals.run.enabled ? runGoal.max : 0) + (goals.cross.enabled ? crossGoal.max : 0),
  } : null;

  const CHART_H = 130;

  const fmtV = (v: number) => {
    if (metric === 'dist') return `${v.toFixed(1)} km`;
    if (metric === 'time') return fmtHours(Math.round(v * 60));
    return `${Math.round(v)} m`;
  };
  const fmtAxisLabel = (v: number) => {
    if (v === 0) return '0';
    if (metric === 'dist') return `${Number.isInteger(v) ? v : v.toFixed(1)} km`;
    if (metric === 'time') {
      const totalMin = Math.round(v * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${Math.round(v)} m`;
  };

  // Regular, evenly-spaced axis ticks that scale to whichever is larger: this
  // week's totals or the configured goal range — rather than sticking at raw values.
  const rawMax    = Math.max(total, runGoal.max || 0, crossGoal.max || 0, totalGoal?.max || 0, 1);
  const axisTicks = niceTicks(rawMax, 4);
  const maxVal    = axisTicks[axisTicks.length - 1];
  const pct       = (v: number) => Math.min(1, v / maxVal);
  const yTicks    = axisTicks.map(v => ({ value: v, label: fmtAxisLabel(v) }));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel = weekOffset === 0
    ? 'Current Week'
    : `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  // Per-bar goal bands: each bar is compared against its own goal, not a single shared one.
  const bandFor = (g: { min: number; max: number } | null) => {
    if (!g || (g.min <= 0 && g.max <= 0)) return null;
    return {
      top:    g.max > 0 ? CHART_H - Math.round(pct(g.max) * CHART_H) : null,
      bottom: g.min > 0 ? CHART_H - Math.round(pct(g.min) * CHART_H) : null,
    };
  };
  const runBand   = bandFor(goals.run.enabled   ? runGoal   : null);
  const crossBand = bandFor(goals.cross.enabled ? crossGoal : null);
  const totalBand = bandFor(totalGoal);

  // Legend entries — only shown for goals that are actually enabled/set for this metric,
  // so the dashed range lines drawn on each bar can be identified without an overlay
  // that blocks the bar itself.
  const legendItems: { label: string; color: string }[] = [];
  if (goals.run.enabled && (runGoal.min > 0 || runGoal.max > 0)) {
    legendItems.push({ label: `${isCycling ? 'Ride' : 'Run'} Goal Range`, color: colors.pink });
  }
  if (goals.cross.enabled && (crossGoal.min > 0 || crossGoal.max > 0)) {
    legendItems.push({ label: 'Cross Goal Range', color: colors.blue });
  }
  if (totalGoal && (totalGoal.min > 0 || totalGoal.max > 0)) {
    legendItems.push({ label: 'Total Goal Range', color: colors.green });
  }

  return (
    <View style={vcStyles.card}>
      {/* Header row */}
      <View style={vcStyles.headerRow}>
        <Text style={styles.sectionLabel}>VOLUME HISTORY</Text>
        <View style={vcStyles.chips}>
          {(['dist','time','vert'] as Metric[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[vcStyles.chip, metric === m && vcStyles.chipActive]}
              onPress={() => setMetric(m)}
            >
              <Text style={[vcStyles.chipText, metric === m && vcStyles.chipTextActive]}>
                {m === 'dist' ? 'Dist' : m === 'time' ? 'Time' : 'Vert'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Week navigation — tap to open dropdown */}
      <TouchableOpacity style={vcStyles.weekNav} onPress={() => setShowWeekPicker(true)}>
        <Text style={vcStyles.weekLabel}>{weekLabel}</Text>
        <Text style={vcStyles.weekDropIcon}>▾</Text>
      </TouchableOpacity>

      {/* Week picker modal */}
      <WeekPickerModal
        visible={showWeekPicker}
        weekOffset={weekOffset}
        onSelect={(n) => { onChangeWeek(n); setShowWeekPicker(false); }}
        onClose={() => setShowWeekPicker(false)}
      />

      {/* Chart: Y-axis + bars */}
      <View style={vcStyles.chartWrapper}>
        {/* Y-axis with goal value ticks */}
        <View style={[vcStyles.yAxis, { height: CHART_H }]}>
          {yTicks.map(tick => (
            <Text
              key={tick.value}
              style={[vcStyles.yLabel, { bottom: Math.max(0, Math.round(pct(tick.value) * CHART_H) - 5) }]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))}
        </View>

        {/* Chart area — tap to toggle tooltip */}
        <View style={vcStyles.chartColumn}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowTooltip(v => !v)}
            style={[vcStyles.chartArea, { height: CHART_H }]}
          >
            {/* Bars — each with its own goal band, compared against its own scale */}
            <View style={vcStyles.barsRow}>
              <ChartBar height={Math.round(pct(run) * CHART_H)}   color={colors.pink}  value={fmtV(run)}   chartH={CHART_H} band={runBand} />
              <ChartBar height={Math.round(pct(cross) * CHART_H)} color={colors.blue}  value={fmtV(cross)} chartH={CHART_H} band={crossBand} />
              <ChartBar height={Math.round(pct(total) * CHART_H)} color={colors.green} value={fmtV(total)} chartH={CHART_H} band={totalBand} />
            </View>

            {/* Stats tooltip (tap to show/hide) */}
            {showTooltip && (
              <View style={vcStyles.tooltip}>
                <Text style={vcStyles.tooltipTitle}>{weekLabel}</Text>
                <Text style={vcStyles.tooltipRow}>
                  <Text style={{ color: colors.pink }}>{isCycling ? 'Ride' : 'Run'}: </Text>
                  <Text style={vcStyles.tooltipVal}>{fmtV(run)}</Text>
                </Text>
                <Text style={vcStyles.tooltipRow}>
                  <Text style={{ color: colors.blue }}>Cross: </Text>
                  <Text style={vcStyles.tooltipVal}>{fmtV(cross)}</Text>
                </Text>
                <Text style={vcStyles.tooltipRow}>
                  <Text style={{ color: colors.green }}>Total: </Text>
                  <Text style={vcStyles.tooltipVal}>{fmtV(total)}</Text>
                </Text>
                {goals.run.enabled && (runGoal.min > 0 || runGoal.max > 0) && (
                  <Text style={vcStyles.tooltipRow}>
                    <Text style={{ color: colors.muted }}>{isCycling ? 'Ride' : 'Run'} Goal: </Text>
                    <Text style={vcStyles.tooltipVal}>{fmtV(runGoal.min)}–{fmtV(runGoal.max)}</Text>
                  </Text>
                )}
                {goals.cross.enabled && (crossGoal.min > 0 || crossGoal.max > 0) && (
                  <Text style={vcStyles.tooltipRow}>
                    <Text style={{ color: colors.muted }}>Cross Goal: </Text>
                    <Text style={vcStyles.tooltipVal}>{fmtV(crossGoal.min)}–{fmtV(crossGoal.max)}</Text>
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Bar labels below chart area so bars align from exact bottom */}
          <View style={vcStyles.barLabelsRow}>
            <Text style={vcStyles.barLabel}>{isCycling ? 'Ride' : 'Run'}</Text>
            <Text style={vcStyles.barLabel}>Cross</Text>
            <Text style={vcStyles.barLabel}>Total</Text>
          </View>

          {/* Goal range legend — explains the dashed lines instead of shading over the bars */}
          {legendItems.length > 0 && (
            <View style={vcStyles.legendRow}>
              {legendItems.map(item => (
                <View key={item.label} style={vcStyles.legendItem}>
                  <View style={[vcStyles.legendSwatch, { borderColor: item.color }]} />
                  <Text style={vcStyles.legendText}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ChartBar({ height, color, value, chartH, band }: {
  height: number; color: string; value: string; chartH: number;
  band: { top: number | null; bottom: number | null } | null;
}) {
  return (
    <View style={[vcStyles.barGroup, { height: chartH }]}>
      {band && band.top    !== null && <View style={[vcStyles.goalLine, { top: band.top, borderColor: color }]} />}
      {band && band.bottom !== null && <View style={[vcStyles.goalLine, { top: band.bottom, borderColor: color }]} />}
      <Text style={[vcStyles.barValue, { color }]}>{height > 2 ? value : '—'}</Text>
      <View style={[vcStyles.bar, { height: Math.max(height, 2), backgroundColor: color }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({ act, onPress }: { act: ActivityEntry; onPress: () => void }) {
  const dotColor = actColors[act.actType] ?? colors.muted;
  const dist = 'dist' in act && Number((act as any).dist) > 0
    ? `${Number((act as any).dist).toFixed(1)} km` : '';
  const dur = 'dur' in act ? fmtHours(Number((act as any).dur)) : '';
  const meta = [dist, dur === '—' ? '' : dur].filter(Boolean).join(' · ');
  const dateStr = new Date(act.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.actRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actDot, { backgroundColor: dotColor }]} />
      <View style={styles.actInfo}>
        <Text style={styles.actLabel}>{actLabel(act)}</Text>
        <Text style={styles.actMeta}>{dateStr}{meta ? '  ·  ' + meta : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 16, paddingBottom: 40 },

  header: {
    marginBottom: 20,
  },
  greeting:    { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subGreeting: { fontSize: 13, color: colors.muted },

  weekNavRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekNavBtn: { padding: 4 },
  weekNavArrow: { fontSize: 20, color: colors.muted, fontWeight: '300', lineHeight: 22 },
  weekLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekLabelCaret: { fontSize: 11, color: colors.muted },
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

const vcStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 16, overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4,
  },
  chips:          { flexDirection: 'row', gap: 4 },
  chip:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.pink, borderColor: colors.pink },
  chipText:       { fontSize: 10, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: '#fff' },

  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  weekLabel:    { fontSize: 12, fontWeight: '600', color: colors.text },
  weekDropIcon: { fontSize: 12, color: colors.muted },

  pickerOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerSheet: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 360, padding: 8,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  pickerRow: {
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10,
  },
  pickerRowActive:    { backgroundColor: colors.pink + '22' },
  pickerRowText:      { fontSize: 14, color: colors.text },
  pickerRowTextActive: { color: colors.pink, fontWeight: '700' },

  chartWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  yAxis: {
    width: 44,
    position: 'relative',
  },
  yLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 8,
    fontWeight: '600',
    color: colors.muted,
    lineHeight: 10,
  },
  chartColumn: { flex: 1 },
  chartArea: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Dashed range markers drawn on each bar (colored per-bar at call site) — no shaded
  // overlay box, so the bar's own fill and value stay fully visible underneath.
  goalLine: {
    position: 'absolute', left: 0, right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  barGroup:     { alignItems: 'center', justifyContent: 'flex-end', position: 'relative', flex: 1 },
  bar:          { width: 32, borderRadius: 4 },
  barValue:     { fontSize: 9, fontWeight: '700', marginBottom: 3 },
  barLabelsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 5,
  },
  barLabel: { fontSize: 9, color: colors.muted, flex: 1, textAlign: 'center' },

  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 4, paddingTop: 10,
  },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  legendText:   { fontSize: 10, color: colors.muted, fontWeight: '600' },

  tooltip: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border2,
    borderRadius: 8, padding: 8,
    zIndex: 10,
  },
  tooltipTitle: { fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 4 },
  tooltipRow:   { fontSize: 10, color: colors.muted, marginBottom: 1 },
  tooltipVal:   { color: colors.text, fontWeight: '700' },
});
