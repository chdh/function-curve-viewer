# function-curve-viewer

An interactive function curve and waveform viewer for the web browser.
It plots mathematical functions and sampled data (e.g. audio waveforms) in a HTML canvas,
with mouse, touch and keyboard support for zooming and panning.
It can be used as a plain widget (with a HTML canvas element) or as a
[web component](https://en.wikipedia.org/wiki/Web_Components) (HTML custom element).

<!-- TODO: Add screenshot or animated GIF here. -->

**[Online demo](https://www.source-code.biz/snippets/typescript/functionCurveViewer)** &nbsp;|&nbsp;
[NPM package](https://www.npmjs.com/package/function-curve-viewer) &nbsp;|&nbsp;
[Examples](https://github.com/chdh/function-curve-viewer/tree/master/examples)

## Features

- Plots any JavaScript function of the form `y = f(x)`.
- Displays sampled data (arrays), e.g. audio waveforms, with automatic min/max envelope
  rendering when zoomed out and linear or nearest-neighbor interpolation when zoomed in.
- Zooming and panning with mouse, touch gestures or keyboard.
- Multiple channels (multiple curves in the same viewer).
- Auto-scaled coordinate grid with axis labels and optional units.
- X-axis segment selection.
- Custom paint hook for drawing additional content on the canvas.
- Clipboard copy support.
- Styling via CSS custom properties.
- Written in TypeScript, type declarations included, no dependencies.

## Usage as a web component

Register the custom element once, place it in the HTML and pass it a viewer state:

```html
<function-curve-viewer id="viewer1" style="width: 800px; height: 300px;"></function-curve-viewer>
```

```typescript
import {registerCustomElement, FunctionCurveViewerElement} from "function-curve-viewer";

registerCustomElement();
const viewer = <FunctionCurveViewerElement>document.getElementById("viewer1");
viewer.setViewerState({
   viewerFunction: (x: number) => Math.sin(x) / x,
   xMin: -20, xMax: 20,
   yMin: -1.2, yMax: 1.2 });
```

## Usage as a widget

In widget mode, the viewer is attached to an existing canvas element:

```html
<canvas id="functionCurveViewer" style="width: 800px; height: 300px;" tabindex="-1"></canvas>
```

```typescript
import {Widget} from "function-curve-viewer";

const canvas = <HTMLCanvasElement>document.getElementById("functionCurveViewer");
const widget = new Widget(canvas);
widget.setViewerState({
   viewerFunction: (x: number) => Math.sin(x) / x,
   xMin: -20, xMax: 20,
   yMin: -1.2, yMax: 1.2 });
```

## Displaying sampled data (e.g. audio waveforms)

`createViewerFunctionForArray()` converts an array of sample values into a viewer function.
When zoomed out, the min/max envelope of the curve is displayed.

```typescript
import {Widget, createViewerFunctionForArray, ZoomMode} from "function-curve-viewer";

const viewerFunction = createViewerFunctionForArray(samples, {scalingFactor: sampleRate});
widget.setViewerState({
   viewerFunction,
   xMin: 0, xMax: samples.length / sampleRate,
   yMin: -1.2, yMax: 1.2,
   primaryZoomMode: ZoomMode.x });
```

The [widget example](https://github.com/chdh/function-curve-viewer/tree/master/examples/widgetExample)
shows how to load and display an audio file.

## Viewer function

The curve to be plotted is defined by a viewer function:

```typescript
type ViewerFunction = (x: number, sampleWidth: number, channel: number) =>
   number | number[] | undefined;
```

It is called once per canvas pixel column and may return a single y value,
an array `[yMin, yMax]` to draw a vertical envelope range, or `undefined` where
the function is not defined.

## Mouse, touch and keyboard controls

| Input                        | Action                            |
| ---------------------------- | --------------------------------- |
| drag with mouse or touch     | move the coordinate plane         |
| mouse wheel                  | zoom (primary zoom mode)          |
| Shift + mouse wheel          | zoom y-axis                       |
| Alt + mouse wheel            | zoom x-axis                       |
| Ctrl + mouse wheel           | zoom both axes                    |
| touch pinch gesture          | zoom x, y or both axes            |
| Shift + drag                 | select x-axis segment             |
| Shift + click                | clear x-axis segment selection    |
| Alt + click / Alt + drag     | modify x-axis segment             |
| `+` / `-`                    | zoom both axes in/out             |
| `X` / `x`, `Y` / `y`         | zoom single axis in/out           |
| `g`                          | toggle coordinate grid            |
| `i`                          | reset to the initial state        |

The widget provides this list at runtime via `getRawHelpText()` and `getFormattedHelpText()`.

## Styling

Colors and line widths can be configured with CSS custom properties on the
viewer element (or on the canvas in widget mode):

| CSS property                    | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `--background-color`            | canvas background color                        |
| `--curve-color`                 | curve color of the first channel               |
| `--curve-color0`, `--curve-color1`, ... | per-channel curve colors               |
| `--curve-width`                 | curve line width of the first channel          |
| `--curve-width0`, `--curve-width1`, ... | per-channel curve line widths          |
| `--grid-color`, `--grid-color-0`, `--grid-color-10` | grid line colors           |
| `--label-text-color`            | axis label text color                          |
| `--selection-color`             | background color of the selected segment       |

For touch devices, `touch-action: none` should be set on the viewer element so that
drag and pinch gestures are handled by the viewer instead of the browser.

## Events

The viewer fires the following events:

- `viewportchange` — after the user has changed the viewport by zooming or panning.
- `segmentchange` — after the user has changed the x-axis segment selection.

```typescript
viewer.addEventListener("viewportchange", () => { ... });
```

## Examples

The [examples directory](https://github.com/chdh/function-curve-viewer/tree/master/examples)
contains complete example applications:

- [widgetExample](https://github.com/chdh/function-curve-viewer/tree/master/examples/widgetExample) —
  widget mode: plots a user-entered function expression and displays the waveform of an audio file.
- [webComponentExample](https://github.com/chdh/function-curve-viewer/tree/master/examples/webComponentExample) —
  the viewer used as a web component.
- [spectrumViewer](https://github.com/chdh/function-curve-viewer/tree/master/examples/spectrumViewer) —
  a `<spectrum-viewer>` web component for audio frequency spectra (dB over Hz), built by subclassing
  the function curve viewer element. Demonstrates the custom paint hook (bar plot mode) and
  loading spectrum data from JSON, element attributes or a URL.
