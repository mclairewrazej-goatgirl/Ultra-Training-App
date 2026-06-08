import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry } from '../types';
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
  const [actType, setActType]   = useState<ActType>('run');
  const [date, setDate]         = useState(todayISO());
  const [dist, setDist]         = useState('');
  const [dur, setDur]           = useState('');
  const [vert, setVert]         = useState('');
  const [hr, setHr]             = useState('');
  const [notes, setNotes]       = useState('');
  const [subtype, setSubtype]   = useState('easy');
  const [saving, setSaving]     = useState(false);

  // Reset subtype when act type changes
  const changeActType = (t: ActType) => {
    setActType(t);
    if (t === 'run')      setSubtype('easy');
    if (t === 'cross')    setSubtype('Cycling');
    if (t === 'strength') setSubtype('Full Body');
    if (t === 'recovery') setSubtype('Rest Day');
  };

  const subtypeOptions = () => {
    if (actType === 'run')      return RUN_TYPES;
    if (actType === 'cross')    return CROSS_TYPES;
    if (actType === 'strength') return STRENGTH_SUB;
    return RECOVERY_SUB;
  };

  const handleSave = async () => {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format, e.g. 2025-06-08');
      return;
    }
    setSaving(true);

    const newDB: TrainingDB = { ...db };

    if (actType === 'run') {
      const entry: RunEntry = {
        id: uid(), date, actType: 'run',
        runType: subtype, terrain: 'trail',
        dist: Number(dist) || 0,
        dur:  Number(dur)  || 0,
        vert: Number(vert) || 0,
        hr:   Number(hr)   || 0,
        notes,
        workoutDetails: '',
        nutritionEntries: [],
      };
      newDB.runs = [...db.runs, entry];
    } else if (actType === 'cross') {
      const entry: CrossEntry = {
        id: uid(), date, actType: 'cross',
        subtype,
        dist: Number(dist) || 0,
        dur:  Number(dur)  || 0,
        vert: Number(vert) || 0,
        rpe: 0,
        notes,
      };
      newDB.crosses = [...db.crosses, entry];
    } else if (actType === 'strength') {
      const entry: StrengthEntry = {
        id: uid(), date, actType: 'strength',
        subtype,
        dur: Number(dur) || 0,
        notes,
      };
      newDB.strengths = [...db.strengths, entry];
    } else {
      const entry: RecoveryEntry = {
        id: uid(), date, actType: 'recovery',
        subtype,
        dur: Number(dur) || 0,
        notes,
      };
      newDB.recoveries = [...db.recoveries, entry];
    }

    try {
      const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
      await setDoc(docRef, JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      // Reset form
      setDist(''); setDur(''); setVert(''); setHr(''); setNotes('');
      setDate(todayISO()); setActType('run'); setSubtype('easy');
      Alert.alert('Saved!', 'Workout logged successfully 🎉');
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
      <Text style={styles.label}>
        {actType === 'run' ? 'Run Type' : 'Subtype'}
      </Text>
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

      {/* Date */}
      <InputField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2025-06-08" />

      {/* Conditional fields */}
      {actType !== 'recovery' && actType !== 'strength' && (
        <InputField label="Distance (miles)" value={dist} onChangeText={setDist} placeholder="0.0" keyboardType="decimal-pad" />
      )}
      <InputField label="Duration (minutes)" value={dur} onChangeText={setDur} placeholder="60" keyboardType="decimal-pad" />
      {(actType === 'run' || actType === 'cross') && (
        <InputField label="Elevation Gain (ft)" value={vert} onChangeText={setVert} placeholder="0" keyboardType="decimal-pad" />
      )}
      {actType === 'run' && (
        <InputField label="Avg Heart Rate (bpm)" value={hr} onChangeText={setHr} placeholder="0" keyboardType="decimal-pad" />
      )}
      <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="How did it feel?" multiline />

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

  saveBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
