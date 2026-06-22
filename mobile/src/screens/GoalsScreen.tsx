import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB } from '../types';
import { colors } from '../theme';

interface GoalRange { min: number; max: number; }
interface SportGoal {
  enabled: boolean;
  metrics: { dist: boolean; time: boolean; vert: boolean };
  dist: GoalRange;
  time: GoalRange;
  vert: GoalRange;
}
interface GoalObj { run: SportGoal; cross: SportGoal; }

export function normalizeGoal(g: any): GoalObj {
  return {
    run: {
      enabled: g?.run?.enabled ?? true,
      metrics: {
        dist: g?.run?.metrics?.dist ?? true,
        time: g?.run?.metrics?.time ?? false,
        vert: g?.run?.metrics?.vert ?? false,
      },
      dist: { min: Number(g?.run?.dist?.min) || 0, max: Number(g?.run?.dist?.max) || 0 },
      time: { min: Number(g?.run?.time?.min) || 0, max: Number(g?.run?.time?.max) || 0 },
      vert: { min: Number(g?.run?.vert?.min) || 0, max: Number(g?.run?.vert?.max) || 0 },
    },
    cross: {
      enabled: g?.cross?.enabled ?? false,
      metrics: {
        dist: g?.cross?.metrics?.dist ?? false,
        time: g?.cross?.metrics?.time ?? true,
        vert: g?.cross?.metrics?.vert ?? false,
      },
      dist: { min: Number(g?.cross?.dist?.min) || 0, max: Number(g?.cross?.dist?.max) || 0 },
      time: { min: Number(g?.cross?.time?.min) || 0, max: Number(g?.cross?.time?.max) || 0 },
      vert: { min: Number(g?.cross?.vert?.min) || 0, max: Number(g?.cross?.vert?.max) || 0 },
    },
  };
}

