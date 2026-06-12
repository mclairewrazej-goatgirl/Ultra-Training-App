import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, SeasonalSport } from '../types';
import { colors } from '../theme';

export const SKI_SUBTYPES = ['Skate Ski', 'Classic Ski', 'Backcountry Ski', 'Alpine Ski'];

export function isSkiSubtype(s: string): boolean {
  return SKI_SUBTYPES.some(k => k.toLowerCase() === (s || '').toLowerCase());
}

export function isInSkiSeason(ss: SeasonalSport | undefined): boolean {
  if (!ss?.enabled) return false;
  const now = new Date();
  const cur = (now.getMonth() + 1) * 100 + now.getDate();
  const [sm, sd] = ss.startMD.split('-').map(Number);
  const [em, ed] = ss.endMD.split('-').map(Number);
  const start = sm * 100 + sd;
  const end   = em * 100 + ed;
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

function getWeekRange() {
  const now  = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function fmtHours(mins: number) {
  if (!mins) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props { user: User; db: TrainingDB; onSaved: (u: TrainingDB) => void; }

export default function SkiSeasonScreen({ user, db, onSaved }: Props) {
  const ss = db.seasonalSport ?? { enabled: false, startMD: '11-01', endMD: '04-30' };

  const [enabled,  setEnabled]  = useState(ss.enabled);
  const [startMD,  setStartMD]  = useState(ss.startMD);
  const [endMD,    setEndMD]    = useState(ss.endMD);
  const [saving,   setSaving]   = useState(false);

  const inSeason = isInSkiSeason({ enabled, startMD, endMD });

  const { monday, sunday } = useMemo(getWeekRange, []);

  const skiStats = useMemo(() => {
    const inWeek = (d: string) => {
      const dt = new Date(d + 'T12:00:00');
      return dt >= monday && dt <= sunday;
    };
    const weekSki = db.crosses.filter(c => inWeek(c.date) && isSkiSubtype(c.subtype));

    // Season vert
    const [sm, sd] = startMD.split('-').map(Number);
    const [em, ed] = endMD.split('-').map(Number);
    const startN = sm * 100 + sd;
    const endN   = em * 100 + ed;
    const inSeasonRange = (d: string) => {
      const dt  = new Date(d + 'T12:00:00');
      const cur = (dt.getMonth() + 1) * 100 + dt.getDate();
      return startN <= endN ? cur >= startN && cur <= endN : cur >= startN || cur <= endN;
    };
    const seasonSki = db.crosses.filter(c => isSkiSubtype(c.subtype) && inSeasonRange(c.date));

    return {
      days:       weekSki.length,
      weekVert:   weekSki.reduce((s, c)  => s + (Number(c.vert) || 0), 0),
      weekMins:   weekSki.reduce((s, c)  => s + (Number(c.dur)  || 0), 0),
      seasonVert: seasonSki.reduce((s, c) => s + (Number(c.vert) || 0), 0),
    };
  }, [db.crosses, monday, sunday, startMD, endMD]);

  const handleSave = async () => {
    // Validate MM-DD format
    const mdRe = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!mdRe.test(startMD) || !mdRe.test(endMD)) {
      Alert.alert('Invalid date', 'Use MM-DD format, e.g. 11-01');
      return;
    }
    setSaving(true);
    const newDB: TrainingDB = { ...db, seasonalSport: { enabled, startMD, endMD } };
    try {
      await setDoc(
        doc(firestoreDB, 'users', user.uid, 'db', 'data'),
        JSON.parse(JSON.stringify(newDB)),
      );
      onSaved(newDB);
      Alert.alert('Saved', 'Ski season settings updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── This-week stats (only when enabled + in season) ── */}
      {enabled && inSeason && (
        <>
          <Text style={styles.sectionTitle}>THIS WEEK ON SNOW</Text>
          <View style={styles.grid}>
            <StatCard label="Days on Snow"  value={String(skiStats.days)}                     color={colors.blue}   />
            <StatCard label="Weekly Vert"   value={`${Math.round(skiStats.weekVert)} m`}      color={colors.purple} />
            <StatCard label="Hours on Snow" value={fmtHours(skiStats.weekMins)}               color={colors.pink}   />
            <StatCard label="Season Vert"   value={`${skiStats.seasonVert.toLocaleString()} m`} color={colors.green} />
          </View>
          <View style={styles.divider} />
        </>
      )}

      {/* ── Enable / Disable ── */}
      <Text style={styles.sectionTitle}>SKI SEASON TRACKING</Text>
      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, enabled && styles.toggleBtnActive]}
            onPress={() => setEnabled(true)}
          >
            <Text style={[styles.toggleBtnText, enabled && { color: colors.blue }]}>Enabled</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !enabled && styles.toggleBtnOff]}
            onPress={() => setEnabled(false)}
          >
            <Text style={[styles.toggleBtnText, !enabled && { color: colors.muted }]}>Disabled</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          When enabled and the current date is within the season, your Dashboard shows dedicated ski stats.
        </Text>
      </View>

      {/* ── Season dates ── */}
      <Text style={styles.sectionTitle}>SEASON DATES (MM-DD)</Text>
      <View style={styles.dateCard}>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>SEASON START</Text>
            <TextInput
              style={styles.input}
              value={startMD}
              onChangeText={setStartMD}
              placeholder="11-01"
              placeholderTextColor={colors.muted2}
              maxLength={5}
            />
          </View>
          <View style={{ width: 16 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>SEASON END</Text>
            <TextInput
              style={styles.input}
              value={endMD}
              onChangeText={setEndMD}
              placeholder="04-30"
              placeholderTextColor={colors.muted2}
              maxLength={5}
            />
          </View>
        </View>
        <Text style={styles.hint}>Default Nov 1 – Apr 30. Wrap-around seasons (e.g. Nov–Apr) are supported.</Text>
      </View>

      {/* ── What counts ── */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>⛷️ What counts as a ski activity?</Text>
        <Text style={styles.infoBody}>
          Cross-training entries logged with any of these subtypes:{'\n'}
          {SKI_SUBTYPES.join('  ·  ')}
        </Text>
        {enabled && !inSeason && (
          <Text style={[styles.infoBody, { color: colors.amber, marginTop: 8 }]}>
            Today is outside the configured season range — ski stats won't appear on the Dashboard until you're within the season dates.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 20, paddingBottom: 60 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statCard: {
    width: '47.5%', backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, borderTopWidth: 3, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  toggleCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16,
  },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggleBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  toggleBtnActive: { borderColor: colors.blue, backgroundColor: colors.blue + '18' },
  toggleBtnOff:    { borderColor: colors.border },
  toggleBtnText:   { fontSize: 14, fontWeight: '700', color: colors.muted },

  dateCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16,
  },
  dateRow:    { flexDirection: 'row', marginBottom: 10 },
  fieldLabel: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 16, textAlign: 'center',
  },

  hint: { fontSize: 12, color: colors.muted2, lineHeight: 17 },

  infoCard: {
    backgroundColor: colors.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  infoBody:  { fontSize: 13, color: colors.muted, lineHeight: 20 },

  saveBtn: {
    backgroundColor: colors.blue, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
