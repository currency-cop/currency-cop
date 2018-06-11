const webpack = require('webpack')
const path = require('path')

// Plugins
const BabiliPlugin = require('babili-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

// Config directories
const SRC_DIR_NAME = 'src'
const OUTPUT_DIR_NAME = 'dist'

// Get Path to Directories
const SRC_DIR = path.resolve(__dirname, '../', SRC_DIR_NAME)
const OUTPUT_DIR = path.resolve(__dirname, '../', OUTPUT_DIR_NAME)

module.exports = {
  mode: 'production',

  devtool: 'inline-source-map',
  target: 'electron-renderer',

  entry: {
    app: [
      'babel-polyfill', 
      `${SRC_DIR}/index.js`
    ]
  },

  output: {
    path: OUTPUT_DIR,
    publicPath: '/',
    filename: 'bundle.js'
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader', options: { importLoaders: 1 } }, { loader: 'postcss-loader' }],
      },

      {
        test: /\.jsx?$/,
        use: [{ loader: 'babel-loader' }],
      },

      {
        test: /\.(jpe?g|png|gif)$/,
        use: [{ loader: 'file-loader?name=img/[name]__[hash:base64:5].[ext]' }],
      },

      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        use: [{ loader: 'file-loader?name=font/[name]__[hash:base64:5].[ext]' }],
      }
    ]
  },

  plugins: [
    new CleanWebpackPlugin([ `${OUTPUT_DIR}/*.*` ], { allowExternal: true }),

		// Copy necessary files that won't be in the .js bundle
    new CopyWebpackPlugin([{
      from: path.join(SRC_DIR, 'index.html'),
      to: path.join(OUTPUT_DIR, 'index.html'),
    }]),

    new ExtractTextPlugin({
      filename: 'bundle.css',
      disable: process.env.NODE_ENV !== 'production'
    })
  ],

  stats: {
    colors: true,
    children: false,
    chunks: false,
    modules: false,
    entrypoints: false
  }
};
