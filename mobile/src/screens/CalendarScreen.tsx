import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, ActivityEntry, PlannedWorkout } from '../types';
import { colors, actColors } from '../theme';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const ACT_TYPES = ['run','cross','strength','recovery'] as const;
const SUBTYPES: Record<string, string[]> = {
  run:      ['easy','long','tempo','interval','race','hike'],
  cross:    ['Cycling','Swimming','Rowing','Yoga','Cross Train'],
  strength: ['Full Body','Upper Body','Lower Body','Core','PT'],
  recovery: ['Rest Day','Easy Walk','Stretching','Foam Rolling','Sauna'],
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

export default function CalendarScreen({ user, db, onSaved }: Props) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [planModalDate, setPlanModalDate] = useState<string | null>(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build a map: date string → list of dot colors
  const dotMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    const add = (date: string, color: string) => {
      if (!map[date]) map[date] = [];
      if (!map[date].includes(color)) map[date].push(color);
    };
    db.runs.forEach(r       => add(r.date, colors.pink));
    db.crosses.forEach(c    => add(c.date, colors.blue));
    db.strengths.forEach(s  => add(s.date, colors.amber));
    db.recoveries.forEach(r => add(r.date, colors.green));
    db.plans.forEach(p      => add(p.date, colors.muted));
    return map;
  }, [db]);

  // Activities on selected date
  const selectedActivities: ActivityEntry[] = useMemo(() => {
    if (!selectedDate) return [];
    return [
      ...db.runs.filter(r => r.date === selectedDate),
      ...db.crosses.filter(r => r.date === selectedDate),
      ...db.strengths.filter(r => r.date === selectedDate),
      ...db.recoveries.filter(r => r.date === selectedDate),
    ];
  }, [selectedDate, db]);

  const selectedPlans: PlannedWorkout[] = useMemo(() => {
    if (!selectedDate) return [];
    return db.plans.filter(p => p.date === selectedDate);
  }, [selectedDate, db]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const handleDayPress = (day: number) => {
    const iso = toISO(year, month, day);
    setSelectedDate(prev => prev === iso ? null : iso);
  };

  const handlePlanPress = (day: number) => {
    setPlanModalDate(toISO(year, month, day));
  };

  const handleDeletePlan = async (planId: string) => {
    const newDB = { ...db, plans: db.plans.filter(p => p.id !== planId) };
    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayRow}>
        {DAYS.map(d => (
          <Text key={d} style={styles.dayHeader}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.cell} />;
          const iso  = toISO(year, month, day);
          const dots = dotMap[iso] ?? [];
          const isToday    = iso === todayISO;
          const isSelected = iso === selectedDate;
          return (
            <TouchableOpacity
              key={iso}
              style={[styles.cell, isSelected && styles.cellSelected, isToday && styles.cellToday]}
              onPress={() => handleDayPress(day)}
            >
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && styles.dayNumToday]}>
                {day}
              </Text>
              <View style={styles.dotsRow}>
                {dots.slice(0, 3).map((c, di) => (
                  <View key={di} style={[styles.dot, { backgroundColor: c }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day panel */}
      {selectedDate && (
        <ScrollView style={styles.dayPanel} contentContainerStyle={styles.dayPanelContent}>
          <View style={styles.dayPanelHeader}>
            <Text style={styles.dayPanelTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Text>
            <TouchableOpacity
              style={styles.planBtn}
              onPress={() => handlePlanPress(new Date(selectedDate + 'T12:00:00').getDate())}
            >
              <Text style={styles.planBtnText}>+ Plan</Text>
            </TouchableOpacity>
          </View>

          {selectedActivities.length === 0 && selectedPlans.length === 0 && (
            <Text style={styles.emptyDay}>No activities on this day.</Text>
          )}

          {selectedActivities.map(act => (
            <View key={act.id} style={[styles.actRow, { borderLeftColor: actColors[act.actType] }]}>
              <Text style={[styles.actType, { color: actColors[act.actType] }]}>
                {act.actType.charAt(0).toUpperCase() + act.actType.slice(1)}
              </Text>
              <Text style={styles.actDetail}>
                {['dist','dur'].map(k => (act as any)[k] > 0
                  ? k === 'dist' ? `${(act as any)[k]} mi` : `${(act as any)[k]} min`
                  : null).filter(Boolean).join(' · ')}
              </Text>
              {(act as any).notes ? (
                <Text style={styles.actNotes} numberOfLines={1}>{(act as any).notes}</Text>
              ) : null}
            </View>
          ))}

          {selectedPlans.map(plan => (
            <View key={plan.id} style={styles.planRow}>
              <View style={styles.planRowLeft}>
                <Text style={styles.planLabel}>📋 Planned: {plan.subtype || plan.actType}</Text>
                {plan.dist ? <Text style={styles.planDetail}>{plan.dist} mi</Text> : null}
                {plan.dur  ? <Text style={styles.planDetail}>{plan.dur} min</Text> : null}
                {plan.notes ? <Text style={styles.planNotes} numberOfLines={1}>{plan.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
                <Text style={styles.deletePlan}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {planModalDate && (
        <PlanWorkoutModal
          date={planModalDate}
          user={user}
          db={db}
          onSaved={onSaved}
          onClose={() => setPlanModalDate(null)}
        />
      )}
    </View>
  );
}

// ─── Plan Workout Modal ───────────────────────────────────────────────────────

function PlanWorkoutModal({ date, user, db, onSaved, onClose }: {
  date: string; user: User; db: TrainingDB;
  onSaved: (u: TrainingDB) => void; onClose: () => void;
}) {
  const [actType, setActType] = useState<string>('run');
  const [subtype, setSubtype] = useState('easy');
  const [dist, setDist] = useState('');
  const [dur,  setDur]  = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accentColor = actType === 'run' ? colors.pink
    : actType === 'cross' ? colors.blue
    : actType === 'strength' ? colors.amber
    : colors.green;

  const changeType = (t: string) => {
    setActType(t);
    setSubtype(SUBTYPES[t][0]);
  };

  const handleSave = async () => {
    setSaving(true);
    const plan: PlannedWorkout = {
      id: uid(), date, actType, subtype,
      dist: Number(dist) || 0,
      dur:  Number(dur)  || 0,
      notes,
      planned: true,
    };
    const newDB = { ...db, plans: [...db.plans, plan] };
    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const dateStr = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Plan Workout</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.planDate}>{dateStr}</Text>

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {ACT_TYPES.map(t => {
              const c = actColors[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, actType === t && { backgroundColor: c, borderColor: c }]}
                  onPress={() => changeType(t)}
                >
                  <Text style={[styles.typeBtnText, actType === t && { color: '#fff' }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Subtype</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(SUBTYPES[actType] ?? []).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, subtype === s && { borderColor: accentColor }]}
                onPress={() => setSubtype(s)}
              >
                <Text style={[styles.chipText, subtype === s && { color: accentColor }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Distance (miles)</Text>
          <TextInput style={styles.input} value={dist} onChangeText={setDist}
            keyboardType="decimal-pad" placeholderTextColor={colors.muted2} placeholder="0.0" />

          <Text style={styles.fieldLabel}>Duration (minutes)</Text>
          <TextInput style={styles.input} value={dur} onChangeText={setDur}
            keyboardType="decimal-pad" placeholderTextColor={colors.muted2} placeholder="60" />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={notes} onChangeText={setNotes}
            multiline numberOfLines={3} placeholderTextColor={colors.muted2}
            placeholder="Workout description…" />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Plan'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn:    { padding: 8 },
  navArrow:  { fontSize: 24, color: colors.text, fontWeight: '300' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },

  dayRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dayHeader: {
    flex: 1, textAlign: 'center', fontSize: 11,
    color: colors.muted, fontWeight: '600', paddingVertical: 6,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.285%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: colors.border,
  },
  cellSelected: { backgroundColor: colors.pink + '22' },
  cellToday:    { backgroundColor: colors.surface2 },
  dayNum:        { fontSize: 13, color: colors.text },
  dayNumSelected: { color: colors.pink, fontWeight: '800' },
  dayNumToday:    { fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:     { width: 4, height: 4, borderRadius: 2 },

  dayPanel: { flex: 1 },
  dayPanelContent: { padding: 16 },
  dayPanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  dayPanelTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  planBtn:       { backgroundColor: colors.pink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  planBtnText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyDay:      { color: colors.muted, fontSize: 13, marginTop: 8 },

  actRow: {
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 8, padding: 10,
  },
  actType:   { fontSize: 13, fontWeight: '700' },
  actDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actNotes:  { fontSize: 11, color: colors.muted2, marginTop: 2, fontStyle: 'italic' },

  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface2, borderRadius: 8, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  planRowLeft: { flex: 1 },
  planLabel:   { fontSize: 13, color: colors.muted, fontWeight: '600' },
  planDetail:  { fontSize: 12, color: colors.muted, marginTop: 2 },
  planNotes:   { fontSize: 11, color: colors.muted2, marginTop: 2, fontStyle: 'italic' },
  deletePlan:  { color: colors.red, fontSize: 16, paddingLeft: 12 },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle:  { fontSize: 16, fontWeight: '700', color: colors.text },
  cancelBtn:   { fontSize: 15, color: colors.muted, width: 60 },
  modalContent: { padding: 20, paddingBottom: 60 },
  planDate:    { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 20 },

  fieldLabel: {
    fontSize: 12, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },

  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  saveBtn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
