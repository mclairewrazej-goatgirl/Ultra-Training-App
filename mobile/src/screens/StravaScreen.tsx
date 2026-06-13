import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { colors } from '../theme';
import { TrainingDB, StravaTokens, Race, PlannedWorkout } from '../types';
import {
  connectStrava, exchangeStravaCode, getValidToken, fetchStravaActivities,
  buildSyncQueue, addEntryToDB, formatRaceResult, mToKm, secToMin,
  RaceMatch, PlanMatch, SyncItem,
} from '../strava';

const STRAVA_ORANGE = '#FC4C02';

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

function fmtDist(km: number) { return `${km.toFixed(1)} km`; }
function fmtDur(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StravaScreen({ user, db, onSaved }: Props) {
  const tokens = db.stravaTokens;
  const isConnected = !!(tokens?.accessToken);

  const [connecting, setConnecting] = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState('');
  const [raceQueue,  setRaceQueue]  = useState<RaceMatch[]>([]);
  const [planQueue,  setPlanQueue]  = useState<PlanMatch[]>([]);

  // workDB accumulates changes during sync; use ref to avoid stale closure in effect
  const workDBRef  = useRef<TrainingDB | null>(null);
  const newCountRef = useRef(0);
  const savingRef  = useRef(false);

  // When both queues empty, save accumulated changes to Firestore
  useEffect(() => {
    if (!syncing || savingRef.current || workDBRef.current === null) return;
    if (raceQueue.length > 0 || planQueue.length > 0) return;

    savingRef.current = true;
    const finalDB = workDBRef.current;
    const n = newCountRef.current;

    setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(finalDB)))
      .then(() => {
        onSaved(finalDB);
        setSyncMsg(`Synced ${n} new ${n === 1 ? 'activity' : 'activities'}!`);
      })
      .catch((err: any) => Alert.alert('Save failed', err.message))
      .finally(() => {
        setSyncing(false);
        savingRef.current = false;
        workDBRef.current = null;
      });
  }, [syncing, raceQueue, planQueue]); // eslint-disable-line

  // ── Connect ──────────────────────────────────────────────────────────────────

  async function handleConnect() {
    setConnecting(true);
    try {
      const code = await connectStrava();
      if (!code) { setConnecting(false); return; }

      const newTokens = await exchangeStravaCode(code);
      const newDB = { ...db, stravaTokens: newTokens };
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
    } catch (err: any) {
      Alert.alert('Connection failed', err.message);
    }
    setConnecting(false);
  }

  function handleDisconnect() {
    Alert.alert(
      'Disconnect Strava',
      'Remove the Strava connection? Your synced activities will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive',
          onPress: async () => {
            const { stravaTokens, stravaProcessedIds, ...rest } = db as any;
            const newDB = { ...rest };
            await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
            onSaved(newDB);
          },
        },
      ],
    );
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  async function handleSync() {
    if (!tokens) return;
    setSyncing(true);
    setSyncMsg('Fetching activities from Strava…');
    setRaceQueue([]);
    setPlanQueue([]);
    workDBRef.current = null;
    savingRef.current = false;

    try {
      const { accessToken, refreshed } = await getValidToken(tokens);

      // If token was refreshed, persist the new tokens
      let baseDB: TrainingDB = refreshed
        ? { ...db, stravaTokens: refreshed }
        : db;

      const activities = await fetchStravaActivities(accessToken);
      const queue = buildSyncQueue(activities, baseDB);

      if (queue.totalNew === 0) {
        setSyncMsg('All caught up — no new activities.');
        setSyncing(false);
        return;
      }

      setSyncMsg(`Found ${queue.totalNew} new ${queue.totalNew === 1 ? 'activity' : 'activities'}.`);
      newCountRef.current = queue.totalNew;

      // Stamp new IDs and add direct (no-match) activities immediately
      let w: TrainingDB = {
        ...baseDB,
        stravaProcessedIds: [...(baseDB.stravaProcessedIds ?? []), ...queue.newIds],
      };
      for (const item of queue.directAdds) {
        w = addEntryToDB(w, item.entry);
      }
      workDBRef.current = w;

      // Set queues — the useEffect handles saving once they drain to zero
      setRaceQueue(queue.raceQueue);
      setPlanQueue(queue.planQueue);

    } catch (err: any) {
      Alert.alert('Sync failed', err.message);
      setSyncing(false);
    }
  }

  // ── Race modal ────────────────────────────────────────────────────────────────

  function handleRaceDecision(recordResult: boolean) {
    const item = raceQueue[0];
    if (!workDBRef.current) return;

    let w = workDBRef.current;
    if (recordResult) {
      w = {
        ...w,
        races: w.races.map((r: Race) =>
          r.id === item.race.id
            ? { ...r, result: formatRaceResult(item.activity.moving_time), stravaActivityId: String(item.activity.id) }
            : r
        ),
      };
    }
    workDBRef.current = addEntryToDB(w, item.entry);
    setRaceQueue(q => q.slice(1));
  }

  // ── Plan modal ────────────────────────────────────────────────────────────────

  function handlePlanDecision(planId: string | null) {
    const item = planQueue[0];
    if (!workDBRef.current) return;

    let w = workDBRef.current;
    if (planId) {
      w = {
        ...w,
        plans: w.plans.map((p: PlannedWorkout) =>
          p.id === planId
            ? {
                ...p,
                completed:         true,
                actualDist:        mToKm(item.activity.distance),
                actualDur:         secToMin(item.activity.moving_time),
                actualVert:        Math.round(item.activity.total_elevation_gain),
                actualHr:          item.activity.average_heartrate,
                completionNotes:   `Strava: ${item.activity.name}`,
                stravaActivityId:  String(item.activity.id),
              }
            : p
        ),
      };
    }
    workDBRef.current = addEntryToDB(w, item.entry);
    setPlanQueue(q => q.slice(1));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const currentRace = raceQueue[0] ?? null;
  const currentPlan = planQueue.length > 0 && raceQueue.length === 0 ? planQueue[0] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Connection card */}
      <View style={styles.brandCard}>
        <View style={styles.brandRow}>
          <View style={styles.sLogo}>
            <Text style={styles.sLogoText}>S</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Strava</Text>
            {isConnected ? (
              <Text style={styles.brandSub}>Connected as {tokens!.athleteName || 'Athlete'}</Text>
            ) : (
              <Text style={styles.brandSub}>Not connected</Text>
            )}
          </View>
          {isConnected && (
            <Ionicons name="checkmark-circle" size={22} color={STRAVA_ORANGE} />
          )}
        </View>
      </View>

      {isConnected ? (
        <>
          <Text style={styles.infoText}>
            Tap Sync to import the last 60 days of Strava activities. New activities are added to your log, and we'll check for matches with any upcoming races or planned workouts.
          </Text>

          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.btnDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sync-outline" size={18} color="#fff" />
                <Text style={styles.syncBtnText}>Sync Activities</Text>
              </>
            )}
          </TouchableOpacity>

          {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}

          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Disconnect Strava</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.infoText}>
            Connect your Strava account to automatically sync activities into your training log. Strava matches are checked against your planned workouts and races.
          </Text>

          <TouchableOpacity
            style={[styles.connectBtn, connecting && styles.btnDisabled]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <View style={styles.sLogoSm}><Text style={styles.sLogoSmText}>S</Text></View>
                <Text style={styles.connectBtnText}>Connect with Strava</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* ── Race match modal ─────────────────────────────────────── */}
      <Modal visible={!!currentRace} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => handleRaceDecision(false)}>
        {currentRace && (
          <View style={styles.modalWrap}>
            <Text style={styles.modalTitle}>Race day match?</Text>
            <Text style={styles.modalSub}>This Strava activity looks like one of your upcoming races.</Text>

            <ActivityCard act={currentRace.activity} />

            <View style={styles.matchCard}>
              <Text style={styles.matchLabel}>MATCHES RACE</Text>
              <Text style={styles.matchName}>{currentRace.race.name}</Text>
              <Text style={styles.matchMeta}>
                {fmtDate(currentRace.race.date)} · {fmtDist(Number(currentRace.race.dist))}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: STRAVA_ORANGE }]}
              onPress={() => handleRaceDecision(true)}
            >
              <Text style={styles.modalPrimaryBtnText}>Yes, record my result</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => handleRaceDecision(false)}
            >
              <Text style={styles.modalSecondaryBtnText}>Add to log only</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── Plan match modal ─────────────────────────────────────── */}
      <Modal visible={!!currentPlan} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => handlePlanDecision(null)}>
        {currentPlan && (
          <View style={styles.modalWrap}>
            <Text style={styles.modalTitle}>Planned workout match</Text>
            <Text style={styles.modalSub}>This activity matches a planned workout. Which one did it complete?</Text>

            <ActivityCard act={currentPlan.activity} />

            <Text style={styles.planListLabel}>PLANNED WORKOUTS ON THIS DAY</Text>
            {currentPlan.plans.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.planOption}
                onPress={() => handlePlanDecision(p.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planOptionType}>{p.type}</Text>
                  {p.desc ? <Text style={styles.planOptionDesc}>{p.desc}</Text> : null}
                  {Number(p.dist) > 0 && (
                    <Text style={styles.planOptionMeta}>{fmtDist(Number(p.dist))}</Text>
                  )}
                </View>
                <Ionicons name="checkmark-circle-outline" size={22} color={STRAVA_ORANGE} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => handlePlanDecision(null)}
            >
              <Text style={styles.modalSecondaryBtnText}>None, just add to log</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

    </ScrollView>
  );
}

