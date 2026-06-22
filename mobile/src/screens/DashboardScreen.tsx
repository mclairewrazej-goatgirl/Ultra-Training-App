import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
} from 'react-native';
import { User } from 'firebase/auth';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry, WeeklyGoal, defaultWeeklyGoal } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
  onNavigateToAdd: () => void;
}

type Metric = 'dist' | 'time' | 'vert';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getGoalForWeek(db: TrainingDB, key: string): WeeklyGoal {
  const raw = db.weeklyGoals?.[key] ?? db.goals;
  if (!raw || typeof raw !== 'object') return defaultWeeklyGoal;
  const r = raw as any;
  return {
    run: {
      enabled: r.run?.enabled ?? true,
      metrics: {
        time: r.run?.metrics?.time ?? true,
        dist: r.run?.metrics?.dist ?? false,
        vert: r.run?.metrics?.vert ?? false,
      },
      time: { min: Number(r.run?.time?.min) || 0, max: Number(r.run?.time?.max) || 0 },
      dist: { min: Number(r.run?.dist?.min) || 0, max: Number(r.run?.dist?.max) || 0 },
      vert: { min: Number(r.run?.vert?.min) || 0, max: Number(r.run?.vert?.max) || 0 },
    },
    cross: {
      enabled: r.cross?.enabled ?? false,
      metrics: {
        time: r.cross?.metrics?.time ?? true,
        dist: r.cross?.metrics?.dist ?? false,
        vert: r.cross?.metrics?.vert ?? false,
      },
      time: { min: Number(r.cross?.time?.min) || 0, max: Number(r.cross?.time?.max) || 0 },
      dist: { min: Number(r.cross?.dist?.min) || 0, max: Number(r.cross?.dist?.max) || 0 },
      vert: { min: Number(r.cross?.vert?.min) || 0, max: Number(r.cross?.vert?.max) || 0 },
    },
  };
}

function effectiveDur(act: any): number {
  if (act.useMovingTime && Number(act.movingTime) > 0) return Number(act.movingTime);
  if (!act.useMovingTime && Number(act.elapsedTime) > 0) return Number(act.elapsedTime);
  return Number(act.dur) || 0;
}

function fmtDist(d: number | string) {
  const n = Number(d);
  return n > 0 ? `${n.toFixed(1)} mi` : '';
}

