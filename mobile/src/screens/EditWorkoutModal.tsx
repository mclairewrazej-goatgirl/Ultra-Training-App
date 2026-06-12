import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, ActivityEntry, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry } from '../types';
import { colors } from '../theme';

type ActType = 'run' | 'cross' | 'strength' | 'recovery';

const RUN_TYPES    = ['easy', 'long', 'tempo', 'interval', 'race', 'hike'];
const CROSS_TYPES  = ['Cycling', 'Swimming', 'Rowing', 'Yoga', 'Cross Train'];
const STRENGTH_SUB = ['Full Body', 'Upper Body', 'Lower Body', 'Core', 'PT'];
const RECOVERY_SUB = ['Rest Day', 'Easy Walk', 'Stretching', 'Foam Rolling', 'Sauna'];

function subtypeFor(act: ActivityEntry): string {
  if (act.actType === 'run') return (act as RunEntry).runType ?? 'easy';
  return (act as any).subtype ?? '';
}

interface Props {
  visible: boolean;
  entry: ActivityEntry | null;
  user: User;
  db: TrainingDB;
  onSaved: (updatedDB: TrainingDB) => void;
  onClose: () => void;
}

export default function EditWorkoutModal({ visible, entry, user, db, onSaved, onClose }: Props) {
  const [date,    setDate]    = useState('');
  const [dist,    setDist]    = useState('');
  const [dur,     setDur]     = useState('');
  const [vert,    setVert]    = useState('');
  const [hr,      setHr]      = useState('');
  const [notes,   setNotes]   = useState('');
  const [subtype, setSubtype] = useState('');
  const [saving,  setSaving]  = useState(false);

  // Populate fields whenever the entry changes
  React.useEffect(() => {
    if (!entry) return;
    setDate(entry.date);
    setSubtype(subtypeFor(entry));
    setNotes((entry as any).notes ?? '');
    setDist(String((entry as any).dist ?? ''));
    setDur(String((entry as any).dur ?? ''));
    setVert(String((entry as any).vert ?? ''));
    setHr(String((entry as any).hr ?? ''));
  }, [entry]);

  if (!entry) return null;

  const actType = entry.actType as ActType;
  const accentColor = actType === 'run' ? colors.pink
    : actType === 'cross' ? colors.blue
    : actType === 'strength' ? colors.amber
    : colors.green;

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
      const updated: RunEntry = {
        ...(entry as RunEntry),
        date, runType: subtype,
        dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, hr: Number(hr) || 0, notes,
      };
      newDB.runs = db.runs.map((r) => r.id === entry.id ? updated : r);
    } else if (actType === 'cross') {
      const updated: CrossEntry = {
        ...(entry as CrossEntry),
        date, subtype,
        dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, notes,
      };
      newDB.crosses = db.crosses.map((r) => r.id === entry.id ? updated : r);
    } else if (actType === 'strength') {
      const updated: StrengthEntry = {
        ...(entry as StrengthEntry),
        date, subtype, dur: Number(dur) || 0, notes,
      };
      newDB.strengths = db.strengths.map((r) => r.id === entry.id ? updated : r);
    } else {
      const updated: RecoveryEntry = {
        ...(entry as RecoveryEntry),
        date, subtype, dur: Number(dur) || 0, notes,
      };
      newDB.recoveries = db.recoveries.map((r) => r.id === entry.id ? updated : r);
    }

    try {
      const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
      await setDoc(docRef, JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete workout', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          const newDB: TrainingDB = {
            ...db,
            runs:       db.runs.filter((r) => r.id !== entry.id),
            crosses:    db.crosses.filter((r) => r.id !== entry.id),
            strengths:  db.strengths.filter((r) => r.id !== entry.id),
            recoveries: db.recoveries.filter((r) => r.id !== entry.id),
          };
          try {
            const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
            await setDoc(docRef, JSON.parse(JSON.stringify(newDB)));
            onSaved(newDB);
            onClose();
          } catch (err: any) {
            Alert.alert('Delete failed', err.message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.deleteBtn}>Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Activity type label */}
          <View style={[styles.typeBadge, { backgroundColor: accentColor + '22', borderColor: accentColor }]}>
            <Text style={[styles.typeBadgeText, { color: accentColor }]}>
              {actType.charAt(0).toUpperCase() + actType.slice(1)}
            </Text>
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

          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} />

          {(actType === 'run' || actType === 'cross') && (
            <Field label="Distance (miles)" value={dist} onChange={setDist} keyboard="decimal-pad" />
          )}
          <Field label="Duration (minutes)" value={dur} onChange={setDur} keyboard="decimal-pad" />
          {(actType === 'run' || actType === 'cross') && (
            <Field label="Elevation Gain (ft)" value={vert} onChange={setVert} keyboard="decimal-pad" />
          )}
          {actType === 'run' && (
            <Field label="Avg Heart Rate (bpm)" value={hr} onChange={setHr} keyboard="decimal-pad" />
          )}
          <Field label="Notes" value={notes} onChange={setNotes} multiline />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, keyboard, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboard?: 'decimal-pad'; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.muted2}
        keyboardType={keyboard ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cancelBtn: { fontSize: 15, color: colors.muted },
  deleteBtn: { fontSize: 15, color: colors.red, fontWeight: '600' },

  content: { padding: 20, paddingBottom: 60 },

  typeBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16,
  },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },

  label: {
    fontSize: 12, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  subtypeScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  fieldGroup: {},
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  saveBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
