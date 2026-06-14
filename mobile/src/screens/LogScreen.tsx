import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
} from 'react-native';
import { User } from 'firebase/auth';
import { colors, actColors } from '../theme';
import { TrainingDB, ActivityEntry, NutritionItem } from '../types';
import AddWorkoutScreen from './AddWorkoutScreen';
import { PlanWorkoutModal } from './CalendarScreen';

type FilterType = 'all' | 'run' | 'cross' | 'strength' | 'recovery';
type AddType = 'run' | 'cross' | 'strength' | 'recovery';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'run',      label: 'Runs' },
  { key: 'cross',    label: 'Cross' },
  { key: 'strength', label: 'Strength' },
  { key: 'recovery', label: 'Recovery' },
];

const ACTION_BTNS: { label: string; type: AddType | 'plan'; color: string }[] = [
  { label: '+ Log Run',           type: 'run',      color: colors.pink   },
  { label: 'Cross Train',         type: 'cross',    color: colors.blue   },
  { label: 'Strength / Recovery', type: 'strength', color: colors.amber  },
  { label: 'Plan Workout',        type: 'plan',     color: '#7c4dff'     },
];

function fmtDist(d: number | string) {
  const n = Number(d);
  return n > 0 ? `${n.toFixed(1)} km` : null;
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
    const rt: string = (act as any).runType ?? '';
    if (!rt) return 'Run';
    const cap = rt.charAt(0).toUpperCase() + rt.slice(1);
    return (cap.endsWith('Run') || cap === 'Hike') ? cap : cap + ' Run';
  }
  if (act.actType === 'cross') return (act as any).subtype || 'Cross-Training';
  if (act.actType === 'strength') return (act as any).subtype || 'Strength';
  if (act.actType === 'recovery') return (act as any).subtype || 'Recovery';
  return 'Workout';
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function nutrPerHour(
  entries: { itemId: string; servings: number }[] | undefined,
  items: NutritionItem[],
  durMins: number,
  elapsedMins?: number,
): { carbs: number; hydration: number; sodium: number } | null {
  if (!entries || entries.length === 0) return null;
  const hrs = (elapsedMins || durMins) / 60;
  if (hrs <= 0) return null;
  let carbs = 0, hydration = 0, sodium = 0;
  for (const ne of entries) {
    const item = items.find(n => n.id === ne.itemId);
    if (!item) continue;
    carbs     += (Number(item.carbsPerServing)     || 0) * ne.servings;
    hydration += (Number(item.hydrationPerServing)  || 0) * ne.servings;
    sodium    += (Number(item.sodiumPerServing)     || 0) * ne.servings;
  }
  if (!carbs && !hydration && !sodium) return null;
  return { carbs: Math.round(carbs / hrs), hydration: Math.round(hydration / hrs), sodium: Math.round(sodium / hrs) };
}

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (db: TrainingDB) => void;
  onEditEntry: (entry: ActivityEntry) => void;
}

export default function LogScreen({ user, db, onSaved, onEditEntry }: Props) {
  const [filter,   setFilter]   = useState<FilterType>('all');
  const [addType,  setAddType]  = useState<AddType | null>(null);
  const [showPlan, setShowPlan] = useState(false);

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

  const handleAction = (type: AddType | 'plan') => {
    if (type === 'plan') setShowPlan(true);
    else setAddType(type);
  };

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      <View style={styles.actionGrid}>
        {ACTION_BTNS.map(btn => (
          <TouchableOpacity
            key={btn.label}
            style={[styles.actionBtn, { borderColor: btn.color, backgroundColor: btn.color + '22' }]}
            onPress={() => handleAction(btn.type)}
          >
            <Text style={[styles.actionBtnText, { color: btn.color }]}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
        renderItem={({ item }) => <LogItem act={item} onPress={() => onEditEntry(item)} nutrition={db.nutrition} />}
      />

      {/* Add Workout Modal */}
      <Modal
        visible={addType !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddType(null)}
      >
        {addType !== null && (
          <AddWorkoutScreen
            key={addType}
            user={user}
            db={db}
            onSaved={onSaved}
            initialType={addType}
            onClose={() => setAddType(null)}
          />
        )}
      </Modal>

      {/* Plan Workout Modal */}
      {showPlan && (
        <PlanWorkoutModal
          date={todayISO()}
          user={user}
          db={db}
          onSaved={onSaved}
          onClose={() => setShowPlan(false)}
        />
      )}
    </View>
  );
}

function LogItem({ act, onPress, nutrition = [] }: { act: ActivityEntry; onPress: () => void; nutrition?: NutritionItem[] }) {
  const dotColor = actColors[act.actType] ?? colors.muted;
  const dist = 'dist' in act ? fmtDist((act as any).dist) : null;
  const dur  = 'dur' in act ? fmtDur((act as any).dur) : null;
  const vert = 'vert' in act && Number((act as any).vert) > 0
    ? `${(act as any).vert} m` : null;
  const notes = (act as any).notes || null;
  const nutrStats = nutrPerHour(
    (act as any).nutritionEntries, nutrition,
    Number((act as any).dur) || 0,
    Number((act as any).elapsed) || undefined,
  );

  const dateStr = new Date(act.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
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
      {nutrStats && (
        <View style={styles.nutrRow}>
          {nutrStats.carbs > 0 && (
            <View>
              <Text style={[styles.nutrVal, { color: colors.pink }]}>{nutrStats.carbs}</Text>
              <Text style={[styles.nutrLabel, { color: colors.pink }]}>G CARBS / HR</Text>
            </View>
          )}
          {nutrStats.hydration > 0 && (
            <View>
              <Text style={[styles.nutrVal, { color: colors.blue }]}>{nutrStats.hydration}</Text>
              <Text style={[styles.nutrLabel, { color: colors.blue }]}>ML / HR</Text>
            </View>
          )}
          {nutrStats.sodium > 0 && (
            <View>
              <Text style={[styles.nutrVal, { color: colors.amber }]}>{nutrStats.sodium}</Text>
              <Text style={[styles.nutrLabel, { color: colors.amber }]}>MG SODIUM / HR</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBtn: {
    width: '47.5%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

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
  nutrRow:   { flexDirection: 'row', gap: 16, marginTop: 10, marginLeft: 20 },
  nutrVal:   { fontSize: 15, fontWeight: '800' },
  nutrLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 },
});