function getMondayKey(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const y = monday.getFullYear();
  const mo = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function isInRange(value: number, range: GoalRange): boolean {
  if (range.min === 0 && range.max === 0) return false;
  return value >= range.min && (range.max === 0 || value <= range.max);
}

function fmtVal(v: number, unit: string): string {
  if (unit === 'h') return v.toFixed(1);
  return Math.round(v).toString();
}

interface Props { user: User; db: TrainingDB; onSaved: (u: TrainingDB) => void; }

export default function GoalsScreen({ user, db, onSaved }: Props) {
  const weekKey = useMemo(getMondayKey, []);

  const weekLabel = useMemo(() => {
    const d = new Date(weekKey + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }, [weekKey]);

  const initialGoal = useMemo(() => {
    const wg = (db.weeklyGoals as any)?.[weekKey];
    return normalizeGoal(wg ?? db.goals);
  }, []);

  const [goal, setGoal] = useState<GoalObj>(initialGoal);
  const [saving, setSaving] = useState(false);

  const weekStats = useMemo(() => {
    const monday = new Date(weekKey + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const inWeek = (d: string) => {
      const dt = new Date(d + 'T12:00:00');
      return dt >= monday && dt <= sunday;
    };
    const runs   = db.runs.filter(r => inWeek(r.date));
    const cross  = db.crosses.filter(c => inWeek(c.date));
    return {
      runDist:   runs.reduce((s, r) => s + (Number(r.dist) || 0), 0),
      runTime:   runs.reduce((s, r) => s + (Number(r.dur)  || 0), 0) / 60,
      runVert:   runs.reduce((s, r) => s + (Number(r.vert) || 0), 0),
      crossDist: cross.reduce((s, c) => s + (Number(c.dist) || 0), 0),
      crossTime: cross.reduce((s, c) => s + (Number(c.dur)  || 0), 0) / 60,
      crossVert: cross.reduce((s, c) => s + (Number(c.vert) || 0), 0),
    };
  }, [db, weekKey]);

  const handleSave = async () => {
    setSaving(true);
    const newDB: TrainingDB = {
      ...db,
      goals: goal as any,
      weeklyGoals: { ...(db.weeklyGoals as any), [weekKey]: goal },
    };
    try {
      await setDoc(
        doc(firestoreDB, 'users', user.uid, 'db', 'data'),
        JSON.parse(JSON.stringify(newDB)),
      );
      onSaved(newDB);
      Alert.alert('Saved', 'Goals updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const patchRun   = (p: Partial<SportGoal>) => setGoal(g => ({ ...g, run:   { ...g.run,   ...p } }));
  const patchCross = (p: Partial<SportGoal>) => setGoal(g => ({ ...g, cross: { ...g.cross, ...p } }));

  const toggleRunMetric   = (k: keyof SportGoal['metrics']) =>
    patchRun({ metrics: { ...goal.run.metrics, [k]: !goal.run.metrics[k] } });
  const toggleCrossMetric = (k: keyof SportGoal['metrics']) =>
    patchCross({ metrics: { ...goal.cross.metrics, [k]: !goal.cross.metrics[k] } });

  const setRunRange   = (f: 'dist'|'time'|'vert', k: 'min'|'max', v: string) =>
    patchRun({ [f]: { ...goal.run[f],   [k]: Number(v) || 0 } });
  const setCrossRange = (f: 'dist'|'time'|'vert', k: 'min'|'max', v: string) =>
    patchCross({ [f]: { ...goal.cross[f], [k]: Number(v) || 0 } });

  const isCycling = db.primarySport === 'cycling';
  const runLabel  = isCycling ? 'Cycling' : 'Running';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── This Week ─────────────────────────────── */}
      <Text style={styles.sectionTitle}>THIS WEEK</Text>
      <Text style={styles.weekLabel}>Week of {weekLabel}</Text>

      <ProgressSection
        label={runLabel}
        color={colors.pink}
        goal={goal.run}
        stats={{ dist: weekStats.runDist, time: weekStats.runTime, vert: weekStats.runVert }}
      />
      <ProgressSection
        label="Cross-Training"
        color={colors.blue}
        goal={goal.cross}
        stats={{ dist: weekStats.crossDist, time: weekStats.crossTime, vert: weekStats.crossVert }}
      />

      <View style={styles.divider} />

      {/* ── Goal Settings ─────────────────────────── */}
      <Text style={styles.sectionTitle}>GOAL SETTINGS</Text>

      {/* Running / Cycling */}
      <SportGoalEditor
        label={runLabel}
        color={colors.pink}
        goal={goal.run}
        onToggleEnabled={() => patchRun({ enabled: !goal.run.enabled })}
        onToggleMetric={toggleRunMetric}
        onSetRange={setRunRange}
        distUnit="km" timeUnit="h" vertUnit="m"
      />

      {/* Cross-Training */}
      <SportGoalEditor
        label="Cross-Training"
        color={colors.blue}
        goal={goal.cross}
        onToggleEnabled={() => patchCross({ enabled: !goal.cross.enabled })}
        onToggleMetric={toggleCrossMetric}
        onSetRange={setCrossRange}
        distUnit="km" timeUnit="h" vertUnit="m"
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Goals'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Progress Section ─────────────────────────────────────────────────────────

function ProgressSection({
  label, color, goal, stats,
}: {
  label: string; color: string;
  goal: SportGoal;
  stats: { dist: number; time: number; vert: number };
}) {
  if (!goal.enabled) {
    return (
      <View style={styles.progressCard}>
        <Text style={styles.progressCardLabel}>{label}</Text>
        <Text style={styles.disabledHint}>Not tracking this week</Text>
      </View>
    );
  }

  const rows: { label: string; value: number; range: GoalRange; unit: string }[] = [];
  if (goal.metrics.dist) rows.push({ label: 'Distance', value: stats.dist, range: goal.dist, unit: 'km' });
  if (goal.metrics.time) rows.push({ label: 'Time',     value: stats.time, range: goal.time, unit: 'h'  });
  if (goal.metrics.vert) rows.push({ label: 'Vert',     value: stats.vert, range: goal.vert, unit: 'm'  });

  if (rows.length === 0) {
    return (
      <View style={styles.progressCard}>
        <Text style={styles.progressCardLabel}>{label}</Text>
        <Text style={styles.disabledHint}>No metrics selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.progressCard}>
      <Text style={styles.progressCardLabel}>{label}</Text>
      {rows.map(row => (
        <GoalBar key={row.label} {...row} color={color} />
      ))}
    </View>
  );
}

function GoalBar({
  label, value, range, unit, color,
}: {
  label: string; value: number; range: GoalRange; unit: string; color: string;
}) {
  const hasRange = range.min > 0 || range.max > 0;
  const achieved = isInRange(value, range);
  const barColor = achieved ? colors.green : color;

  const maxScale = Math.max(
    range.max ? range.max * 1.3 : range.min * 2,
    value * 1.15,
    1,
  );
  const pct = `${Math.min((value / maxScale) * 100, 100).toFixed(1)}%`;

  return (
    <View style={styles.goalBarWrap}>
      <View style={styles.goalBarHeader}>
        <Text style={styles.goalBarLabel}>{label}</Text>
        <Text style={[styles.goalBarValue, achieved && { color: colors.green }]}>
          {fmtVal(value, unit)} {unit}
          {achieved ? ' ✓' : ''}
          {hasRange ? `  /  ${range.min}–${range.max} ${unit}` : ''}
        </Text>
      </View>
      <View style={styles.barTrack}>
        {hasRange && range.min > 0 && (
          <View style={[styles.barMin, {
            left: `${(range.min / maxScale) * 100}%`,
            borderColor: barColor + '80',
          }]} />
        )}
        {hasRange && range.max > 0 && (
          <View style={[styles.barMax, {
            left: `${Math.min((range.max / maxScale) * 100, 100)}%`,
            borderColor: barColor + '80',
          }]} />
        )}
        <View style={[styles.barFill, { width: pct, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// ─── Sport Goal Editor ────────────────────────────────────────────────────────

function SportGoalEditor({
  label, color, goal,
  onToggleEnabled, onToggleMetric, onSetRange,
  distUnit, timeUnit, vertUnit,
}: {
  label: string; color: string; goal: SportGoal;
  onToggleEnabled: () => void;
  onToggleMetric: (k: keyof SportGoal['metrics']) => void;
  onSetRange: (f: 'dist'|'time'|'vert', k: 'min'|'max', v: string) => void;
  distUnit: string; timeUnit: string; vertUnit: string;
}) {
  return (
    <View style={[styles.editorCard, !goal.enabled && styles.editorCardDisabled]}>
      <View style={styles.editorHeader}>
        <View style={[styles.editorDot, { backgroundColor: color }]} />
        <Text style={styles.editorLabel}>{label}</Text>
        <Switch
          value={goal.enabled}
          onValueChange={onToggleEnabled}
          trackColor={{ false: colors.border, true: color + '60' }}
          thumbColor={goal.enabled ? color : colors.muted}
        />
      </View>

      {goal.enabled && (
        <>
          <Text style={styles.fieldLabel}>TRACK METRICS</Text>
          <View style={styles.metricRow}>
            {(['dist', 'time', 'vert'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.metricChip, goal.metrics[m] && { borderColor: color, backgroundColor: color + '22' }]}
                onPress={() => onToggleMetric(m)}
              >
                <Text style={[styles.metricChipText, goal.metrics[m] && { color }]}>
                  {m === 'dist' ? 'Distance' : m === 'time' ? 'Time' : 'Vert'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {goal.metrics.dist && (
            <RangeInput
              label={`DISTANCE RANGE (${distUnit})`}
              min={String(goal.dist.min || '')}
              max={String(goal.dist.max || '')}
              onMin={v => onSetRange('dist', 'min', v)}
              onMax={v => onSetRange('dist', 'max', v)}
              placeholder={{ min: '50', max: '70' }}
            />
          )}
          {goal.metrics.time && (
            <RangeInput
              label={`TIME RANGE (${timeUnit})`}
              min={String(goal.time.min || '')}
              max={String(goal.time.max || '')}
              onMin={v => onSetRange('time', 'min', v)}
              onMax={v => onSetRange('time', 'max', v)}
              placeholder={{ min: '7', max: '10' }}
            />
          )}
          {goal.metrics.vert && (
            <RangeInput
              label={`ELEVATION RANGE (${vertUnit})`}
              min={String(goal.vert.min || '')}
              max={String(goal.vert.max || '')}
              onMin={v => onSetRange('vert', 'min', v)}
              onMax={v => onSetRange('vert', 'max', v)}
              placeholder={{ min: '800', max: '1400' }}
            />
          )}
        </>
      )}
    </View>
  );
}

function RangeInput({
  label, min, max, onMin, onMax, placeholder,
}: {
  label: string;
  min: string; max: string;
  onMin: (v: string) => void; onMax: (v: string) => void;
  placeholder: { min: string; max: string };
}) {
  return (
    <View style={styles.rangeWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeField}>
          <Text style={styles.rangeFieldLabel}>Min</Text>
          <TextInput
            style={styles.rangeInput}
            value={min}
            onChangeText={onMin}
            keyboardType="decimal-pad"
            placeholder={placeholder.min}
            placeholderTextColor={colors.muted2}
          />
        </View>
        <Text style={styles.rangeDash}>–</Text>
        <View style={styles.rangeField}>
          <Text style={styles.rangeFieldLabel}>Max</Text>
          <TextInput
            style={styles.rangeInput}
            value={max}
            onChangeText={onMax}
            keyboardType="decimal-pad"
            placeholder={placeholder.max}
            placeholderTextColor={colors.muted2}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 20, paddingBottom: 60 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  weekLabel: { fontSize: 13, color: colors.muted, marginBottom: 12 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },

  progressCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  progressCardLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 },
  disabledHint: { fontSize: 12, color: colors.muted2, fontStyle: 'italic' },

  goalBarWrap:   { marginBottom: 12 },
  goalBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  goalBarLabel:  { fontSize: 12, color: colors.muted, fontWeight: '600' },
  goalBarValue:  { fontSize: 12, color: colors.text, fontWeight: '600' },
  barTrack: {
    height: 8, backgroundColor: colors.surface2,
    borderRadius: 4, overflow: 'visible', position: 'relative',
  },
  barFill: { position: 'absolute', top: 0, left: 0, height: 8, borderRadius: 4 },
  barMin: {
    position: 'absolute', top: -3, width: 2, height: 14,
    borderLeftWidth: 2, borderStyle: 'dashed',
  },
  barMax: {
    position: 'absolute', top: -3, width: 2, height: 14,
    borderLeftWidth: 2, borderStyle: 'dashed',
  },

  editorCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  editorCardDisabled: { opacity: 0.7 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  editorDot:    { width: 10, height: 10, borderRadius: 5 },
  editorLabel:  { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },

  fieldLabel: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12,
  },
  metricRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metricChip:    {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.surface2,
  },
  metricChipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  rangeWrap: { marginTop: 4 },
  rangeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rangeField: { flex: 1 },
  rangeFieldLabel: { fontSize: 10, color: colors.muted2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  rangeInput: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 15, textAlign: 'center',
  },
  rangeDash: { fontSize: 18, color: colors.muted, fontWeight: '300', marginTop: 14 },

  saveBtn: {
    backgroundColor: colors.pink, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 12,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
