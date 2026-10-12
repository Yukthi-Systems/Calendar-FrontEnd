import { atom, getDefaultStore } from 'jotai';

// App-wide transient feedback: toasts and the confirm dialog. Callable from
// anywhere (components, hooks, services) through `toast` / `confirm` — the hosts
// that render them (ui/Toast.tsx ToastHost, ui/ConfirmDialog.tsx ConfirmHost) are
// mounted once in App.tsx.

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  // ms before it dismisses itself.
  duration: number;
}

export const toastsAtom = atom<ToastData[]>([]);

const store = getDefaultStore();
let nextId = 1;
const MAX_VISIBLE = 3;

const push = (
  kind: ToastKind,
  message: string,
  opts: Partial<Omit<ToastData, 'id' | 'kind' | 'message'>> = {},
) => {
  const id = nextId++;
  const t: ToastData = {
    id,
    kind,
    message,
    duration: opts.duration ?? (kind === 'error' ? 6000 : opts.action ? 6000 : 3500),
    description: opts.description,
    action: opts.action,
  };
  store.set(toastsAtom, prev => [...prev, t].slice(-MAX_VISIBLE));
  return id;
};

// Pull a readable message out of whatever a promise rejected with.
export const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export const toast = {
  success: (message: string, opts?: Partial<Omit<ToastData, 'id' | 'kind' | 'message'>>) =>
    push('success', message, opts),
  error: (message: string, opts?: Partial<Omit<ToastData, 'id' | 'kind' | 'message'>>) =>
    push('error', message, opts),
  info: (message: string, opts?: Partial<Omit<ToastData, 'id' | 'kind' | 'message'>>) =>
    push('info', message, opts),
  dismiss: (id: number) => store.set(toastsAtom, prev => prev.filter(t => t.id !== id)),
};

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

export const confirmAtom = atom<ConfirmRequest | null>(null);

// `if (await confirm({ title: 'Delete task?', destructive: true })) …`
export const confirm = (req: Omit<ConfirmRequest, 'resolve'>) =>
  new Promise<boolean>(resolve => {
    store.get(confirmAtom)?.resolve(false);
    store.set(confirmAtom, { ...req, resolve });
  });

// Ids of the Sheets currently open, oldest first. Toasts must render inside the
// topmost one — a Modal is its own layer (a body-level portal on web, a separate
// window on native), so a toast drawn by the app root would sit hidden behind it.
export const openSheetsAtom = atom<number[]>([]);
let nextSheetId = 1;
export const newSheetId = () => nextSheetId++;
