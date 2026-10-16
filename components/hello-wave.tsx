import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export function HelloWave() {
  const rotation = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 1 + rotation.value / 100 }],
  }));

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(15, { duration: 350 }),
        withTiming(0, { duration: 350 })
      ),
      3,
      false
    );
  }, [rotation]);

  return (
    <Animated.View
      accessibilityLabel="Poké Ball"
      accessibilityRole="image"
      style={[styles.pokeball, animatedStyle]}
    >
      <View style={styles.topHalf} />
      <View style={styles.band} />
      <View style={styles.button} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pokeball: {
    width: 32,
    height: 32,
    marginTop: -6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#202020',
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  topHalf: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: '50%',
    backgroundColor: '#e53935',
  },
  band: {
    position: 'absolute',
    top: '45%',
    right: 0,
    left: 0,
    height: 3,
    backgroundColor: '#202020',
  },
  button: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 11,
    height: 11,
    marginTop: -5.5,
    marginLeft: -5.5,
    borderWidth: 2,
    borderColor: '#202020',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
});
