import { useEffect, useState } from 'react';

// Returns `value`, but only after it's stopped changing for `delayMs` — e.g. for
// turning fast keystrokes into one query per pause instead of one per keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
