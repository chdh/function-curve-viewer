import EventTargetPolyfill from "./EventTargetPolyfill";

//--- Point and PointUtils -----------------------------------------------------

export interface Point {
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

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      const ctx = wctx.canvas.getContext("2d");
      if (ctx == null) {
         throw new Error("Canvas 2D context not available."); }
      this.ctx = ctx; }

   private clearCanvas() {
      const wctx = this.wctx;
      const ctx = this.ctx;
      ctx.save();
      const width  = wctx.canvas.width;
      const height = wctx.canvas.height;
      ctx.fillStyle = wctx.style.backgroundColor;
      ctx.fillRect(0, 0, width, height);
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

   private drawFunctionCurve() {
      // Curve drawing can switch from line mode to fill mode.
      // Line mode is preferred because it looks visually better thanks to antialiasing.
      const enum Mode {skip=0, line, fill}
      const wctx = this.wctx;
      const ctx = this.ctx;
      const viewerFunction = wctx.vState.viewerFunction;
      const canvasWidth = wctx.canvas.width;
      const canvasHeight = wctx.canvas.height;
      const sampleWidth = (wctx.vState.xMax - wctx.vState.xMin) / wctx.canvas.width;
      const pixelCompensation = 0.41;
      ctx.save();
      ctx.fillStyle = wctx.style.curveColor;
      ctx.strokeStyle = ctx.fillStyle;
      let prevCyLo: number|undefined = undefined;
      let prevCyHi: number|undefined = undefined;
      let pixelAcc = 0;
      let fillModeUsed = false;
      let mode: number = Mode.skip;                  // "number" is used instead of "Mode" to prevent compiler error, see https://stackoverflow.com/questions/48919455
      startMode();
      for (let cx = 0; cx < canvasWidth; cx++) {
         const lx = wctx.mapCanvasToLogicalXCoordinate(cx + 0.5);
         const ly = viewerFunction(lx, sampleWidth);
         let lyLo: number;
         let lyHi: number;
         if (ly == undefined) {
            switchMode(Mode.skip);
            continue; }
         if (Array.isArray(ly)) {
            lyLo = ly[0];
            lyHi = ly[1]; }
          else {
            lyLo = ly;
            lyHi = ly; }
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
               const cyLo0 = Math.max(0, Math.min(canvasHeight, wctx.mapLogicalToCanvasYCoordinate(lyHi)));      // (hi/lo reversed, because Y coordinate polarity is switched)
               const cyHi0 = Math.max(0, Math.min(canvasHeight, wctx.mapLogicalToCanvasYCoordinate(lyLo)));
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
               ctx.fillRect(cx, cyLo, 1, cyHi - cyLo);
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
      this.clearCanvas();
      if (wctx.vState.gridEnabled) {
         this.drawGrid(); }
      this.drawFunctionCurve(); }}

//--- Pointer controller -------------------------------------------------------

// Common high-level routines for mouse and touch.
class PointerController {

   private wctx:             WidgetContext;
   private dragStartPos:     Point | undefined;            // logical coordinates of starting point of drag action

   constructor (wctx: WidgetContext) {
      this.wctx = wctx; }

   public startDragging (cPoint: Point) {
      const wctx = this.wctx;
      const lPoint = wctx.mapCanvasToLogicalCoordinates(cPoint);
      wctx.iState.planeDragging = true;
      this.dragStartPos = lPoint;
      wctx.refresh(); }

   public processPointerMove (cPoint: Point) : boolean {
      const wctx = this.wctx;
      if (wctx.iState.planeDragging && this.dragStartPos) {
         wctx.moveCoordinatePlane(cPoint, this.dragStartPos);
         wctx.refresh();
         wctx.fireViewportChangeEvent();
         return true; }
      return false; }

   public stopDragging() : boolean {
      const wctx = this.wctx;
      if (!wctx.iState.planeDragging) {
         return false; }
      wctx.iState.planeDragging = false;
      this.dragStartPos = undefined;
      wctx.refresh();
      return true; }}

//--- Mouse controller ---------------------------------------------------------

class MouseController {

   private wctx:              WidgetContext;
   private pointerController: PointerController;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointerController = new PointerController(wctx);
      wctx.canvas.addEventListener("mousedown", this.mouseDownEventListener);
      document.addEventListener("mouseup", this.mouseUpEventListener);
      document.addEventListener("mousemove", this.mouseMoveEventListener);
      wctx.canvas.addEventListener("wheel", this.wheelEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("mousedown", this.mouseDownEventListener);
      document.removeEventListener("mouseup", this.mouseUpEventListener);
      document.removeEventListener("mousemove", this.mouseMoveEventListener);
      wctx.canvas.removeEventListener("wheel", this.wheelEventListener); }

   private mouseDownEventListener = (event: MouseEvent) => {
      const wctx = this.wctx;
      if (event.button == 0) {
         const cPoint = this.getCanvasCoordinatesFromEvent(event);
         this.pointerController.startDragging(cPoint);
         event.preventDefault();
         wctx.canvas.focus(); }};

   private mouseUpEventListener = (event: MouseEvent) => {
      if (this.pointerController.stopDragging()) {
         event.preventDefault(); }};

   private mouseMoveEventListener = (event: MouseEvent) => {
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (this.pointerController.processPointerMove(cPoint)) {
         event.preventDefault(); }};

   private wheelEventListener = (event: WheelEvent) => {
      const wctx = this.wctx;
      const cPoint = this.getCanvasCoordinatesFromEvent(event);
      if (event.deltaY == 0) {
         return; }
      const f = (event.deltaY > 0) ? Math.SQRT1_2 : Math.SQRT2;
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
      wctx.refresh();
      wctx.fireViewportChangeEvent();
      event.preventDefault(); };

   private getCanvasCoordinatesFromEvent (event: MouseEvent) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: event.clientX, y: event.clientY}); }}

