import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

// Bottom snackbar with one action. Fades in on mount; the parent unmounts it.
export function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ opacity }}
      className="absolute inset-x-0 bottom-6 items-center px-4"
    >
      <View
        accessibilityLiveRegion="polite"
        className="w-full max-w-md flex-row items-center justify-between gap-4 rounded-2xl bg-text-heading px-4 py-3"
      >
        <Text numberOfLines={1} className="flex-1 text-sm text-bg-main">
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onUndo}
          className="active:opacity-70"
        >
          <Text className="text-sm font-semibold text-accent">Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
