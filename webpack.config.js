const path = require('path');
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
      },
    },
    module: {
      rules: [
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
