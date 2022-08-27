import {nextTick} from "./Utils.js";

//--- Point and PointUtils -----------------------------------------------------

interface Point {
   x: number;
   y: number; }

class PointUtils {

   public static clone (p: Point) : Point {
      return {x: p.x, y: p.y}; }

   // Returns the distance between two points.
   public static computeDistance (point1: Point, point2: Point) : number {
      const dx = point1.x - point2.x;
      const dy = point1.y - point2.y;
      return Math.sqrt(dx * dx + dy * dy); }

   public static computeCenter (point1: Point, point2: Point) : Point {
      return {x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2}; }}

//--- Plotter ------------------------------------------------------------------

class FunctionPlotter {

   private wctx:             WidgetContext;
   private ctx:              CanvasRenderingContext2D;
   private newCanvasWidth:   number;
   private newCanvasHeight:  number;

   public constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      const ctx = wctx.canvas.getContext("2d");
      if (!ctx) {
         throw new Error("Canvas 2D context not available."); }
      this.ctx = ctx; }

   private clearCanvas() {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      const width  = wctx.canvas.width;
      const height = wctx.canvas.height;
      ctx.fillStyle = wctx.disabled ? wctx.style.disabledBackgroundColor : wctx.style.backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore(); }

   private drawSelectedSegmentBackground() {
      const wctx = this.wctx;
      const ctx = this.ctx;
      const canvasWidth  = wctx.canvas.width;
      const canvasHeight = wctx.canvas.height;
      let segmentStart: number;
      let segmentEnd: number;
      if (wctx.iState.interactionOperation == InteractionOperation.segmentSelecting) {
         segmentStart = wctx.iState.segmentStart;
         segmentEnd   = wctx.iState.segmentEnd; }
       else if (wctx.vState.segmentSelected) {
         segmentStart = wctx.vState.segmentStart;
         segmentEnd   = wctx.vState.segmentEnd; }
       else {
         return; }
      const xStart = Math.round(wctx.mapLogicalToCanvasXCoordinate(segmentStart));
      const xEnd   = Math.round(wctx.mapLogicalToCanvasXCoordinate(segmentEnd));
      const x1 = Math.max(0, Math.min(xStart, xEnd));
      const x2 = Math.min(canvasWidth, Math.max(xStart, xEnd));
      if (x2 < 0 || x1 >= canvasWidth) {
         return; }
      const w = Math.max(1, x2 - x1);
      ctx.save();
      ctx.fillStyle = wctx.style.selectionColor;
      ctx.fillRect(x1, 0, w, canvasHeight);
      ctx.restore(); }

   private formatLabel (value: number, decPow: number, xy: boolean) {
      const wctx = this.wctx;
      let s = (decPow <= 7 && decPow >= -6) ? value.toFixed(Math.max(0, -decPow)) : value.toExponential();
      if (s.length > 10) {
         s = value.toPrecision(6); }
      const unit = xy ? wctx.vState.xAxisUnit : wctx.vState.yAxisUnit;
      if (unit) {
         s += " " + unit; }
      return s; }

   private drawLabel (cPos: number, value: number, decPow: number, xy: boolean) {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      ctx.textBaseline = "bottom";
      ctx.font = "12px";
      ctx.fillStyle = wctx.style.labelTextColor;
      const x = xy ? cPos + 5 : 5;
      const y = xy ? wctx.canvas.height - 2 : cPos - 2;
      const s = this.formatLabel(value, decPow, xy);
      ctx.fillText(s, x, y);
      ctx.restore(); }

   private drawGridLine (p: number, cPos: number, xy: boolean) {
      const wctx = this.wctx;
      const style = wctx.style;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = (p == 0) ? style.gridColor0 : (p % 10 == 0) ? style.gridColor10 : style.gridColor;
      ctx.fillRect(xy ? cPos : 0, xy ? 0 : cPos, xy ? 1 : wctx.canvas.width, xy ? wctx.canvas.height : 1);
      ctx.restore(); }

   private drawGridOrLabels (labels: boolean, xy: boolean) {
      const wctx = this.wctx;
      const gp = wctx.getGridParms(xy);
      if (!gp) {
         return; }
      let p = gp.pos;
      let loopCtr = 0;
      while (true) {
         const lPos = p * gp.space;
         const cPos = xy ? wctx.mapLogicalToCanvasXCoordinate(lPos) : wctx.mapLogicalToCanvasYCoordinate(lPos);
         if (xy ? (cPos > wctx.canvas.width) : (cPos < 0)) {
            break; }
         if (labels) {
            this.drawLabel(cPos, lPos, gp.decPow, xy); }
          else {
            this.drawGridLine(p, cPos, xy); }
         p += gp.span;
         if (loopCtr++ > 100) {                            // to prevent endless loop on numerical instability
            break; }}}

   private drawGrid() {
      this.drawGridOrLabels(false, false);
      this.drawGridOrLabels(false, true);
      this.drawGridOrLabels(true, false);
      this.drawGridOrLabels(true, true); }

   private drawFunctionCurve (channel: number) {
      // Curve drawing can switch from line mode to fill mode.
      // Line mode is preferred because it looks visually better thanks to antialiasing.
      const enum Mode {skip=0, line, fill}
      const wctx = this.wctx;
      const ctx = this.ctx;
      const viewerFunction = wctx.vState.viewerFunction!;
      const canvasWidth = wctx.canvas.width;
      const canvasHeight = wctx.canvas.height;
      const sampleWidth = (wctx.vState.xMax - wctx.vState.xMin) / wctx.canvas.width;
      const pixelCompensation = 0.41;
      const lineWidth = wctx.style.curveWidths[channel] || 1;
      const lineWidthInt = Math.max(1, Math.round(lineWidth));
      ctx.save();
      ctx.fillStyle = wctx.style.curveColors[channel] || "#666666";
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = lineWidth;
      let prevCyLo: number|undefined = undefined;
      let prevCyHi: number|undefined = undefined;
      let pixelAcc = 0;
      let fillModeUsed = false;
      let mode: number = Mode.skip;                        // "number" is used instead of "Mode" to prevent compiler error, see https://stackoverflow.com/questions/48919455
      startMode();
      for (let cx = 0; cx < canvasWidth; cx++) {
         const lx = wctx.mapCanvasToLogicalXCoordinate(cx + 0.5);
         const ly = viewerFunction(lx, sampleWidth, channel);
         let lyLo: number;                                 // logical y low
         let lyHi: number;                                 // logical y high
         if (ly == undefined) {
            switchMode(Mode.skip);
            continue; }
         if (Array.isArray(ly)) {
            lyLo = ly[0];
            lyHi = ly[1]; }
          else {
            lyLo = ly;
            lyHi = ly; }
         lyLo = mapInfinity(lyLo);
         lyHi = mapInfinity(lyHi);
         if (!isFinite(lyLo) || !isFinite(lyHi)) {
            switchMode(Mode.skip); }
          else if (!fillModeUsed && lyLo == lyHi) {
            switchMode(Mode.line); }
          else {
            switchMode(Mode.fill); }
         switch (mode) {
            case Mode.line: {
               const cy = Math.max(-1E6, Math.min(1E6, wctx.mapLogicalToCanvasYCoordinate(lyLo)));
               ctx.lineTo(cx, cy);
               break; }
            case Mode.fill: {
               const cyLo0 = Math.max(-1, Math.min(canvasHeight, wctx.mapLogicalToCanvasYCoordinate(lyHi)));   // (hi/lo reversed, because Y coordinate polarity is switched)
               const cyHi0 = Math.max(-1, Math.min(canvasHeight, wctx.mapLogicalToCanvasYCoordinate(lyLo)));
               const cyLo1 = Math.floor(cyLo0);
               const cyHi1 = Math.ceil(cyHi0);
               const cyLo2 = cyLo1;
               const cyHi2 = Math.max(cyHi1, cyLo1 + 1);
               let cyLo: number = (prevCyHi == undefined) ? cyLo2 : Math.min(cyLo2, prevCyHi);
               let cyHi: number = (prevCyLo == undefined) ? cyHi2 : Math.max(cyHi2, prevCyLo);
               if (cyLo == prevCyHi) {
                  pixelAcc += pixelCompensation;
                  if (pixelAcc >= cyHi1 - cyHi0) {
                     cyLo--;
                     pixelAcc--; }}
                else if (cyHi == prevCyLo) {
                  pixelAcc += pixelCompensation;
                  if (pixelAcc >= cyLo0 - cyLo1) {
                     cyHi++;
                     pixelAcc--; }}
               const fillHeight = Math.max(lineWidthInt, cyHi - cyLo);
               ctx.fillRect(cx, cyLo, 1, fillHeight);
               prevCyLo = cyLo;
               prevCyHi = cyHi;
               break; }}}
      stopMode();
      ctx.restore();
      //
      function switchMode (newMode: Mode) {
         if (newMode != mode) {
            stopMode();
            mode = newMode;
            startMode(); }}
      function startMode() {
         switch (mode) {
            case Mode.line: {
               ctx.beginPath();
               break; }
            case Mode.fill: {
               prevCyLo = undefined;
               prevCyHi = undefined;
               fillModeUsed = true;
               break; }}}
      function stopMode() {
         switch (mode) {
            case Mode.line: {
               ctx.stroke();
               break; }}}}

   public paint() {
      const wctx = this.wctx;
      const vState = wctx.vState;
      if (!this.newCanvasWidth || !this.newCanvasHeight) {
         return; }
      if (this.newCanvasWidth != wctx.canvas.width || this.newCanvasHeight != wctx.canvas.height) {
         wctx.canvas.width = this.newCanvasWidth;
         wctx.canvas.height = this.newCanvasHeight; }
      this.clearCanvas();
      if (wctx.disabled) {
         return; }
      this.drawSelectedSegmentBackground();
      if (wctx.vState.gridEnabled) {
         this.drawGrid(); }
      if (wctx.vState.viewerFunction) {
         for (let channel = wctx.vState.channels - 1; channel >= 0; channel--) {
            this.drawFunctionCurve(channel); }}
      if (vState.customPaintFunction) {
         vState.customPaintFunction({
            vState,
            ctx: this.ctx,
            mapLogicalToCanvasXCoordinate: (x: number) => wctx.mapLogicalToCanvasXCoordinate(x),
            mapLogicalToCanvasYCoordinate: (y: number) => wctx.mapLogicalToCanvasYCoordinate(y),
            curveColors: wctx.style.curveColors}); }}

   public resize (width: number, height: number) {
      const wctx = this.wctx;
      if (this.newCanvasWidth == width && this.newCanvasHeight == height) {
         return; }
      this.newCanvasWidth = width;
      this.newCanvasHeight = height;
      wctx.requestRefresh(); }}