//--- Touch controller ---------------------------------------------------------

class TouchController {

   private wctx:              WidgetContext;
   private pointerController: PointerController;
   private zooming:           boolean = false;
   private zoomLCenter:       Point;                       // zoom center point in logical coordinates
   private zoomStartDist:     number;
   private zoomStartFactorX:  number;
   private zoomStartFactorY:  number;
   private zoomX:             boolean;                     // true when zooming in X direction
   private zoomY:             boolean;                     // true when zooming in y direction

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      this.pointerController = new PointerController(wctx);
      wctx.canvas.addEventListener("touchstart", this.touchStartEventListener);
      wctx.canvas.addEventListener("touchmove", this.touchMoveEventListener);
      wctx.canvas.addEventListener("touchend", this.touchEndEventListener);
      wctx.canvas.addEventListener("touchcancel", this.touchEndEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("touchstart", this.touchStartEventListener);
      wctx.canvas.removeEventListener("touchmove", this.touchMoveEventListener);
      wctx.canvas.removeEventListener("touchend", this.touchEndEventListener);
      wctx.canvas.removeEventListener("touchcancel", this.touchEndEventListener); }

   private touchStartEventListener = (event: TouchEvent) => {
      const touches = event.touches;
      if (touches.length == 1) {
         const touch = touches[0];
         const cPoint = this.getCanvasCoordinatesFromTouch(touch);
         this.pointerController.startDragging(cPoint);
         event.preventDefault(); }
       else if (touches.length == 2) {                     // zoom gesture
         this.startZooming(touches);
         event.preventDefault(); }};

   private touchMoveEventListener = (event: TouchEvent) => {
      const touches = event.touches;
      if (touches.length == 1) {
         const touch = touches[0];
         const cPoint = this.getCanvasCoordinatesFromTouch(touch);
         if (this.pointerController.processPointerMove(cPoint)) {
            event.preventDefault(); }}
       else if (touches.length == 2 && this.zooming) {
         this.zoom(touches);
         event.preventDefault(); }};

   private touchEndEventListener = (event: TouchEvent) => {
      if (this.pointerController.stopDragging() || this.zooming) {
         this.zooming = false;
         event.preventDefault(); }};

   private getCanvasCoordinatesFromTouch (touch: Touch) : Point {
      const wctx = this.wctx;
      return wctx.mapViewportToCanvasCoordinates({x: touch.clientX, y: touch.clientY}); }

   private startZooming (touches: TouchList) {
      const wctx = this.wctx;
      const touch1 = touches[0];
      const touch2 = touches[1];
      const cPoint1 = this.getCanvasCoordinatesFromTouch(touch1);
      const cPoint2 = this.getCanvasCoordinatesFromTouch(touch2);
      const cCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const xDist = Math.abs(cPoint1.x - cPoint2.x);
      const yDist = Math.abs(cPoint1.y - cPoint2.y);
      this.zoomLCenter = wctx.mapCanvasToLogicalCoordinates(cCenter);
      this.zoomStartDist = PointUtils.computeDistance(cPoint1, cPoint2);
      this.zoomStartFactorX = wctx.getZoomFactor(true);
      this.zoomStartFactorY = wctx.getZoomFactor(false);
      this.zoomX = xDist * 2 > yDist;
      this.zoomY = yDist * 2 > xDist;
      this.zooming = true; }

