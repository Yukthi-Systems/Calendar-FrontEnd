module.exports = {
  // nativewind/babel turns `className` into styles (and adds Reanimated's plugin, which
  // NativeWind's transitions/animations use). webpack.config.js reuses this file.
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
};
