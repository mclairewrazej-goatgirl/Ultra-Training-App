import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, Alert, Dimensions,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, ActivityEntry, PlannedWorkout } from '../types';
import { colors, actColors } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const CELL_W   = SCREEN_W / 7;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PLAN_TYPES = ['Run','Cross-training','Strength','Recovery','Race'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function todayISO() {
  const t = new Date();
  return toISO(t.getFullYear(), t.getMonth(), t.getDate());
}

function planTypeColor(type: string) {
  if (type === 'Run')            return colors.pink;
  if (type === 'Cross-training') return colors.blue;
  if (type === 'Strength')       return colors.amber;
  if (type === 'Recovery')       return colors.green;
  return colors.muted;
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
  const [selectedDate,   setSelectedDate]   = useState<string>(todayISO());
  const [planModalDate,  setPlanModalDate]  = useState<string | null>(null);
  const [completingPlan, setCompletingPlan] = useState<PlannedWorkout | null>(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

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
    db.plans.forEach(p      => add(p.date, p.completed ? colors.muted2 : planTypeColor(p.type)));
    return map;
  }, [db]);

  const selectedActivities: ActivityEntry[] = useMemo(() => ([
    ...db.runs.filter(r => r.date === selectedDate),
    ...db.crosses.filter(r => r.date === selectedDate),
    ...db.strengths.filter(r => r.date === selectedDate),
    ...db.recoveries.filter(r => r.date === selectedDate),
  ]), [selectedDate, db]);

  const selectedPlans: PlannedWorkout[] = useMemo(() => (
    db.plans.filter(p => p.date === selectedDate)
  ), [selectedDate, db]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = todayISO();

  const saveDB = async (newDB: TrainingDB) => {
    await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
    onSaved(newDB);
  };

  const handleDeletePlan = (planId: string) => {
    Alert.alert('Delete plan', 'Remove this planned workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await saveDB({ ...db, plans: db.plans.filter(p => p.id !== planId) }); }
        catch (err: any) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  const selectedDateLabel = new Date(selectedDate+'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* ── Calendar grid (fixed height, no flex) ─── */}
      <View>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayRow}>
          {DAYS.map(d => <Text key={d} style={styles.dayHeader}>{d}</Text>)}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e-${i}`} style={styles.cell} />;
            const iso  = toISO(year, month, day);
            const dots = dotMap[iso] ?? [];
            const isToday    = iso === todayStr;
            const isSelected = iso === selectedDate;
            return (
              <TouchableOpacity
                key={iso}
                style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                onPress={() => setSelectedDate(iso)}
              >
                <Text style={[
                  styles.dayNum,
                  isSelected && styles.dayNumSelected,
                  isToday && !isSelected && styles.dayNumToday,
                ]}>
                  {day}
                </Text>
                <View style={styles.dotsRow}>
                  {dots.slice(0,3).map((c, di) => <View key={di} style={[styles.dot, { backgroundColor: c }]} />)}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Day panel (always visible, fills remaining space) ─── */}
      <ScrollView style={styles.dayPanel} contentContainerStyle={styles.dayPanelContent}>
        <View style={styles.dayPanelHeader}>
          <Text style={styles.dayPanelTitle}>{selectedDateLabel}</Text>
          <TouchableOpacity style={styles.planBtn} onPress={() => setPlanModalDate(selectedDate)}>
            <Text style={styles.planBtnText}>+ Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Logged activities */}
        {selectedActivities.length > 0 && (
          <Text style={styles.sectionLabel}>LOGGED</Text>
        )}
        {selectedActivities.map(act => {
          const dist = Number((act as any).dist) > 0 ? `${(act as any).dist} km` : null;
          const dur  = Number((act as any).dur)  > 0 ? `${(act as any).dur} min` : null;
          const detail = [dist, dur].filter(Boolean).join(' · ');
          return (
            <View key={act.id} style={[styles.actRow, { borderLeftColor: actColors[act.actType] }]}>
              <Text style={[styles.actType, { color: actColors[act.actType] }]}>
                {act.actType === 'run'
                  ? ((act as any).runType
                      ? (act as any).runType.charAt(0).toUpperCase() + (act as any).runType.slice(1) + ' Run'
                      : 'Run')
                  : (act as any).subtype || act.actType.charAt(0).toUpperCase() + act.actType.slice(1)}
              </Text>
              {detail ? <Text style={styles.actDetail}>{detail}</Text> : null}
              {(act as any).notes ? <Text style={styles.actNotes} numberOfLines={1}>{(act as any).notes}</Text> : null}
            </View>
          );
        })}

        {/* Planned workouts */}
        <Text style={styles.sectionLabel}>PLANNED</Text>

        {selectedPlans.length === 0 && (
          <Text style={styles.emptyPlans}>No planned workouts. Tap "+ Plan" to add one.</Text>
        )}

        {selectedPlans.map(plan => (
          <View key={plan.id} style={[styles.planRow, plan.completed && styles.planRowDone]}>
            <View style={styles.planRowLeft}>
              <View style={styles.planTitleRow}>
                <View style={[styles.planTypeDot, { backgroundColor: planTypeColor(plan.type) }]} />
                <Text style={styles.planType}>{plan.type}</Text>
                {plan.completed && <Text style={styles.completedBadge}>✓ Done</Text>}
              </View>
              {plan.desc ? <Text style={styles.planDesc}>{plan.desc}</Text> : null}
              <Text style={styles.planDetail}>
                {[plan.dist ? `${plan.dist} km` : null, plan.dur ? `${plan.dur} min` : null]
                  .filter(Boolean).join(' · ')}
              </Text>
              {plan.notes ? <Text style={styles.planNotes} numberOfLines={1}>{plan.notes}</Text> : null}
            </View>
            <View style={styles.planActions}>
              {!plan.completed && (
                <TouchableOpacity style={styles.doneBtn} onPress={() => setCompletingPlan(plan)}>
                  <Text style={styles.doneBtnText}>✓</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
                <Text style={styles.deletePlan}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {planModalDate && (
        <PlanWorkoutModal
          date={planModalDate}
          user={user}
          db={db}
          onSaved={onSaved}
          onClose={() => setPlanModalDate(null)}
        />
      )}

      {completingPlan && (
        <MarkDoneModal
          plan={completingPlan}
          user={user}
          db={db}
          onSaved={onSaved}
          onClose={() => setCompletingPlan(null)}
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
  const [type,  setType]  = useState('Run');
  const [desc,  setDesc]  = useState('');
  const [dist,  setDist]  = useState('');
  const [dur,   setDur]   = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accentColor = planTypeColor(type);
  const dateStr = new Date(date+'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleSave = async () => {
    setSaving(true);
    const plan: PlannedWorkout = {
      id: uid(), date, type, desc,
      dist: Number(dist) || 0,
      dur:  Number(dur)  || 0,
      notes, planned: true,
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

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Plan Workout</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.planDateLabel}>{dateStr}</Text>

          <Text style={styles.fieldLabel}>TYPE</Text>
          <View style={styles.typeRow}>
            {PLAN_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, type === t && { borderColor: planTypeColor(t), backgroundColor: planTypeColor(t)+'22' }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeChipText, type === t && { color: planTypeColor(t) }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput style={styles.input} value={desc} onChangeText={setDesc}
            placeholder="e.g. 12km easy + strides" placeholderTextColor={colors.muted2} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TARGET DISTANCE (KM)</Text>
              <TextInput style={styles.input} value={dist} onChangeText={setDist}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TARGET DURATION (MIN)</Text>
              <TextInput style={styles.input} value={dur} onChangeText={setDur}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={notes} onChangeText={setNotes}
            multiline numberOfLines={3} placeholderTextColor={colors.muted2}
            placeholder="Additional notes…" textAlignVertical="top" />

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

// ─── Mark as Done Modal ───────────────────────────────────────────────────────

function MarkDoneModal({ plan, user, db, onSaved, onClose }: {
  plan: PlannedWorkout; user: User; db: TrainingDB;
  onSaved: (u: TrainingDB) => void; onClose: () => void;
}) {
  const [actualDist, setActualDist] = useState(String(plan.dist || ''));
  const [actualDur,  setActualDur]  = useState(String(plan.dur  || ''));
  const [actualVert, setActualVert] = useState('');
  const [actualHr,   setActualHr]   = useState('');
  const [compNotes,  setCompNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  const accentColor = planTypeColor(plan.type);

  const handleSave = async () => {
    setSaving(true);
    const updated: PlannedWorkout = {
      ...plan,
      completed: true,
      actualDist: Number(actualDist) || 0,
      actualDur:  Number(actualDur)  || 0,
      actualVert: Number(actualVert) || 0,
      actualHr:   Number(actualHr)   || 0,
      completionNotes: compNotes,
    };
    const newDB = { ...db, plans: db.plans.map(p => p.id === plan.id ? updated : p) };
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

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Mark as Done</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={[styles.planSummary, { borderLeftColor: accentColor }]}>
            <Text style={[styles.planSummaryType, { color: accentColor }]}>{plan.type}</Text>
            {plan.desc ? <Text style={styles.planSummaryDesc}>{plan.desc}</Text> : null}
            <Text style={styles.planSummaryTarget}>
              Target: {[plan.dist ? `${plan.dist} km` : null, plan.dur ? `${plan.dur} min` : null].filter(Boolean).join(' · ') || 'No targets set'}
            </Text>
          </View>

          <Text style={styles.sectionHeading}>Actual Stats</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DISTANCE (KM)</Text>
              <TextInput style={styles.input} value={actualDist} onChangeText={setActualDist}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
              <TextInput style={styles.input} value={actualDur} onChangeText={setActualDur}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>ELEVATION GAIN (M)</Text>
              <TextInput style={styles.input} value={actualVert} onChangeText={setActualVert}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>AVG HEART RATE</Text>
              <TextInput style={styles.input} value={actualHr} onChangeText={setActualHr}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>COMPLETION NOTES</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={compNotes} onChangeText={setCompNotes}
            multiline numberOfLines={3} placeholder="How did it go?" placeholderTextColor={colors.muted2}
            textAlignVertical="top" />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : '✓ Mark as Done'}</Text>
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
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn:    { padding: 8 },
  navArrow:  { fontSize: 24, color: colors.text, fontWeight: '300' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },

  dayRow: {
    flexDirection: 'row', backgroundColor: colors.surface2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dayHeader: {
    width: CELL_W, textAlign: 'center', fontSize: 11,
    color: colors.muted, fontWeight: '600', paddingVertical: 5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.bg },
  cell: {
    width: CELL_W, height: CELL_W,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: colors.border,
  },
  cellSelected: { backgroundColor: colors.pink+'22' },
  cellToday:    { backgroundColor: colors.surface2 },
  dayNum:         { fontSize: 13, color: colors.text },
  dayNumSelected: { color: colors.pink, fontWeight: '800' },
  dayNumToday:    { fontWeight: '700', color: colors.blue },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:     { width: 4, height: 4, borderRadius: 2 },

  dayPanel:        { flex: 1, backgroundColor: colors.bg },
  dayPanelContent: { padding: 14, paddingBottom: 40 },
  dayPanelHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayPanelTitle:   { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  planBtn:         { backgroundColor: colors.pink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  planBtnText:     { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6, marginTop: 4,
  },
  emptyPlans: { fontSize: 12, color: colors.muted2, marginBottom: 8, fontStyle: 'italic' },

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
  planRowDone:    { opacity: 0.6 },
  planRowLeft:    { flex: 1 },
  planTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  planTypeDot:    { width: 8, height: 8, borderRadius: 4 },
  planType:       { fontSize: 13, fontWeight: '700', color: colors.text },
  completedBadge: { fontSize: 11, color: colors.green, fontWeight: '600' },
  planDesc:       { fontSize: 12, color: colors.text, marginBottom: 2 },
  planDetail:     { fontSize: 12, color: colors.muted },
  planNotes:      { fontSize: 11, color: colors.muted2, marginTop: 2, fontStyle: 'italic' },
  planActions:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  doneBtn:        { backgroundColor: colors.green, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  doneBtnText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  deletePlan:     { color: colors.red, fontSize: 16 },

  // Modal shared
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: colors.text },
  cancelBtn:     { fontSize: 15, color: colors.muted, width: 60 },
  modalContent:  { padding: 20, paddingBottom: 60 },
  planDateLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },

  fieldLabel: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  typeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface,
  },
  typeChipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  row: { flexDirection: 'row' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  inputMulti:   { minHeight: 80, textAlignVertical: 'top' },
  saveBtn:      { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText:  { fontSize: 16, fontWeight: '800', color: '#fff' },

  planSummary: {
    borderLeftWidth: 3, paddingLeft: 12, marginBottom: 20,
    backgroundColor: colors.surface, borderRadius: 8, padding: 12,
  },
  planSummaryType:   { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  planSummaryDesc:   { fontSize: 13, color: colors.text, marginBottom: 4 },
  planSummaryTarget: { fontSize: 12, color: colors.muted },
  sectionHeading:    { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 4 },
});
