const path = require('path')

const mode = process.env.NODE_ENV || 'development'

module.exports = {
  entry: path.resolve('./src/index.ts'),
  output: {
    filename: `worker.js`,
    path: path.resolve('./dist'),
  },
  devtool: 'cheap-module-source-map',
  mode,
  resolve: {
    extensions: ['.ts', '.js'],
    mainFields: ['module', 'main'],
    plugins: [],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
}