function mapInfinity (v: number) {
   if (v == Infinity) {
      return 1E300; }
    else if (v == -Infinity) {
      return -1E300; }
    else {
      return v; }}

//--- Pointer controller -------------------------------------------------------

// Controller for mouse and touch input.
class PointerController {

   private wctx:             WidgetContext;
   private pointers:         Map<number,PointerEvent>;     // maps IDs of active pointers to last pointer events
   private dragStartPos:     Point;                        // logical coordinates of starting point of drag action
   private zoomLCenter:      Point;                        // zoom center point in logical coordinates
   private zoomStartDist:    number;
   private zoomStartFactorX: number;
   private zoomStartFactorY: number;
   private zoomX:            boolean;                      // true when zooming in X direction
   private zoomY:            boolean;                      // true when zooming in y direction

   public constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointers = new Map();
      wctx.canvas.addEventListener("pointerdown",   this.pointerDownEventListener);
      wctx.canvas.addEventListener("pointerup",     this.pointerUpEventListener);
      wctx.canvas.addEventListener("pointercancel", this.pointerUpEventListener);
      wctx.canvas.addEventListener("pointermove",   this.pointerMoveEventListener);
      wctx.canvas.addEventListener("wheel",         this.wheelEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("pointerdown",   this.pointerDownEventListener);
      wctx.canvas.removeEventListener("pointerup",     this.pointerUpEventListener);
      wctx.canvas.removeEventListener("pointercancel", this.pointerUpEventListener);
      wctx.canvas.removeEventListener("pointermove",   this.pointerMoveEventListener);
      wctx.canvas.removeEventListener("wheel",         this.wheelEventListener);
      this.releaseAllPointers(); }

