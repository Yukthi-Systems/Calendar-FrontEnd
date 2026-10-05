import type { WidgetTask } from '../data/widgetTasks';

// Home-screen widgets only exist on Android (see widget.native.ts).
export function pushWidgetTasks(_tasks: WidgetTask[]): void {}

export async function takeWidgetCompletions(): Promise<string[]> {
  return [];
}
