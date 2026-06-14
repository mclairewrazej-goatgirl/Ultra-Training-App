import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, ActivityEntry, RunEntry, CrossEntry, StrengthEntry, RecoveryEntry, NutritionItem } from '../types';
import { colors } from '../theme';

type ActType = 'run' | 'cross' | 'strength' | 'recovery';

const RUN_TYPES    = ['easy','long','tempo','interval','hike','race'];
const TERRAIN_OPT  = ['trail','road','treadmill'];
const BIKE_TYPES   = ['Gravel','Road','Mountain','Fat Bike'];
const RIDE_TYPES   = ['easy','long','workout'];
const CROSS_RUN    = ['Skate Ski','Classic Ski','Backcountry Ski','Alpine Ski','Outdoor Climb','Alpine Climb','Gravel Bike','Road Bike','Mountain Bike','Fat Bike'];
const CROSS_CYCLE  = ['Run','Hike','Skate Ski','Classic Ski','Backcountry Ski','Alpine Ski','Outdoor Climb','Alpine Climb'];
const STRENGTH_SUB = ['Indoor Climbing','Gym Strength'];
const RECOVERY_SUB = ['Yoga/Stretch','Massage','Physio'];
const RPE_OPTS     = ['1','2','3','4','5','6','7','8','9','10'];

interface Props {
  visible: boolean;
  entry: ActivityEntry | null;
  user: User;
  db: TrainingDB;
  onSaved: (updatedDB: TrainingDB) => void;
  onClose: () => void;
}

