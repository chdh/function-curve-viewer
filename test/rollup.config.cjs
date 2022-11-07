const alias = require("@rollup/plugin-alias");

module.exports = {
   input: "tempBuild/app.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      alias({
         entries: {
            "function-curve-viewer": "../dist/FunctionCurveViewer.js"
         }
      })
   ]
};
