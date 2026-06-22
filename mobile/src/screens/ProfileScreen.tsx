import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ScrollView, TextInput, Switch,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db as firestoreDB } from '../config/firebase';
import { colors } from '../theme';
import { TrainingDB, WeeklyGoal, defaultWeeklyGoal } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

function getMondayKey(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getGoalForWeek(db: TrainingDB, key: string): WeeklyGoal {
  const raw = db.weeklyGoals?.[key] ?? db.goals;
  if (!raw || typeof raw !== 'object') return defaultWeeklyGoal;
  const r = raw as any;
  return {
    run: {
      enabled: r.run?.enabled ?? true,
      metrics: {
        time: r.run?.metrics?.time ?? true,
        dist: r.run?.metrics?.dist ?? false,
        vert: r.run?.metrics?.vert ?? false,
      },
      time: { min: Number(r.run?.time?.min) || 0, max: Number(r.run?.time?.max) || 0 },
      dist: { min: Number(r.run?.dist?.min) || 0, max: Number(r.run?.dist?.max) || 0 },
      vert: { min: Number(r.run?.vert?.min) || 0, max: Number(r.run?.vert?.max) || 0 },
    },
    cross: {
      enabled: r.cross?.enabled ?? false,
      metrics: {
        time: r.cross?.metrics?.time ?? true,
        dist: r.cross?.metrics?.dist ?? false,
        vert: r.cross?.metrics?.vert ?? false,
      },
      time: { min: Number(r.cross?.time?.min) || 0, max: Number(r.cross?.time?.max) || 0 },
      dist: { min: Number(r.cross?.dist?.min) || 0, max: Number(r.cross?.dist?.max) || 0 },
      vert: { min: Number(r.cross?.vert?.min) || 0, max: Number(r.cross?.vert?.max) || 0 },
    },
  };
}

export default function ProfileScreen({ user, db, onSaved }: Props) {
  const weekKey = getMondayKey();
  const totalWorkouts = db.runs.length + db.crosses.length + db.strengths.length + db.recoveries.length;

  const [saving, setSaving] = useState(false);

  // Goal fields
  const initial = getGoalForWeek(db, weekKey);
  const [runEnabled, setRunEnabled] = useState(initial.run.enabled);
  const [runTrackTime, setRunTrackTime] = useState(initial.run.metrics.time);
  const [runTimeMin, setRunTimeMin] = useState(String(initial.run.time.min || ''));
  const [runTimeMax, setRunTimeMax] = useState(String(initial.run.time.max || ''));
  const [runTrackDist, setRunTrackDist] = useState(initial.run.metrics.dist);
  const [runDistMin, setRunDistMin] = useState(String(initial.run.dist.min || ''));
  const [runDistMax, setRunDistMax] = useState(String(initial.run.dist.max || ''));
  const [crossEnabled, setCrossEnabled] = useState(initial.cross.enabled);
  const [crossTrackTime, setCrossTrackTime] = useState(initial.cross.metrics.time);
  const [crossTimeMin, setCrossTimeMin] = useState(String(initial.cross.time.min || ''));
  const [crossTimeMax, setCrossTimeMax] = useState(String(initial.cross.time.max || ''));
  const [crossTrackDist, setCrossTrackDist] = useState(initial.cross.metrics.dist);
  const [crossDistMin, setCrossDistMin] = useState(String(initial.cross.dist.min || ''));
  const [crossDistMax, setCrossDistMax] = useState(String(initial.cross.dist.max || ''));

  // Re-sync when db.weeklyGoals changes for this week
  useEffect(() => {
    const g = getGoalForWeek(db, weekKey);
    setRunEnabled(g.run.enabled);
    setRunTrackTime(g.run.metrics.time);
    setRunTimeMin(String(g.run.time.min || ''));
    setRunTimeMax(String(g.run.time.max || ''));
    setRunTrackDist(g.run.metrics.dist);
    setRunDistMin(String(g.run.dist.min || ''));
    setRunDistMax(String(g.run.dist.max || ''));
    setCrossEnabled(g.cross.enabled);
    setCrossTrackTime(g.cross.metrics.time);
    setCrossTimeMin(String(g.cross.time.min || ''));
    setCrossTimeMax(String(g.cross.time.max || ''));
    setCrossTrackDist(g.cross.metrics.dist);
    setCrossDistMin(String(g.cross.dist.min || ''));
    setCrossDistMax(String(g.cross.dist.max || ''));
  }, [db.weeklyGoals, weekKey]);

  const handleSaveGoals = async () => {
    setSaving(true);
    const goal: WeeklyGoal = {
      run: {
        enabled: runEnabled,
        metrics: { time: runTrackTime, dist: runTrackDist, vert: false },
        time: { min: Number(runTimeMin) || 0, max: Number(runTimeMax) || 0 },
        dist: { min: Number(runDistMin) || 0, max: Number(runDistMax) || 0 },
        vert: { min: 0, max: 0 },
      },
      cross: {
        enabled: crossEnabled,
        metrics: { time: crossTrackTime, dist: crossTrackDist, vert: false },
        time: { min: Number(crossTimeMin) || 0, max: Number(crossTimeMax) || 0 },
        dist: { min: Number(crossDistMin) || 0, max: Number(crossDistMax) || 0 },
        vert: { min: 0, max: 0 },
      },
    };
    const newDB: TrainingDB = {
      ...db,
      weeklyGoals: { ...db.weeklyGoals, [weekKey]: goal },
      goals: goal,
    };
    try {
      const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
      await setDoc(docRef, JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      Alert.alert('Saved', `Goals saved for week of ${weekKey}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(auth).catch((err) => Alert.alert('Error', err.message)),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + Name */}
      <View style={styles.profileCard}>
        {user.photoURL ? (
          <Image source={{ uri: user.photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user.displayName ?? 'Athlete'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {db.logName ? <Text style={styles.logName}>{db.logName}</Text> : null}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox label="Runs" value={db.runs.length} color={colors.pink} />
        <StatBox label="Cross" value={db.crosses.length} color={colors.blue} />
        <StatBox label="Strength" value={db.strengths.length} color={colors.amber} />
        <StatBox label="Recovery" value={db.recoveries.length} color={colors.green} />
      </View>
      <Text style={styles.totalText}>{totalWorkouts} total workouts logged</Text>

      {/* Weekly Goals */}
      <Text style={styles.sectionTitle}>Weekly Goals</Text>
      <Text style={styles.weekLabel}>Week of {weekKey}</Text>

      {/* Running goals */}
      <View style={styles.goalCard}>
        <View style={styles.goalCardHeader}>
          <Text style={[styles.goalCardTitle, { color: colors.pink }]}>Running</Text>
          <Switch
            value={runEnabled}
            onValueChange={setRunEnabled}
            trackColor={{ true: colors.pink, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
        {runEnabled && (
          <View style={styles.goalFields}>
            <View style={styles.metricRow}>
              <View style={styles.metricToggle}>
                <TouchableOpacity
                  style={[styles.metricBtn, runTrackTime && { backgroundColor: colors.pink }]}
                  onPress={() => setRunTrackTime(!runTrackTime)}
                >
                  <Text style={[styles.metricBtnText, runTrackTime && { color: '#fff' }]}>Time (hrs)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.metricBtn, runTrackDist && { backgroundColor: colors.pink }]}
                  onPress={() => setRunTrackDist(!runTrackDist)}
                >
                  <Text style={[styles.metricBtnText, runTrackDist && { color: '#fff' }]}>Distance (mi)</Text>
                </TouchableOpacity>
              </View>
            </View>
            {runTrackTime && (
              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>Time range (hrs)</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    value={runTimeMin}
                    onChangeText={setRunTimeMin}
                    placeholder="Min"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.rangeSep}>–</Text>
                  <TextInput
                    style={styles.rangeInput}
                    value={runTimeMax}
                    onChangeText={setRunTimeMax}
                    placeholder="Max"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
            {runTrackDist && (
              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>Distance range (mi)</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    value={runDistMin}
                    onChangeText={setRunDistMin}
                    placeholder="Min"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.rangeSep}>–</Text>
                  <TextInput
                    style={styles.rangeInput}
                    value={runDistMax}
                    onChangeText={setRunDistMax}
                    placeholder="Max"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Cross-training goals */}
      <View style={styles.goalCard}>
        <View style={styles.goalCardHeader}>
          <Text style={[styles.goalCardTitle, { color: colors.blue }]}>Cross-Training</Text>
          <Switch
            value={crossEnabled}
            onValueChange={setCrossEnabled}
            trackColor={{ true: colors.blue, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
        {crossEnabled && (
          <View style={styles.goalFields}>
            <View style={styles.metricRow}>
              <View style={styles.metricToggle}>
                <TouchableOpacity
                  style={[styles.metricBtn, crossTrackTime && { backgroundColor: colors.blue }]}
                  onPress={() => setCrossTrackTime(!crossTrackTime)}
                >
                  <Text style={[styles.metricBtnText, crossTrackTime && { color: '#fff' }]}>Time (hrs)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.metricBtn, crossTrackDist && { backgroundColor: colors.blue }]}
                  onPress={() => setCrossTrackDist(!crossTrackDist)}
                >
                  <Text style={[styles.metricBtnText, crossTrackDist && { color: '#fff' }]}>Distance (mi)</Text>
                </TouchableOpacity>
              </View>
            </View>
            {crossTrackTime && (
              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>Time range (hrs)</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    value={crossTimeMin}
                    onChangeText={setCrossTimeMin}
                    placeholder="Min"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.rangeSep}>–</Text>
                  <TextInput
                    style={styles.rangeInput}
                    value={crossTimeMax}
                    onChangeText={setCrossTimeMax}
                    placeholder="Max"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
            {crossTrackDist && (
              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>Distance range (mi)</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    value={crossDistMin}
                    onChangeText={setCrossDistMin}
                    placeholder="Min"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.rangeSep}>–</Text>
                  <TextInput
                    style={styles.rangeInput}
                    value={crossDistMax}
                    onChangeText={setCrossDistMax}
                    placeholder="Max"
                    placeholderTextColor={colors.muted2}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={handleSaveGoals}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Goals'}</Text>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.infoCard}>
        <InfoRow label="Primary sport" value={db.primarySport || 'Not set'} />
        <InfoRow label="Data synced with" value="Ultra Training web app" />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statNum, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 60 },

  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  logName: { fontSize: 13, color: colors.pink, marginTop: 6, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },

  totalText: { fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 20 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  weekLabel: { fontSize: 12, color: colors.muted, marginBottom: 12 },

  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalCardTitle: { fontSize: 14, fontWeight: '700' },
  goalFields: { marginTop: 12 },
  metricRow: { marginBottom: 10 },
  metricToggle: { flexDirection: 'row', gap: 8 },
  metricBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border2,
    backgroundColor: colors.surface2,
  },
  metricBtnText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  rangeRow: { marginBottom: 10 },
  rangeLabel: { fontSize: 11, color: colors.muted, marginBottom: 6, textTransform: 'uppercase', fontWeight: '600' },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  rangeSep: { color: colors.muted, fontSize: 16 },

  saveBtn: {
    backgroundColor: colors.pink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, color: colors.text, fontWeight: '600' },

  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: colors.red, fontWeight: '700', fontSize: 15 },
});
