// This file runs BEFORE jest-preset-angular is loaded.
// It patches the Buffer prototype chain to fix esbuild's instanceof check
// in Jest's VM context (Node.js 22 compatibility).
if (!(Buffer.from('') instanceof Uint8Array)) {
  Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
}
