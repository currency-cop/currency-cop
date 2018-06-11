// Based on: https://webpack.js.org/guides/development/#using-webpack-dev-middleware
const express = require('express')
const webpack = require('webpack')
const webpackMerge = require('webpack-merge')
const webpackDevMiddleware = require('webpack-dev-middleware')

const app = express()

const configProd = require('./webpack.config.prod.js')
const configDev = require('./webpack.config.dev.js')
const config = webpackMerge(configProd, configDev)
const compiler = webpack(config)

// Tell express to use the webpack-dev-middleware and use the
// merged webpack configs as a base.
app.use(webpackDevMiddleware(compiler, {
	publicPath: config.output.publicPath,
	stats: {
		// Older versions of electron produce garbled output because of formatting in Windows.
		// (Newer versions seem to strip formatting from the get go)
		// https://github.com/electron/electron/issues/11488
		colors: !(process.platform === "win32")
	},
}))

app.use(require("webpack-hot-middleware")(compiler))

// Serve the files on port 3000.
app.listen(3000, function () {
	console.log('Example app listening on port 3000!\n')
})