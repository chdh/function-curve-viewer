import * as FunctionCurveViewer from "function-curve-viewer";

const initialViewerState = <FunctionCurveViewer.ViewerState>{
   viewerFunction: (x: number, _sampleWidth: number) => Math.sin(x) / x,
   planeOrigin:    {x: -20, y: -1.2},
   zoomFactorX:    800 / 40,
   zoomFactorY:    500 / 2.4,
   gridEnabled:    true };

function toggleHelp() {
   const t = document.getElementById("helpText")!;
   if (t.classList.contains("hidden")) {
      t.classList.remove("hidden");
      const element = <FunctionCurveViewer.FunctionCurveViewerElement>document.getElementById("viewer1");
      t.innerHTML = element.getFormattedHelpText(); }
    else {
      t.classList.add("hidden"); }}

function startup2() {
   FunctionCurveViewer.registerCustomElement();
   const element = <FunctionCurveViewer.FunctionCurveViewerElement>document.getElementById("viewer1");
   element.addEventListener("viewportchange", () => console.log("Viewportchange event"));
   element.setViewerState(initialViewerState);
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp); }

function startup() {
   try {
      startup2(); }
    catch (e) {
      console.log(e);
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", startup);
