import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { colors } from '../theme';
import { TrainingDB, RunEntry, CrossEntry } from '../types';

interface Props {
  db: TrainingDB;
}

type Metric = 'time' | 'dist' | 'vert';
type Period = 'week' | 'month' | 'all';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function effectiveDur(act: any): number {
  if (act.useMovingTime && Number(act.movingTime) > 0) return Number(act.movingTime);
  if (!act.useMovingTime && Number(act.elapsedTime) > 0) return Number(act.elapsedTime);
  return Number(act.dur) || 0;
}

function fmtDur(mins: number): string {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDist(d: number): string {
  return d > 0 ? `${d.toFixed(1)} mi` : '—';
}

function fmtVert(v: number): string {
  return v > 0 ? `${Math.round(v)} ft` : '—';
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function filterByPeriod(date: string, period: Period): boolean {
  const now = new Date();
  const d = new Date(date + 'T12:00:00');
  if (period === 'week') {
    const monday = getMondayOfWeek(now);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
  }
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

interface SubtypeStat {
  label: string;
  mins: number;
  dist: number;
  vert: number;
  count: number;
  avgHr: number;
  hrCount: number;
}

export default function ExploreScreen({ db }: Props) {
  const [period, setPeriod] = useState<Period>('week');
  const [metric, setMetric] = useState<Metric>('time');

  const runs = useMemo(
    () => db.runs.filter((r) => filterByPeriod(r.date, period)),
    [db.runs, period],
  );
  const crosses = useMemo(
    () => db.crosses.filter((c) => filterByPeriod(c.date, period)),
    [db.crosses, period],
  );

  // --- Running breakdown by runType ---
  const runBreakdown = useMemo(() => {
    const map: Record<string, SubtypeStat> = {};
    runs.forEach((r) => {
      const key = r.runType || 'other';
      if (!map[key]) map[key] = { label: key.charAt(0).toUpperCase() + key.slice(1), mins: 0, dist: 0, vert: 0, count: 0, avgHr: 0, hrCount: 0 };
      map[key].mins += effectiveDur(r);
      map[key].dist += Number(r.dist) || 0;
      map[key].vert += Number(r.vert) || 0;
      map[key].count += 1;
      if (Number(r.hr) > 0) { map[key].avgHr += Number(r.hr); map[key].hrCount += 1; }
    });
    return Object.values(map).sort((a, b) => b.mins - a.mins);
  }, [runs]);

  // --- Cross-training breakdown by subtype ---
  const crossBreakdown = useMemo(() => {
    const map: Record<string, SubtypeStat> = {};
    crosses.forEach((c) => {
      const key = c.subtype || 'Other';
      if (!map[key]) map[key] = { label: key, mins: 0, dist: 0, vert: 0, count: 0, avgHr: 0, hrCount: 0 };
      map[key].mins += effectiveDur(c);
      map[key].dist += Number(c.dist) || 0;
      map[key].vert += Number(c.vert) || 0;
      map[key].count += 1;
      if (Number((c as any).hr) > 0) { map[key].avgHr += Number((c as any).hr); map[key].hrCount += 1; }
    });
    return Object.values(map).sort((a, b) => b.mins - a.mins);
  }, [crosses]);

  // Totals
  const runTotals = useMemo(() => ({
    mins: runBreakdown.reduce((s, r) => s + r.mins, 0),
    dist: runBreakdown.reduce((s, r) => s + r.dist, 0),
    vert: runBreakdown.reduce((s, r) => s + r.vert, 0),
    count: runs.length,
    avgHr: runs.filter((r) => Number(r.hr) > 0).length
      ? runs.filter((r) => Number(r.hr) > 0).reduce((s, r) => s + Number(r.hr), 0) / runs.filter((r) => Number(r.hr) > 0).length
      : 0,
  }), [runBreakdown, runs]);

  const crossTotals = useMemo(() => ({
    mins: crossBreakdown.reduce((s, c) => s + c.mins, 0),
    dist: crossBreakdown.reduce((s, c) => s + c.dist, 0),
    vert: crossBreakdown.reduce((s, c) => s + c.vert, 0),
    count: crosses.length,
    avgHr: crosses.filter((c) => Number((c as any).hr) > 0).length
      ? crosses.filter((c) => Number((c as any).hr) > 0).reduce((s, c) => s + Number((c as any).hr), 0) / crosses.filter((c) => Number((c as any).hr) > 0).length
      : 0,
  }), [crossBreakdown, crosses]);

  function metricVal(stat: SubtypeStat): number {
    if (metric === 'time') return stat.mins;
    if (metric === 'dist') return stat.dist;
    return stat.vert;
  }

  function totalVal(totals: typeof runTotals): number {
    if (metric === 'time') return totals.mins;
    if (metric === 'dist') return totals.dist;
    return totals.vert;
  }

  function fmtMetric(n: number): string {
    if (metric === 'time') return fmtDur(n);
    if (metric === 'dist') return fmtDist(n);
    return fmtVert(n);
  }

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Explore Stats</Text>

      {/* Period selector */}
      <View style={styles.segRow}>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.segBtn, period === p && styles.segBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.segText, period === p && styles.segTextActive]}>
              {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metric selector */}
      <View style={styles.segRow}>
        {(['time', 'dist', 'vert'] as Metric[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.segBtn, metric === m && { backgroundColor: colors.surface3, borderColor: colors.blue }]}
            onPress={() => setMetric(m)}
          >
            <Text style={[styles.segText, metric === m && { color: colors.blue }]}>
              {m === 'time' ? 'Time' : m === 'dist' ? 'Distance' : 'Vert'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Running section */}
      <SectionHeader
        label="Running"
        color={colors.pink}
        count={runTotals.count}
        total={fmtMetric(totalVal(runTotals))}
        avgHr={runTotals.avgHr}
      />
      {runBreakdown.length === 0 ? (
        <EmptyNote text={`No runs logged ${periodLabel.toLowerCase()}`} />
      ) : (
        runBreakdown.map((stat) => (
          <SubtypeRow
            key={stat.label}
            stat={stat}
            total={totalVal(runTotals)}
            metricVal={metricVal(stat)}
            fmtMetric={fmtMetric}
            color={colors.pink}
          />
        ))
      )}

      {/* Cross-training section */}
      <SectionHeader
        label="Cross-Training"
        color={colors.blue}
        count={crossTotals.count}
        total={fmtMetric(totalVal(crossTotals))}
        avgHr={crossTotals.avgHr}
      />
      {crossBreakdown.length === 0 ? (
        <EmptyNote text={`No cross-training logged ${periodLabel.toLowerCase()}`} />
      ) : (
        crossBreakdown.map((stat) => (
          <SubtypeRow
            key={stat.label}
            stat={stat}
            total={totalVal(crossTotals)}
            metricVal={metricVal(stat)}
            fmtMetric={fmtMetric}
            color={colors.blue}
          />
        ))
      )}
    </ScrollView>
  );
}

function SectionHeader({
  label, color, count, total, avgHr,
}: { label: string; color: string; count: number; total: string; avgHr: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
        <Text style={styles.sectionMeta}>
          {count} activit{count === 1 ? 'y' : 'ies'} · {total}
          {avgHr > 0 ? ` · avg ${Math.round(avgHr)} bpm` : ''}
        </Text>
      </View>
    </View>
  );
}

function SubtypeRow({
  stat, total, metricVal, fmtMetric, color,
}: {
  stat: SubtypeStat;
  total: number;
  metricVal: number;
  fmtMetric: (n: number) => string;
  color: string;
}) {
  const proportion = total > 0 ? metricVal / total : 0;
  const avgHrStr = stat.hrCount > 0 ? `${Math.round(stat.avgHr / stat.hrCount)} bpm` : null;

  return (
    <View style={styles.subtypeRow}>
      <View style={styles.subtypeInfo}>
        <View style={styles.subtypeTop}>
          <Text style={styles.subtypeLabel}>{stat.label}</Text>
          <Text style={[styles.subtypeValue, { color }]}>{fmtMetric(metricVal)}</Text>
        </View>
        {/* Proportion bar */}
        <View style={styles.propBarTrack}>
          <View style={[styles.propBarFill, { width: `${Math.round(proportion * 100)}%` as any, backgroundColor: color }]} />
        </View>
        <View style={styles.subtypeMeta}>
          <Text style={styles.metaText}>{pct(metricVal, total)} · {stat.count} act{stat.count === 1 ? '' : 's'}</Text>
          {avgHrStr && <Text style={styles.metaText}>avg {avgHrStr}</Text>}
        </View>
      </View>
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.emptyNote}>
      <Text style={styles.emptyNoteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },

  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },

  segRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segBtnActive: {
    backgroundColor: colors.surface3,
    borderColor: colors.pink,
  },
  segText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  segTextActive: { color: colors.pink },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionLabel: { fontSize: 15, fontWeight: '700' },
  sectionMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },

  subtypeRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtypeInfo: {},
  subtypeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subtypeLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtypeValue: { fontSize: 14, fontWeight: '700' },
  propBarTrack: {
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  propBarFill: {
    height: '100%',
    borderRadius: 999,
    opacity: 0.8,
  },
  subtypeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: { fontSize: 11, color: colors.muted },

  emptyNote: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyNoteText: { fontSize: 13, color: colors.muted },
});
