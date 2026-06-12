import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert, Modal,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db as firestoreDB } from '../config/firebase';
import { colors } from '../theme';
import { TrainingDB } from '../types';
import NutritionScreen  from './NutritionScreen';
import RacesScreen      from './RacesScreen';
import GoalsScreen      from './GoalsScreen';
import SkiSeasonScreen  from './SkiSeasonScreen';

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

export default function ProfileScreen({ user, db, onSaved }: Props) {
  const [showNutrition, setShowNutrition] = useState(false);
  const [showRaces,     setShowRaces]     = useState(false);
  const [showGoals,     setShowGoals]     = useState(false);
  const [showSki,       setShowSki]       = useState(false);

  const isCycling = db.primarySport === 'cycling';
  const totalWorkouts = db.runs.length + db.crosses.length + db.strengths.length + db.recoveries.length;

  const setPrimarySport = async (sport: string) => {
    if (db.primarySport === sport) return;
    const newDB = { ...db, primarySport: sport };
    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive',
        onPress: () => signOut(auth).catch(err => Alert.alert('Error', err.message)) },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Avatar */}
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
        <StatBox label={isCycling ? 'Rides' : 'Runs'} value={db.runs.length}      color={colors.pink}  />
        <StatBox label="Cross"    value={db.crosses.length}   color={colors.blue}  />
        <StatBox label="Strength" value={db.strengths.length} color={colors.amber} />
        <StatBox label="Races"    value={db.races.length}     color={colors.red}   />
      </View>
      <Text style={styles.totalText}>{totalWorkouts} workouts · {db.races.length} races</Text>

      {/* Primary Sport */}
      <View style={styles.sportSection}>
        <Text style={styles.sectionTitle}>PRIMARY SPORT</Text>
        <View style={styles.sportRow}>
          <TouchableOpacity
            style={[styles.sportBtn, !isCycling && styles.sportBtnRunning]}
            onPress={() => setPrimarySport('running')}
          >
            <Text style={[styles.sportBtnText, !isCycling && { color: colors.pink }]}>Running</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sportBtn, isCycling && styles.sportBtnCycling]}
            onPress={() => setPrimarySport('cycling')}
          >
            <Text style={[styles.sportBtnText, isCycling && { color: colors.blue }]}>Cycling</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sportHint}>Changes activity types and labels throughout the app.</Text>
      </View>

      {/* Navigation rows */}
      <View style={styles.navCard}>
        <TouchableOpacity style={styles.navRow} onPress={() => setShowGoals(true)}>
          <Text style={styles.navIcon}>🎯</Text>
          <Text style={styles.navLabel}>My Goals</Text>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navRow} onPress={() => setShowNutrition(true)}>
          <Text style={styles.navIcon}>🥗</Text>
          <Text style={styles.navLabel}>My Nutrition</Text>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navRow} onPress={() => setShowRaces(true)}>
          <Text style={styles.navIcon}>🏁</Text>
          <Text style={styles.navLabel}>My Races</Text>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.navDivider} />
        <TouchableOpacity style={styles.navRow} onPress={() => setShowSki(true)}>
          <Text style={styles.navIcon}>⛷️</Text>
          <Text style={styles.navLabel}>Ski Season</Text>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Ski Season modal */}
      <Modal visible={showSki} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowSki(false)}>
        <View style={styles.modalShell}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setShowSki(false)}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTopTitle}>Ski Season</Text>
            <View style={{ width: 60 }} />
          </View>
          <SkiSeasonScreen user={user} db={db} onSaved={onSaved} />
        </View>
      </Modal>

      {/* My Goals modal */}
      <Modal visible={showGoals} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowGoals(false)}>
        <View style={styles.modalShell}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setShowGoals(false)}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTopTitle}>My Goals</Text>
            <View style={{ width: 60 }} />
          </View>
          <GoalsScreen user={user} db={db} onSaved={onSaved} />
        </View>
      </Modal>

      {/* My Nutrition modal */}
      <Modal visible={showNutrition} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowNutrition(false)}>
        <View style={styles.modalShell}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setShowNutrition(false)}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTopTitle}>My Nutrition</Text>
            <View style={{ width: 60 }} />
          </View>
          <NutritionScreen user={user} db={db} onSaved={onSaved} />
        </View>
      </Modal>

      {/* My Races modal */}
      <Modal visible={showRaces} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowRaces(false)}>
        <View style={styles.modalShell}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setShowRaces(false)}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTopTitle}>My Races</Text>
            <View style={{ width: 60 }} />
          </View>
          <RacesScreen user={user} db={db} onSaved={onSaved} />
        </View>
      </Modal>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },

  profileCard: {
    alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 16, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name:    { fontSize: 20, fontWeight: '800', color: colors.text },
  email:   { fontSize: 13, color: colors.muted, marginTop: 2 },
  logName: { fontSize: 13, color: colors.pink, marginTop: 6, fontStyle: 'italic' },

  statsRow:  { flexDirection: 'row', gap: 8, marginBottom: 6 },
  statBox:   { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statNum:   { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 9, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },
  totalText: { fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 16 },

  sectionTitle: {
    fontSize: 11, color: colors.muted, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  sportSection: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },
  sportRow:       { flexDirection: 'row', gap: 10, marginBottom: 8 },
  sportBtn:       { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface2 },
  sportBtnRunning: { borderColor: colors.pink, backgroundColor: colors.pink+'18' },
  sportBtnCycling: { borderColor: colors.blue, backgroundColor: colors.blue+'18' },
  sportBtnText:   { fontSize: 14, fontWeight: '700', color: colors.muted },
  sportHint:      { fontSize: 11, color: colors.muted2, textAlign: 'center' },

  navCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },
  navRow:    { flexDirection: 'row', alignItems: 'center', padding: 16 },
  navDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  navIcon:   { fontSize: 20, marginRight: 12 },
  navLabel:  { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  navArrow:  { fontSize: 22, color: colors.muted, fontWeight: '300' },

  signOutBtn: {
    borderWidth: 1, borderColor: colors.red, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { color: colors.red, fontWeight: '700', fontSize: 15 },

  modalShell:    { flex: 1, backgroundColor: colors.bg },
  modalTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn:       { fontSize: 16, color: colors.pink, fontWeight: '600', width: 60 },
  modalTopTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
