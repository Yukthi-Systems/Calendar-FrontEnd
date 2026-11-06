import { useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// Long lists draw this many rows at first and more as they're scrolled towards
// the end — drawing hundreds of rows up front is what makes every click slow.
export const RENDER_STEP = 100;
const NEAR_END_PX = 400;

export const isNearScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
  return (
    contentOffset.y + layoutMeasurement.height >=
    contentSize.height - NEAR_END_PX
  );
};

export function useRenderLimit(step = RENDER_STEP) {
  const [limit, setLimit] = useState(step);
  return { limit, showMore: () => setLimit(n => n + step) };
}
