import { AppState, Linking } from 'react-native';
import { getDefaultStore } from 'jotai';
import { itemFormAtom, itemsAtom, projectHydratedAtom } from '../atoms/project';
import { widgetTasks } from '../data/widgetTasks';
import { pushWidgetTasks, takeWidgetCompletions } from './widget';

// Keeps the home-screen widget in step with the app: today's tasks flow out to
// it, and checkboxes ticked in it flow back in as completed tasks. The widget
// can be ticked while the app is closed, so completions are drained on every
// launch and foreground, not only while the app is running.

const store = getDefaultStore();
let booted = false;

const applyWidgetCompletions = async () => {
  const ids = await takeWidgetCompletions();
  if (ids.length > 0) {
    store.set(itemsAtom, prev =>
      prev.map(i => (ids.includes(i.id) ? { ...i, status: 'completed' } : i)),
    );
  }
};

const push = () => pushWidgetTasks(widgetTasks(store.get(itemsAtom), new Date()));

const openNewTaskFromLink = (url: string | null | undefined) => {
  if (url && url.startsWith('ytc://new')) {
    store.set(itemFormAtom, { mode: 'new' });
  }
};

const waitForHydration = () =>
  new Promise<void>(resolve => {
    if (store.get(projectHydratedAtom)) {
      resolve();
      return;
    }
    const unsub = store.sub(projectHydratedAtom, () => {
      if (store.get(projectHydratedAtom)) {
        unsub();
        resolve();
      }
    });
  });

// Waits for the saved project to load first, so the seed data never overwrites
// completions the widget recorded.
export const bootWidgetSync = async () => {
  if (booted) {
    return;
  }
  booted = true;
  await waitForHydration();
  await applyWidgetCompletions();
  push();
  store.sub(itemsAtom, push);
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      applyWidgetCompletions();
    }
  });
  Linking.getInitialURL().then(openNewTaskFromLink);
  Linking.addEventListener('url', ({ url }) => openNewTaskFromLink(url));
};
