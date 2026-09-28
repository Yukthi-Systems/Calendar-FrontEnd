import { AppRegistry } from 'react-native';
import App from '../App';
import { name as appName } from '../app.json';

// Same registration call the native entry (index.js) makes — react-native-web
// implements AppRegistry itself, so App.tsx needs no web-specific branching to run
// here. See webpack.config.js for how this file gets built/served.
const rootTag = document.getElementById('app-root');
if (!rootTag) {
  throw new Error('Missing #app-root element — check web/index.html');
}

AppRegistry.registerComponent(appName, () => App);
// react-native's own .d.ts types `runApplication`'s rootTag as RN's native opaque
// branded type (RootTag), which has nothing to do with react-native-web's actual
// runtime behavior of taking the DOM element passed here directly. `as unknown as`
// sidesteps that definitions mismatch for this one call only.
AppRegistry.runApplication(appName, {
  rootTag,
  initialProps: {},
} as unknown as Parameters<typeof AppRegistry.runApplication>[1]);