   private pointerDownEventListener = (event: PointerEvent) => {
      const wctx = this.wctx;
      if (event.metaKey || (event.pointerType == "mouse" && event.button != 0)) {
         return; }
      if (this.isPointerInResizeHandle(event)) {
         return; }
      event.preventDefault();
      if (wctx.disabled) {
         return; }
      this.trackPointer(event);
      this.startInteractionOperation(event.shiftKey, event.ctrlKey, event.altKey); };

   private pointerUpEventListener = (event: PointerEvent) => {
      const wctx = this.wctx;
      if (!this.pointers.has(event.pointerId)) {
         return; }
      event.preventDefault();
      this.completeInteractionOperation();
      this.releasePointer(event.pointerId);
      wctx.resetInteractionState();
      wctx.requestRefresh(); };

   private startInteractionOperation (shiftKey: boolean, ctrlKey: boolean, altKey: boolean) {
      const wctx = this.wctx;
      wctx.resetInteractionState();
      wctx.requestRefresh();
      switch (this.pointers.size) {
         case 1: {                                         // left click or single touch
            wctx.canvas.focus();
            if (shiftKey || ctrlKey || altKey) {
               this.startSegmentSelecting(ctrlKey, altKey); }
             else {
               this.startPlaneDragging(); }
            break; }
         case 2: {                                         // zoom gesture
            if (!shiftKey && !ctrlKey && !altKey) {
               this.startZooming(); }}}}

   private completeInteractionOperation() {
      const wctx = this.wctx;
      if (wctx.disabled) {
         return; }
      switch (wctx.iState.interactionOperation) {
         case InteractionOperation.segmentSelecting: {
            this.completeSegmentSelecting();
            break; }}}

   private pointerMoveEventListener = (event: PointerEvent) => {
      const wctx = this.wctx;
      if (!this.pointers.has(event.pointerId)) {
         return; }
      event.preventDefault();
      this.trackPointer(event);
      if (wctx.disabled) {
         return; }
      switch (wctx.iState.interactionOperation) {
         case InteractionOperation.planeDragging: {
            this.dragPlane();
            break; }
         case InteractionOperation.zooming: {
            this.zoom();
            break; }
         case InteractionOperation.segmentSelecting: {
            this.selectSegment();
            break; }}};

   private trackPointer (event: PointerEvent) {
      const wctx = this.wctx;
      const pointerId = event.pointerId;
      if (!this.pointers.has(pointerId)) {
         wctx.canvas.setPointerCapture(pointerId); }
      this.pointers.set(pointerId, event); }

   private releasePointer (pointerId: number) {
      const wctx = this.wctx;
      this.pointers.delete(pointerId);
      wctx.canvas.releasePointerCapture(pointerId); }

   private releaseAllPointers() {
      while (this.pointers.size > 0) {
         const pointerId = this.pointers.keys().next().value;
         this.releasePointer(pointerId); }}

   private startPlaneDragging() {
      const wctx = this.wctx;
      const lPoint = this.getPointerLogicalCoordinates();
      this.dragStartPos = lPoint;
      wctx.iState.interactionOperation = InteractionOperation.planeDragging;
      wctx.requestRefresh(); }

   private dragPlane() {
      const wctx = this.wctx;
      if (this.pointers.size != 1) {
         return; }
      const cPoint = this.getPointerCanvasCoordinates();
      wctx.moveCoordinatePlane(cPoint, this.dragStartPos);
      wctx.requestRefresh();
      wctx.fireViewportChangeEvent(); }