function ActivityCard({ act }: { act: any }) {
  const dist = mToKm(act.distance);
  const dur  = secToMin(act.moving_time);
  const vert = Math.round(act.total_elevation_gain);
  return (
    <View style={styles.actCard}>
      <View style={[styles.actCardStripe, { backgroundColor: STRAVA_ORANGE }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.actCardName}>{act.name || act.sport_type || act.type}</Text>
        <Text style={styles.actCardMeta}>
          {fmtDist(dist)} · {fmtDur(dur)}{vert > 0 ? ` · ${vert} m ↑` : ''}
        </Text>
        <Text style={styles.actCardDate}>{fmtDate(act.start_date_local)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: 20, paddingBottom: 40 },

  brandCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16,
  },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sLogo:       { width: 44, height: 44, borderRadius: 10, backgroundColor: STRAVA_ORANGE, alignItems: 'center', justifyContent: 'center' },
  sLogoText:   { fontSize: 22, fontWeight: '900', color: '#fff' },
  brandTitle:  { fontSize: 17, fontWeight: '800', color: colors.text },
  brandSub:    { fontSize: 12, color: colors.muted, marginTop: 2 },

  infoText: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 20 },

  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: STRAVA_ORANGE, borderRadius: 12, paddingVertical: 14,
  },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sLogoSm:       { width: 22, height: 22, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  sLogoSmText:   { fontSize: 13, fontWeight: '900', color: '#fff' },

  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: STRAVA_ORANGE, borderRadius: 12, paddingVertical: 14, marginBottom: 12,
  },
  syncBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  syncMsg:     { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 16 },

  disconnectBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  disconnectText: { fontSize: 14, fontWeight: '600', color: colors.muted },

  btnDisabled: { opacity: 0.5 },

  // Modals
  modalWrap: {
    flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 28,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
  modalSub:   { fontSize: 14, color: colors.muted, marginBottom: 20, lineHeight: 20 },

  actCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  actCardStripe: { width: 4 },
  actCardName:   { fontSize: 15, fontWeight: '700', color: colors.text, padding: 12, paddingBottom: 2 },
  actCardMeta:   { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 2 },
  actCardDate:   { fontSize: 12, color: colors.muted2, paddingHorizontal: 12, paddingBottom: 12 },

  matchCard: {
    backgroundColor: colors.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20,
  },
  matchLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  matchName:  { fontSize: 16, fontWeight: '700', color: colors.text },
  matchMeta:  { fontSize: 13, color: colors.muted, marginTop: 2 },

  planListLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  planOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  planOptionType: { fontSize: 15, fontWeight: '700', color: colors.text },
  planOptionDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  planOptionMeta: { fontSize: 12, color: STRAVA_ORANGE, marginTop: 2 },

  modalPrimaryBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  modalPrimaryBtnText:   { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalSecondaryBtn:     { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.muted },
});
