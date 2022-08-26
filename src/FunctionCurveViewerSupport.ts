// Support routines for the function curve viewer.

import {ViewerFunction} from "./FunctionCurveViewer.js";

export interface CreateViewerFunctionForArrayOptions {
   scalingFactor?:           number;                       // usually the sample rate
   offset?:                  number;
   nearestNeighbor?:         boolean;                      // true = use neares neighbour interpolation when zommed in, false = use linear interpolation
   average?:                 boolean; }                    // true = use average when zommed out, true = use range

// Creates and returns a viewer function for discrete sampled values.
// When zoomed in, linear interpolation or nearest neighbour interpolation is used (depending on options.nearestNeighbor).
// When zommed out, the min/max values of the corresponding x value range are used to display the envelope of the curve.
export function createViewerFunctionForArray (samples: ArrayLike<number>, options: CreateViewerFunctionForArrayOptions) : ViewerFunction {
   const scalingFactor   = options.scalingFactor   ?? 1;
   const offset          = options.offset          ?? 0;
   const nearestNeighbor = options.nearestNeighbor ?? false;
   const average         = options.average         ?? false;
   return function (x: number, sampleWidth: number) : number | number[] | undefined {
      const pos = x * scalingFactor + offset;
      const width = sampleWidth * scalingFactor;
      if (width < 1) {
         if (nearestNeighbor) {
            return interpolateNearestNeighbor(samples, pos); }
          else {
            return interpolateLinear(samples, pos); }}
       else {
         if (average) {
            return computeAverageOfRange(samples, pos - width / 2, pos + width / 2); }
          else {
            return findValueRange(samples, pos - width / 2, pos + width / 2); }}}; }

// This function is only defined for backward compatibility with FunctionCurveViewer versions <= 1.0.25.
export function createViewerFunctionForFloat64Array (samples: ArrayLike<number>, scalingFactor: number, offset = 0, nearestNeighbor = false) : ViewerFunction {
   return createViewerFunctionForArray(samples, {scalingFactor, offset, nearestNeighbor }); }

function interpolateNearestNeighbor (samples: ArrayLike<number>, pos: number) : number | undefined {
   const p = Math.round(pos);
   return (p >= 0 && p < samples.length) ? samples[p] : undefined; }

function interpolateLinear (samples: ArrayLike<number>, pos: number) : number | undefined {
   const p1 = Math.floor(pos);
   const p2 = Math.ceil(pos);
   if (p1 < 0 || p2 >= samples.length) {
      return undefined; }
   if (p1 == p2) {
      return samples[p1]; }
   const v1 = samples[p1];
   const v2 = samples[p2];
   return v1 + (pos - p1) * (v2 - v1); }

// Returns the minimum and maximum sample values within the range from pos1 (inclusive) to pos2 (exclusive).
function findValueRange (samples: ArrayLike<number>, pos1: number, pos2: number) : number[] | undefined {
   const p1 = Math.max(0, Math.ceil(pos1));
   const p2 = Math.min(samples.length, Math.ceil(pos2));
   if (p1 >= p2) {
      return undefined; }
   let vMin = samples[p1];
   let vMax = vMin;
   for (let p = p1 + 1; p < p2; p++) {
      const v = samples[p];
      vMin = Math.min(v, vMin);
      vMax = Math.max(v, vMax); }
   return [vMin, vMax]; }

// Returns the average of the sample values within the range from pos1 to pos2. pos1 and pos2 are float values.
function computeAverageOfRange (samples: ArrayLike<number>, pos1: number, pos2: number) : number | undefined {
   const p1 = Math.max(-0.5, pos1);
   const p2 = Math.min(samples.length - 0.50000001, pos2);
   if (p1 >= p2) {
      return undefined; }
   const p1i = Math.round(p1);
   const p2i = Math.round(p2);
   if (p1i >= p2i) {
      return samples[p1i]; }
   let sum = 0;
   sum += samples[p1i] * (p1i + 0.5 - p1);
   for (let i = p1i + 1; i < p2i; i++) {
      sum += samples[i]; }
   sum += samples[p2i] * (p2 - (p2i - 0.5));
   return sum / (p2 - p1); }

// Creates and returns a viewer function for displaying the envelope of a function value.
// When zoomed in, the values of the underlying function are passed on.
// When zoomed out, the min/max values are estimated to display the envelope of the curve.
// The parameter criticalWidth is used to switch between direct display and envelope display and
// to sub-sample the signal for envelope display.
export function createEnvelopeViewerFunction (baseFunction: (x: number) => number | undefined, criticalWidth: number) : ViewerFunction {
   return function (xCenter: number, sampleWidth: number) : (number | number[] | undefined) {
      if (sampleWidth <= criticalWidth) {
         return baseFunction(xCenter); }
       else {
         return envelopeFunction(xCenter, sampleWidth); }};
   function envelopeFunction (xCenter: number, sampleWidth: number) : (number[] | undefined) {
      const n = Math.ceil(sampleWidth / criticalWidth);    // subsampling factor
      const subSampleWidth = sampleWidth / n;
      const x0 = xCenter - sampleWidth / 2 + subSampleWidth / 2;
      const v0 = baseFunction(x0);
      if (v0 == undefined) {
         return; }
      let vMin = v0;
      let vMax = v0;
      for (let i = 1; i < n; i++) {
         const x = x0 + i * subSampleWidth;
         const v = baseFunction(x);
         if (v == undefined) {
            return; }
         vMin = Math.min(vMin, v);
         vMax = Math.max(vMax, v); }
      return [vMin, vMax]; }}