   private startZooming() {
      const wctx = this.wctx;
      const pointerValues = this.pointers.values();
      const event1 = pointerValues.next().value;
      const event2 = pointerValues.next().value;
      const cPoint1 = this.getCanvasCoordinatesFromEvent(event1);
      const cPoint2 = this.getCanvasCoordinatesFromEvent(event2);
      const cCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const xDist = Math.abs(cPoint1.x - cPoint2.x);
      const yDist = Math.abs(cPoint1.y - cPoint2.y);
      this.zoomLCenter = wctx.mapCanvasToLogicalCoordinates(cCenter);
      this.zoomStartDist = PointUtils.computeDistance(cPoint1, cPoint2);
      this.zoomStartFactorX = wctx.getZoomFactor(true);
      this.zoomStartFactorY = wctx.getZoomFactor(false);
      const t = Math.tan(Math.PI / 8);
      this.zoomX = xDist > t * yDist;
      this.zoomY = yDist > t * xDist;
      wctx.iState.interactionOperation = InteractionOperation.zooming; }

   private zoom() {
      const wctx = this.wctx;
      const vState = wctx.vState;
      if (this.pointers.size != 2) {
         return; }
      const pointerValues = this.pointers.values();
      const event1 = pointerValues.next().value;
      const event2 = pointerValues.next().value;
      const cPoint1 = this.getCanvasCoordinatesFromEvent(event1);
      const cPoint2 = this.getCanvasCoordinatesFromEvent(event2);
      const newCCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const newDist = PointUtils.computeDistance(cPoint1, cPoint2);
      const f = newDist / this.zoomStartDist;
      if (this.zoomX) {
         vState.xMax = vState.xMin + wctx.canvas.width / (this.zoomStartFactorX * f); }
      if (this.zoomY) {
         vState.yMax = vState.yMin + wctx.canvas.height / (this.zoomStartFactorY * f); }
      wctx.moveCoordinatePlane(newCCenter, this.zoomLCenter);
      wctx.requestRefresh();
      wctx.fireViewportChangeEvent(); }

   private wheelEventListener = (event: WheelEvent) => {
      const wctx = this.wctx;
      if (wctx.disabled) {
         return; }
      if (wctx.vState.focusShield && !wctx.hasFocus()) {
         return; }
      event.preventDefault();
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (event.deltaY == 0) {
         return; }
      const f0 = (event.deltaMode == 0 && Math.abs(event.deltaY) < 20) ? 1.05 : Math.SQRT2;
      const f = (event.deltaY > 0) ? 1 / f0 : f0;
      let zoomMode: ZoomMode;
      if (event.shiftKey) {
         zoomMode = ZoomMode.y; }
       else if (event.altKey) {
         zoomMode = ZoomMode.x; }
       else if (event.ctrlKey) {
         zoomMode = ZoomMode.xy; }
       else {
         zoomMode = wctx.vState.primaryZoomMode; }
      let fx: number;
      let fy: number;
      switch (zoomMode) {
         case ZoomMode.x: {
            fx = f; fy = 1; break; }
         case ZoomMode.y: {
            fx = 1; fy = f; break; }
         default: {
            fx = f; fy = f; }}
      wctx.zoom(fx, fy, cPoint);
      wctx.requestRefresh();
      wctx.fireViewportChangeEvent(); };

   private startSegmentSelecting (ctrlKey: boolean, altKey: boolean) {
      const wctx = this.wctx;
      const iState = wctx.iState;
      const x = this.getPointerLogicalCoordinates().x;
      if (ctrlKey || altKey) {
         if (Math.abs(x - iState.segmentStart) < Math.abs(x - iState.segmentEnd)) {
            iState.segmentStart = iState.segmentEnd; }}
       else {
         iState.segmentStart = x; }
      iState.segmentEnd = x;
      iState.interactionOperation = InteractionOperation.segmentSelecting;
      wctx.requestRefresh(); }

   private selectSegment() {
      const wctx = this.wctx;
      if (this.pointers.size != 1) {
         return; }
      wctx.iState.segmentEnd = this.getPointerLogicalCoordinates().x;
      wctx.requestRefresh(); }

   private completeSegmentSelecting() {
      const wctx = this.wctx;
      const x1 = Math.min(wctx.iState.segmentStart, wctx.iState.segmentEnd);
      const x2 = Math.max(wctx.iState.segmentStart, wctx.iState.segmentEnd);
      wctx.vState.segmentStart = x1;
      wctx.vState.segmentEnd = x2;
      wctx.vState.segmentSelected = x2 > x1;
      wctx.fireEvent("segmentchange");
      wctx.requestRefresh(); }

   // Returns the canvas coordinates of the first pointer.
   private getPointerCanvasCoordinates() : Point {
      if (this.pointers.size < 1) {
         throw new Error("No active pointers."); }
      const event = this.pointers.values().next().value;
      return this.getCanvasCoordinatesFromEvent(event); }

   // Returns the logical coordinates of the first pointer.
   private getPointerLogicalCoordinates() : Point {
      const wctx = this.wctx;
      const cPoint = this.getPointerCanvasCoordinates();
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      return lPoint; }

