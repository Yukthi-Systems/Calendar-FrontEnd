const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

// Web target for the same App.tsx the native (Metro) build uses, via react-native-web.
// Env vars come from .env (git-ignored — see .env.example and README.md's
// "Environment & secrets" section) through Dotenv below; `safe: false` +
// `systemvars: true` means it also works with no local .env at all (e.g. CI), reading
// real process env vars instead — it never invents or commits a value.
module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'eval-source-map',
    entry: path.resolve(__dirname, 'web/index.tsx'),
    output: {
      path: path.resolve(__dirname, 'web-build'),
      filename: isProd ? 'bundle.[contenthash].js' : 'bundle.js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      // .web.* wins over the bare extension whenever both exist (env.web.ts vs
      // env.ts/env.native.ts being the main case in this project) — same idea as
      // Metro's platform-extension resolution on the native side.
      extensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
      ],
      alias: {
        'react-native$': 'react-native-web',
        // react-native-svg (used by the lucide icons) resolves images through RN's registry.
        '@react-native/assets-registry/registry':
          'react-native-web/dist/modules/AssetRegistry',
      },
    },
    module: {
      rules: [
        {
          // react-native-reanimated and react-native-worklets ship ESM-only —
          // lib/module/package.json marks that whole directory `"type": "module"`,
          // which webpack trusts for module *type* regardless of what any loader
          // returns. babel-loader below still compiles their import/export syntax
          // to CommonJS (needed since react-native-web etc. expect that), so
          // without this override webpack wraps the loader's CommonJS output in an
          // ESM module shell anyway, and the code — written expecting a real
          // `exports` binding — throws "exports is not defined" at runtime.
          test: /node_modules\/(react-native-reanimated|react-native-worklets)\/.*\.js$/,
          type: 'javascript/auto',
        },
        {
          test: /\.[jt]sx?$/,
          // React Native packages (and NativeWind, which rides on them) ship
          // untranspiled ES modules/JSX and need babel too; everything else in
          // node_modules is skipped as usual.
          exclude:
            /node_modules\/(?!(react-native|@react-native|react-native-.*|nativewind)\/).*/,
          use: {
            loader: 'babel-loader',
            options: {
              // babel.config.js (RN preset + nativewind/babel), plus the web alias plugin.
              configFile: path.resolve(__dirname, 'babel.config.js'),
              plugins: ['react-native-web'],
            },
          },
        },
        {
          // global.css → Tailwind via postcss.config.js; Metro does this via NativeWind.
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|ttf|otf|woff2?)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      // React Native's own runtime defines the global __DEV__; Metro injects it,
      // but webpack has nothing that does, so any package that reads it bare
      // (react-native-gesture-handler does) throws "__DEV__ is not defined" in
      // the browser. This defines it the same way Metro does.
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!isProd),
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'web/index.html'),
      }),
      new Dotenv({
        path: path.resolve(__dirname, '.env'),
        safe: false,
        systemvars: true,
        silent: true,
      }),
    ],
    devServer: {
      port: 5174,
      host: '0.0.0.0',
      // Dev-only: lets the server be reached by hostname/IP other than localhost
      // (proxy, tunnel, LAN device) without webpack-dev-server's Host-header check
      // rejecting the request as "Invalid Host header". Never applies to build:web.
      allowedHosts: 'all',
      // Behind a proxy the page isn't on :5174, so connect the hot-reload socket back to
      // whatever host/port/protocol the page was actually loaded from.
      client: { webSocketURL: 'auto://0.0.0.0:0/ws' },
      open: false,
      hot: true,
      historyApiFallback: true,
      static: { directory: path.resolve(__dirname, 'web') },
    },
  };
};
