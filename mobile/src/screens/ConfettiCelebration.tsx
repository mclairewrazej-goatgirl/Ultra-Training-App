import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, Dimensions } from 'react-native';
import { colors } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIECE_COLORS = [colors.pink, colors.blue, colors.green, colors.amber, colors.purple, colors.red];
const PIECE_COUNT = 28;
const DURATION_MS = 1900;

interface Piece {
  left: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  rotateDeg: number;
  anim: Animated.Value;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: Math.random() * SCREEN_W,
    color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
    size: 6 + Math.random() * 6,
    delay: Math.random() * 300,
    duration: 1200 + Math.random() * 500,
    rotateDeg: Math.random() * 720 - 360,
    anim: new Animated.Value(0),
  }));
}

interface Props {
  visible: boolean;
  message?: string;
  onDone: () => void;
}

// Hand-rolled confetti (RN Animated only) — no new native dependency required.
export default function ConfettiCelebration({ visible, message = 'Congrats on your race! 🎉', onDone }: Props) {
  const piecesRef = useRef<Piece[]>([]);

  useEffect(() => {
    if (!visible) return;
    piecesRef.current = makePieces();
    const animations = piecesRef.current.map(p =>
      Animated.timing(p.anim, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    );
    Animated.parallel(animations).start();
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay} pointerEvents="none">
        {piecesRef.current.map((p, i) => {
          const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, SCREEN_H * 0.75] });
          const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotateDeg}deg`] });
          const opacity = p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
          return (
            <Animated.View
              key={i}
              style={[
                styles.piece,
                {
                  left: p.left,
                  width: p.size,
                  height: p.size * 1.6,
                  backgroundColor: p.color,
                  opacity,
                  transform: [{ translateY }, { rotate }],
                },
              ]}
            />
          );
        })}
        <View style={styles.messageWrap}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'transparent' },
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
  messageWrap: {
    position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center',
  },
  messageText: {
    fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center',
    textShadowColor: '#000000aa', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 },
    paddingHorizontal: 24,
  },
});
