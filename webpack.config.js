const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const defaultProxyBaseUrl = "http://localhost:3001";

function normalizeProxyBaseUrl(value) {
  const trimmedValue = (value || "").trim();
  const resolvedValue = trimmedValue || defaultProxyBaseUrl;
  return resolvedValue.endsWith("/")
    ? resolvedValue.slice(0, -1)
    : resolvedValue;
}

// Webpack entry points. Mapping from resulting bundle name to the source file entry.
const entries = {};

// Add entry for the Hub
entries["copilot-hub-group"] = "./src/Hub/copilot-hub-group";
entries["pipeline-sessions"] = "./src/PipelineSessions/pipeline-sessions";
entries["product-definition"] = "./src/ProductDefinition/product-definition";

module.exports = (env, argv) => ({
  entry: entries,
  output: {
    filename: "[name]/[name].js",
    publicPath: "/dist/",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "azure-devops-extension-sdk": path.resolve(
        "node_modules/azure-devops-extension-sdk",
      ),
    },
  },
  stats: {
    warnings: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
      {
        test: /\.scss$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/inline",
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: "asset/resource",
        generator: {
          filename: "images/[name][ext]",
        },
      },
      {
        test: /\.html$/,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __COPILOT_PROXY_BASE_URL__: JSON.stringify(
        normalizeProxyBaseUrl(process.env.COPILOT_PROXY_BASE_URL),
      ),
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/Hub/copilot-hub-group.html", to: "copilot-hub-group/" },
        { from: "src/PipelineSessions/pipeline-sessions.html", to: "pipeline-sessions/" },
        { from: "src/ProductDefinition/product-definition.html", to: "product-definition/" },
      ],
    }),
  ],
  ...(env.WEBPACK_SERVE
    ? {
        devtool: "inline-source-map",
        devServer: {
          server: "https",
          port: 3000,
          client: {
            overlay: {
              errors: true,
              warnings: false,
            },
          },
        },
      }
    : {}),
});