   private zoom (touches: TouchList) {
      const wctx = this.wctx;
      const vState = wctx.vState;
      const touch1 = touches[0];
      const touch2 = touches[1];
      const cPoint1 = this.getCanvasCoordinatesFromTouch(touch1);
      const cPoint2 = this.getCanvasCoordinatesFromTouch(touch2);
      const newCCenter = PointUtils.computeCenter(cPoint1, cPoint2);
      const newDist = PointUtils.computeDistance(cPoint1, cPoint2);
      const f = newDist / this.zoomStartDist;
      if (this.zoomX) {
         vState.xMax = vState.xMin + wctx.canvas.width / (this.zoomStartFactorX * f); }
      if (this.zoomY) {
         vState.yMax = vState.yMin + wctx.canvas.height / (this.zoomStartFactorY * f); }
      wctx.moveCoordinatePlane(newCCenter, this.zoomLCenter);
      wctx.refresh();
      wctx.fireViewportChangeEvent(); }}

//--- Keyboard controller ------------------------------------------------------

class KeyboardController {

   private wctx:             WidgetContext;

   constructor (wctx: WidgetContext) {
      this.wctx = wctx;
      wctx.canvas.addEventListener("keypress", this.keyPressEventListener); }

   public dispose() {
      const wctx = this.wctx;
      wctx.canvas.removeEventListener("keypress", this.keyPressEventListener); }

   private keyPressEventListener = (event: KeyboardEvent) => {
      if (this.processKeyPress(event.key)) {
         event.stopPropagation(); }};

   private processKeyPress (key: string) {
      const wctx = this.wctx;
      switch (key) {
         case "+": case "-": case "x": case "X": case "y": case "Y": {
            const fx = (key == '+' || key == 'X') ? Math.SQRT2 : (key == '-' || key == 'x') ? Math.SQRT1_2 : 1;
            const fy = (key == '+' || key == 'Y') ? Math.SQRT2 : (key == '-' || key == 'y') ? Math.SQRT1_2 : 1;
            wctx.zoom(fx, fy);
            wctx.refresh();
            wctx.fireViewportChangeEvent();
            return true; }
         case "r": {
            wctx.reset();
            wctx.refresh();
            wctx.fireViewportChangeEvent();
            return true; }
         case "g": {
            wctx.vState.gridEnabled = !wctx.vState.gridEnabled;
            wctx.refresh();
            return true; }
         default: {
            return false; }}}}

//--- Internal widget context --------------------------------------------------

interface InteractionState {
   planeDragging:            boolean; }                    // true if the coordinate plane is beeing dragged

interface Style {
   backgroundColor:          string;
   labelTextColor:           string;
   gridColor0:               string;
   gridColor10:              string;
   gridColor:                string;
   curveColor:               string; }

class WidgetContext {

   public plotter:           FunctionPlotter;
   public mouseController:   MouseController;
   public touchController:   TouchController;
   public kbController:      KeyboardController;

   public canvas:            HTMLCanvasElement;            // the DOM canvas element
   public eventTarget:       EventTarget;
   public isConnected:       boolean;
   public style:             Style;

   public vState:            ViewerState;                  // current viewer state
   public initialVState:     ViewerState;                  // last set initial viewer state
   public iState:            InteractionState;

   constructor (canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.eventTarget = new EventTargetPolyfill();
      this.isConnected = false;
      this.setViewerState(<ViewerState>{});
      this.resetInteractionState(); }

   private getStyle() {
      const cs = getComputedStyle(this.canvas);
      const style = <Style>{};
      style.backgroundColor = cs.getPropertyValue("--background-color") || "#FFFFFF";
      style.labelTextColor  = cs.getPropertyValue("--label-text-color") || "#707070";
      style.gridColor0      = cs.getPropertyValue("--grid-color-0")     || "#989898";
      style.gridColor10     = cs.getPropertyValue("--grid-color-10")    || "#D4D4D4";
      style.gridColor       = cs.getPropertyValue("--grid-color")       || "#EEEEEE";
      style.curveColor      = cs.getPropertyValue("--curve-color")      || "#44CC44";
      this.style = style; }

   public setConnected (connected: boolean) {
      if (connected == this.isConnected) {
         return; }
      if (connected) {
         this.getStyle();
         this.plotter         = new FunctionPlotter(this);
         this.mouseController = new MouseController(this);
         this.touchController = new TouchController(this);
         this.kbController    = new KeyboardController(this); }
       else {
         this.mouseController.dispose();
         this.touchController.dispose();
         this.kbController.dispose(); }
      this.isConnected = connected; }

   public adjustBackingBitmapResolution() {
      this.canvas.width = this.canvas.clientWidth || 200;
      this.canvas.height = this.canvas.clientHeight || 200; }

   public setViewerState (vState: ViewerState) {
      this.vState = cloneViewerState(vState);
      this.initialVState = cloneViewerState(vState); }

   public getViewerState() : ViewerState {
      return cloneViewerState(this.vState); }

