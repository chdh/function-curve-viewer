import * as FunctionCurveViewer from "function-curve-viewer";

let widget: FunctionCurveViewer.Widget;

const initialViewerState = <FunctionCurveViewer.ViewerState>{
   viewerFunction: viewerFunction,
   channels:       50,
   xMin:           -20,
   xMax:           20,
   yMin:           -1.2,
   yMax:           1.2,
   xAxisUnit:      "s",
   yAxisUnit:      "m",
   gridEnabled:    true };

function viewerFunction (x: number, _sampleWidth: number, channel: number) {
   switch (channel) {
      case 0: {
         // if (x >= -2 && x <= -1) {
         //    return undefined; }
         const y1 = Math.sin(x) / x;
         if (x < 0) {
            return y1; }
         const y2 = Math.abs(Math.sin(3 * x) / 20);
         return [y1, y1 + y2]; }
      case 1: {
         return Math.cos(x) / x; }
      case 2: {
         return Math.tan(x) ** 2 / x; }
      default: {
         if (x < 10) {
            return NaN; }
         return -1 + channel * 0.8 / 50; }}}

function toggleHelp() {
   const t = document.getElementById("helpText")!;
   if (t.classList.contains("hidden")) {
      t.classList.remove("hidden");
      t.innerHTML = widget.getFormattedHelpText(); }
    else {
      t.classList.add("hidden"); }}

function startup() {
   const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("functionCurveViewer");
   widget = new FunctionCurveViewer.Widget(canvas);
   widget.setViewerState(initialViewerState);
   widget.addEventListener("viewportchange", () => console.log("Viewportchange event"));
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp); }

document.addEventListener("DOMContentLoaded", startup);
