const resolve = require("@rollup/plugin-node-resolve");

module.exports = {
   input: "tempBuild/app.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      resolve()
   ]
};
