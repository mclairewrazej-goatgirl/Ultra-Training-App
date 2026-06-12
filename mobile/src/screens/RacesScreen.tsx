import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, Race } from '../types';
import { colors } from '../theme';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const RACE_TYPES = ['run', 'bike', 'skimo'] as const;
const BIKE_TYPES = ['Gravel', 'Road', 'Mountain', 'Fat Bike'];
const SKIMO_CATS = ['Individual', 'Vertical', 'Team'];

function daysUntil(dateStr: string): number {
  const race = new Date(dateStr + 'T12:00:00');
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function raceTypeBadge(race: Race): string {
  if (race.raceType === 'bike')  return race.bikeType  ? `Bike · ${race.bikeType}` : 'Bike Race';
  if (race.raceType === 'skimo') return race.skimoCategory ? `Skimo · ${race.skimoCategory}` : 'Skimo';
  return 'Run Race';
}

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

export default function RacesScreen({ user, db, onSaved }: Props) {
  const [tab,          setTab]          = useState<'upcoming' | 'results'>('upcoming');
  const [editingRace,  setEditingRace]  = useState<Race | null>(null);
  const [showModal,    setShowModal]    = useState(false);

  const upcoming = useMemo(() =>
    db.races.filter(r => !r.result).sort((a, b) => a.date.localeCompare(b.date)),
    [db.races]);

  const results = useMemo(() =>
    db.races.filter(r => !!r.result).sort((a, b) => b.date.localeCompare(a.date)),
    [db.races]);

  const displayed = tab === 'upcoming' ? upcoming : results;

  const openAdd = () => { setEditingRace(null); setShowModal(true); };
  const openEdit = (r: Race) => { setEditingRace(r); setShowModal(true); };

  const handleDelete = (raceId: string) => {
    Alert.alert('Delete race', 'Remove this race?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const newDB = { ...db, races: db.races.filter(r => r.id !== raceId) };
        try {
          await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
          onSaved(newDB);
        } catch (err: any) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'results' && styles.tabBtnActive]}
          onPress={() => setTab('results')}
        >
          <Text style={[styles.tabText, tab === 'results' && styles.tabTextActive]}>
            Results ({results.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayed}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add Race</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming' ? 'No upcoming races' : 'No race results yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'upcoming'
                ? 'Add a race to your schedule to track your goals.'
                : 'Once you finish a race, add your result time here.'}
            </Text>
          </View>
        }
        renderItem={({ item: race }) => {
          const days = daysUntil(race.date);
          const dateStr = new Date(race.date + 'T12:00:00').toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          });
          return (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(race)} activeOpacity={0.75}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.raceName}>🏁 {race.name}</Text>
                  <Text style={styles.raceBadge}>{raceTypeBadge(race)}</Text>
                </View>
                {tab === 'upcoming' ? (
                  <View style={[styles.daysBadge, days <= 7 && { backgroundColor: colors.red+'33', borderColor: colors.red }]}>
                    <Text style={[styles.daysNum, days <= 7 && { color: colors.red }]}>
                      {days > 0 ? days : days === 0 ? '🏁' : '✓'}
                    </Text>
                    <Text style={styles.daysLabel}>{days > 1 ? 'days' : days === 1 ? 'day' : days === 0 ? 'today' : 'done'}</Text>
                  </View>
                ) : (
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultTime}>{race.result}</Text>
                    {race.goal ? <Text style={styles.goalTime}>goal {race.goal}</Text> : null}
                  </View>
                )}
              </View>

              <Text style={styles.raceDate}>{dateStr}</Text>
              {race.loc ? <Text style={styles.raceLoc}>📍 {race.loc}</Text> : null}

              <View style={styles.statsRow}>
                {Number(race.dist) > 0 && (
                  <Text style={styles.stat}>{race.dist} km</Text>
                )}
                {Number(race.vert) > 0 && (
                  <Text style={styles.stat}>↑ {race.vert} m</Text>
                )}
                {race.goal && tab === 'upcoming' && (
                  <Text style={styles.stat}>Goal: {race.goal}</Text>
                )}
              </View>

              {race.notes ? <Text style={styles.raceNotes} numberOfLines={2}>{race.notes}</Text> : null}

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(race.id)}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      <RaceModal
        visible={showModal}
        editingRace={editingRace}
        user={user}
        db={db}
        onSaved={onSaved}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

// ─── Race Modal ───────────────────────────────────────────────────────────────

