import { AppState, Linking } from 'react-native';
import { getDefaultStore } from 'jotai';
import {
  activeViewIdAtom,
  itemFormAtom,
  itemsAtom,
  projectHydratedAtom,
  viewsAtom,
} from '../atoms/project';
import { tokenAtom } from '../atoms/auth';
import { widgetTasks } from '../data/widgetTasks';
import { pushWidgetTasks, takeWidgetCompletions } from './widget';
import { updateTask } from './tasks';
import { isServerTaskId, taskToUpdatePayload } from '../data/taskSync';
import { isServerViewId } from '../data/viewSync';
import { TASKS_API_ENABLED } from '../config/features';

// Keeps the home-screen widget in step with the app: today's tasks flow out to
// it, and checkboxes ticked in it flow back in as completed tasks. The widget
// can be ticked while the app is closed, so completions are drained on every
// launch and foreground, not only while the app is running.

const store = getDefaultStore();
let booted = false;

// A checkbox ticked in the widget only "sticks" once the server confirms it —
// same rule as every other task write in this app (see useTaskMutations' header
// comment): itemsAtom only ever reflects what Tasks-Main-API has actually saved,
// never a local guess that could silently drift from it. If the server can't be
// reached right now (signed out, TASKS_API_ENABLED off, or the active view isn't
// server-backed), a widget tick is just dropped rather than applied locally —
// it'll need to be ticked again once saving tasks works.
const applyWidgetCompletions = async () => {
  const ids = await takeWidgetCompletions();
  if (ids.length === 0) {
    return;
  }
  const token = store.get(tokenAtom);
  const activeView = store
    .get(viewsAtom)
    .find(v => v.id === store.get(activeViewIdAtom));
  const viewId =
    TASKS_API_ENABLED && token && activeView && isServerViewId(activeView.id)
      ? Number(activeView.id)
      : undefined;
  if (!token || viewId === undefined) {
    return;
  }

  for (const id of ids) {
    const item = store.get(itemsAtom).find(i => i.id === id);
    if (!item || !isServerTaskId(item.id) || item.status === 'completed') {
      continue;
    }
    const updated = { ...item, status: 'completed' as const };
    try {
      await updateTask(token, viewId, taskToUpdatePayload(updated));
      store.set(itemsAtom, prev => prev.map(i => (i.id === id ? updated : i)));
    } catch (err) {
      console.warn('Could not save a widget completion to the server:', err);
    }
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
