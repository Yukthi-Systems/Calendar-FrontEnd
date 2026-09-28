// Web only (webpack's postcss-loader); Metro compiles global.css through NativeWind.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
