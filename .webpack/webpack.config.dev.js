const webpack = require('webpack')
const path = require('path')

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',

  entry: {
    app: ['webpack-hot-middleware/client']
  },

  plugins: [
		new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  ],

  devServer: {
    contentBase: path.resolve(__dirname, '../', 'dist'),
    hot: true
  }
}
