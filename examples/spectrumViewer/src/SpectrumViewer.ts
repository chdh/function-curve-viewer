// This is a simple implementation of a spectrum viewer web component.
// It is based on the function curve viewer web component.
//
// The current implementation does not yet support DOM attribute changes
// and does not mirror object attribute changes to the DOM.

import * as FunctionCurveViewer from "function-curve-viewer";
import * as Utils from "./Utils.ts";

export type PlotType = "line" | "bars";

export class SpectrumViewerElement extends FunctionCurveViewer.FunctionCurveViewerElement {

   private refreshPending:             boolean = false;

   // Element attributes:
   private _spectrum:                  ArrayLike<number> = [];                 // spectrum amplitude values in dB
   private _specRes:                   number = 10;                            // spectrum resolution in Hz
   private _plotType:                  PlotType = "line";                      // plot type for the spectrum curve
   private _xMin:                      number = 0;
   private _xMax:                      number = 5500;
   private _yMin:                      number = -100;
   private _yMax:                      number = 0;

   public constructor() {
      super(); }

   // Attribute accessors:
   public get spectrum() : ArrayLike<number> {
      return this._spectrum; }
   public set spectrum (spectrum: ArrayLike<number>) {
      this._spectrum = spectrum;
      this.requestRefresh(); }
   public get specRes() : number {
      return this._specRes; }
   public set specRes (specRes: number) {
      if (this._specRes == specRes) {
         return; }
      this._specRes = specRes;
      this.requestRefresh(); }
   public get plotType() : PlotType {
      return this._plotType; }
   public set plotType (plotType: PlotType) {
      if (this._plotType == plotType) {
         return; }
      this._plotType = plotType;
      this.requestRefresh(); }
   public get xMin() : number {
      return this._xMin; }
   public set xMin (xMin: number) {
      if (this._xMin == xMin) {
         return; }
      this._xMin = xMin;
      this.requestRefresh(); }
   public get xMax() : number {
      return this._xMax; }
   public set xMax (xMax: number) {
      if (this._xMax == xMax) {
         return; }
      this._xMax = xMax;
      this.requestRefresh(); }
   public get yMin() : number {
      return this._yMin; }
   public set yMin (yMin: number) {
      if (this._yMin == yMin) {
         return; }
      this._yMin = yMin;
      this.requestRefresh(); }
   public get yMax() : number {
      return this._yMax; }
   public set yMax (yMax: number) {
      if (this._yMax == yMax) {
         return; }
      this._yMax = yMax;
      this.requestRefresh(); }

   private drawBars = (pctx: FunctionCurveViewer.CustomPaintContext) => {
      if (pctx.pass != 1) {
         return; }
      const ctx = pctx.ctx;
      ctx.save();
      ctx.fillStyle = pctx.curveColors[0];
      const n = this._spectrum.length;
      const specRes = this._specRes;
      const cyBottom = pctx.mapLogicalToCanvasYCoordinate(-999);
      let cx1 = Math.round(pctx.mapLogicalToCanvasXCoordinate(-specRes / 2));
      for (let p = 0; p < n; p++) {
         const f = p * specRes;                                                // frequency
         const a = this._spectrum[p];                                          // amplitude
         const lx2 = f + specRes / 2;
         const cx2 = Math.round(pctx.mapLogicalToCanvasXCoordinate(lx2));
         if (cx2 > cx1) {
            const cy = pctx.mapLogicalToCanvasYCoordinate(a);
            ctx.fillRect(cx1, cy, cx2 - cx1, cyBottom - cy);
            cx1 = cx2; }}
      ctx.restore(); };

   private loadFunctionViewer() {
      let viewerFunction: FunctionCurveViewer.ViewerFunction | undefined = undefined;
      let customPaintFunction: FunctionCurveViewer.CustomPaintFunction | undefined = undefined;
      switch (this._plotType) {
         case "line": {
            viewerFunction = FunctionCurveViewer.createViewerFunctionForArray(this._spectrum, {scalingFactor: 1 / this._specRes, nearestNeighbor: true});
            break; }
         case "bars": {
            customPaintFunction = this.drawBars;
            break; }}
      const viewerState : Partial<FunctionCurveViewer.ViewerState> = {
         viewerFunction,
         customPaintFunction,
         xMin:             this._xMin,
         xMax:             this._xMax,
         yMin:             this._yMin,
         yMax:             this._yMax,
         gridEnabled:      true,
         primaryZoomMode:  FunctionCurveViewer.ZoomMode.x,
         xAxisUnit:        "Hz",
         yAxisUnit:        "dB",
         focusShield:      true };
      this.setViewerState(viewerState); }

   private refresh() {
      this.refreshPending = false;
      if (!this._spectrum?.length) {
         this.disabled = true;
         return; }
      this.loadFunctionViewer();
      this.disabled = false; }

   private requestRefresh() {
      if (this.refreshPending) {
         return; }
      queueMicrotask(() => this.refresh());
      this.refreshPending = true; }

   private getAttr_num (attrName: string) : number | undefined {
      const s = this.getAttribute(attrName);
      if (!s) {
         return; }
      try {
         return Utils.parseNumber(s); }
       catch (_e) {
         throw new Error(`Invalid numeric value for attribute "${attrName}".`); }}

   private getElementAttributes() {
      this._specRes = this.getAttr_num("spec-res") ?? this._specRes;
      this._plotType = <PlotType>this.getAttribute("plot-type") ?? this._plotType;
      this._xMin = this.getAttr_num("x-min") ?? this._xMin;
      this._xMax = this.getAttr_num("x-max") ?? this._xMax;
      this._yMin = this.getAttr_num("y-min") ?? this._yMin;
      this._yMax = this.getAttr_num("y-max") ?? this._yMax;
      const specData = this.getAttribute("spec-data");
      if (specData) {
         this.loadSpectrumJson(specData); }
      const src = this.getAttribute("src");
      if (src) {
         this.fetchSpectrumJson(src); }}

   public loadSpectrumJson (json: string) {
      const r = JSON.parse(json);
      if (Utils.isArrayOfNumbers(r)) {
         this._spectrum = r; }
       else if (typeof r == "object" && Utils.isArrayOfNumbers(r.spectrum)) {
         this._spectrum = r.spectrum;
         if (Number.isFinite(r.specRes)) {
            this._specRes = r.specRes; }}
       else {
         throw new Error("Incompatible spectrum JSON data."); }
      this.requestRefresh(); }

   private fetchSpectrumJson (url: string) {
      const promise = fetch(url, {mode: "cors", credentials: "include"});
      promise.then(this.fetchSpectrumJson_continue);
      promise.catch(this.fetchSpectrumJson_error); }

   private fetchSpectrumJson_continue = async (response: Response) => {
      if (!response.ok) {
         console.log("Fetch for spectrum JSON file failed.", response);
         return; }
      const json = await response.text();
      this.loadSpectrumJson(json); }

   private fetchSpectrumJson_error = (error: Error) => {
      console.log("Fetch for spectrum JSON file failed.", error); }

   public override connectedCallback() {
      super.connectedCallback();
      this.getElementAttributes();
      if (this._spectrum?.length) {
         this.requestRefresh(); }}}

export function registerCustomElement() {
   customElements.define("spectrum-viewer", SpectrumViewerElement); }
