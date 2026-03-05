const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "cheap-module-source-map",
  devServer: {
    port: 3000,
    host: "localhost",
    hot: true,
    historyApiFallback: true,
    proxy: [{ context: ["/api"], target: "http://127.0.0.1:4001", changeOrigin: true }],
  },
});
