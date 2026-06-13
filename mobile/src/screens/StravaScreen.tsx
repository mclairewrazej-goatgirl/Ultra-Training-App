import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Modal, ScrollView, FlatList,
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
  StravaActivity, RaceMatch, PlanMatch, SyncRange,
} from '../strava';

const STRAVA_ORANGE = '#FC4C02';

const RANGES: { key: SyncRange; label: string }[] = [
  { key: 'count5', label: 'Last 5'  },
  { key: 'days7',  label: '7 days'  },
  { key: 'days14', label: '2 weeks' },
  { key: 'days30', label: '30 days' },
  { key: 'days60', label: '60 days' },
];

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
function fmtStravaDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
function fmtRaceDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
function actTypeColor(act: StravaActivity) {
  const t = act.sport_type || act.type;
  if (['Run', 'TrailRun', 'VirtualRun', 'Hike', 'Walk'].includes(t)) return colors.pink;
  if (['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'].includes(t)) return colors.blue;
  if (['NordicSki', 'BackcountrySki', 'AlpineSki'].includes(t)) return '#38bdf8';
  if (['WeightTraining', 'Crossfit', 'Yoga', 'RockClimbing'].includes(t)) return colors.amber;
  return colors.muted;
}

export default function StravaScreen({ user, db, onSaved }: Props) {
  const tokens = db.stravaTokens;
  const isConnected = !!(tokens?.accessToken);

  const [connecting, setConnecting] = useState(false);
  const [fetching,   setFetching]   = useState(false);
  const [fetchMsg,   setFetchMsg]   = useState('');
  const [syncRange,  setSyncRange]  = useState<SyncRange>('count5');

  // Activity picker
  const [pickerActivities, setPickerActivities] = useState<StravaActivity[]>([]);
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [showPicker,       setShowPicker]       = useState(false);

  // Sync (race/plan matching modals + auto-save)
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [raceQueue, setRaceQueue] = useState<RaceMatch[]>([]);
  const [planQueue, setPlanQueue] = useState<PlanMatch[]>([]);

  const workDBRef   = useRef<TrainingDB | null>(null);
  const newCountRef = useRef(0);
  const savingRef   = useRef(false);

  // When both queues drain, save accumulated changes
  useEffect(() => {
    if (!syncing || savingRef.current || workDBRef.current === null) return;
    if (raceQueue.length > 0 || planQueue.length > 0) return;

    savingRef.current = true;
    const finalDB = workDBRef.current;
    const n = newCountRef.current;

    setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(finalDB)))
      .then(() => {
        onSaved(finalDB);
        setSyncMsg(`Synced ${n} ${n === 1 ? 'activity' : 'activities'}!`);
      })
      .catch((err: any) => Alert.alert('Save failed', err.message))
      .finally(() => {
        setSyncing(false);
        savingRef.current = false;
        workDBRef.current = null;
      });
  }, [syncing, raceQueue, planQueue]); // eslint-disable-line

  // ── Connect / Disconnect ─────────────────────────────────────────────────────

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

  // ── Fetch activities → show picker ───────────────────────────────────────────

  async function handleFetch() {
    if (!tokens) return;
    setFetching(true);
    setFetchMsg('');
    setSyncMsg('');

    try {
      const { accessToken, refreshed } = await getValidToken(tokens);

      if (refreshed) {
        const newDB = { ...db, stravaTokens: refreshed };
        await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
        onSaved(newDB);
      }

      const activities = await fetchStravaActivities(accessToken, syncRange);
      const processed = new Set(db.stravaProcessedIds ?? []);
      const newActivities = activities.filter(a => !processed.has(String(a.id)));

      if (newActivities.length === 0) {
        setFetchMsg('All caught up — no new activities in this range.');
        setFetching(false);
        return;
      }

      setPickerActivities(newActivities);
      setSelectedIds(new Set(newActivities.map(a => String(a.id)))); // default: all selected
      setShowPicker(true);

    } catch (err: any) {
      Alert.alert('Fetch failed', err.message);
    }
    setFetching(false);
  }

  function toggleActivity(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Start sync with selected activities ──────────────────────────────────────

  function handleStartSync() {
    setShowPicker(false);

    const selected = pickerActivities.filter(a => selectedIds.has(String(a.id)));
    if (selected.length === 0) return;

    setSyncing(true);
    setSyncMsg(`Processing ${selected.length} ${selected.length === 1 ? 'activity' : 'activities'}…`);
    newCountRef.current = selected.length;
    workDBRef.current = null;
    savingRef.current = false;
    setRaceQueue([]);
    setPlanQueue([]);

    const queue = buildSyncQueue(selected, db);

    let w: TrainingDB = {
      ...db,
      stravaProcessedIds: [...(db.stravaProcessedIds ?? []), ...queue.newIds],
    };
    for (const item of queue.directAdds) {
      w = addEntryToDB(w, item.entry);
    }
    workDBRef.current = w;

    setRaceQueue(queue.raceQueue);
    setPlanQueue(queue.planQueue);
    // useEffect handles saving when queues drain to zero
  }

  // ── Race modal decision ──────────────────────────────────────────────────────

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

  // ── Plan modal decision ──────────────────────────────────────────────────────

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
                completed:        true,
                completedEntryId: item.entry.id,
                actualDist:       mToKm(item.activity.distance),
                actualDur:        secToMin(item.activity.moving_time),
                actualVert:       Math.round(item.activity.total_elevation_gain),
                actualHr:         item.activity.average_heartrate,
                completionNotes:  `Strava: ${item.activity.name}`,
                stravaActivityId: String(item.activity.id),
              }
            : p
        ),
      };
    }
    workDBRef.current = addEntryToDB(w, item.entry);
    setPlanQueue(q => q.slice(1));
  }

  const currentRace = raceQueue[0] ?? null;
  const currentPlan = raceQueue.length === 0 ? (planQueue[0] ?? null) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Brand card */}
      <View style={styles.brandCard}>
        <View style={styles.brandRow}>
          <View style={styles.sLogo}>
            <Text style={styles.sLogoText}>S</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Strava</Text>
            <Text style={styles.brandSub}>
              {isConnected ? `Connected as ${tokens!.athleteName || 'Athlete'}` : 'Not connected'}
            </Text>
          </View>
          {isConnected && <Ionicons name="checkmark-circle" size={22} color={STRAVA_ORANGE} />}
        </View>
      </View>

      {isConnected ? (
        <>
          <Text style={styles.infoText}>
            Fetch activities from Strava, pick which ones to import, and we'll check for race or planned workout matches.
          </Text>

          {/* Range selector */}
          <Text style={styles.rangeLabel}>FETCH RANGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeScroll}
            contentContainerStyle={styles.rangeRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.rangeChip, syncRange === r.key && styles.rangeChipActive]}
                onPress={() => setSyncRange(r.key)}
              >
                <Text style={[styles.rangeChipText, syncRange === r.key && styles.rangeChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Fetch button */}
          <TouchableOpacity
            style={[styles.fetchBtn, fetching && styles.btnDisabled]}
            onPress={handleFetch}
            disabled={fetching || syncing}
          >
            {fetching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                <Text style={styles.fetchBtnText}>Fetch Activities</Text>
              </>
            )}
          </TouchableOpacity>

          {fetchMsg ? <Text style={styles.statusMsg}>{fetchMsg}</Text> : null}

          {syncing && (
            <View style={styles.syncingRow}>
              <ActivityIndicator size="small" color={STRAVA_ORANGE} />
              <Text style={styles.syncingText}>{syncMsg}</Text>
            </View>
          )}
          {!syncing && syncMsg ? <Text style={styles.statusMsg}>{syncMsg}</Text> : null}

          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Disconnect Strava</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.infoText}>
            Connect your Strava account to import activities into your training log. Strava activities can be matched to planned workouts and races automatically.
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

      {/* ── Activity picker modal ───────────────────────────────── */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}>
        <View style={styles.pickerShell}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Select Activities</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.pickerTopRow}>
            <Text style={styles.pickerCount}>
              {pickerActivities.length} new {pickerActivities.length === 1 ? 'activity' : 'activities'}
            </Text>
            <View style={styles.selectAllRow}>
              <TouchableOpacity onPress={() => setSelectedIds(new Set(pickerActivities.map(a => String(a.id))))}>
                <Text style={styles.selectLink}>All</Text>
              </TouchableOpacity>
              <Text style={styles.selectSep}>·</Text>
              <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
                <Text style={styles.selectLink}>None</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={pickerActivities}
            keyExtractor={a => String(a.id)}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item: act }) => {
              const id = String(act.id);
              const checked = selectedIds.has(id);
              const dot = actTypeColor(act);
              const dist = act.distance > 0 ? fmtDist(mToKm(act.distance)) : null;
              const dur  = act.moving_time > 0 ? fmtDur(secToMin(act.moving_time)) : null;
              return (
                <TouchableOpacity style={styles.pickerRow} onPress={() => toggleActivity(id)}>
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={checked ? STRAVA_ORANGE : colors.muted}
                    style={{ marginRight: 12 }}
                  />
                  <View style={[styles.actDot, { backgroundColor: dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerActName} numberOfLines={1}>{act.name || act.sport_type || act.type}</Text>
                    <Text style={styles.pickerActMeta}>
                      {fmtStravaDate(act.start_date_local)}
                      {dist || dur ? `  ·  ${[dist, dur].filter(Boolean).join('  ·  ')}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.pickerFooter}>
            <TouchableOpacity
              style={[styles.syncBtn, selectedIds.size === 0 && styles.btnDisabled]}
              onPress={handleStartSync}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.syncBtnText}>
                Sync {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}
                {selectedIds.size === 1 ? 'Activity' : 'Activities'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Race match modal ────────────────────────────────────── */}
      <Modal visible={!!currentRace} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => handleRaceDecision(false)}>
        {currentRace && (
          <View style={styles.matchWrap}>
            <Text style={styles.matchTitle}>Race day match?</Text>
            <Text style={styles.matchSub}>This Strava activity looks like one of your upcoming races.</Text>

            <ActivityCard act={currentRace.activity} />

            <View style={styles.matchCard}>
              <Text style={styles.matchCardLabel}>MATCHES RACE</Text>
              <Text style={styles.matchCardName}>{currentRace.race.name}</Text>
              <Text style={styles.matchCardMeta}>
                {fmtRaceDate(currentRace.race.date)} · {fmtDist(Number(currentRace.race.dist))}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: STRAVA_ORANGE }]}
              onPress={() => handleRaceDecision(true)}
            >
              <Text style={styles.primaryBtnText}>Yes, record my result</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleRaceDecision(false)}>
              <Text style={styles.secondaryBtnText}>Add to log only</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ── Plan match modal ────────────────────────────────────── */}
      <Modal visible={!!currentPlan} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => handlePlanDecision(null)}>
        {currentPlan && (
          <View style={styles.matchWrap}>
            <Text style={styles.matchTitle}>Planned workout match</Text>
            <Text style={styles.matchSub}>This activity matches a planned workout. Which one did it complete?</Text>

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

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => handlePlanDecision(null)}>
              <Text style={styles.secondaryBtnText}>None, just add to log</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

    </ScrollView>
  );
}

function ActivityCard({ act }: { act: StravaActivity }) {
  const dist = act.distance > 0 ? fmtDist(mToKm(act.distance)) : null;
  const dur  = act.moving_time > 0 ? fmtDur(secToMin(act.moving_time)) : null;
  const vert = act.total_elevation_gain > 0 ? `${Math.round(act.total_elevation_gain)} m ↑` : null;
  return (
    <View style={styles.actCard}>
      <View style={[styles.actCardStripe, { backgroundColor: STRAVA_ORANGE }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.actCardName}>{act.name || act.sport_type || act.type}</Text>
        <Text style={styles.actCardMeta}>
          {[dist, dur, vert].filter(Boolean).join('  ·  ')}
        </Text>
        <Text style={styles.actCardDate}>{fmtStravaDate(act.start_date_local)}</Text>
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
  brandRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sLogo:      { width: 44, height: 44, borderRadius: 10, backgroundColor: STRAVA_ORANGE, alignItems: 'center', justifyContent: 'center' },
  sLogoText:  { fontSize: 22, fontWeight: '900', color: '#fff' },
  brandTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  brandSub:   { fontSize: 12, color: colors.muted, marginTop: 2 },

  infoText: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 16 },

  rangeLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  rangeScroll: { marginBottom: 16 },
  rangeRow:   { flexDirection: 'row', gap: 6, paddingRight: 8 },
  rangeChip:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface2 },
  rangeChipActive:     { borderColor: STRAVA_ORANGE, backgroundColor: STRAVA_ORANGE + '18' },
  rangeChipText:       { fontSize: 13, fontWeight: '600', color: colors.muted },
  rangeChipTextActive: { color: STRAVA_ORANGE },

  fetchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: STRAVA_ORANGE, borderRadius: 12, paddingVertical: 14, marginBottom: 12,
  },
  fetchBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  statusMsg: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 16 },
  syncingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 },
  syncingText: { fontSize: 13, color: STRAVA_ORANGE, fontWeight: '600' },

  disconnectBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  disconnectText: { fontSize: 14, fontWeight: '600', color: colors.muted },

  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: STRAVA_ORANGE, borderRadius: 12, paddingVertical: 14,
  },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sLogoSm:    { width: 22, height: 22, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  sLogoSmText:{ fontSize: 13, fontWeight: '900', color: '#fff' },

  btnDisabled: { opacity: 0.5 },

  // Picker modal
  pickerShell: { flex: 1, backgroundColor: colors.bg },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn:   { fontSize: 16, color: colors.pink, fontWeight: '600', width: 60 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  pickerTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerCount:  { fontSize: 13, color: colors.muted, fontWeight: '600' },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectLink:   { fontSize: 13, color: STRAVA_ORANGE, fontWeight: '700' },
  selectSep:    { fontSize: 13, color: colors.muted2 },

  pickerList: { paddingBottom: 8 },
  pickerRow:  {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  actDot:       { width: 8, height: 8, borderRadius: 4, marginRight: 10, flexShrink: 0 },
  pickerActName:{ fontSize: 14, fontWeight: '600', color: colors.text },
  pickerActMeta:{ fontSize: 12, color: colors.muted, marginTop: 2 },

  pickerFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  syncBtn:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: STRAVA_ORANGE, borderRadius: 12, paddingVertical: 14,
  },
  syncBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Match modals
  matchWrap:  { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 28 },
  matchTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
  matchSub:   { fontSize: 14, color: colors.muted, marginBottom: 20, lineHeight: 20 },

  actCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginBottom: 16,
  },
  actCardStripe: { width: 4 },
  actCardName:   { fontSize: 15, fontWeight: '700', color: colors.text, padding: 12, paddingBottom: 2 },
  actCardMeta:   { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 2 },
  actCardDate:   { fontSize: 12, color: colors.muted2, paddingHorizontal: 12, paddingBottom: 12 },

  matchCard:      { backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20 },
  matchCardLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  matchCardName:  { fontSize: 16, fontWeight: '700', color: colors.text },
  matchCardMeta:  { fontSize: 13, color: colors.muted, marginTop: 2 },

  planListLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  planOption:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  planOptionType: { fontSize: 15, fontWeight: '700', color: colors.text },
  planOptionDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  planOptionMeta: { fontSize: 12, color: STRAVA_ORANGE, marginTop: 2 },

  primaryBtn:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn:     { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.muted },
});
