import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { User } from 'firebase/auth';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
  onNavigateToAdd: () => void;
}

function getThisWeekRange() {
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

function fmtDist(d: number | string) {
  const n = Number(d);
  return n > 0 ? `${n.toFixed(1)} mi` : '';
}

function fmtDur(d: number | string) {
  const mins = Number(d);
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function actLabel(act: ActivityEntry) {
  if (act.actType === 'run') {
    const r = act as import('../types').RunEntry;
    return r.runType
      ? r.runType.charAt(0).toUpperCase() + r.runType.slice(1) + ' Run'
      : 'Run';
  }
  if (act.actType === 'cross') {
    const c = act as import('../types').CrossEntry;
    return c.subtype || 'Cross-Training';
  }
  if (act.actType === 'strength') return 'Strength';
  if (act.actType === 'recovery') return 'Recovery';
  return 'Workout';
}

export default function DashboardScreen({ user, db, onNavigateToAdd }: Props) {
  const { monday, sunday } = useMemo(getThisWeekRange, []);

  const allActivities: ActivityEntry[] = useMemo(() => {
    const all: ActivityEntry[] = [
      ...db.runs,
      ...db.crosses,
      ...db.strengths,
      ...db.recoveries,
    ];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [db]);

  const weekActivities = useMemo(() => {
    return allActivities.filter((a) => {
      const d = new Date(a.date + 'T12:00:00');
      return d >= monday && d <= sunday;
    });
  }, [allActivities, monday, sunday]);

  const weeklyStats = useMemo(() => {
    let dist = 0, mins = 0, count = 0;
    weekActivities.forEach((a) => {
      count++;
      if ('dist' in a) dist += Number(a.dist) || 0;
      if ('dur' in a) mins += Number(a.dur) || 0;
    });
    return { dist, mins, count };
  }, [weekActivities]);

  const recentActivities = allActivities.slice(0, 7);

  const firstName = user.displayName?.split(' ')[0] ?? 'Athlete';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
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
  const dur  = 'dur' in act ? fmtDur((act as any).dur) : '';
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

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
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
