import * as FunctionCurveViewer from "function-curve-viewer";

let widget: FunctionCurveViewer.Widget;

const initialViewerState = <FunctionCurveViewer.ViewerState>{
   viewerFunction:           viewerFunction,
   channels:                 50,
   xMin:                     -20,
   xMax:                     20,
   yMin:                     -1.2,
   yMax:                     1.2,
   xAxisUnit:                "s",
   yAxisUnit:                "m",
   gridEnabled:              true,
   customPaintFunction:      customPaintFunction,
   copyEventHandler:         copyEventHandler };

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

function customPaintFunction (pctx: FunctionCurveViewer.CustomPaintContext) {
   drawSpiral(-12, 0.7, 5, 0.4, 0.75, 25, pctx); }

function copyEventHandler (event: ClipboardEvent) {
   event.preventDefault();
   event.clipboardData?.setData("text", "Clipboard data from FunctionCurveViewer - " + String(new Date())); }

function drawSpiral (centerX: number, centerY: number, widthX: number, widthY: number, growthFactor: number, revolutions: number, pctx: FunctionCurveViewer.CustomPaintContext) {
   const ctx = pctx.ctx;
   ctx.save();
   ctx.strokeStyle = pctx.curveColors[0];
   ctx.beginPath();
   for (let w = 0; w < revolutions * 2 * Math.PI; w += 0.02) {
      const g = growthFactor ** (w / (2 * Math.PI));
      const lx = centerX + g * Math.cos(w) * widthX;
      const ly = centerY + g * Math.sin(w) * widthY;
      const cx = pctx.mapLogicalToCanvasXCoordinate(lx);
      const cy = pctx.mapLogicalToCanvasYCoordinate(ly);
      ctx.lineTo(cx, cy); }
   ctx.stroke();
   ctx.restore(); }

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
   widget.addEventListener("segmentchange",  () => {
      const vs = widget.getViewerState();
      console.log(`segmentchange event:  segmentSelected=${vs.segmentSelected}, segmentStart=${vs.segmentStart}, segmentEnd=${vs.segmentEnd}`); });
   document.getElementById("helpButton")!.addEventListener("click", toggleHelp); }

document.addEventListener("DOMContentLoaded", startup);