   private getCanvasCoordinatesFromEvent (event: MouseEvent) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: event.clientX, y: event.clientY}); }

   // Checks whether the resize property of the parent element of the canvas element is "both"
   // and the pointer is in the lower right corner.
   private isPointerInResizeHandle (event: PointerEvent) : boolean {
      const wctx = this.wctx;
      const parentElement = wctx.canvas.parentNode;
      if (!(parentElement instanceof HTMLElement)) {
         return false; }
      if (getComputedStyle(parentElement).resize != "both") {
         return false; }
      const rect = parentElement.getBoundingClientRect();
      const dx = rect.right - event.clientX;
      const dy = rect.bottom - event.clientY;
      const handleSize = 18;
      return dx >= 0 && dx < handleSize && dy >= 0 && dy < handleSize; }}

//--- Keyboard controller ------------------------------------------------------

class KeyboardController {

   private wctx:             WidgetContext;

   public constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      wctx.canvas.addEventListener("keypress", this.keyPressEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("keypress", this.keyPressEventListener); }

   private keyPressEventListener = (event: KeyboardEvent) => {
      if (this.processKeyPress(event.key)) {
         event.preventDefault(); }};

   private processKeyPress (key: string) {
      const wctx = this.wctx;
      if (wctx.disabled) {
         return false; }
      switch (key) {
         case "+": case "-": case "x": case "X": case "y": case "Y": {
            const fx = (key == '+' || key == 'X') ? Math.SQRT2 : (key == '-' || key == 'x') ? Math.SQRT1_2 : 1;
            const fy = (key == '+' || key == 'Y') ? Math.SQRT2 : (key == '-' || key == 'y') ? Math.SQRT1_2 : 1;
            wctx.zoom(fx, fy);
            wctx.requestRefresh();
            wctx.fireViewportChangeEvent();
            return true; }
         case "r": {
            wctx.reset();
            wctx.requestRefresh();
            wctx.fireViewportChangeEvent();
            return true; }
         case "g": {
            wctx.vState.gridEnabled = !wctx.vState.gridEnabled;
            wctx.requestRefresh();
            return true; }
         default: {
            return false; }}}}

//--- Internal widget context --------------------------------------------------

const enum InteractionOperation {
   none,
   planeDragging,                                                    // coordinate plane is beeing dragged
   zooming,                                                          // zooming in/out
   segmentSelecting }                                                // x-axis segment is beeing selected

interface InteractionState {
   interactionOperation:               InteractionOperation;
   // Values for InteractionOperation = segmentSelecting:
   segmentStart:                       number;
   segmentEnd:                         number; }

interface Style {
   backgroundColor:                    string;
   disabledBackgroundColor:            string;
   selectionColor:                     string;
   labelTextColor:                     string;
   gridColor0:                         string;
   gridColor10:                        string;
   gridColor:                          string;
   curveColors:                        string[];
   curveWidths:                        number[]; }                   // curve line widths

class WidgetContext {

   public  plotter:                    FunctionPlotter;
   public  pointerController:          PointerController;
   public  kbController:               KeyboardController;

   public  canvas:                     HTMLCanvasElement;            // the DOM canvas element
   private canvasStyle:                CSSStyleDeclaration;
   public  eventTarget:                EventTarget;
   public  isConnected:                boolean;
   public  style:                      Style;
   private animationFramePending:      boolean;
   private resizeObserver:             ResizeObserver;

   public  vState:                     ViewerState;                  // current viewer state
   public  initialVState:              ViewerState;                  // last set initial viewer state
   public  iState:                     InteractionState;
   public  disabled:                   boolean;                      // internal "disabled" flag
   public  disabledProperty:           boolean;                      // external "disabled" property

   public constructor (canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.canvasStyle = getComputedStyle(canvas);
      this.eventTarget = new EventTarget();
      this.isConnected = false;
      this.disabled = true;
      this.disabledProperty = false;
      this.animationFramePending = false;
      this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
      this.setViewerState({});
      this.iState = {interactionOperation: InteractionOperation.none, segmentStart: 0, segmentEnd: 0}; }

   private getStyle() {
      const cs = getComputedStyle(this.canvas);
      const style = <Style>{};
      style.backgroundColor         = cs.getPropertyValue("--background-color")          || "#FFFFFF";
      style.disabledBackgroundColor = cs.getPropertyValue("--disabled-background-color") || "#F9F9F9";
      style.selectionColor          = cs.getPropertyValue("--selection-color")           || "#F2F2F2";
      style.labelTextColor          = cs.getPropertyValue("--label-text-color")          || "#707070";
      style.gridColor0              = cs.getPropertyValue("--grid-color-0")              || "rgba(0, 0, 0, 0.404)";
      style.gridColor10             = cs.getPropertyValue("--grid-color-10")             || "rgba(0, 0, 0, 0.169)";
      style.gridColor               = cs.getPropertyValue("--grid-color")                || "rgba(0, 0, 0, 0.067)";
      const maxChannels = 100;
      style.curveColors = Array(maxChannels);
      style.curveColors[0] = cs.getPropertyValue("--curve-color0") || cs.getPropertyValue("--curve-color") || this.generateCurveColor(0);
      for (let channel = 1; channel < maxChannels; channel++) {
         style.curveColors[channel] = cs.getPropertyValue("--curve-color" + channel) || this.generateCurveColor(channel); }
      style.curveWidths = Array(maxChannels);
      style.curveWidths[0] = parseFloat(cs.getPropertyValue("--curve-width0")) || parseFloat(cs.getPropertyValue("--curve-width")) || 1;
      for (let channel = 1; channel < maxChannels; channel++) {
         style.curveWidths[channel] = parseFloat(cs.getPropertyValue("--curve-width" + channel)) || 1; }
      this.style = style; }

