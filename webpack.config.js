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
      extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
      alias: {
        'react-native$': 'react-native-web',
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          // React Native packages ship untranspiled ES modules/JSX and need babel too;
          // everything else in node_modules is skipped as usual.
          exclude: /node_modules\/(?!(react-native|@react-native|react-native-.*)\/).*/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['module:@react-native/babel-preset'],
              plugins: ['react-native-web'],
            },
          },
        },
        {
          test: /\.(png|jpe?g|gif|svg|ttf|otf|woff2?)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'web/index.html') }),
      new Dotenv({
        path: path.resolve(__dirname, '.env'),
        safe: false,
        systemvars: true,
        silent: true,
      }),
    ],
    devServer: {
      port: 3000,
      open: false,
      hot: true,
      historyApiFallback: true,
      static: { directory: path.resolve(__dirname, 'web') },
    },
  };
};
