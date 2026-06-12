import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry } from '../types';

type FilterType = 'all' | 'run' | 'cross' | 'strength' | 'recovery';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'run',      label: 'Runs' },
  { key: 'cross',    label: 'Cross' },
  { key: 'strength', label: 'Strength' },
  { key: 'recovery', label: 'Recovery' },
];

function fmtDist(d: number | string) {
  const n = Number(d);
  return n > 0 ? `${n.toFixed(1)} mi` : null;
}

function fmtDur(d: number | string) {
  const mins = Number(d);
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function actTitle(act: ActivityEntry): string {
  if (act.actType === 'run') {
    const rt = (act as any).runType ?? '';
    return rt ? rt.charAt(0).toUpperCase() + rt.slice(1) + ' Run' : 'Run';
  }
  if (act.actType === 'cross') return (act as any).subtype || 'Cross-Training';
  if (act.actType === 'strength') return (act as any).subtype || 'Strength';
  if (act.actType === 'recovery') return (act as any).subtype || 'Recovery';
  return 'Workout';
}

interface Props {
  db: TrainingDB;
}

export default function LogScreen({ db }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');

  const allActivities: ActivityEntry[] = useMemo(() => {
    const all: ActivityEntry[] = [
      ...db.runs,
      ...db.crosses,
      ...db.strengths,
      ...db.recoveries,
    ];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [db]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allActivities;
    return allActivities.filter((a) => a.actType === filter);
  }, [allActivities, filter]);

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activities to show.</Text>
          </View>
        }
        renderItem={({ item }) => <LogItem act={item} />}
      />
    </View>
  );
}

function LogItem({ act }: { act: ActivityEntry }) {
  const dotColor = actColors[act.actType] ?? colors.muted;
  const dist = 'dist' in act ? fmtDist((act as any).dist) : null;
  const dur  = 'dur' in act ? fmtDur((act as any).dur) : null;
  const vert = 'vert' in act && Number((act as any).vert) > 0
    ? `${(act as any).vert} ft` : null;
  const notes = (act as any).notes || null;

  const dateStr = new Date(act.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <View style={styles.itemLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <View>
            <Text style={styles.itemTitle}>{actTitle(act)}</Text>
            <Text style={styles.itemDate}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.itemStats}>
          {dist && <Text style={[styles.statChip, { color: dotColor }]}>{dist}</Text>}
          {dur  && <Text style={styles.durChip}>{dur}</Text>}
        </View>
      </View>
      {vert && <Text style={styles.detail}>↑ {vert}</Text>}
      {notes ? <Text style={styles.notes} numberOfLines={2}>{notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  filterBtnActive: {
    backgroundColor: colors.pink,
  },
  filterText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 40 },

  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: colors.muted, fontSize: 15 },

  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemDate: { fontSize: 11, color: colors.muted, marginTop: 1 },
  itemStats: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statChip: { fontSize: 13, fontWeight: '700' },
  durChip: { fontSize: 12, color: colors.muted },

  detail: { fontSize: 12, color: colors.muted, marginTop: 6, marginLeft: 20 },
  notes: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    marginLeft: 20,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
