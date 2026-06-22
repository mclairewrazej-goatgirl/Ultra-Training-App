import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { User } from 'firebase/auth';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry, WeeklyGoal, defaultWeeklyGoal } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
  onNavigateToAdd: () => void;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getThisWeekRange() {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function weekKey(monday: Date): string {
  return monday.toISOString().slice(0, 10);
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

/** Returns the effective duration (minutes) for dashboard, respecting useMovingTime */
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

const CHART_H = 110;

export default function DashboardScreen({ user, db, onNavigateToAdd }: Props) {
  const { monday, sunday } = useMemo(getThisWeekRange, []);
  const thisWeekKey = useMemo(() => weekKey(monday), [monday]);

  const allActivities: ActivityEntry[] = useMemo(() => {
    return [
      ...db.runs,
      ...db.crosses,
      ...db.strengths,
      ...db.recoveries,
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [db]);

  const weekActivities = useMemo(() =>
    allActivities.filter((a) => {
      const d = new Date(a.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    }),
    [allActivities, monday, sunday],
  );

  const weeklyStats = useMemo(() => {
    let dist = 0, mins = 0, count = 0;
    weekActivities.forEach((a) => {
      count++;
      if ('dist' in a) dist += Number((a as any).dist) || 0;
      mins += effectiveDur(a);
    });
    return { dist, mins, count };
  }, [weekActivities]);

  // Bar chart data — run hours and cross hours for current week
  const goal = useMemo(() => getGoalForWeek(db, thisWeekKey), [db, thisWeekKey]);

  const chartData = useMemo(() => {
    let runMins = 0, crossMins = 0;
    weekActivities.forEach((a) => {
      if (a.actType === 'run') runMins += effectiveDur(a);
      else if (a.actType === 'cross') crossMins += effectiveDur(a);
    });
    const runHrs = runMins / 60;
    const crossHrs = crossMins / 60;

    // Goal band in hours
    const runGoalMax = goal.run.enabled && goal.run.metrics.time ? goal.run.time.max : 0;
    const runGoalMin = goal.run.enabled && goal.run.metrics.time ? goal.run.time.min : 0;
    const crossGoalMax = goal.cross.enabled && goal.cross.metrics.time ? goal.cross.time.max : 0;
    const crossGoalMin = goal.cross.enabled && goal.cross.metrics.time ? goal.cross.time.min : 0;

    const maxVal = Math.max(runHrs, crossHrs, runGoalMax, crossGoalMax, 0.1);
    const axisMax = Math.max(1, Math.ceil((maxVal * 1.15) * 2) / 2); // round to 0.5h steps

    return { runHrs, crossHrs, runGoalMin, runGoalMax, crossGoalMin, crossGoalMax, axisMax };
  }, [weekActivities, goal]);

  const recentActivities = allActivities.slice(0, 7);
  const firstName = user.displayName?.split(' ')[0] ?? 'Athlete';

  const { runHrs, crossHrs, runGoalMin, runGoalMax, crossGoalMin, crossGoalMax, axisMax } = chartData;
  const hasGoalBand = runGoalMax > 0 || crossGoalMax > 0;

  function barH(val: number) {
    return Math.max((val / axisMax) * CHART_H, val > 0 ? 3 : 0);
  }

  // Y-axis labels
  const yLabels = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];

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

      {/* Weekly Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Workouts" value={String(weeklyStats.count)} color={colors.pink} />
        <StatCard label="Distance" value={fmtDist(weeklyStats.dist) || '—'} color={colors.blue} />
        <StatCard label="Time" value={fmtDur(weeklyStats.mins) || '—'} color={colors.green} />
      </View>

      {/* Volume Bar Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weekly Volume (hours)</Text>

        <View style={styles.chartArea}>
          {/* Y-axis */}
          <View style={styles.yAxis}>
            {yLabels.map((v, i) => (
              <Text key={i} style={styles.yLabel}>{v.toFixed(1)}</Text>
            ))}
          </View>

          {/* Chart body */}
          <View style={[styles.chartBody, { height: CHART_H }]}>
            {/* Goal bands */}
            {hasGoalBand && runGoalMax > 0 && (
              <View
                style={[
                  styles.goalBand,
                  {
                    bottom: (runGoalMin / axisMax) * CHART_H,
                    height: Math.max(2, ((runGoalMax - runGoalMin) / axisMax) * CHART_H),
                    backgroundColor: 'rgba(233,30,140,0.15)',
                    borderTopColor: colors.pink,
                    borderBottomColor: colors.pink,
                  },
                ]}
              />
            )}
            {hasGoalBand && crossGoalMax > 0 && (
              <View
                style={[
                  styles.goalBand,
                  {
                    bottom: (crossGoalMin / axisMax) * CHART_H,
                    height: Math.max(2, ((crossGoalMax - crossGoalMin) / axisMax) * CHART_H),
                    backgroundColor: 'rgba(0,180,216,0.15)',
                    borderTopColor: colors.blue,
                    borderBottomColor: colors.blue,
                  },
                ]}
              />
            )}

            {/* Bars */}
            <View style={styles.barGroup}>
              <View style={styles.barPair}>
                <View style={[styles.bar, { height: barH(runHrs), backgroundColor: colors.pink }]} />
                <View style={[styles.bar, { height: barH(crossHrs), backgroundColor: colors.blue }]} />
              </View>
            </View>

            {/* Grid lines */}
            {yLabels.slice(0, -1).map((v, i) => (
              <View
                key={i}
                style={[styles.gridLine, { bottom: (v / axisMax) * CHART_H }]}
              />
            ))}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.pink }]} />
            <Text style={styles.legendText}>Run {runHrs.toFixed(1)}h</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
            <Text style={styles.legendText}>Cross {crossHrs.toFixed(1)}h</Text>
          </View>
          {runGoalMax > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDash, { borderColor: colors.pink }]} />
              <Text style={styles.legendText}>Run goal {runGoalMin > 0 ? `${runGoalMin}–` : ''}{runGoalMax}h</Text>
            </View>
          )}
          {crossGoalMax > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDash, { borderColor: colors.blue }]} />
              <Text style={styles.legendText}>Cross goal {crossGoalMin > 0 ? `${crossGoalMin}–` : ''}{crossGoalMax}h</Text>
            </View>
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
        recentActivities.map((act) => (
          <ActivityRow key={act.id} act={act} />
        ))
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

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  subGreeting: { fontSize: 14, color: colors.muted, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.pink,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 3,
    borderTopColor: colors.pink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chart
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end' },
  yAxis: {
    width: 32,
    height: CHART_H,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: { fontSize: 9, color: colors.muted2, lineHeight: 10 },
  chartBody: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border2,
  },
  goalBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.4,
  },
  barGroup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bar: {
    width: 36,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDash: {
    width: 14,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  legendText: { fontSize: 11, color: colors.muted },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '600', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: colors.muted },

  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  actDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  actInfo: { flex: 1 },
  actLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  actMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
