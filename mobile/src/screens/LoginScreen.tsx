import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors } from '../theme';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  // Anonymous sign-in lets you explore the app UI without Google OAuth setup.
  // Replace with Google Sign-In once you have a proper development build.
  const handleAnonymousSignIn = async () => {
    setLoading(true);
    signInAnonymously(auth).catch((err) => {
      Alert.alert('Sign-in failed', err.message);
      setLoading(false);
    });
  };

  return (
    <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.emoji}>🏃</Text>
        <Text style={styles.title}>Ultra Training</Text>
        <Text style={styles.subtitle}>Your training log, on the go</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome</Text>
        <Text style={styles.cardBody}>
          Sign in to explore the app. Use "Try the app" to browse the UI,
          or sign in with Google once you have a development build set up.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleAnonymousSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Try the app →</Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pink,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
