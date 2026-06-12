import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors } from '../theme';
import { TrainingDB } from '../types';

interface Props {
  user: User;
  db: TrainingDB;
}

export default function ProfileScreen({ user, db }: Props) {
  const totalWorkouts = db.runs.length + db.crosses.length + db.strengths.length + db.recoveries.length;

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
        <StatBox label="Runs" value={db.runs.length} color={colors.pink} />
        <StatBox label="Cross" value={db.crosses.length} color={colors.blue} />
        <StatBox label="Strength" value={db.strengths.length} color={colors.amber} />
        <StatBox label="Recovery" value={db.recoveries.length} color={colors.green} />
      </View>

      <Text style={styles.totalText}>{totalWorkouts} total workouts logged</Text>

      {/* Info */}
      <View style={styles.infoCard}>
        <InfoRow label="Primary sport" value={db.primarySport || 'Not set'} />
        <InfoRow label="Data synced with" value="Ultra Training web app" />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  logName: {
    fontSize: 13, color: colors.pink, marginTop: 6, fontStyle: 'italic',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
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

  totalText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },

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