function RaceModal({ visible, editingRace, user, db, onSaved, onClose }: {
  visible: boolean;
  editingRace: Race | null;
  user: User;
  db: TrainingDB;
  onSaved: (u: TrainingDB) => void;
  onClose: () => void;
}) {
  const [name,         setName]         = useState('');
  const [raceType,     setRaceType]     = useState<'run' | 'bike' | 'skimo'>('run');
  const [bikeType,     setBikeType]     = useState('Gravel');
  const [skimoCat,     setSkimoCat]     = useState('Individual');
  const [date,         setDate]         = useState('');
  const [dist,         setDist]         = useState('');
  const [loc,          setLoc]          = useState('');
  const [goal,         setGoal]         = useState('');
  const [vert,         setVert]         = useState('');
  const [result,       setResult]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [saving,       setSaving]       = useState(false);

  React.useEffect(() => {
    if (editingRace) {
      setName(editingRace.name);
      setRaceType(editingRace.raceType);
      setBikeType(editingRace.bikeType || 'Gravel');
      setSkimoCat(editingRace.skimoCategory || 'Individual');
      setDate(editingRace.date);
      setDist(String(editingRace.dist || ''));
      setLoc(editingRace.loc || '');
      setGoal(editingRace.goal || '');
      setVert(String(editingRace.vert || ''));
      setResult(editingRace.result || '');
      setNotes(editingRace.notes || '');
    } else {
      setName(''); setRaceType('run'); setBikeType('Gravel'); setSkimoCat('Individual');
      setDate(new Date().toISOString().slice(0, 10));
      setDist(''); setLoc(''); setGoal(''); setVert(''); setResult(''); setNotes('');
    }
  }, [editingRace, visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Race name required'); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Invalid date', 'Use YYYY-MM-DD'); return; }
    setSaving(true);
    const race: Race = {
      id: editingRace?.id ?? uid(),
      name: name.trim(),
      raceType,
      bikeType:      raceType === 'bike'  ? bikeType  : undefined,
      skimoCategory: raceType === 'skimo' ? skimoCat  : undefined,
      date,
      dist: Number(dist) || 0,
      loc: loc.trim(),
      goal: goal.trim(),
      vert: Number(vert) || 0,
      result: result.trim(),
      notes: notes.trim(),
    };
    const newDB = {
      ...db,
      races: editingRace
        ? db.races.map(r => r.id === editingRace.id ? race : r)
        : [...db.races, race],
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{editingRace ? 'Edit Race' : 'Add Race'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Field label="RACE NAME" value={name} onChange={setName} placeholder="e.g. UTMB, Gravel Worlds" />

          <Text style={styles.fieldLabel}>RACE TYPE</Text>
          <View style={styles.chipRow}>
            {RACE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, raceType === t && { borderColor: colors.red, backgroundColor: colors.red+'22' }]}
                onPress={() => setRaceType(t)}
              >
                <Text style={[styles.chipText, raceType === t && { color: colors.red }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {raceType === 'bike' && (
            <>
              <Text style={styles.fieldLabel}>BIKE TYPE</Text>
              <View style={styles.chipRow}>
                {BIKE_TYPES.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.chip, bikeType === b && { borderColor: colors.red, backgroundColor: colors.red+'22' }]}
                    onPress={() => setBikeType(b)}
                  >
                    <Text style={[styles.chipText, bikeType === b && { color: colors.red }]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {raceType === 'skimo' && (
            <>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <View style={styles.chipRow}>
                {SKIMO_CATS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, skimoCat === c && { borderColor: colors.red, backgroundColor: colors.red+'22' }]}
                    onPress={() => setSkimoCat(c)}
                  >
                    <Text style={[styles.chipText, skimoCat === c && { color: colors.red }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Field label="DATE (YYYY-MM-DD)" value={date} onChange={setDate} placeholder="2026-07-20" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="DISTANCE (KM)" value={dist} onChange={setDist} keyboard="decimal-pad" placeholder="0" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="ELEVATION GAIN (M)" value={vert} onChange={setVert} keyboard="decimal-pad" placeholder="0" />
            </View>
          </View>

          <Field label="LOCATION" value={loc} onChange={setLoc} placeholder="City, Country" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="GOAL TIME" value={goal} onChange={setGoal} placeholder="h:mm:ss" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="RESULT TIME" value={result} onChange={setResult} placeholder="h:mm:ss" />
            </View>
          </View>

          <Field label="NOTES" value={notes} onChange={setNotes} placeholder="Notes, conditions, strategy…" multiline />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Race'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: 'decimal-pad'; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.muted2}
        keyboardType={keyboard ?? 'default'}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.red },
  tabText:      { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.red },

  list: { padding: 16, paddingBottom: 40 },
  addBtn: {
    backgroundColor: colors.red, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody:  { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  raceName:    { fontSize: 15, fontWeight: '800', color: colors.text },
  raceBadge:   { fontSize: 11, color: colors.red, fontWeight: '600', marginTop: 2 },
  raceDate:    { fontSize: 12, color: colors.muted, marginBottom: 2 },
  raceLoc:     { fontSize: 12, color: colors.muted, marginBottom: 4 },
  statsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  stat:        { fontSize: 12, color: colors.blue, fontWeight: '600' },
  raceNotes:   { fontSize: 12, color: colors.muted2, marginTop: 6, fontStyle: 'italic' },
  deleteBtn:   { position: 'absolute', top: 12, right: 12 },
  deleteBtnText: { color: colors.muted2, fontSize: 16 },

  daysBadge: {
    alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border,
    minWidth: 52,
  },
  daysNum:   { fontSize: 18, fontWeight: '800', color: colors.text },
  daysLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase' },

  resultBadge: { alignItems: 'flex-end' },
  resultTime:  { fontSize: 16, fontWeight: '800', color: colors.green },
  goalTime:    { fontSize: 11, color: colors.muted },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cancelBtn:  { fontSize: 15, color: colors.muted, width: 60 },
  modalContent: { padding: 20, paddingBottom: 60 },

  fieldLabel: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  row: { flexDirection: 'row' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn:    { backgroundColor: colors.red, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
