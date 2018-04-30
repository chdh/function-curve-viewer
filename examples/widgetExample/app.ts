import * as FunctionCurveViewer from "function-curve-viewer";

const audioContext  = new AudioContext();
let   canvas:       HTMLCanvasElement;
let   widget:       FunctionCurveViewer.Widget;

function loadFunctionExpr() {
   const functionExpr = (<HTMLInputElement>document.getElementById("functionExpr"))!.value;
   const viewerFunction = new Function("x", "return " + functionExpr);
   const xRange = 20;
   const yRange = 1.2;
   const viewerState = <FunctionCurveViewer.ViewerState>{
      viewerFunction: viewerFunction,
      planeOrigin:    {x: -xRange, y: -yRange},
      zoomFactorX:    canvas.width / (2 * xRange),
      zoomFactorY:    canvas.height / (2 * yRange),
      gridEnabled:    true };
   widget.setViewerState(viewerState);
   toggleHelp(false); }

function loadFunctionExprButtonClick() {
   try {
      loadFunctionExpr(); }
    catch (e) {
      console.log(e);
      alert(e); }}

async function initFunctionViewerFromAudioFileData (fileData: ArrayBuffer) {
   const audioBuffer = await audioContext.decodeAudioData(fileData);
   const samples = new Float64Array(audioBuffer.getChannelData(0)); // only the first channel is used
   const viewerFunction = FunctionCurveViewer.createViewerFunctionForFloat64Array(samples, audioBuffer.sampleRate);
   const yRange = 1.2;
   const viewerState = <FunctionCurveViewer.ViewerState>{
      viewerFunction:  viewerFunction,
      planeOrigin:     {x: 0, y: -yRange},
      zoomFactorX:     canvas.width / audioBuffer.duration,
      zoomFactorY:     canvas.height / (2 * yRange),
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x};
   widget.setViewerState(viewerState);
   toggleHelp(false); }

function loadFileData (file: File) : Promise<ArrayBuffer> {
   return new Promise<ArrayBuffer>(executor);
   function executor (resolve: Function, reject: Function) {
      let fileReader = new FileReader();
      fileReader.addEventListener("loadend", () => resolve(fileReader.result));
      fileReader.addEventListener("error", () => reject(fileReader.error));
      fileReader.readAsArrayBuffer(file); }}

async function loadLocalAudioFile() {
   let files = (<HTMLInputElement>document.getElementById("audioFile"))!.files;
   if (!files || files.length != 1) {
      throw new Error("No file selected."); }
   const file = files[0];
   const fileData = await loadFileData(file)
   initFunctionViewerFromAudioFileData(fileData); }

async function loadLocalAudioFileButtonClick() {
   try {
      await loadLocalAudioFile(); }
    catch (e) {
      console.log(e);
      alert(e); }}

async function loadFileByUrl (url: string) : Promise<ArrayBuffer> {
   let response = await fetch(url, {mode: "cors"});   // (server must send "Access-Control-Allow-Origin" header field or have same origin)
   if (!response.ok) {
      throw new Error("Request failed for " + url); }
   return await response.arrayBuffer(); }

async function loadAudioFileFromUrl() {
   const audioFileUrl = (<HTMLInputElement>document.getElementById("audioFileUrl"))!.value;
   let fileData = await loadFileByUrl(audioFileUrl);
   initFunctionViewerFromAudioFileData(fileData); }

async function loadAudioFileFromUrlButtonClick() {
   try {
      await loadAudioFileFromUrl(); }
    catch (e) {
      console.log(e);
      alert(e); }}

function toggleHelp (show?: boolean) {
   const t = document.getElementById("helpText")!;
   if (show != undefined ? show : t.classList.contains("hidden")) {
      t.classList.remove("hidden");
      t.innerHTML = widget.getFormattedHelpText(); }
    else {
      t.classList.add("hidden"); }}

function startup2() {
   canvas = <HTMLCanvasElement>document.getElementById("functionCurveViewer");
   widget = new FunctionCurveViewer.Widget(canvas);
   widget.connectedCallback();
   document.getElementById("helpButton")!.addEventListener("click", () => toggleHelp());
   document.getElementById("loadFunctionExprButton")!.addEventListener("click", loadFunctionExprButtonClick);
   document.getElementById("loadLocalAudioFileButton")!.addEventListener("click", loadLocalAudioFileButtonClick);
   document.getElementById("loadAudioFileFromUrlButton")!.addEventListener("click", loadAudioFileFromUrlButtonClick);
   loadFunctionExprButtonClick(); }

function startup() {
   try {
      startup2(); }
    catch (e) {
      console.log(e);
      alert("Error: " + e); }}

document.addEventListener("DOMContentLoaded", startup);
