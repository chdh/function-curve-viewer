// Support routines for the function curve viewer.

import {ViewerFunction} from "./FunctionCurveViewer";

// Creates and returns a viewer function for discrete sampled values.
// When zoomed in, linear interpolation is used.
// When zommed out, min/max values of the corresponding x value range are used to display the envelope of the curve.
// The parameter scalingFactor is usually the sample rate.
export function createViewerFunctionForFloat64Array (samples: Float64Array, scalingFactor: number, offset = 0) : ViewerFunction {
   return function (x: number, sampleWidth: number) : number | number[] | undefined {
      const pos = x * scalingFactor + offset;
      const width = sampleWidth * scalingFactor;
      if (width < 1) {
         return interpolateLinear(samples, pos); }
       else {
         return findValueRange(samples, pos - width / 2, pos + width / 2); }}; }

function interpolateLinear (samples: Float64Array, pos: number) : number | undefined {
   const p1 = Math.floor(pos);
   const p2 = Math.ceil(pos);
   if (p1 < 0 || p2 > samples.length) {
      return undefined; }
   if (p1 == p2) {
      return samples[p1]; }
   const v1 = samples[p1];
   const v2 = samples[p2];
   return v1 + (pos - p1) * (v2 - v1); }

// Returns the minimum and maximum sample values within the range from pos1 (inclusive) to pos2 (exclusive).
function findValueRange (samples: Float64Array, pos1: number, pos2: number) : number[] | undefined {
   const p1 = Math.max(0, Math.ceil(pos1));
   const p2 = Math.min(samples.length + 1, Math.ceil(pos2));
   if (p1 > p2) {
      return undefined; }
   let vMin = samples[p1];
   let vMax = vMin;
   for (let p = p1 + 1; p < p2; p++) {
      const v = samples[p];
      vMin = Math.min(v, vMin);
      vMax = Math.max(v, vMax); }
   return [vMin, vMax]; }

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