export default function EditWorkoutModal({ visible, entry, user, db, onSaved, onClose }: Props) {
  const [date,     setDate]     = useState('');
  const [dist,     setDist]     = useState('');
  const [dur,      setDur]      = useState('');
  const [vert,     setVert]     = useState('');
  const [hr,       setHr]       = useState('');
  const [notes,    setNotes]    = useState('');
  const [subtype,  setSubtype]  = useState('');
  const [terrain,  setTerrain]  = useState('trail');
  const [bikeType, setBikeType] = useState('Gravel');
  const [rpe,      setRpe]      = useState('5');
  const [showNutr, setShowNutr] = useState(false);
  const [nutrQty,  setNutrQty]  = useState<Record<string, number>>({});
  const [saving,   setSaving]   = useState(false);

  React.useEffect(() => {
    if (!entry) return;
    setDate(entry.date);
    setNotes((entry as any).notes ?? '');
    setDist(String((entry as any).dist  || ''));
    setDur(String((entry as any).dur    || ''));
    setVert(String((entry as any).vert  || ''));
    setHr(String((entry as any).hr      || ''));

    if (entry.actType === 'run') {
      const r = entry as RunEntry;
      setSubtype(r.runType ?? 'easy');
      setTerrain(r.terrain || 'trail');
      setBikeType(r.bikeType || 'Gravel');
      const nutrMap: Record<string, number> = {};
      ((r.nutritionEntries ?? []) as any[]).forEach((ne: any) => {
        if (ne.itemId && ne.servings > 0) nutrMap[ne.itemId] = ne.servings;
      });
      setNutrQty(nutrMap);
      setShowNutr(Object.keys(nutrMap).length > 0);
    } else {
      setSubtype((entry as any).subtype ?? '');
      setRpe(String((entry as any).rpe ?? '5'));
      if (entry.actType === 'cross') {
        const nutrMap: Record<string, number> = {};
        ((entry as CrossEntry).nutritionEntries ?? []).forEach((ne: any) => {
          if (ne.itemId && ne.servings > 0) nutrMap[ne.itemId] = ne.servings;
        });
        setNutrQty(nutrMap);
        setShowNutr(Object.keys(nutrMap).length > 0);
      }
    }
  }, [entry, visible]);

  if (!entry) return null;

  const actType   = entry.actType as ActType;
  const isCycling = db.primarySport === 'cycling';
  const isRide    = actType === 'run' && !!(entry as RunEntry).bikeType;
  const crossTypes = isCycling ? CROSS_CYCLE : CROSS_RUN;

  const accentColor = actType === 'run' ? colors.pink
    : actType === 'cross' ? colors.blue
    : actType === 'strength' ? colors.amber
    : colors.green;

  const subtypeOptions = () => {
    if (actType === 'run')      return isRide ? RIDE_TYPES : RUN_TYPES;
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
      const updated: RunEntry = {
        ...(entry as RunEntry),
        date, runType: subtype,
        terrain: isRide ? '' : terrain,
        bikeType: isRide ? bikeType : undefined,
        dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, hr: Number(hr) || 0,
        notes, nutritionEntries,
      };
      newDB.runs = db.runs.map(r => r.id === entry.id ? updated : r);
    } else if (actType === 'cross') {
      const nutritionEntries = showNutr
        ? Object.entries(nutrQty).map(([itemId, servings]) => ({ itemId, servings }))
        : [];
      const updated: CrossEntry = {
        ...(entry as CrossEntry),
        date, subtype,
        dist: Number(dist) || 0, dur: Number(dur) || 0,
        vert: Number(vert) || 0, rpe: Number(rpe) || 0, notes, nutritionEntries,
      };
      newDB.crosses = db.crosses.map(r => r.id === entry.id ? updated : r);
    } else if (actType === 'strength') {
      const updated: StrengthEntry = {
        ...(entry as StrengthEntry),
        date, subtype, dur: Number(dur) || 0, notes,
      };
      newDB.strengths = db.strengths.map(r => r.id === entry.id ? updated : r);
    } else {
      const updated: RecoveryEntry = {
        ...(entry as RecoveryEntry),
        date, subtype, dur: Number(dur) || 0, notes,
      };
      newDB.recoveries = db.recoveries.map(r => r.id === entry.id ? updated : r);
    }

    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      onClose();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete workout', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setSaving(true);
        const newDB: TrainingDB = {
          ...db,
          runs:       db.runs.filter(r => r.id !== entry.id),
          crosses:    db.crosses.filter(r => r.id !== entry.id),
          strengths:  db.strengths.filter(r => r.id !== entry.id),
          recoveries: db.recoveries.filter(r => r.id !== entry.id),
        };
        try {
          await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
          onSaved(newDB);
          onClose();
        } catch (err: any) {
          Alert.alert('Delete failed', err.message);
        } finally {
          setSaving(false);
        }
      }},
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <TouchableOpacity onPress={handleDelete}><Text style={styles.deleteBtn}>Delete</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.typeBadge, { backgroundColor: accentColor+'22', borderColor: accentColor }]}>
            <Text style={[styles.typeBadgeText, { color: accentColor }]}>
              {actType === 'run' && isRide ? 'Ride'
                : actType === 'run' ? 'Run'
                : actType.charAt(0).toUpperCase() + actType.slice(1)}
            </Text>
          </View>

          {/* Subtype */}
          <Text style={styles.label}>
            {actType === 'run' ? (isRide ? 'RIDE TYPE' : 'RUN TYPE') : 'ACTIVITY'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {subtypeOptions().map(s => (
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

          {/* Terrain — run, not ride */}
          {actType === 'run' && !isRide && (
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

          {/* Bike type — ride */}
          {actType === 'run' && isRide && (
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
          <TextInput style={styles.input} value={date} onChangeText={setDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted2} />

          {/* Distance */}
          {(actType === 'run' || actType === 'cross') && (
            <>
              <Text style={styles.label}>DISTANCE (KM)</Text>
              <TextInput style={styles.input} value={dist} onChangeText={setDist}
                keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.muted2} />
            </>
          )}

          {/* Duration */}
          <Text style={styles.label}>DURATION (MIN)</Text>
          <TextInput style={styles.input} value={dur} onChangeText={setDur}
            keyboardType="decimal-pad" placeholder="60" placeholderTextColor={colors.muted2} />

          {/* Elevation */}
          {(actType === 'run' || actType === 'cross') && (
            <>
              <Text style={styles.label}>ELEVATION GAIN (M)</Text>
              <TextInput style={styles.input} value={vert} onChangeText={setVert}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
            </>
          )}

          {/* HR — run only */}
          {actType === 'run' && (
            <>
              <Text style={styles.label}>AVG HEART RATE (BPM)</Text>
              <TextInput style={styles.input} value={hr} onChangeText={setHr}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted2} />
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
          <TextInput style={[styles.input, styles.inputMulti]} value={notes} onChangeText={setNotes}
            multiline numberOfLines={3} textAlignVertical="top"
            placeholder="How did it feel?" placeholderTextColor={colors.muted2} />

          {/* Nutrition — run and cross */}
          {(actType === 'run' || actType === 'cross') && db.nutrition.length > 0 && (
            <TouchableOpacity style={styles.nutrToggle} onPress={() => setShowNutr(v => !v)}>
              <View style={[styles.checkbox, showNutr && { backgroundColor: accentColor, borderColor: accentColor }]}>
                {showNutr && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.nutrToggleText}>Add nutrition?</Text>
            </TouchableOpacity>
          )}

          {showNutr && (actType === 'run' || actType === 'cross') && (
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
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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
  cancelBtn:   { fontSize: 15, color: colors.muted },
  deleteBtn:   { fontSize: 15, color: colors.red, fontWeight: '600' },

  content: { padding: 20, paddingBottom: 60 },

  typeBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16,
  },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },

  label: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
