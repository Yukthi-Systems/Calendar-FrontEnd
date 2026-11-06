import type { ViewInstance } from 'react-native';

// The controls the first-run tour (OnboardingTips.tsx) points at. Each one's
// wrapper registers itself with `ref={tourTarget('…')}`; the tour measures
// whichever are on screen and skips the rest (e.g. Filter outside a table).
export type TourTargetKey =
  | 'views'
  | 'tabs'
  | 'newTask'
  | 'filter'
  | 'search'
  | 'alerts'
  | 'profile';

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const nodes = new Map<TourTargetKey, ViewInstance>();
// One stable callback per key, so a re-render doesn't detach and re-attach it.
const callbacks = new Map<TourTargetKey, (node: ViewInstance | null) => void>();

export const tourTarget = (key: TourTargetKey) => {
  let cb = callbacks.get(key);
  if (!cb) {
    cb = node => {
      if (node) {
        nodes.set(key, node);
      } else {
        nodes.delete(key);
      }
    };
    callbacks.set(key, cb);
  }
  return cb;
};

// Where the target is on screen, or null when it isn't mounted / has no size.
export const measureTarget = (key: TourTargetKey): Promise<TargetRect | null> =>
  new Promise(resolve => {
    const node = nodes.get(key);
    if (!node) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
    );
  });
