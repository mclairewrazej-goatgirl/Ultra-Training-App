import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { colors } from '../theme';

interface Props {
  visible: boolean;
  raceName: string;
  finishTime: string;
  onSave: (placement: string) => void;
  onSkip: () => void;
}

export default function RaceStatsModal({ visible, raceName, finishTime, onSave, onSkip }: Props) {
  const [placement, setPlacement] = useState('');

  useEffect(() => { if (visible) setPlacement(''); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onSkip}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onSkip}><Text style={styles.skipBtn}>Skip</Text></TouchableOpacity>
          <Text style={styles.title}>Race Stats</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.raceName}>🏁 {raceName}</Text>

          <Text style={styles.label}>FINISH TIME</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{finishTime}</Text>
          </View>

          <Text style={styles.label}>OVERALL PLACEMENT</Text>
          <TextInput
            style={styles.input}
            value={placement}
            onChangeText={setPlacement}
            placeholder="e.g. 14th overall"
            placeholderTextColor={colors.muted2}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(placement.trim())}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  skipBtn: { fontSize: 15, color: colors.muted, fontWeight: '600', width: 44 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  content: { padding: 20 },
  raceName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 11, color: colors.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  readOnlyField: {
    backgroundColor: colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  readOnlyText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.pink, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
