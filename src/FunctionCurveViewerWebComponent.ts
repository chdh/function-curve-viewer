import {Widget, ViewerState} from "./FunctionCurveViewer.js";

export class FunctionCurveViewerElement extends HTMLElement {

   private widget:           Widget;

   public constructor() {
      super();
      this.attachShadow({mode: "open"});
      this.shadowRoot!.innerHTML = htmlTemplate;
      const canvas = <HTMLCanvasElement>this.shadowRoot!.querySelector("canvas");
      this.widget = new Widget(canvas, false);
      this.widget.setEventTarget(this); }

   // Called by the browser when the element is inserted into the DOM.
   public connectedCallback() {
      this.widget.setConnected(true); }

   // Called by the browser when the element is removed from the DOM.
   public disconnectedCallback() {
      this.widget.setConnected(false); }

   // Returns the current state of the function curve viewer.
   public getViewerState() : ViewerState {
      return this.widget.getViewerState(); }

   // Updates the current state of the function curve viewer.
   public setViewerState (vState: Partial<ViewerState>) {
      this.widget.setViewerState(vState); }

   public get disabled() : boolean {
      return this.widget.disabled; }

   public set disabled (disabled: boolean) {
      this.widget.disabled = disabled; }

   // Returns the help text as an array.
   public getRawHelpText() : string[] {
      return this.widget.getRawHelpText(); }

   // Returns the help text as a HTML string.
   public getFormattedHelpText() : string {
      return this.widget.getFormattedHelpText(); }}

const style = `
   :host {
      display: block;
      contain: content;
      background-color: #f8f8f8;
      border-style: solid;
      border-width: 1px;
      border-color: #dddddd;
   }
   canvas {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
   }
   `;

const htmlTemplate = `
   <style>${style}</style>
   <canvas tabindex="-1">
   </canvas>
   `;

export function registerCustomElement() {
   customElements.define("function-curve-viewer", FunctionCurveViewerElement); }
