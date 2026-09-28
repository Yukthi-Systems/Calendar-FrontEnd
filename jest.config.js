module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Stylesheets are compiled by NativeWind/postcss at build time, not under Jest.
  moduleNameMapper: { '\\.css$': '<rootDir>/__mocks__/styleMock.js' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-.*|nativewind|jotai)/)',
  ],
};
