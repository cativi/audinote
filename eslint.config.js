// eslint.config.js
const { node: nodeGlobals } = require("globals");

module.exports = [
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    ignores: ["coverage/**", "node_modules/**"],
    languageOptions: {
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      // custom rules
    }
  }
];