   private generateCurveColor (i: number) : string {
      const hueStart = 120;
      const hue = Math.round(hueStart + i * 360 / 6.4) % 360;
      return "hsl(" + hue + ",57%,53%)"; }

   public setConnected (connected: boolean) {
      if (connected == this.isConnected) {
         return; }
      if (connected) {
         this.getStyle();
         this.plotter           = new FunctionPlotter(this);
         this.pointerController = new PointerController(this);
         this.kbController      = new KeyboardController(this);
         this.resizeObserver.observe(this.canvas); }
       else {
         this.pointerController.dispose();
         this.kbController.dispose();
         this.resizeObserver.unobserve(this.canvas); }
      this.isConnected = connected;
      this.requestRefresh(); }

   public setViewerState (vState: Partial<ViewerState>) {
      this.vState = cloneViewerState(vState);
      this.initialVState = cloneViewerState(vState);
      this.updateDisabledFlag();
      this.requestRefresh(); }

   public updateDisabledFlag() {
      const oldDisabled = this.disabled;
      this.disabled = this.disabledProperty || (!this.vState.viewerFunction && !this.vState.customPaintFunction);
      if (this.disabled != oldDisabled) {
         this.requestRefresh(); }}

   public getViewerState() : ViewerState {
      return cloneViewerState(this.vState); }

   public resetInteractionState() {
      this.iState.interactionOperation = InteractionOperation.none; }

   // Resets the context to the initial state.
   public reset() {
      this.setViewerState(this.initialVState);
      this.resetInteractionState(); }

   public mapLogicalToCanvasXCoordinate (lx: number) : number {
      return (lx - this.vState.xMin) * this.canvas.width / (this.vState.xMax - this.vState.xMin); }

   public mapLogicalToCanvasYCoordinate (ly: number) : number {
      return this.canvas.height - (ly - this.vState.yMin) * this.canvas.height / (this.vState.yMax - this.vState.yMin); }

   public mapLogicalToCanvasCoordinates (lPoint: Point) : Point {
      return {x: this.mapLogicalToCanvasXCoordinate(lPoint.x), y: this.mapLogicalToCanvasYCoordinate(lPoint.y)}; }

   public mapCanvasToLogicalXCoordinate (cx: number) : number {
      return this.vState.xMin + cx * (this.vState.xMax - this.vState.xMin) / this.canvas.width; }

   public mapCanvasToLogicalYCoordinate (cy: number) : number {
      return this.vState.yMin + (this.canvas.height - cy) * (this.vState.yMax - this.vState.yMin) / this.canvas.height; }

   public mapCanvasToLogicalCoordinates (cPoint: Point) : Point {
      return {x: this.mapCanvasToLogicalXCoordinate(cPoint.x), y: this.mapCanvasToLogicalYCoordinate(cPoint.y)}; }

   public mapViewportToCanvasCoordinates (vPoint: Point) : Point {
      const canvasStyle = this.canvasStyle;
      const rect = this.canvas.getBoundingClientRect();
      const paddingLeft   = getPx(canvasStyle.paddingLeft);
      const paddingRight  = getPx(canvasStyle.paddingRight);
      const paddingTop    = getPx(canvasStyle.paddingTop);
      const paddingBottom = getPx(canvasStyle.paddingBottom);
      const borderLeft    = getPx(canvasStyle.borderLeftWidth);
      const borderTop     = getPx(canvasStyle.borderTopWidth);
      const width  = this.canvas.clientWidth  - paddingLeft - paddingRight;
      const height = this.canvas.clientHeight - paddingTop  - paddingBottom;
      const x1 = vPoint.x - rect.left - borderLeft - paddingLeft;
      const y1 = vPoint.y - rect.top  - borderTop  - paddingTop;
      const x = x1 / width  * this.canvas.width;
      const y = y1 / height * this.canvas.height;
      return {x, y};
      function getPx (s: string) : number {
         return s ? parseFloat(s) : 0; }}                            // ignores the "px" suffix

   // Moves the coordinate plane so that `cPoint` (in canvas coordinates) matches
   // `lPoint` (in logical coordinates), while keeping the zoom factors unchanged.
   public moveCoordinatePlane (cPoint: Point, lPoint: Point) {
      const vState = this.vState;
      const lWidth  = vState.xMax - vState.xMin;
      const lHeight = vState.yMax - vState.yMin;
      const cWidth  = this.canvas.width;
      const cHeight = this.canvas.height;
      vState.xMin = lPoint.x - cPoint.x * lWidth / cWidth;
      vState.xMax = vState.xMin + lWidth;
      vState.yMin = lPoint.y - (cHeight - cPoint.y) * lHeight / cHeight;
      vState.yMax = vState.yMin + lHeight; }

   public getZoomFactor (xy: boolean) : number {
      const vState = this.vState;
      return xy ? this.canvas.width / (vState.xMax - vState.xMin) : this.canvas.height / (vState.yMax - vState.yMin); }