function fmtDur(d: number | string) {
  const mins = Number(d);
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtMetricVal(v: number, metric: Metric): string {
  if (metric === 'dist') return `${v.toFixed(1)} mi`;
  if (metric === 'time') return v >= 1 ? `${v.toFixed(1)}h` : `${Math.round(v * 60)}m`;
  return `${Math.round(v)} ft`;
}

function fmtAxisTick(v: number, metric: Metric): string {
  if (metric === 'dist') return v.toFixed(0);
  if (metric === 'time') return v.toFixed(1);
  return String(Math.round(v));
}

function actLabel(act: ActivityEntry) {
  if (act.actType === 'run') {
    const r = act as import('../types').RunEntry;
    return r.runType ? r.runType.charAt(0).toUpperCase() + r.runType.slice(1) + ' Run' : 'Run';
  }
  if (act.actType === 'cross') {
    const c = act as import('../types').CrossEntry;
    return c.subtype || 'Cross-Training';
  }
  if (act.actType === 'strength') return 'Strength';
  if (act.actType === 'recovery') return 'Recovery';
  return 'Workout';
}

function weekRangeLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

const CHART_H = 140;
const WEEK_HISTORY = 12;
const Y_AXIS_W = 38;

export default function DashboardScreen({ user, db, onNavigateToAdd }: Props) {
  const [metric, setMetric] = useState<Metric>('dist');
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);

  const currentMonday = useMemo(() => getMondayOfWeek(new Date()), []);

  const viewedMonday = useMemo(() => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [currentMonday, weekOffset]);

  const viewedSunday = useMemo(() => {
    const s = new Date(viewedMonday);
    s.setDate(viewedMonday.getDate() + 6);
    s.setHours(23, 59, 59, 999);
    return s;
  }, [viewedMonday]);

  const viewedWeekKey = useMemo(() => localDateKey(viewedMonday), [viewedMonday]);

  const weekOptions = useMemo(() =>
    Array.from({ length: WEEK_HISTORY }, (_, i) => {
      const mon = new Date(currentMonday);
      mon.setDate(mon.getDate() - i * 7);
      return { offset: -i, label: weekRangeLabel(mon), isCurrent: i === 0 };
    }),
    [currentMonday],
  );

  const allActivities: ActivityEntry[] = useMemo(() => [
    ...db.runs, ...db.crosses, ...db.strengths, ...db.recoveries,
  ].sort((a, b) => b.date.localeCompare(a.date)), [db]);

  // Stat cards always show the current (this) week
  const thisWeekSunday = useMemo(() => {
    const s = new Date(currentMonday);
    s.setDate(currentMonday.getDate() + 6);
    s.setHours(23, 59, 59, 999);
    return s;
  }, [currentMonday]);

  const thisWeekActivities = useMemo(() =>
    allActivities.filter((a) => {
      const d = new Date(a.date + 'T12:00:00');
      return d >= currentMonday && d <= thisWeekSunday;
    }),
    [allActivities, currentMonday, thisWeekSunday],
  );

  const weeklyStats = useMemo(() => {
    let dist = 0, mins = 0, count = 0;
    thisWeekActivities.forEach((a) => {
      count++;
      if ('dist' in a) dist += Number((a as any).dist) || 0;
      mins += effectiveDur(a);
    });
    return { dist, mins, count };
  }, [thisWeekActivities]);

  // Chart uses the viewed week
  const viewedActivities = useMemo(() =>
    allActivities.filter((a) => {
      const d = new Date(a.date + 'T12:00:00');
      return d >= viewedMonday && d <= viewedSunday;
    }),
    [allActivities, viewedMonday, viewedSunday],
  );

  const goal = useMemo(() => getGoalForWeek(db, viewedWeekKey), [db, viewedWeekKey]);

  const chartData = useMemo(() => {
    let runDist = 0, runMins = 0, runVert = 0;
    let crossDist = 0, crossMins = 0, crossVert = 0;

    viewedActivities.forEach((a) => {
      if (a.actType === 'run') {
        runDist  += Number((a as any).dist) || 0;
        runMins  += effectiveDur(a);
        runVert  += Number((a as any).vert) || 0;
      } else if (a.actType === 'cross') {
        crossDist += Number((a as any).dist) || 0;
        crossMins += effectiveDur(a);
        crossVert += Number((a as any).vert) || 0;
      }
    });

    let runVal: number, crossVal: number;
    if (metric === 'dist')      { runVal = runDist;       crossVal = crossDist; }
    else if (metric === 'time') { runVal = runMins / 60;  crossVal = crossMins / 60; }
    else                        { runVal = runVert;        crossVal = crossVert; }
    const totalVal = runVal + crossVal;

    let runGoalMin = 0, runGoalMax = 0, crossGoalMin = 0, crossGoalMax = 0;
    if (goal.run.enabled) {
      if (metric === 'dist' && goal.run.metrics.dist) {
        runGoalMin = goal.run.dist.min; runGoalMax = goal.run.dist.max;
      } else if (metric === 'time' && goal.run.metrics.time) {
        runGoalMin = goal.run.time.min / 60; runGoalMax = goal.run.time.max / 60;
      } else if (metric === 'vert' && goal.run.metrics.vert) {
        runGoalMin = goal.run.vert.min; runGoalMax = goal.run.vert.max;
      }
    }
    if (goal.cross.enabled) {
      if (metric === 'dist' && goal.cross.metrics.dist) {
        crossGoalMin = goal.cross.dist.min; crossGoalMax = goal.cross.dist.max;
      } else if (metric === 'time' && goal.cross.metrics.time) {
        crossGoalMin = goal.cross.time.min / 60; crossGoalMax = goal.cross.time.max / 60;
      } else if (metric === 'vert' && goal.cross.metrics.vert) {
        crossGoalMin = goal.cross.vert.min; crossGoalMax = goal.cross.vert.max;
      }
    }

    const step = metric === 'dist' ? 5 : metric === 'time' ? 0.5 : 100;
    const minAxis = metric === 'dist' ? 10 : metric === 'time' ? 1 : 100;
    const maxVal = Math.max(runVal, crossVal, totalVal, runGoalMax, crossGoalMax, step * 0.1);
    const axisMax = Math.max(minAxis, Math.ceil((maxVal * 1.15) / step) * step);

    return { runVal, crossVal, totalVal, runGoalMin, runGoalMax, crossGoalMin, crossGoalMax, axisMax };
  }, [viewedActivities, goal, metric]);

  const { runVal, crossVal, totalVal, runGoalMin, runGoalMax, crossGoalMin, crossGoalMax, axisMax } = chartData;

  function barH(val: number): number {
    return Math.max((val / axisMax) * CHART_H, val > 0 ? 3 : 0);
  }

  // Y-axis ticks: evenly-spaced base ticks + goal range boundary values
  const yTicks = useMemo(() => {
    const base = [0, axisMax * 0.25, axisMax * 0.5, axisMax * 0.75, axisMax];
    const goalVals = [runGoalMin, runGoalMax, crossGoalMin, crossGoalMax].filter(v => v > 0 && v <= axisMax);
    const threshold = axisMax * 0.03;
    return [...base, ...goalVals]
      .filter((v, i, arr) => arr.findIndex(w => Math.abs(w - v) < threshold) === i)
      .sort((a, b) => a - b);
  }, [axisMax, runGoalMin, runGoalMax, crossGoalMin, crossGoalMax]);

  function isGoalTick(v: number): boolean {
    const thr = axisMax * 0.02;
    return (runGoalMin > 0 && Math.abs(v - runGoalMin) < thr) ||
           (runGoalMax > 0 && Math.abs(v - runGoalMax) < thr) ||
           (crossGoalMin > 0 && Math.abs(v - crossGoalMin) < thr) ||
           (crossGoalMax > 0 && Math.abs(v - crossGoalMax) < thr);
  }

  const metricUnit = metric === 'dist' ? 'mi' : metric === 'time' ? 'h' : 'ft';
  const recentActivities = allActivities.slice(0, 7);
  const firstName = user.displayName?.split(' ')[0] ?? 'Athlete';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName}</Text>
          <Text style={styles.subGreeting}>Here's your week so far</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onNavigateToAdd}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {/* This-week stat cards */}
      <View style={styles.statsRow}>
        <StatCard label="Workouts" value={String(weeklyStats.count)} color={colors.pink} />
        <StatCard label="Distance" value={fmtDist(weeklyStats.dist) || '—'} color={colors.blue} />
        <StatCard label="Time" value={fmtDur(weeklyStats.mins) || '—'} color={colors.green} />
      </View>

      {/* Volume History card */}
      <View style={styles.chartCard}>

        {/* Header row: title + metric toggle */}
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>Volume History</Text>
          <View style={styles.metricRow}>
            {(['dist', 'time', 'vert'] as Metric[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.metricBtn, metric === m && styles.metricBtnActive]}
                onPress={() => setMetric(m)}
              >
                <Text style={[styles.metricBtnText, metric === m && styles.metricBtnTextActive]}>
                  {m === 'dist' ? 'Dist' : m === 'time' ? 'Time' : 'Vert'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Week dropdown trigger */}
        <TouchableOpacity style={styles.weekTrigger} onPress={() => setWeekDropdownOpen(true)}>
          <Text style={styles.weekTriggerText}>{weekRangeLabel(viewedMonday)}</Text>
          <Text style={styles.weekTriggerArrow}>{'▾'}</Text>
        </TouchableOpacity>

        {/* Chart */}
        <View style={styles.chartArea}>

          {/* Y-axis: absolutely-positioned labels aligned to chart scale */}
          <View style={{ width: Y_AXIS_W, height: CHART_H }}>
            {yTicks.map((v, i) => {
              const bottom = Math.max(0, (v / axisMax) * CHART_H - 5);
              const goal = isGoalTick(v);
              return (
                <Text
                  key={i}
                  style={[styles.yLabel, { bottom }, goal && styles.yLabelGoal]}
                >
                  {fmtAxisTick(v, metric)}
                </Text>
              );
            })}
          </View>

          {/* Chart body */}
          <View style={[styles.chartBody, { height: CHART_H }]}>

            {/* Goal bands */}
            {runGoalMax > 0 && (
              <View style={[styles.goalBand, {
                bottom: (runGoalMin / axisMax) * CHART_H,
                height: Math.max(2, ((runGoalMax - runGoalMin) / axisMax) * CHART_H),
                backgroundColor: 'rgba(233,30,140,0.13)',
                borderTopColor: colors.pink,
                borderBottomColor: colors.pink,
              }]} />
            )}
            {crossGoalMax > 0 && (
              <View style={[styles.goalBand, {
                bottom: (crossGoalMin / axisMax) * CHART_H,
                height: Math.max(2, ((crossGoalMax - crossGoalMin) / axisMax) * CHART_H),
                backgroundColor: 'rgba(0,180,216,0.13)',
                borderTopColor: colors.blue,
                borderBottomColor: colors.blue,
              }]} />
            )}

            {/* Grid lines (one per y-tick) */}
            {yTicks.map((v, i) => (
              <View key={i} style={[styles.gridLine, { bottom: (v / axisMax) * CHART_H }]} />
            ))}

            {/* Bars — absolutely positioned, full height, bars grow from bottom */}
            <View style={styles.barsGroup}>
              <BarCol value={runVal} height={barH(runVal)} color={colors.pink} metric={metric} />
              <BarCol value={crossVal} height={barH(crossVal)} color={colors.blue} metric={metric} />
              <BarCol value={totalVal} height={barH(totalVal)} color={colors.green} metric={metric} />
            </View>
          </View>
        </View>

        {/* X-axis labels aligned under the bars (offset by y-axis width) */}
        <View style={[styles.xAxisRow, { paddingLeft: Y_AXIS_W }]}>
          <Text style={styles.xAxisLabel}>Run</Text>
          <Text style={styles.xAxisLabel}>Cross</Text>
          <Text style={styles.xAxisLabel}>Total</Text>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendDot color={colors.pink} label="Run" />
          <LegendDot color={colors.blue} label="Cross" />
          <LegendDot color={colors.green} label="Total" />
          {runGoalMax > 0 && (
            <LegendDash color={colors.pink}
              label={`Run goal: ${runGoalMin > 0 ? `${fmtAxisTick(runGoalMin, metric)}–` : ''}${fmtAxisTick(runGoalMax, metric)} ${metricUnit}`}
            />
          )}
          {crossGoalMax > 0 && (
            <LegendDash color={colors.blue}
              label={`Cross goal: ${crossGoalMin > 0 ? `${fmtAxisTick(crossGoalMin, metric)}–` : ''}${fmtAxisTick(crossGoalMax, metric)} ${metricUnit}`}
            />
          )}
        </View>
      </View>

      {/* Recent Activities */}
      <Text style={styles.sectionTitle}>Recent Activities</Text>
      {recentActivities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No activities yet.</Text>
          <Text style={styles.emptySubText}>Tap "+ Log" to record your first workout.</Text>
        </View>
      ) : (
        recentActivities.map((act) => <ActivityRow key={act.id} act={act} />)
      )}

      {/* Week picker modal */}
      <Modal visible={weekDropdownOpen} transparent animationType="fade"
        onRequestClose={() => setWeekDropdownOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}
          onPress={() => setWeekDropdownOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Week</Text>
            <ScrollView bounces={false}>
              {weekOptions.map(opt => {
                const selected = opt.offset === weekOffset;
                return (
                  <TouchableOpacity
                    key={opt.offset}
                    style={[styles.weekOpt, selected && styles.weekOptSelected]}
                    onPress={() => { setWeekOffset(opt.offset); setWeekDropdownOpen(false); }}
                  >
                    <Text style={[styles.weekOptText, selected && styles.weekOptTextSelected]}>
                      {opt.label}{opt.isCurrent ? '  — This Week' : ''}
                    </Text>
                    {selected && <Text style={{ color: colors.pink, fontSize: 14 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// Sub-components

function BarCol({ value, height, color, metric }: { value: number; height: number; color: string; metric: Metric }) {
  return (
    <View style={styles.barCol}>
      {value > 0 && (
        <Text style={[styles.barValLabel, { color }]} numberOfLines={1}>
          {fmtMetricVal(value, metric)}
        </Text>
      )}
      <View style={[styles.bar, { height, backgroundColor: color }]} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LegendDash({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDash, { borderColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
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
  const dist = 'dist' in act ? fmtDist((act as any).dist) : '';
  const mins = effectiveDur(act);
  const dur = mins > 0 ? fmtDur(mins) : '';
  const meta = [dist, dur].filter(Boolean).join(' · ');
  const dateStr = new Date(act.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  return (
    <View style={styles.actRow}>
      <View style={[styles.actDot, { backgroundColor: dotColor }]} />
      <View style={styles.actInfo}>
        <Text style={styles.actLabel}>{actLabel(act)}</Text>
        <Text style={styles.actMeta}>{dateStr}{meta ? ' · ' + meta : ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  subGreeting: { fontSize: 14, color: colors.muted, marginTop: 2 },
  addBtn: { backgroundColor: colors.pink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderTopWidth: 3, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  chartCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24,
  },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  metricRow: { flexDirection: 'row', gap: 4 },
  metricBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  metricBtnActive: { backgroundColor: colors.surface3, borderColor: colors.pink },
  metricBtnText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  metricBtnTextActive: { color: colors.pink },

  weekTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 6, marginBottom: 10,
  },
  weekTriggerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  weekTriggerArrow: { fontSize: 12, color: colors.muted },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end' },

  yLabel: {
    position: 'absolute', right: 4,
    fontSize: 8, color: colors.muted2, lineHeight: 10,
  },
  yLabelGoal: { color: colors.muted, fontWeight: '700' },

  chartBody: {
    flex: 1, position: 'relative',
    borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.border2,
  },
  goalBand: {
    position: 'absolute', left: 0, right: 0,
    borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed',
  },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: colors.border, opacity: 0.4,
  },

  barsGroup: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: CHART_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 6,
  },
  barCol: {
    flex: 1,
    height: CHART_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValLabel: { fontSize: 8, fontWeight: '700', marginBottom: 2, lineHeight: 10 },
  bar: { width: 26, borderTopLeftRadius: 4, borderTopRightRadius: 4 },

  xAxisRow: { flexDirection: 'row', marginTop: 4 },
  xAxisLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.muted },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDash: { width: 12, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  legendText: { fontSize: 10, color: colors.muted },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '600', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.muted },

  actRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  actDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  actInfo: { flex: 1 },
  actLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  actMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalSheet: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 16, width: '85%', maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, textAlign: 'center' },
  weekOpt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2,
  },
  weekOptSelected: { backgroundColor: colors.surface3 },
  weekOptText: { fontSize: 14, color: colors.text },
  weekOptTextSelected: { color: colors.pink, fontWeight: '600' },
});
