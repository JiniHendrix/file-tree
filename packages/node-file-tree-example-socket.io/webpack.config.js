const path = require('path')
const webpack = require('webpack')

const DIRECTORY = __dirname

module.exports = {
  devServer: {
    contentBase: DIRECTORY,
    port: 3000,
  },
  entry: {
    client: path.join(DIRECTORY, 'client.js'),
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: { cacheDirectory: true }
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.css$/,
        loader: "style-loader!css-loader"
      },
    ]
  },
  output: {
    filename: '[name]-bundle.js'
  },
  plugins: [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin()
  ]
}
