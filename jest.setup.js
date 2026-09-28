/* eslint-env jest */
// Native modules have no implementation under Jest; stub the ones App pulls in.
jest.mock('react-native-config', () => ({ __esModule: true, default: {} }));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async key => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value);
      },
      removeItem: async key => {
        store.delete(key);
      },
    },
  };
});

jest.mock('@preeternal/react-native-cookie-manager', () => ({
  __esModule: true,
  default: {
    getAsArray: jest.fn(async () => []),
    set: jest.fn(async () => true),
    clearAll: jest.fn(async () => true),
    clearAllStores: jest.fn(async () => true),
  },
}));

jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));
