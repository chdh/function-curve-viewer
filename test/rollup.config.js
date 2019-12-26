import alias from "@rollup/plugin-alias";

export default {
   input: "tempBuild/app.js",
   output: {
      file: "tempBuild/appBundle.js",
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
