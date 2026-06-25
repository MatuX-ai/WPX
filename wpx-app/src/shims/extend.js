// Compatibility shim for the `extend` CJS package.
//
// `extend` is a deep-merging utility used transitively by CopilotKit
// (via @ai-sdk/google-vertex → google-auth-library → gaxios) and by
// `tui-image-editor` (via fabric → jsdom → request).  It only ships a
// CommonJS entry point (`module.exports = extend`), so when Vite hands
// the package to esbuild the resulting ESM module exposes the whole
// exports object as the default, e.g.
//
//   import extend from 'extend'
//   //   ^  { default: extend, ... }
//
// Consumer code such as `gaxios`/`unified` does
//
//   import extend from 'extend'
//   extend({}, source)
//
// which then explodes with
//   "extend is not a function"
//
// We unwrap the real function before re-exporting so both the default
// and named re-export work for the small handful of call sites.
import extendPackage from 'extend/index.js'

const extendFn = extendPackage.default ?? extendPackage

export default extendFn
export { extendFn as extend }
