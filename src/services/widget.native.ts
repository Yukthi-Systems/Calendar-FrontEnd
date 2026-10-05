import { NativeModules } from 'react-native';
import type { WidgetTask } from '../data/widgetTasks';

// Android home-screen widget bridge (android/app/.../widget/YtcWidgetModule.kt).
// iOS has no such widget yet, so this is a no-op there.
interface YtcWidgetNative {
  setTasks(json: string): void;
  takePending(): Promise<string>;
}

const native = NativeModules.YtcWidget as YtcWidgetNative | undefined;

export function pushWidgetTasks(tasks: WidgetTask[]): void {
  native?.setTasks(JSON.stringify(tasks));
}

export async function takeWidgetCompletions(): Promise<string[]> {
  if (!native) {
    return [];
  }
  try {
    return JSON.parse(await native.takePending());
  } catch {
    return [];
  }
}
