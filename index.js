/**
 * @format
 */

import { AppRegistry } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered before AppRegistry.registerComponent, at the top level
// (RNFirebase's own requirement) — handles a push that arrives while the app
// is backgrounded or killed. Every alert this app sends has a `notification`
// payload, which the OS already displays on its own; this mainly exists so
// RNFirebase doesn't warn about a missing handler. Wrapped in try/catch:
// before GoogleService-Info.plist / google-services.json are added (see
// README.md), there's no native Firebase app yet, and that must not crash
// the whole app over push not being set up — see push.native.ts.
try {
  setBackgroundMessageHandler(getMessaging(), async () => {});
} catch {
  // Firebase isn't configured natively yet.
}

AppRegistry.registerComponent(appName, () => App);
