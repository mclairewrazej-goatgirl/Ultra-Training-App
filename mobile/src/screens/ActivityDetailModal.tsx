import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors, actColors } from '../theme';
import { ActivityEntry, NutritionItem, RunEntry } from '../types';
import { nutrPerHour } from '../nutrition';

interface Props {
  visible: boolean;
  entry: ActivityEntry | null;
  nutrition: NutritionItem[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function fmtDist(d: number | string) {
  const n = Number(d);
  return n > 0 ? n.toFixed(1) : null;
}
function fmtDur(mins: number | string) {
  const n = Number(mins);
  if (!n) return null;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtHr(n: number | string) {
  const v = Number(n);
  return v > 0 ? `${Math.round(v)} bpm` : null;
}
function fmtRpe(n: number | string) {
  const v = Number(n);
  return v > 0 ? `${v} / 10` : null;
}
function actTitle(act: ActivityEntry): string {
  if (act.actType === 'run') {
    const rt: string = (act as any).runType ?? '';
    if (!rt) return 'Run';
    const cap = rt.charAt(0).toUpperCase() + rt.slice(1);
    return (cap.endsWith('Run') || cap === 'Hike') ? cap : cap + ' Run';
  }
  if (act.actType === 'cross') return (act as any).subtype || 'Cross-Training';
  if (act.actType === 'strength') return (act as any).subtype || 'Strength';
  if (act.actType === 'recovery') return (act as any).subtype || 'Recovery';
  return 'Workout';
}
function secondaryBadge(act: ActivityEntry): string | null {
  if (act.actType === 'run') {
    const r = act as RunEntry;
    if (r.bikeType) return r.bikeType;
    if (r.terrain) return r.terrain.charAt(0).toUpperCase() + r.terrain.slice(1);
  }
  return null;
}

export default function ActivityDetailModal({ visible, entry, nutrition, onEdit, onDelete, onClose }: Props) {
  if (!entry) return null;

  const accentColor = actColors[entry.actType] ?? colors.muted;
  const dist        = 'dist' in entry ? fmtDist((entry as any).dist) : null;
  const movingTime  = 'dur'  in entry ? fmtDur((entry as any).dur)   : null;
  const elapsedTime = 'elapsed' in entry ? fmtDur((entry as any).elapsed) : null;
  const vert        = 'vert' in entry && Number((entry as any).vert) > 0 ? `${Math.round(Number((entry as any).vert))} m` : null;
  const hr          = 'hr'  in entry ? fmtHr((entry as any).hr) : null;
  const rpe         = 'rpe' in entry ? fmtRpe((entry as any).rpe) : null;
  const notes = (entry as any).notes || null;
  const workoutDetails = entry.actType === 'run' ? (entry as RunEntry).workoutDetails || null : null;
  const badge2 = secondaryBadge(entry);

  const nutritionEntries = (entry as any).nutritionEntries as { itemId: string; servings: number }[] | undefined;
  const nutrStats = nutrPerHour(
    nutritionEntries, nutrition,
    Number((entry as any).dur) || 0,
    Number((entry as any).elapsed) || undefined,
  );

  const dateStr = new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {dist && (
                <Text style={[styles.bigDist, { color: accentColor }]}>
                  {dist} <Text style={styles.bigDistUnit}>km</Text>
                </Text>
              )}
              <Text style={styles.dateText}>{dateStr}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { borderColor: accentColor }]}>
                  <Text style={[styles.badgeText, { color: accentColor }]}>{actTitle(entry)}</Text>
                </View>
                {badge2 && (
                  <View style={styles.badgeMuted}>
                    <Text style={styles.badgeMutedText}>{badge2}</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {(movingTime || elapsedTime || vert || hr || rpe) && (
            <View style={styles.statGrid}>
              {movingTime && <StatBox label="Moving Time" value={movingTime} />}
              {elapsedTime && <StatBox label="Elapsed Time" value={elapsedTime} />}
              {vert && <StatBox label="Elevation Gain" value={vert} />}
              {hr && <StatBox label="Avg Heart Rate" value={hr} />}
              {rpe && <StatBox label="RPE" value={rpe} />}
            </View>
          )}

          {notes && (
            <View style={styles.textBlock}>
              <Text style={styles.textBlockText}>{notes}</Text>
            </View>
          )}

          {workoutDetails && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.workoutDetailsLabel}>WORKOUT DETAILS</Text>
              <View style={styles.textBlock}>
                <Text style={styles.textBlockText}>{workoutDetails}</Text>
              </View>
            </View>
          )}

          {nutritionEntries && nutritionEntries.length > 0 && (
            <View style={styles.nutrBlock}>
              <Text style={styles.nutrBlockLabel}>NUTRITION</Text>
              {nutritionEntries.map((ne, i) => {
                const item = nutrition.find(n => n.id === ne.itemId);
                if (!item) return null;
                return (
                  <Text key={i} style={styles.nutrItemLine}>{ne.servings} × {item.name}</Text>
                );
              })}
              {nutrStats && (
                <View style={styles.nutrTotals}>
                  <View>
                    <Text style={[styles.nutrTotalVal, { color: colors.green }]}>{nutrStats.carbs}</Text>
                    <Text style={styles.nutrTotalLabel}>G CARBS / HR</Text>
                  </View>
                  <View>
                    <Text style={[styles.nutrTotalVal, { color: colors.blue }]}>{nutrStats.hydration}</Text>
                    <Text style={styles.nutrTotalLabel}>ML / HR</Text>
                  </View>
                  <View>
                    <Text style={[styles.nutrTotalVal, { color: colors.amber }]}>{nutrStats.sodium}</Text>
                    <Text style={styles.nutrTotalLabel}>MG SODIUM / HR</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerBtn} onPress={onEdit}>
            <Text style={styles.footerBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerBtn, styles.deleteBtn]} onPress={onDelete}>
            <Text style={[styles.footerBtnText, styles.deleteBtnText]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn} onPress={onClose}>
            <Text style={styles.footerBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // flexGrow + centering lets short entries sit centered in the available space
  // instead of clinging to the top of the screen; longer entries still scroll normally.
  content: { padding: 24, paddingBottom: 24, flexGrow: 1, justifyContent: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bigDist: { fontSize: 34, fontWeight: '800' },
  bigDistUnit: { fontSize: 16, fontWeight: '400', color: colors.muted },
  dateText: { fontSize: 13, color: colors.muted, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  badgeMuted: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeMutedText: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  closeX: { fontSize: 22, color: colors.muted, fontWeight: '300' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  statBox: {
    minWidth: '30%', flexGrow: 1,
    backgroundColor: colors.surface2, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 4, textTransform: 'uppercase' },

  textBlock: {
    backgroundColor: colors.surface2, borderRadius: 10, padding: 14, marginTop: 14,
  },
  textBlockText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  workoutDetailsLabel: {
    fontSize: 10, color: colors.amber, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 6,
  },

  nutrBlock: {
    backgroundColor: colors.surface2, borderRadius: 10, padding: 14, marginTop: 14,
  },
  nutrBlockLabel: {
    fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 8,
  },
  nutrItemLine: { fontSize: 12, color: colors.muted, marginBottom: 2 },
  nutrTotals: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  nutrTotalVal: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  nutrTotalLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },

  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  footerBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  footerBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  deleteBtn: { borderColor: colors.red },
  deleteBtnText: { color: colors.red },
});
