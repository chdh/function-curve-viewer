import * as FunctionCurveViewer from "function-curve-viewer";

const initialViewerState = <Partial<FunctionCurveViewer.ViewerState>>{
   viewerFunction:           (x: number, _sampleWidth: number) => Math.sin(x) / x,
   xMin:                     -20,
   xMax:                     20,
   yMin:                     -1.2,
   yMax:                     1.2,
   gridEnabled:              true,
   copyEventHandler:         copyEventHandler };

function copyEventHandler (event: ClipboardEvent) {
   event.preventDefault();
   event.clipboardData?.setData("text", "Clipboard data from FunctionCurveViewer - " + String(new Date())); }

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
   element.addEventListener("viewportchange", () => console.log("viewportchange event"));
   element.addEventListener("segmentchange", () => console.log("segmentchange event"));
   element.setViewerState(initialViewerState);
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp); }

function startup() {
   try {
      startup2(); }
    catch (e) {
      console.log(e);
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", startup);