   public zoom (fx: number, fyOpt?: number, cCenterOpt?: Point) {
      const vState = this.vState;
      const fy = fyOpt ?? fx;
      const cCenter = cCenterOpt ?? {x: this.canvas.width / 2, y: this.canvas.height / 2};
      const lCenter = this.mapCanvasToLogicalCoordinates(cCenter);
      vState.xMax = vState.xMin + (vState.xMax - vState.xMin) / fx;
      vState.yMax = vState.yMin + (vState.yMax - vState.yMin) / fy;
      this.moveCoordinatePlane(cCenter, lCenter); }

   public getGridParms (xy: boolean) : {space: number; span: number; pos: number; decPow: number} | undefined {
      const minSpaceC = xy ? 66 : 50;                                              // minimum space between grid lines in pixel
      const edge = xy ? this.vState.xMin : this.vState.yMin;                       // canvas edge coordinate
      const minSpaceL = minSpaceC / this.getZoomFactor(xy);                        // minimum space between grid lines in logical coordinate units
      const decPow = Math.ceil(Math.log(minSpaceL / 5) / Math.LN10);               // decimal power of grid line space
      const edgeDecPow = (edge == 0) ? -99 : Math.log(Math.abs(edge)) / Math.LN10; // decimal power of canvas coordinates
      if (edgeDecPow - decPow > 10) {
         return; }                                                                 // numerically instable
      const space = Math.pow(10, decPow);                                          // grid line space (distance) in logical units
      const f = minSpaceL / space;                                                 // minimum for span factor
      const span = (f > 2.001) ? 5 : (f > 1.001) ? 2 : 1;                          // span factor for visible grid lines
      const p1 = Math.ceil(edge / space);
      const pos = span * Math.ceil(p1 / span);                                     // position of first grid line in grid space units
      return {space, span, pos, decPow}; }

   public requestRefresh() {
      if (this.animationFramePending || !this.isConnected) {
         return; }
      requestAnimationFrame(this.animationFrameHandler);
      this.animationFramePending = true; }

   private animationFrameHandler = () => {
      this.animationFramePending = false;
      if (!this.isConnected) {
         return; }
      this.refresh(); };

   // Re-paints the canvas and updates the cursor.
   private refresh() {
      this.plotter.paint();
      this.updateCanvasCursorStyle(); }

   private updateCanvasCursorStyle() {
      let style: string;
      switch (this.iState.interactionOperation) {
         case InteractionOperation.planeDragging:    style = "move";       break;
         case InteractionOperation.segmentSelecting: style = "col-resize"; break;
         default:                                    style = "auto"; }
      this.canvas.style.cursor = style; }

   public fireViewportChangeEvent() {
      this.fireEvent("viewportchange"); }

   public fireEvent (eventName: string) {
      const event = new CustomEvent(eventName);
      nextTick(() => {                                     // call event listeners asynchronously
         this.eventTarget.dispatchEvent(event); }); }

   public hasFocus() : boolean {
      return document.activeElement === this.canvas; }

   private resizeObserverCallback = (entries: ResizeObserverEntry[]) => {
      const box = entries[0].contentBoxSize[0];
      const width = box.inlineSize;
      const height = box.blockSize;
      this.plotter.resize(width, height); }; }

//--- Viewer state -------------------------------------------------------------

/**
* The viewer function provides the Y values for the function graph to be plotted.
*
* @param x
*    X coordinate value.
* @param sampleWidth
*    Sample width used to plot the function graph.
*    In the current implementation of the function curve viewer, the sample width is (xMax - xMin) / canvasWidth.
* @param channel
*    0-based channel number.
* @return
*   The return value can be:
*   - A single Y value.
*   - An array containing the lowest and highest Y values for the X range (x - sampleWidth / 2) to (x + sampleWidth / 2).
*   - undefined, when the function value is undefined for this X value.
*/
export type ViewerFunction = (x: number, sampleWidth: number, channel: number) => (number | number[] | undefined);

export const enum ZoomMode {x, y, xy}

// Function curve viewer state.
export interface ViewerState {
   viewerFunction?:          ViewerFunction;               // the function to be plotted in this viewer
   channels:                 number;                       // number of channels to plot (number of graphs)
   xMin:                     number;                       // minimum x coordinate of the function graph area (viewport)
   xMax:                     number;                       // maximum x coordinate of the function graph area (viewport)
   yMin:                     number;                       // minimum y coordinate of the function graph area (viewport)
   yMax:                     number;                       // maximum y coordinate of the function graph area (viewport)
   gridEnabled:              boolean;                      // true to draw a coordinate grid
   xAxisUnit?:               string;                       // unit to be appended to x-axis labels
   yAxisUnit?:               string;                       // unit to be appended to y-axis labels
   primaryZoomMode:          ZoomMode;                     // zoom mode to be used for mouse wheel when no shift/alt/ctrl-Key is pressed
   focusShield:              boolean;                      // true to ignore mouse wheel events without focus
   customPaintFunction?:     CustomPaintFunction;          // custom paint function
   segmentSelected:          boolean;                      // =true if an x-axis segment is selected
   segmentStart:             number;                       // x value of start of x-axis segment, only relevant if segmentSelected is true
   segmentEnd:               number; }                     // x value of end of x-axis segment, only relevant if segmentSelected is true

