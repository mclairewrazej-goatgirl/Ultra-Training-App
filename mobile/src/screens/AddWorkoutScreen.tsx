import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry, NutritionItem } from '../types';
import { colors } from '../theme';

type ActType = 'run' | 'cross' | 'strength' | 'recovery';

const RUN_TYPES    = ['Easy', 'Workout', 'Long Run', 'Recovery', 'Hike'];
const TERRAIN_OPT  = ['trail','road','treadmill'];
const BIKE_TYPES   = ['Gravel','Road','Mountain','Fat Bike'];
const RIDE_TYPES   = ['easy','long','workout'];
const CROSS_RUN    = ['Skate Ski','Classic Ski','Backcountry Ski','Alpine Ski','Outdoor Climb','Alpine Climb','Gravel Bike','Road Bike','Mountain Bike','Fat Bike'];
const CROSS_CYCLE  = ['Run','Hike','Skate Ski','Classic Ski','Backcountry Ski','Alpine Ski','Outdoor Climb','Alpine Climb'];
const STRENGTH_SUB = ['Indoor Climbing','Gym Strength'];
const RECOVERY_SUB = ['Yoga/Stretch','Massage','Physio'];
const RPE_OPTS     = ['1','2','3','4','5','6','7','8','9','10'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updatedDB: TrainingDB) => void;
  initialType?: ActType;
  onClose?: () => void;
}

