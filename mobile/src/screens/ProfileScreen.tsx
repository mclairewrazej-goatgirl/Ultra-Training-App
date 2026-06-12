import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db as firestoreDB } from '../config/firebase';
import { colors } from '../theme';
import { TrainingDB } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

export default function ProfileScreen({ user, db, onSaved }: Props) {
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
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: () => signOut(auth).catch((err) => Alert.alert('Error', err.message)),
      },
    ]);
  };

  const isCycling = db.primarySport === 'cycling';

  return (
    <View style={styles.container}>
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
        <StatBox label={isCycling ? 'Rides' : 'Runs'} value={db.runs.length} color={colors.pink} />
        <StatBox label="Cross" value={db.crosses.length} color={colors.blue} />
        <StatBox label="Strength" value={db.strengths.length} color={colors.amber} />
        <StatBox label="Recovery" value={db.recoveries.length} color={colors.green} />
      </View>

      <Text style={styles.totalText}>{totalWorkouts} total workouts logged</Text>

      {/* Primary Sport Selection */}
      <View style={styles.sportSection}>
        <Text style={styles.sportTitle}>PRIMARY SPORT</Text>
        <View style={styles.sportRow}>
          <TouchableOpacity
            style={[styles.sportBtn, !isCycling && styles.sportBtnRunning]}
            onPress={() => setPrimarySport('running')}
          >
            <Text style={[styles.sportBtnText, !isCycling && { color: colors.pink }]}>
              Running
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sportBtn, isCycling && styles.sportBtnCycling]}
            onPress={() => setPrimarySport('cycling')}
          >
            <Text style={[styles.sportBtnText, isCycling && { color: colors.blue }]}>
              Cycling
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sportHint}>
          Changes the activity types and labels throughout the app.
        </Text>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
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
  name:    { fontSize: 20, fontWeight: '800', color: colors.text },
  email:   { fontSize: 13, color: colors.muted, marginTop: 2 },
  logName: { fontSize: 13, color: colors.pink, marginTop: 6, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statNum:   { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },

  totalText: { fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 20 },

  sportSection: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  sportTitle: {
    fontSize: 11, color: colors.muted, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  sportRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sportBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  sportBtnRunning: { borderColor: colors.pink, backgroundColor: colors.pink+'18' },
  sportBtnCycling: { borderColor: colors.blue, backgroundColor: colors.blue+'18' },
  sportBtnText:    { fontSize: 14, fontWeight: '700', color: colors.muted },
  sportHint:       { fontSize: 11, color: colors.muted2, textAlign: 'center' },

  signOutBtn: {
    borderWidth: 1, borderColor: colors.red, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { color: colors.red, fontWeight: '700', fontSize: 15 },
});
