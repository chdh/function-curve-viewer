import * as FunctionCurveViewer from "function-curve-viewer";

let widget: FunctionCurveViewer.Widget;

const initialViewerState = <FunctionCurveViewer.ViewerState>{
   viewerFunction: viewerFunction,
   planeOrigin:    {x: -20, y: -1.2},
   zoomFactorX:    800 / 40,
   zoomFactorY:    500 / 2.4,
   xAxisUnit:      "s",
   yAxisUnit:      "m",
   gridEnabled:    true };

function viewerFunction (x: number, _sampleWidth: number) {
   // if (x >= -2 && x <= -1) {
   //    return undefined; }
   const y1 = Math.sin(x) / x;
   if (x < 0) {
      return y1; }
   const y2 = Math.abs(Math.sin(3 * x) / 20);
   return [y1, y1 + y2];
   }

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
   widget.connectedCallback();
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp); }

document.addEventListener("DOMContentLoaded", startup);
