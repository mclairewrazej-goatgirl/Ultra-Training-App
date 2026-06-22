import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry, NutritionEntry } from '../types';
import { colors } from '../theme';

type ActType = 'run' | 'cross' | 'strength' | 'recovery';

const RUN_TYPES    = ['easy', 'long', 'tempo', 'interval', 'race', 'hike'];
const CROSS_TYPES  = ['Cycling', 'Swimming', 'Rowing', 'Yoga', 'Cross Train'];
const STRENGTH_SUB = ['Full Body', 'Upper Body', 'Lower Body', 'Core', 'PT'];
const RECOVERY_SUB = ['Rest Day', 'Easy Walk', 'Stretching', 'Foam Rolling', 'Sauna'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updatedDB: TrainingDB) => void;
}

export default function AddWorkoutScreen({ user, db, onSaved }: Props) {
  const [actType, setActType]       = useState<ActType>('run');
  const [date, setDate]             = useState(todayISO());
  const [dist, setDist]             = useState('');
  const [movingTime, setMovingTime] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');
  const [useMovingTime, setUseMovingTime] = useState(false);
  const [vert, setVert]             = useState('');
  const [hr, setHr]                 = useState('');
  const [notes, setNotes]           = useState('');
  const [subtype, setSubtype]       = useState('easy');
  const [saving, setSaving]         = useState(false);

  // Nutrition
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionEntries, setNutritionEntries] = useState<{ nutritionId: string; qty: string }[]>([]);

  const changeActType = (t: ActType) => {
    setActType(t);
    if (t === 'run')      setSubtype('easy');
    if (t === 'cross')    setSubtype('Cycling');
    if (t === 'strength') setSubtype('Full Body');
    if (t === 'recovery') setSubtype('Rest Day');
    setMovingTime(''); setElapsedTime(''); setUseMovingTime(false);
    setShowNutrition(false); setNutritionEntries([]);
  };

  const subtypeOptions = () => {
    if (actType === 'run')      return RUN_TYPES;
    if (actType === 'cross')    return CROSS_TYPES;
    if (actType === 'strength') return STRENGTH_SUB;
    return RECOVERY_SUB;
  };

  // Effective duration for saving to dur field
  const effectiveDurMins = (): number => {
    if (useMovingTime && Number(movingTime) > 0) return Number(movingTime);
    if (!useMovingTime && Number(elapsedTime) > 0) return Number(elapsedTime);
    return Number(elapsedTime) || Number(movingTime) || 0;
  };

  // Nutrition calculation
  const nutritionCalc = () => {
    const durMins = effectiveDurMins();
    if (!durMins || nutritionEntries.length === 0) return null;
    const hrs = durMins / 60;
    let totalCarbs = 0, totalHydration = 0, totalSodium = 0;
    let valid = false;
    nutritionEntries.forEach((e: { nutritionId: string; qty: string }) => {
      const item = db.nutrition.find((n) => n.id === e.nutritionId);
      if (item && Number(e.qty) > 0) {
        const qty = Number(e.qty);
        totalCarbs += (item.carbsPerServing || 0) * qty;
        totalHydration += (item.hydrationPerServing || 0) * qty;
        totalSodium += (item.sodiumPerServing || 0) * qty;
        valid = true;
      }
    });
    if (!valid) return null;
    return {
      carbsHr: (totalCarbs / hrs).toFixed(1),
      mlHr: (totalHydration / hrs).toFixed(0),
      sodiumHr: (totalSodium / hrs).toFixed(0),
    };
  };

  const addNutritionRow = () => {
    if (!db.nutrition.length) {
      Alert.alert('No nutrition items', 'Add nutrition items in the web app first.');
      return;
    }
    setNutritionEntries((prev: { nutritionId: string; qty: string }[]) => [...prev, { nutritionId: db.nutrition[0].id, qty: '1' }]);
  };

  const updateNutritionEntry = (index: number, field: 'nutritionId' | 'qty', value: string) => {
    setNutritionEntries((prev: { nutritionId: string; qty: string }[]) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeNutritionEntry = (index: number) => {
    setNutritionEntries((prev: { nutritionId: string; qty: string }[]) => prev.filter((_: { nutritionId: string; qty: string }, i: number) => i !== index));
  };

  const handleSave = async () => {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format, e.g. 2025-06-08');
      return;
    }
    setSaving(true);

    const newDB: TrainingDB = { ...db };
    const savedNutrition: NutritionEntry[] = nutritionEntries
      .filter((e) => e.nutritionId && Number(e.qty) > 0)
      .map((e) => ({ nutritionId: e.nutritionId, qty: Number(e.qty) }));

    const durMins = effectiveDurMins();

    if (actType === 'run') {
      const entry: RunEntry = {
        id: uid(), date, actType: 'run',
        runType: subtype, terrain: 'trail',
        dist: Number(dist) || 0,
        dur: durMins,
        movingTime: Number(movingTime) || 0,
        elapsedTime: Number(elapsedTime) || 0,
        useMovingTime,
        vert: Number(vert) || 0,
        hr: Number(hr) || 0,
        notes,
        workoutDetails: '',
        nutritionEntries: savedNutrition,
      };
      newDB.runs = [...db.runs, entry];
    } else if (actType === 'cross') {
      const entry: CrossEntry = {
        id: uid(), date, actType: 'cross',
        subtype,
        dist: Number(dist) || 0,
        dur: durMins,
        movingTime: Number(movingTime) || 0,
        elapsedTime: Number(elapsedTime) || 0,
        useMovingTime,
        vert: Number(vert) || 0,
        rpe: 0,
        notes,
        nutritionEntries: savedNutrition,
      };
      newDB.crosses = [...db.crosses, entry];
    } else if (actType === 'strength') {
      const entry: StrengthEntry = {
        id: uid(), date, actType: 'strength',
        subtype,
        dur: Number(elapsedTime) || Number(movingTime) || 0,
        notes,
      };
      newDB.strengths = [...db.strengths, entry];
    } else {
      const entry: RecoveryEntry = {
        id: uid(), date, actType: 'recovery',
        subtype,
        dur: Number(elapsedTime) || Number(movingTime) || 0,
        notes,
      };
      newDB.recoveries = [...db.recoveries, entry];
    }

    try {
      const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
      await setDoc(docRef, JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      setDist(''); setMovingTime(''); setElapsedTime(''); setVert(''); setHr(''); setNotes('');
      setDate(todayISO()); setActType('run'); setSubtype('easy');
      setUseMovingTime(false); setShowNutrition(false); setNutritionEntries([]);
      Alert.alert('Saved!', 'Workout logged successfully');
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const accentColor = actType === 'run' ? colors.pink
    : actType === 'cross' ? colors.blue
    : actType === 'strength' ? colors.amber
    : colors.green;

  const showTimeFields = actType === 'run' || actType === 'cross';
  const nutCalc = showNutrition ? nutritionCalc() : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Log a Workout</Text>

      {/* Activity type selector */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {(['run', 'cross', 'strength', 'recovery'] as ActType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, actType === t && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => changeActType(t)}
          >
            <Text style={[styles.typeBtnText, actType === t && styles.typeBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subtype */}
      <Text style={styles.label}>{actType === 'run' ? 'Run Type' : 'Subtype'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subtypeScroll}>
        {subtypeOptions().map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, subtype === s && { borderColor: accentColor }]}
            onPress={() => setSubtype(s)}
          >
            <Text style={[styles.chipText, subtype === s && { color: accentColor }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <InputField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2025-06-08" />

      {actType !== 'recovery' && actType !== 'strength' && (
        <InputField label="Distance (miles)" value={dist} onChangeText={setDist} placeholder="0.0" keyboardType="decimal-pad" />
      )}

      {/* Moving / elapsed time */}
      {showTimeFields && (
        <>
          <InputField label="Moving Time (minutes)" value={movingTime} onChangeText={setMovingTime} placeholder="60" keyboardType="decimal-pad" />
          <InputField label="Elapsed Time (minutes)" value={elapsedTime} onChangeText={setElapsedTime} placeholder="65" keyboardType="decimal-pad" />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Use moving time for dashboard</Text>
            <Switch
              value={useMovingTime}
              onValueChange={setUseMovingTime}
              trackColor={{ true: accentColor, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.switchHint}>
            {useMovingTime ? 'Moving time will count toward weekly totals' : 'Elapsed time will count toward weekly totals'}
          </Text>
        </>
      )}

      {(actType === 'strength' || actType === 'recovery') && (
        <InputField label="Duration (minutes)" value={elapsedTime} onChangeText={setElapsedTime} placeholder="60" keyboardType="decimal-pad" />
      )}

      {(actType === 'run' || actType === 'cross') && (
        <InputField label="Elevation Gain (ft)" value={vert} onChangeText={setVert} placeholder="0" keyboardType="decimal-pad" />
      )}
      {actType === 'run' && (
        <InputField label="Avg Heart Rate (bpm)" value={hr} onChangeText={setHr} placeholder="0" keyboardType="decimal-pad" />
      )}

      <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="How did it feel?" multiline />

      {/* Nutrition — only for run/cross */}
      {(actType === 'run' || actType === 'cross') && (
        <View style={styles.nutritionSection}>
          <View style={styles.nutritionHeader}>
            <Text style={styles.label}>Nutrition</Text>
            <Switch
              value={showNutrition}
              onValueChange={(v) => {
                setShowNutrition(v);
                if (!v) setNutritionEntries([]);
              }}
              trackColor={{ true: accentColor, false: colors.border }}
              thumbColor="#fff"
            />
          </View>

          {showNutrition && (
            <>
              {nutritionEntries.map((entry: { nutritionId: string; qty: string }, i: number) => {
                const item = db.nutrition.find((n) => n.id === entry.nutritionId);
                return (
                  <View key={i} style={styles.nutritionRow}>
                    {/* Item picker — cycle through available items */}
                    <TouchableOpacity
                      style={styles.nutritionPicker}
                      onPress={() => {
                        const idx = db.nutrition.findIndex((n) => n.id === entry.nutritionId);
                        const next = db.nutrition[(idx + 1) % db.nutrition.length];
                        updateNutritionEntry(i, 'nutritionId', next.id);
                      }}
                    >
                      <Text style={styles.nutritionPickerText} numberOfLines={1}>
                        {item?.name ?? 'Select item'}
                      </Text>
                      <Text style={styles.nutritionPickerHint}>tap to change</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.nutritionQty}
                      value={entry.qty}
                      onChangeText={(v) => updateNutritionEntry(i, 'qty', v)}
                      placeholder="Qty"
                      placeholderTextColor={colors.muted2}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity onPress={() => removeNutritionEntry(i)} style={styles.nutritionRemove}>
                      <Text style={styles.nutritionRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity style={[styles.addNutritionBtn, { borderColor: accentColor }]} onPress={addNutritionRow}>
                <Text style={[styles.addNutritionText, { color: accentColor }]}>+ Add Item</Text>
              </TouchableOpacity>

              {nutCalc && (
                <View style={styles.nutritionCalc}>
                  <NutriStat value={nutCalc.carbsHr} label="g carbs / hr" color={colors.amber} />
                  <NutriStat value={nutCalc.mlHr} label="mL / hr" color={colors.blue} />
                  <NutriStat value={nutCalc.sodiumHr} label="mg sodium / hr" color={colors.green} />
                </View>
              )}
              {showNutrition && nutritionEntries.length > 0 && !nutCalc && (
                <Text style={styles.nutritionHint}>
                  Enter {useMovingTime ? 'moving' : 'elapsed'} time above to see per-hour values
                </Text>
              )}
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: accentColor }, saving && styles.btnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Workout'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function NutriStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.nutriStat}>
      <Text style={[styles.nutriStatVal, { color }]}>{value}</Text>
      <Text style={styles.nutriStatLbl}>{label}</Text>
    </View>
  );
}

function InputField({
  label, value, onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'default';
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted2}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },

  label: { fontSize: 12, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  typeBtnTextActive: { color: '#fff' },

  subtypeScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  inputGroup: {},
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabel: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
  switchHint: { fontSize: 11, color: colors.muted, marginTop: 4, paddingHorizontal: 2 },

  nutritionSection: { marginTop: 4 },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  nutritionPicker: { flex: 1 },
  nutritionPickerText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  nutritionPickerHint: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  nutritionQty: {
    width: 52,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  nutritionRemove: { padding: 4 },
  nutritionRemoveText: { color: colors.muted2, fontSize: 14 },
  addNutritionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderStyle: 'dashed',
  },
  addNutritionText: { fontSize: 13, fontWeight: '600' },
  nutritionCalc: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  nutriStat: { flex: 1, alignItems: 'center' },
  nutriStatVal: { fontSize: 18, fontWeight: '800' },
  nutriStatLbl: { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
  nutritionHint: { fontSize: 11, color: colors.muted, marginBottom: 8 },

  saveBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
