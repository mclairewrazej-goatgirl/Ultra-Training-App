import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, ActivityEntry, PlannedWorkout, Race, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry } from '../types';
import { colors, actColors } from '../theme';

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

  // Text snippets shown inside calendar cells (plans first, then logged)
  const contentMap = useMemo(() => {
    const map: Record<string, { label: string; color: string; done?: boolean }[]> = {};
    const add = (date: string, item: { label: string; color: string; done?: boolean }) => {
      if (!map[date]) map[date] = [];
      map[date].push(item);
    };
    // Plans at top of cell
    db.plans.forEach(p => {
      const label = p.desc || p.type;
      add(p.date, { label, color: p.completed ? colors.muted2 : planTypeColor(p.type), done: p.completed });
    });
    db.races.forEach(r => add(r.date, { label: r.name || 'Race', color: colors.red }));
    // Logged activities below
    db.runs.forEach(r => {
      const dist = Number(r.dist) > 0 ? ` ${r.dist}k` : '';
      const type = r.runType ? (r.runType.charAt(0).toUpperCase() + r.runType.slice(1)) : 'Run';
      add(r.date, { label: `${type}${dist}`, color: colors.pink });
    });
    db.crosses.forEach(c => {
      const dist = Number(c.dist) > 0 ? ` ${c.dist}k` : '';
      add(c.date, { label: `${c.subtype}${dist}`, color: colors.blue });
    });
    db.strengths.forEach(s => add(s.date, { label: s.subtype || 'Strength', color: colors.amber }));
    db.recoveries.forEach(r => add(r.date, { label: (r as any).subtype || 'Recovery', color: colors.green }));
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

  const selectedRaces: Race[] = useMemo(() => (
    db.races.filter(r => r.date === selectedDate)
  ), [selectedDate, db]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Explicit week rows so each cell can use flex: 1 (no overflow)
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

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
      {/* ── Calendar grid ─── */}
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
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={`e-${wi}-${di}`} style={styles.cell} />;
                const iso     = toISO(year, month, day);
                const items   = contentMap[iso] ?? [];
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
                    {items.slice(0, 3).map((item, i) => (
                      <Text
                        key={i}
                        style={[styles.cellItem, { color: item.color }]}
                        numberOfLines={1}
                      >
                        {item.done ? '✓ ' : ''}{item.label}
                      </Text>
                    ))}
                    {items.length > 3 && (
                      <Text style={styles.cellMore}>+{items.length - 3}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* ── Day panel (scrollable, fills remaining space) ─── */}
      <ScrollView style={styles.dayPanel} contentContainerStyle={styles.dayPanelContent}>
        <View style={styles.dayPanelHeader}>
          <Text style={styles.dayPanelTitle}>{selectedDateLabel}</Text>
          <TouchableOpacity style={styles.planBtn} onPress={() => setPlanModalDate(selectedDate)}>
            <Text style={styles.planBtnText}>+ Plan</Text>
          </TouchableOpacity>
        </View>

        {/* ── Planned workouts first ── */}
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
              <TouchableOpacity
                style={[styles.doneBtn, plan.completed && styles.editDoneBtn]}
                onPress={() => setCompletingPlan(plan)}
              >
                <Text style={styles.doneBtnText}>{plan.completed ? '✎' : '✓'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
                <Text style={styles.deletePlan}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* ── Races ── */}
        {selectedRaces.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>RACES</Text>
            {selectedRaces.map(race => (
              <View key={race.id} style={styles.raceRow}>
                <Text style={styles.raceName}>🏁 {race.name}</Text>
                <Text style={styles.raceDetail}>
                  {[
                    race.raceType.charAt(0).toUpperCase() + race.raceType.slice(1),
                    Number(race.dist) > 0 ? `${race.dist} km` : null,
                    race.result ? `Finish: ${race.result}` : race.goal ? `Goal: ${race.goal}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
                {race.loc ? <Text style={styles.raceLoc}>📍 {race.loc}</Text> : null}
              </View>
            ))}
          </>
        )}

        {/* ── Logged activities ── */}
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
                  ? (() => {
                      const rt: string = (act as any).runType ?? '';
                      if (!rt) return 'Run';
                      const cap = rt.charAt(0).toUpperCase() + rt.slice(1);
                      return (cap.endsWith('Run') || cap === 'Hike') ? cap : cap + ' Run';
                    })()
                  : (act as any).subtype || act.actType.charAt(0).toUpperCase() + act.actType.slice(1)}
              </Text>
              {detail ? <Text style={styles.actDetail}>{detail}</Text> : null}
              {(act as any).notes ? <Text style={styles.actNotes} numberOfLines={1}>{(act as any).notes}</Text> : null}
            </View>
          );
        })}
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

export function PlanWorkoutModal({ date, user, db, onSaved, onClose }: {
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

const TERRAIN_OPTS   = ['Trail', 'Road', 'Treadmill'];
const CROSS_SUBTYPES = ['Hiking', 'Cycling', 'Swimming', 'Skate Ski', 'Classic Ski', 'Snowshoe', 'E-Bike', 'Other'];
const ACT_TYPES      = ['Run', 'Cross', 'Strength', 'Recovery'] as const;
type CompActType = typeof ACT_TYPES[number];

function initActType(planType: string): CompActType {
  if (planType === 'Run' || planType === 'Race') return 'Run';
  if (planType === 'Cross-training') return 'Cross';
  if (planType === 'Strength') return 'Strength';
  return 'Recovery';
}

function MarkDoneModal({ plan, user, db, onSaved, onClose }: {
  plan: PlannedWorkout; user: User; db: TrainingDB;
  onSaved: (u: TrainingDB) => void; onClose: () => void;
}) {
  const [actType,   setActType]   = useState<CompActType>(initActType(plan.type));
  const [terrain,   setTerrain]   = useState('Trail');
  const [crossSub,  setCrossSub]  = useState(CROSS_SUBTYPES[0]);
  const [actualDist, setActualDist] = useState(
    plan.actualDist != null ? String(plan.actualDist) : String(plan.dist || ''),
  );
  const [actualDur,  setActualDur]  = useState(
    plan.actualDur  != null ? String(plan.actualDur)  : String(plan.dur  || ''),
  );
  const [actualVert, setActualVert] = useState(String(plan.actualVert || ''));
  const [actualHr,   setActualHr]   = useState(String(plan.actualHr   || ''));
  const [compNotes,  setCompNotes]  = useState(plan.completionNotes   || '');
  const [showNutr,   setShowNutr]   = useState(false);
  const [nutrQty,    setNutrQty]    = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const accentColor = planTypeColor(plan.type);
  const isEditing   = !!plan.completed;
  const isRace      = plan.type === 'Race';

  const handleSave = async () => {
    setSaving(true);

    const entryId = plan.completedEntryId || uid();
    const dist    = Number(actualDist) || 0;
    const dur     = Number(actualDur)  || 0;
    const vert    = Number(actualVert) || 0;
    const hr      = Number(actualHr)   || 0;
    const nutritionEntries = showNutr
      ? Object.entries(nutrQty).filter(([, v]) => v > 0).map(([itemId, servings]) => ({ itemId, servings }))
      : [];

    let newRuns       = [...db.runs];
    let newCrosses    = [...db.crosses];
    let newStrengths  = [...db.strengths];
    let newRecoveries = [...db.recoveries];

    if (actType === 'Run') {
      const entry: RunEntry = {
        id: entryId, date: plan.date, actType: 'run',
        runType: isRace ? 'race' : 'easy',
        terrain: terrain.toLowerCase(),
        dist, dur, vert, hr, notes: compNotes, nutritionEntries,
      };
      newRuns = plan.completedEntryId
        ? newRuns.map(r => r.id === entryId ? entry : r)
        : [...newRuns, entry];
    } else if (actType === 'Cross') {
      const entry: CrossEntry = {
        id: entryId, date: plan.date, actType: 'cross',
        subtype: crossSub, dist, dur, vert, rpe: 0, notes: compNotes, nutritionEntries,
      };
      newCrosses = plan.completedEntryId
        ? newCrosses.map(c => c.id === entryId ? entry : c)
        : [...newCrosses, entry];
    } else if (actType === 'Strength') {
      const entry: StrengthEntry = {
        id: entryId, date: plan.date, actType: 'strength',
        subtype: 'Gym Strength', dur, notes: compNotes,
      };
      newStrengths = plan.completedEntryId
        ? newStrengths.map(s => s.id === entryId ? entry : s)
        : [...newStrengths, entry];
    } else {
      const entry: RecoveryEntry = {
        id: entryId, date: plan.date, actType: 'recovery',
        subtype: 'Stretch', dur, notes: compNotes,
      };
      newRecoveries = plan.completedEntryId
        ? newRecoveries.map(r => r.id === entryId ? entry : r)
        : [...newRecoveries, entry];
    }

    const updatedPlan: PlannedWorkout = {
      ...plan, completed: true, completedEntryId: entryId,
      actualDist: dist, actualDur: dur, actualVert: vert, actualHr: hr,
      completionNotes: compNotes,
    };

    const newDB: TrainingDB = {
      ...db,
      runs: newRuns, crosses: newCrosses,
      strengths: newStrengths, recoveries: newRecoveries,
      plans: db.plans.map(p => p.id === plan.id ? updatedPlan : p),
    };

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
          <Text style={styles.modalTitle}>{isEditing ? 'Edit Completion' : 'Mark as Done'}</Text>
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

          {/* Activity type — hidden for Race plans */}
          {!isRace && (
            <>
              <Text style={styles.fieldLabel}>ACTIVITY TYPE</Text>
              <View style={styles.chipRow}>
                {ACT_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, actType === t && { borderColor: accentColor, backgroundColor: accentColor + '22' }]}
                    onPress={() => setActType(t)}
                  >
                    <Text style={[styles.typeChipText, actType === t && { color: accentColor }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Terrain — runs only */}
          {actType === 'Run' && (
            <>
              <Text style={styles.fieldLabel}>TERRAIN</Text>
              <View style={styles.chipRow}>
                {TERRAIN_OPTS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, terrain === t && { borderColor: accentColor, backgroundColor: accentColor + '22' }]}
                    onPress={() => setTerrain(t)}
                  >
                    <Text style={[styles.typeChipText, terrain === t && { color: accentColor }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Cross-training subtype */}
          {actType === 'Cross' && (
            <>
              <Text style={styles.fieldLabel}>ACTIVITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {CROSS_SUBTYPES.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.typeChip, crossSub === s && { borderColor: colors.blue, backgroundColor: colors.blue + '22' }]}
                      onPress={() => setCrossSub(s)}
                    >
                      <Text style={[styles.typeChipText, crossSub === s && { color: colors.blue }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

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
              <Text style={styles.fieldLabel}>ELEV GAIN (M)</Text>
              <TextInput style={styles.input} value={actualVert} onChangeText={setActualVert}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>AVG HR (BPM)</Text>
              <TextInput style={styles.input} value={actualHr} onChangeText={setActualHr}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={compNotes} onChangeText={setCompNotes}
            multiline numberOfLines={3} placeholder="How did it go?" placeholderTextColor={colors.muted2}
            textAlignVertical="top" />

          {/* Nutrition toggle */}
          {(actType === 'Run' || actType === 'Cross') && db.nutrition.length > 0 && (
            <TouchableOpacity style={styles.nutrToggle} onPress={() => setShowNutr(v => !v)}>
              <View style={[styles.checkbox, showNutr && { backgroundColor: accentColor, borderColor: accentColor }]}>
                {showNutr && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.nutrToggleText}>Add nutrition?</Text>
            </TouchableOpacity>
          )}

          {showNutr && (actType === 'Run' || actType === 'Cross') && (
            <View style={styles.nutrSection}>
              {(db.nutrition as any[]).map((item: any) => {
                const qty = nutrQty[item.id] ?? 0;
                return (
                  <View key={item.id} style={styles.nutrRow}>
                    <Text style={styles.nutrName}>{item.name}</Text>
                    <View style={styles.nutrQtyRow}>
                      <TouchableOpacity onPress={() => setNutrQty(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 0.5) }))}
                        style={styles.nutrBtn}><Text style={styles.nutrBtnText}>−</Text></TouchableOpacity>
                      <Text style={styles.nutrQty}>{qty > 0 ? qty : '—'}</Text>
                      <TouchableOpacity onPress={() => setNutrQty(q => ({ ...q, [item.id]: (q[item.id] ?? 0) + 0.5 }))}
                        style={styles.nutrBtn}><Text style={styles.nutrBtnText}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : isEditing ? 'Update' : '✓ Mark as Done'}</Text>
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
    flex: 1, textAlign: 'center', fontSize: 10,
    color: colors.muted, fontWeight: '600', paddingVertical: 5,
  },

  grid:    { backgroundColor: colors.bg },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1, minHeight: 56,
    borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: colors.border,
    padding: 3,
  },
  cellSelected: { backgroundColor: colors.pink+'22' },
  cellToday:    { backgroundColor: colors.surface2 },
  dayNum:         { fontSize: 11, color: colors.text, fontWeight: '500', marginBottom: 1 },
  dayNumSelected: { color: colors.pink, fontWeight: '800' },
  dayNumToday:    { fontWeight: '700', color: colors.blue },
  cellItem: { fontSize: 8, lineHeight: 10, marginBottom: 1, fontWeight: '500' },
  cellMore: { fontSize: 7, color: colors.muted2 },

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

  raceRow: {
    borderLeftWidth: 3, borderLeftColor: colors.red, paddingLeft: 10, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 8, padding: 10,
  },
  raceName:   { fontSize: 13, fontWeight: '700', color: colors.text },
  raceDetail: { fontSize: 12, color: colors.red, marginTop: 2 },
  raceLoc:    { fontSize: 11, color: colors.muted2, marginTop: 2 },

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
  editDoneBtn:    { backgroundColor: colors.blue },
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  nutrToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  checkbox: {
    width: 20, height: 20, borderWidth: 2, borderColor: colors.border,
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { fontSize: 12, color: '#fff', fontWeight: '700' },
  nutrToggleText: { fontSize: 14, color: colors.text },
  nutrSection: { marginTop: 12 },
  nutrRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  nutrName: { fontSize: 14, color: colors.text, flex: 1 },
  nutrQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nutrBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  nutrBtnText: { fontSize: 18, color: colors.text, lineHeight: 22 },
  nutrQty: { fontSize: 15, color: colors.text, minWidth: 30, textAlign: 'center' },
});
