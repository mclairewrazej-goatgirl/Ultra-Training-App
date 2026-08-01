import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { Race } from '../types';

interface Props {
  race: Race | null;
  onAcknowledge: () => void;
  onLater: () => void;
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RegistrationReminderModal({ race, onAcknowledge, onLater }: Props) {
  if (!race || !race.regOpenDate) return null;

  const days = daysUntil(race.regOpenDate);
  const dateStr = new Date(race.regOpenDate + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const daysText = days > 0 ? `in ${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'today' : 'now';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>⏰</Text>
          <Text style={styles.title}>Registration Reminder</Text>
          <Text style={styles.body}>
            Registration for <Text style={styles.bold}>{race.name}</Text> opens {daysText} ({dateStr}).
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onAcknowledge}>
            <Text style={styles.primaryBtnText}>Got it</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onLater}>
            <Text style={styles.secondaryBtnText}>Remind me later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 360, padding: 24, alignItems: 'center',
  },
  emoji: { fontSize: 36, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 },
  body: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  bold: { color: colors.text, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: colors.pink, borderRadius: 10,
    paddingVertical: 12, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { paddingVertical: 6 },
  secondaryBtnText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
});
