import * as FunctionCurveViewer from "function-curve-viewer";

let   canvas:       HTMLCanvasElement;
let   widget:       FunctionCurveViewer.Widget;
let   audioContext: AudioContext;

function loadFunctionExpr() {
   const functionExpr = (<HTMLInputElement>document.getElementById("functionExpr"))!.value;
   const viewerFunction = new Function("x", "return " + functionExpr);
   const viewerState = <FunctionCurveViewer.ViewerState>{
      viewerFunction: viewerFunction,
      xMin:           -20,
      xMax:           20,
      yMin:           -1.2,
      yMax:           1.2,
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
   if (!audioContext) {
      audioContext = new ((<any>window).AudioContext || (<any>window).webkitAudioContext)(); }
   const audioBuffer = await audioContext.decodeAudioData(fileData);
   const samples = new Float64Array(audioBuffer.getChannelData(0)); // only the first channel is used
   const viewerFunction = FunctionCurveViewer.createViewerFunctionForFloat64Array(samples, audioBuffer.sampleRate);
   const viewerState = <FunctionCurveViewer.ViewerState>{
      viewerFunction:  viewerFunction,
      xMin:            0,
      xMax:            audioBuffer.duration,
      yMin:            -1.2,
      yMax:            1.2,
      gridEnabled:     true,
      primaryZoomMode: FunctionCurveViewer.ZoomMode.x};
   widget.setViewerState(viewerState);
   toggleHelp(false); }

function loadFileData (file: File) : Promise<ArrayBuffer> {
   return new Promise<ArrayBuffer>(executor);
   function executor (resolve: Function, reject: Function) {
      const fileReader = new FileReader();
      fileReader.addEventListener("loadend", () => resolve(fileReader.result));
      fileReader.addEventListener("error", () => reject(fileReader.error));
      fileReader.readAsArrayBuffer(file); }}

async function loadLocalAudioFile() {
   const files = (<HTMLInputElement>document.getElementById("audioFile"))!.files;
   if (!files || files.length != 1) {
      throw new Error("No file selected."); }
   const file = files[0];
   const fileData = await loadFileData(file);
   await initFunctionViewerFromAudioFileData(fileData); }

async function loadLocalAudioFileButtonClick() {
   try {
      await loadLocalAudioFile(); }
    catch (e) {
      console.log(e);
      alert(e); }}

async function loadFileByUrl (url: string) : Promise<ArrayBuffer> {
   const response = await fetch(url, {mode: "cors"});   // (server must send "Access-Control-Allow-Origin" header field or have same origin)
   if (!response.ok) {
      throw new Error("Request failed for " + url); }
   return await response.arrayBuffer(); }

async function loadAudioFileFromUrl() {
   const audioFileUrl = (<HTMLInputElement>document.getElementById("audioFileUrl"))!.value;
   const fileData = await loadFileByUrl(audioFileUrl);
   await initFunctionViewerFromAudioFileData(fileData); }

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
   widget.addEventListener("viewportchange", () => console.log("Viewportchange event"));
   document.getElementById("helpButton")!.addEventListener("click", () => toggleHelp());
   document.getElementById("loadFunctionExprButton")!.addEventListener("click", loadFunctionExprButtonClick);
   document.getElementById("loadLocalAudioFileButton")!.addEventListener("click", loadLocalAudioFileButtonClick);
   document.getElementById("loadAudioFileFromUrlButton")!.addEventListener("click", loadAudioFileFromUrlButtonClick);
   loadFunctionExprButtonClick(); }

function showError (e: Error) {
   console.log(e);
   const divElement = document.createElement("div");
   divElement.textContent = "Error: " + e;
   document.body.insertAdjacentElement("afterbegin", divElement); }

function startup() {
   try {
      startup2(); }
    catch (e) {
      showError(e); }}

document.addEventListener("DOMContentLoaded", startup);