// Clones and adds missing fields.
function cloneViewerState (vState: Partial<ViewerState>) : ViewerState {
   return {
      viewerFunction:        vState.viewerFunction,
      channels:              vState.channels ?? 1,
      xMin:                  vState.xMin ?? 0,
      xMax:                  vState.xMax ?? 1,
      yMin:                  vState.yMin ?? 0,
      yMax:                  vState.yMax ?? 1,
      gridEnabled:           vState.gridEnabled ?? true,
      xAxisUnit:             vState.xAxisUnit,
      yAxisUnit:             vState.yAxisUnit,
      primaryZoomMode:       vState.primaryZoomMode ?? ZoomMode.xy,
      focusShield:           vState.focusShield ?? false,
      customPaintFunction:   vState.customPaintFunction,
      segmentSelected:       vState.segmentSelected ?? false,
      segmentStart:          vState.segmentStart ?? 0,
      segmentEnd:            vState.segmentEnd ?? 0 }; }

//--- Custom paint function ----------------------------------------------------

/**
* A custom paint function can be used to draw additional content on the canvas.
*/
export type CustomPaintFunction = (pctx: CustomPaintContext) => void;

export interface CustomPaintContext {
   vState:                   ViewerState;                  // viewer state
   ctx:                      CanvasRenderingContext2D;     // canvas drawing context
   mapLogicalToCanvasXCoordinate: (lx: number) => number;  // function to map x coordinate from logical to canvas
   mapLogicalToCanvasYCoordinate: (ly: number) => number;  // function to map y coordinate from logical to canvas
   curveColors:              string[]; }                   // colors used for drawing function plot

//--- Widget -------------------------------------------------------------------

export class Widget {

   private wctx:             WidgetContext;

   public constructor (canvas: HTMLCanvasElement, connected = true) {
      this.wctx = new WidgetContext(canvas);
      if (connected) {
         this.setConnected(true); }}

   // Sets a new EventTarget for this widget.
   // The web component calls this method to direct the events out of the shadow DOM.
   public setEventTarget (eventTarget: EventTarget) {
      this.wctx.eventTarget = eventTarget; }

   // Called after the widget is inserted into or removed from the DOM.
   // It installs or removes the internal event listeners for mouse, touch and keyboard.
   // When the widget is connected, it also adjusts the resolution of the backing bitmap
   // and draws the widget.
   public setConnected (connected: boolean) {
      this.wctx.setConnected(connected); }

   // Registers an event listener.
   // Supported events:
   //    viewportchange:
   //      Fired after the user has changed the viewport of the widget e.g. by zooming
   //      oder moving the plane.
   //    segmentchange:
   //      Fired after the user has changed the x-axis segment selection.
   public addEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.addEventListener(type, listener); }

   // Deregisters an event listener.
   public removeEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.removeEventListener(type, listener); }

   // Returns the current state of the function curve viewer.
   public getViewerState() : ViewerState {
      return this.wctx.getViewerState(); }

   // Updates the current state of the function curve viewer.
   public setViewerState (vState: Partial<ViewerState>) {
      const wctx = this.wctx;
      wctx.setViewerState(vState); }

   public get disabled() : boolean {
      return this.wctx.disabledProperty; }

   public set disabled (disabled: boolean) {
      this.wctx.disabledProperty = disabled;
      this.wctx.updateDisabledFlag(); }

   // Returns the help text as an array.
   public getRawHelpText() : string[] {
      const pz = this.wctx.vState.primaryZoomMode;
      const primaryZoomAxis = (pz == ZoomMode.x) ? "x-axis" : (pz == ZoomMode.y) ? "y-axis" : "both axes";
      return [
         "drag plane with mouse or touch", "move the coordinate space",
         "shift + drag",                   "select x-axis segment",
         "shift + click",                  "clear x-asis segment,<br> set edge for ctrl+click/drag",
         "ctrl + click &nbsp;or&nbsp; alt + click<br>" +
         "ctrl + drag &nbsp;or&nbsp; alt + drag",
                                           "modify x-asis segment",
         "mouse wheel",                    "zoom " + primaryZoomAxis,
         "shift + mouse wheel",            "zoom y-axis",
         "ctrl + mouse wheel",             "zoom both axes",
         "alt + mouse wheel",              "zoom x-axis",
         "touch zoom gesture",             "zoom x, y or both axes",
         "+ / -",                          "zoom both axes in/out",
         "X / x",                          "zoom x-axis in/out",
         "Y / y",                          "zoom y-axis in/out",
         "g",                              "toggle coordinate grid",
         "r",                              "reset to the initial state" ]; }

   // Returns the help text as a HTML string.
   public getFormattedHelpText() : string {
      const t = this.getRawHelpText();
      const a: string[] = [];
      a.push("<table class='functionCurveViewerHelp'>");
      a.push( "<colgroup>");
      a.push(  "<col class='functionCurveViewerHelpCol1'>");
      a.push(  "<col class='functionCurveViewerHelpCol2'>");
      a.push( "</colgroup>");
      a.push( "<tbody>");
      for (let i = 0; i < t.length; i += 2) {
         a.push("<tr><td>");
         a.push(t[i]);
         a.push("</td><td>");
         a.push(t[i + 1]);
         a.push("</td>"); }
      a.push( "</tbody>");
      a.push("</table>");
      return a.join(""); }}
