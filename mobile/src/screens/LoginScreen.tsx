import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors } from '../theme';

// Required for expo-auth-session to complete the OAuth flow
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '528346991243-c1knpb5h3f92qunvqievqrdat0c5hp28.apps.googleusercontent.com';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  });

  // Handle the OAuth response when it comes back
  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .catch((err) => {
          Alert.alert('Sign-in failed', err.message);
          setLoading(false);
        });
    }
  }, [response]);

  const handleSignIn = async () => {
    setLoading(true);
    await promptAsync({ useProxy: true });
    setLoading(false);
  };

  return (
    <LinearGradient colors={[colors.bg, colors.surface]} style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.emoji}>🏃</Text>
        <Text style={styles.title}>Ultra Training</Text>
        <Text style={styles.subtitle}>Your training log, on the go</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign in to continue</Text>
        <Text style={styles.cardBody}>
          Use the same Google account as your web app — your data is shared.
        </Text>

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
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
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