   private resetInteractionState() {
      this.iState = {
         planeDragging:    false}; }

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
      const rect = this.canvas.getBoundingClientRect();
      const x1 = vPoint.x - rect.left - (this.canvas.clientLeft || 0);
      const y1 = vPoint.y - rect.top  - (this.canvas.clientTop  || 0);
         // Our canvas element may have a border, but must have no padding.
         // In the future, the CSSOM View Module can probably be used for proper coordinate mapping.
      const x = x1 / rect.width  * this.canvas.width;
      const y = y1 / rect.height * this.canvas.height;
      return {x, y}; }

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

   public zoom (fx: number, fy?: number, cCenter?: Point) {
      const vState = this.vState;
      if (fy == undefined) {
         fy = fx; }
      if (cCenter == undefined) {
         cCenter = {x: this.canvas.width / 2, y: this.canvas.height / 2}; }
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

   // Re-paints the canvas and updates the cursor.
   public refresh() {
      this.plotter.paint();
      this.updateCanvasCursorStyle(); }

   private updateCanvasCursorStyle() {
      const style = this.iState.planeDragging ? "move" : "auto";
      this.canvas.style.cursor = style; }

   public fireViewportChangeEvent() {
      const event = new CustomEvent("viewportchange");
      this.eventTarget.dispatchEvent(event); }}

//--- Viewer state -------------------------------------------------------------

// The viewer function receives an X value and the sample width used to plot the function graph.
// It returns one of the following:
//   - A single Y value.
//   - An array containing the lowest and highest Y values within the range (x - sampleWidth/2) to (x + sampleWidth/2).
//   - undefined, when the function value is undefined for this X value.
// In the current implementation of the function curve viewer, the sample width is (xMax - xMin) / canvasWidth.
export type ViewerFunction = (x: number, sampleWidth: number) => (number | number[] | undefined);

export const enum ZoomMode {x, y, xy}

// Function curve viewer state.
export interface ViewerState {
   viewerFunction:           ViewerFunction;               // the function to be plotted in this viewer
   xMin:                     number;                       // minimum x coordinate of the function graph area
   xMax:                     number;                       // maximum x coordinate of the function graph area
   yMin:                     number;                       // minimum y coordinate of the function graph area
   yMax:                     number;                       // maximum y coordinate of the function graph area
   gridEnabled:              boolean;                      // true to draw a coordinate grid
   xAxisUnit?:               string;                       // unit to be appended to x-axis labels
   yAxisUnit?:               string;                       // unit to be appended to y-axis labels
   primaryZoomMode:          ZoomMode; }                   // zoom mode to be used for mouse wheel when no shift/alt/ctrl-Key is pressed

// Clones and adds missing fields.
function cloneViewerState (vState: ViewerState) : ViewerState {
   const vState2 = <ViewerState>{};
   vState2.viewerFunction      = get(vState.viewerFunction, (x: number, _sampleWidth: number) => Math.sin(x));
   vState2.xMin                = get(vState.xMin, 0);
   vState2.xMax                = get(vState.xMax, 1);
   vState2.yMin                = get(vState.yMin, 0);
   vState2.yMax                = get(vState.yMax, 1);
   vState2.xAxisUnit           = vState.xAxisUnit;
   vState2.yAxisUnit           = vState.yAxisUnit;
   vState2.gridEnabled         = get(vState.gridEnabled, true);
   vState2.primaryZoomMode     = get(vState.primaryZoomMode, ZoomMode.xy);
   return vState2;
   function get<T> (value: T, defaultValue: T) : T {
      return (value === undefined) ? defaultValue : value; }}

//--- Widget -------------------------------------------------------------------

export class Widget {

   private wctx:             WidgetContext;

   constructor (canvas: HTMLCanvasElement, connected = true) {
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
      const wctx = this.wctx;
      this.wctx.setConnected(connected);
      if (connected) {
         wctx.adjustBackingBitmapResolution();
         wctx.refresh(); }}

   // Registers an event listener.
   // Currently only the "viewport-change" event is supported.
   // The "viewportchange" event is fired after the user has changed the viewport of the widget
   // e.g. by zooming oder moving the plane.
   public addEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.addEventListener(type, listener); }

   // Deregisters an event listener.
   public removeEventListener (type: string, listener: EventListener) {
      this.wctx.eventTarget.removeEventListener(type, listener); }

   // Returns the current state of the function curve viewer.
   public getViewerState() : ViewerState {
      return this.wctx.getViewerState(); }

   // Updates the current state of the function curve viewer.
   public setViewerState (vState: ViewerState) {
      const wctx = this.wctx;
      wctx.setViewerState(vState);
      if (wctx.isConnected) {
         wctx.refresh(); }}

   // Returns the help text as an array.
   public getRawHelpText() : string[] {
      const pz = this.wctx.vState.primaryZoomMode;
      const primaryZoomAxis = (pz == ZoomMode.x) ? "x-axis" : (pz == ZoomMode.y) ? "y-axis" : "both axes";
      return [
         "drag plane with mouse or touch", "move the coordinate space",
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
