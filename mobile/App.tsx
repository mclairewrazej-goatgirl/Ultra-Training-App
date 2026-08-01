import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityEntry } from './src/types';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onSnapshot, doc, setDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';

import { auth, db as firestoreDB } from './src/config/firebase';
import { TrainingDB, Race, emptyDB } from './src/types';
import { colors } from './src/theme';

import LoginScreen        from './src/screens/LoginScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import LogScreen          from './src/screens/LogScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import EditWorkoutModal   from './src/screens/EditWorkoutModal';
import CalendarScreen     from './src/screens/CalendarScreen';
import ExploreScreen      from './src/screens/ExploreScreen';
import RegistrationReminderModal, { daysUntil } from './src/screens/RegistrationReminderModal';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, [string, string]> = {
  Dashboard:      ['grid',         'grid-outline'        ],
  'Activity Log': ['pulse',        'pulse-outline'       ],
  Explore:        ['stats-chart',  'stats-chart-outline' ],
  Calendar:       ['calendar',     'calendar-outline'    ],
  Profile:        ['person',       'person-outline'      ],
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const [active, inactive] = TAB_ICONS[label] ?? ['ellipse', 'ellipse-outline'];
  const color = focused ? colors.pink : colors.muted;
  return <Ionicons name={(focused ? active : inactive) as any} size={focused ? 24 : 22} color={color} />;
}

export default function App() {
  const [user, setUser]       = useState<User | null>(null);
  const [db, setDB]           = useState<TrainingDB>(emptyDB);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) setDB(emptyDB);
    });
    return unsubscribe;
  }, []);

  // Listen for Firestore data changes when signed in
  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    const docRef = doc(firestoreDB, 'users', user.uid, 'db', 'data');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setDB({ ...emptyDB, ...snap.data() } as TrainingDB);
      }
      setDataLoading(false);
    }, () => {
      setDataLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleDBUpdate = useCallback((updated: TrainingDB) => {
    setDB(updated);
  }, []);

  const [editingEntry, setEditingEntry] = useState<ActivityEntry | null>(null);

  // Registration reminders — surface a popup for the soonest upcoming, unacknowledged race
  // whose registration opens within the next 7 days.
  const [regReminderRace, setRegReminderRace] = useState<Race | null>(null);

  useEffect(() => {
    if (dataLoading || db.races.length === 0) { setRegReminderRace(null); return; }
    const candidates = db.races
      .filter(r => r.regOpenDate && !r.regReminderAcknowledged)
      .filter(r => { const d = daysUntil(r.regOpenDate!); return d >= 0 && d <= 7; })
      .sort((a, b) => daysUntil(a.regOpenDate!) - daysUntil(b.regOpenDate!));
    setRegReminderRace(candidates[0] ?? null);
  }, [db, dataLoading]);

  const handleAcknowledgeReminder = useCallback(async () => {
    if (!regReminderRace || !user) return;
    const newDB: TrainingDB = {
      ...db,
      races: db.races.map(r => r.id === regReminderRace.id ? { ...r, regReminderAcknowledged: true } : r),
    };
    setRegReminderRace(null);
    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      setDB(newDB);
    } catch {
      // Firestore listener will resync on the next snapshot regardless.
    }
  }, [regReminderRace, user, db]);

  const handleDismissReminder = useCallback(() => setRegReminderRace(null), []);

  // Waiting for Firebase Auth to initialize
  if (!authReady) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashEmoji}>🏃</Text>
        <ActivityIndicator color={colors.pink} size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }

  // Signed in — show the main app
  return (
    <>
      <StatusBar style="light" />
      {dataLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator color={colors.pink} size="small" />
          <Text style={styles.loadingText}>Syncing…</Text>
        </View>
      )}
      <EditWorkoutModal
        visible={!!editingEntry}
        entry={editingEntry}
        user={user}
        db={db}
        onSaved={handleDBUpdate}
        onClose={() => setEditingEntry(null)}
      />
      <RegistrationReminderModal
        race={regReminderRace}
        onAcknowledge={handleAcknowledgeReminder}
        onLater={handleDismissReminder}
      />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => (
              <TabIcon label={route.name} focused={focused} />
            ),
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 70,
              paddingBottom: 10,
            },
            tabBarActiveTintColor:   colors.pink,
            tabBarInactiveTintColor: colors.muted,
            headerStyle: { backgroundColor: colors.surface, shadowColor: 'transparent' },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
          })}
        >
          <Tab.Screen name="Dashboard">
            {() => (
              <DashboardScreen
                user={user}
                db={db}
                onSaved={handleDBUpdate}
                onEditEntry={setEditingEntry}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Activity Log" options={{ tabBarLabel: 'Log' }}>
            {() => (
              <LogScreen
                user={user}
                db={db}
                onSaved={handleDBUpdate}
                onEditEntry={setEditingEntry}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Explore">
            {() => <ExploreScreen db={db} />}
          </Tab.Screen>

          <Tab.Screen name="Calendar">
            {() => (
              <CalendarScreen
                user={user}
                db={db}
                onSaved={handleDBUpdate}
                onEditEntry={setEditingEntry}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Profile">
            {() => <ProfileScreen user={user} db={db} onSaved={handleDBUpdate} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashEmoji: { fontSize: 64 },

  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
    paddingVertical: 6,
  },
  loadingText: { fontSize: 12, color: colors.muted },
});
