import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  signInAnonymously,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors } from '../theme';

const WEB_CLIENT_ID = '528346991243-c1knpb5h3f92qunvqievqrdat0c5hp28.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google.');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Sign-in failed', error.message ?? 'Unknown error');
      }
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = () => {
    setLoading(true);
    signInAnonymously(auth).catch(err => {
      Alert.alert('Sign-in failed', err.message);
      setLoading(false);
    });
  };

  return (
    <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.emoji}>🏔️</Text>
        <Text style={styles.title}>Ultra Training</Text>
        <Text style={styles.subtitle}>Your training log, on the go</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardBody}>
          Sign in with the same Google account you use on the web app to access all your training data on your phone.
        </Text>

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#222" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.anonBtn, loading && styles.btnDisabled]}
          onPress={handleAnonymousSignIn}
          disabled={loading}
        >
          <Text style={styles.anonBtnText}>Try without signing in</Text>
        </TouchableOpacity>
        <Text style={styles.anonHint}>Data will not sync with the web app</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  emoji:    { fontSize: 64, marginBottom: 12 },
  title:    { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6 },

  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 24, width: '100%', borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  cardBody:  { fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 20 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20,
    marginBottom: 16,
  },
  googleIcon:    { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { fontSize: 16, fontWeight: '700', color: '#222' },

  divider:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.muted2 },

  anonBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginBottom: 8,
  },
  anonBtnText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  anonHint:    { fontSize: 11, color: colors.muted2, textAlign: 'center' },

  btnDisabled: { opacity: 0.5 },
});
