import * as SpectrumViewer from "./SpectrumViewer.ts";
import {SpectrumViewerElement, PlotType} from "./SpectrumViewer.ts";
import * as Utils from "./Utils.ts";

function setPlotType (plotType: PlotType) {
   const viewerElements = <NodeListOf<SpectrumViewerElement>>document.querySelectorAll("spectrum-viewer");
   for (const viewerElement of viewerElements) {
      viewerElement.plotType = plotType; }}

async function loadFile (file: File) {
   const json = await file.text();
   const viewerElement = <SpectrumViewerElement>document.querySelector("spectrum-viewer");
   viewerElement.loadSpectrumJson(json); }

function startup() {
   document.getElementById("plotType")?.addEventListener("input", (event: InputEvent) => {
      setPlotType(<PlotType>(<any>event.target).value); });
   document.getElementById("loadFileButton")?.addEventListener("click", () => {
      Utils.openFileOpenDialog(loadFile); }); }

document.addEventListener("DOMContentLoaded", startup);
SpectrumViewer.registerCustomElement();
