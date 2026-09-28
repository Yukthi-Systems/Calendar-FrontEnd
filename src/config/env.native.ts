import Config from 'react-native-config';
import type { EnvKey } from './keys';

// iOS/Android: react-native-config reads the git-ignored .env at native build time and
// exposes it here — nothing is baked into source. Resolved by Metro's platform
// extension order (env.native.ts beats the bare env.ts) whenever app code imports
// './env' — see env.ts for why that file exists too.
export const getEnv = (key: EnvKey): string => Config[key] ?? '';