export default function AddWorkoutScreen({ user, db, onSaved, initialType, onClose }: Props) {
  const isCycling = db.primarySport === 'cycling';
  const crossTypes = isCycling ? CROSS_CYCLE : CROSS_RUN;

  const [actType,  setActType]  = useState<ActType>(initialType ?? 'run');
  const [date,     setDate]     = useState(todayISO());
  const [dist,     setDist]     = useState('');
  const [dur,      setDur]      = useState('');
  const [vert,     setVert]     = useState('');
  const [hr,       setHr]       = useState('');
  const [notes,    setNotes]    = useState('');
  const [subtype,  setSubtype]  = useState(() => {
    const t = initialType ?? 'run';
    if (t === 'cross')    return crossTypes[0];
    if (t === 'strength') return STRENGTH_SUB[0];
    if (t === 'recovery') return RECOVERY_SUB[0];
    return 'Easy';
  });
  const [terrain,  setTerrain]  = useState('trail');
  const [bikeType, setBikeType] = useState('Gravel');
  const [rpe,      setRpe]      = useState('5');
  const [showNutr, setShowNutr] = useState(false);
  const [nutrQty,  setNutrQty]  = useState<Record<string, number>>({});
  const [saving,   setSaving]   = useState(false);

  const changeActType = (t: ActType) => {
    setActType(t);
    setSubtype(
      t === 'run'      ? 'Easy' :
      t === 'cross'    ? crossTypes[0] :
      t === 'strength' ? STRENGTH_SUB[0] :
                         RECOVERY_SUB[0]
    );
    setShowNutr(false);
    setNutrQty({});
  };

  const subtypeList = () => {
    if (actType === 'run')      return isCycling ? RIDE_TYPES : RUN_TYPES;
    if (actType === 'cross')    return crossTypes;
    if (actType === 'strength') return STRENGTH_SUB;
    return RECOVERY_SUB;
  };

  const adjustQty = (id: string, delta: number) => {
    setNutrQty(prev => {
      const n = Math.max(0, (prev[id] ?? 0) + delta);
      if (n === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: n };
    });
  };

  const handleSave = async () => {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format');
      return;
    }
    setSaving(true);
    const newDB: TrainingDB = { ...db };

    if (actType === 'run') {
      const nutritionEntries = showNutr
        ? Object.entries(nutrQty).map(([itemId, servings]) => ({ itemId, servings }))
        : [];
      const entry: RunEntry = {
        id: uid(), date, actType: 'run',
        runType: subtype,
        terrain: isCycling ? '' : terrain,
        bikeType: isCycling ? bikeType : undefined,
        dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, hr: Number(hr) || 0,
        notes, workoutDetails: '', nutritionEntries,
      };
      newDB.runs = [...db.runs, entry];
    } else if (actType === 'cross') {
      const entry: CrossEntry = {
        id: uid(), date, actType: 'cross',
        subtype, dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, rpe: Number(rpe) || 0, notes,
      };
      newDB.crosses = [...db.crosses, entry];
    } else if (actType === 'strength') {
      const entry: StrengthEntry = {
        id: uid(), date, actType: 'strength',
        subtype, dur: Number(dur) || 0, notes,
      };
      newDB.strengths = [...db.strengths, entry];
    } else {
      const entry: RecoveryEntry = {
        id: uid(), date, actType: 'recovery',
        subtype, dur: Number(dur) || 0, notes,
      };
      newDB.recoveries = [...db.recoveries, entry];
    }

    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      if (onClose) {
        onClose();
      } else {
        setDist(''); setDur(''); setVert(''); setHr(''); setNotes('');
        setDate(todayISO()); setActType('run'); setSubtype('Easy');
        setTerrain('trail'); setBikeType('Gravel'); setRpe('5');
        setShowNutr(false); setNutrQty({});
        Alert.alert('Saved!', 'Workout logged successfully');
      }
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
    <View style={styles.container}>
      {onClose && (
        <View style={styles.modalHeader}>
          <View style={{ width: 44 }} />
          <Text style={styles.modalTitle}>Log an Activity</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>

      {/* Activity type */}
      <Text style={styles.label}>TYPE</Text>
      <View style={styles.typeRow}>
        {(['run','cross','strength','recovery'] as ActType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, actType === t && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => changeActType(t)}
          >
            <Text style={[styles.typeBtnText, actType === t && styles.typeBtnActive]}>
              {t === 'run' ? (isCycling ? 'Ride' : 'Run')
                : t === 'cross' ? 'Cross'
                : t === 'strength' ? 'Strength' : 'Recovery'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subtype chips */}
      <Text style={styles.label}>
        {actType === 'run' ? (isCycling ? 'RIDE TYPE' : 'RUN TYPE') : 'ACTIVITY'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {subtypeList().map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, subtype === s && { borderColor: accentColor }]}
            onPress={() => setSubtype(s)}
          >
            <Text style={[styles.chipText, subtype === s && { color: accentColor }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Terrain — runs only (not cycling) */}
      {actType === 'run' && !isCycling && (
        <>
          <Text style={styles.label}>TERRAIN</Text>
          <View style={styles.chipRow}>
            {TERRAIN_OPT.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, terrain === t && { borderColor: accentColor }]}
                onPress={() => setTerrain(t)}
              >
                <Text style={[styles.chipText, terrain === t && { color: accentColor }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Bike type — cycling rides */}
      {actType === 'run' && isCycling && (
        <>
          <Text style={styles.label}>BIKE TYPE</Text>
          <View style={styles.chipRow}>
            {BIKE_TYPES.map(b => (
              <TouchableOpacity
                key={b}
                style={[styles.chip, bikeType === b && { borderColor: accentColor }]}
                onPress={() => setBikeType(b)}
              >
                <Text style={[styles.chipText, bikeType === b && { color: accentColor }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Date */}
      <Text style={styles.label}>DATE</Text>
      <TextInput
        style={styles.input} value={date} onChangeText={setDate}
        placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted2}
      />

      {/* Distance */}
      {(actType === 'run' || actType === 'cross') && (
        <>
          <Text style={styles.label}>DISTANCE (KM)</Text>
          <TextInput
            style={styles.input} value={dist} onChangeText={setDist}
            keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.muted2}
          />
        </>
      )}

      {/* Duration */}
      <Text style={styles.label}>DURATION (MIN)</Text>
      <TextInput
        style={styles.input} value={dur} onChangeText={setDur}
        keyboardType="decimal-pad" placeholder="60" placeholderTextColor={colors.muted2}
      />

      {/* Elevation */}
      {(actType === 'run' || actType === 'cross') && (
        <>
          <Text style={styles.label}>ELEVATION GAIN (M)</Text>
          <TextInput
            style={styles.input} value={vert} onChangeText={setVert}
            keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2}
          />
        </>
      )}

      {/* HR — runs only */}
      {actType === 'run' && (
        <>
          <Text style={styles.label}>AVG HEART RATE (BPM)</Text>
          <TextInput
            style={styles.input} value={hr} onChangeText={setHr}
            keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2}
          />
        </>
      )}

      {/* RPE — cross only */}
      {actType === 'cross' && (
        <>
          <Text style={styles.label}>RPE (1–10)</Text>
          <View style={styles.rpeRow}>
            {RPE_OPTS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.rpeChip, rpe === r && { backgroundColor: accentColor, borderColor: accentColor }]}
                onPress={() => setRpe(r)}
              >
                <Text style={[styles.rpeChipText, rpe === r && { color: '#fff' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Notes */}
      <Text style={styles.label}>NOTES</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]} value={notes} onChangeText={setNotes}
        placeholder="How did it feel?" placeholderTextColor={colors.muted2}
        multiline numberOfLines={3} textAlignVertical="top"
      />

      {/* Add nutrition toggle — runs only, if library has items */}
      {actType === 'run' && db.nutrition.length > 0 && (
        <TouchableOpacity style={styles.nutrToggle} onPress={() => setShowNutr(v => !v)}>
          <View style={[styles.checkbox, showNutr && { backgroundColor: colors.pink, borderColor: colors.pink }]}>
            {showNutr && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.nutrToggleText}>Add nutrition?</Text>
        </TouchableOpacity>
      )}

      {showNutr && actType === 'run' && (
        <View style={styles.nutrSection}>
          {(db.nutrition as NutritionItem[]).map(item => {
            const qty = nutrQty[item.id] ?? 0;
            return (
              <View key={item.id} style={styles.nutrRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nutrName}>{item.name}</Text>
                  <Text style={styles.nutrUnit}>per {item.servingUnit || 'serving'}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item.id, -1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyVal}>{qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(item.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Workout'}</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 20, paddingBottom: 60 },
  heading:   { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },

  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  closeBtn:   { width: 44, alignItems: 'flex-end' },
  closeBtnText: { fontSize: 22, color: colors.muted, fontWeight: '300' },

  label: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  typeBtnText:  { fontSize: 12, fontWeight: '700', color: colors.muted },
  typeBtnActive: { color: '#fff' },

  chipScroll: { marginBottom: 4 },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  rpeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rpeChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, minWidth: 34, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  rpeChipText: { fontSize: 13, color: colors.muted, fontWeight: '700' },

  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  nutrToggle:     { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkmark:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  nutrToggleText: { fontSize: 14, color: colors.text, fontWeight: '600' },

  nutrSection: {
    marginTop: 10, backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  nutrRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  nutrName: { fontSize: 13, fontWeight: '600', color: colors.text },
  nutrUnit: { fontSize: 11, color: colors.muted, marginTop: 1 },
  qtyRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: colors.text, fontWeight: '700', lineHeight: 22 },
  qtyVal:   { fontSize: 15, color: colors.text, fontWeight: '700', minWidth: 24, textAlign: 'center' },

  saveBtn:     { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
