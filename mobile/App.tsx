import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ActivityEntry } from './src/types';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';

import { auth, db as firestoreDB } from './src/config/firebase';
import { TrainingDB, emptyDB } from './src/types';
import { colors } from './src/theme';

import LoginScreen        from './src/screens/LoginScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import LogScreen          from './src/screens/LogScreen';
import AddWorkoutScreen   from './src/screens/AddWorkoutScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import EditWorkoutModal   from './src/screens/EditWorkoutModal';
import CalendarScreen     from './src/screens/CalendarScreen';

const Tab = createBottomTabNavigator();

// Simple icon component using text characters so we don't need an icon library
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard:      '⚡',
    'Activity Log': '📋',
    Add:            '＋',
    Calendar:       '📅',
    Profile:        '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '•'}
    </Text>
  );
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
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => (
              <TabIcon label={route.name} focused={focused} />
            ),
            tabBarLabel: route.name === 'Add' ? '' : route.name,
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
                onNavigateToAdd={() => {/* navigate via tab */}}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Activity Log" options={{ tabBarLabel: 'Log' }}>
            {() => <LogScreen db={db} onEditEntry={setEditingEntry} />}
          </Tab.Screen>

          <Tab.Screen name="Add" options={{ title: 'Log Workout' }}>
            {() => (
              <AddWorkoutScreen
                user={user}
                db={db}
                onSaved={handleDBUpdate}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Calendar">
            {() => <CalendarScreen user={user} db={db} onSaved={handleDBUpdate} />}
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
