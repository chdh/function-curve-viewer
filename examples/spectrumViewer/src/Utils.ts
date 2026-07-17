export function parseNumber (s: string) : number {
   const s2 = s.trim();
   if (s2 == "") {
      throw new TypeError("Invalid empty numeric value."); }
   const n = Number(s2);
   if (!Number.isFinite(n)) {
      throw new TypeError(`Invalid numeric value "${s2}".`); }
   return n; }

export function isArrayOfNumbers (a: unknown) : a is number[] {
   return Array.isArray(a) && a.every(e => typeof e === 'number' && Number.isFinite(e)); }

export function openFileOpenDialog (callback: (file: File) => void) {
   if ((<any>window).showOpenFilePicker) {
      openFileOpenDialog_new().then(callback, (e) => console.log(e)); }
    else {
      openFileOpenDialog_old(callback); }}

async function openFileOpenDialog_new() : Promise<File> {
   const pickerOpts = {};
   const fileHandle: FileSystemFileHandle = (await (<any>window).showOpenFilePicker(pickerOpts))[0];
   const file = await fileHandle.getFile();
   return file; }

function openFileOpenDialog_old (callback: (file: File) => void) {
   const element: HTMLInputElement = document.createElement("input");
   element.type = "file";
   element.addEventListener("change", () => {
      if (element.files?.length == 1) {
         callback(element.files[0]); }});
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   (<any>document).dummyFileOpenElementHolder = element; } // to prevent garbage collection
