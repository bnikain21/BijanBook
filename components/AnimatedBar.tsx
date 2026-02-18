import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

interface AnimatedBarProps {
  pct: number;
  color: string;
  height?: number;
  trackStyle?: ViewStyle;
}

export function AnimatedBar({ pct, color, height = 8, trackStyle }: AnimatedBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={[styles.track, { height }, trackStyle]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            height,
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 4,
  },
});
