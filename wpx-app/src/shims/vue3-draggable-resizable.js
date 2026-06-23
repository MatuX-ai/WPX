// Compatibility shim for `vue3-draggable-resizable`.
//
// Vite/esbuild's CJS→ESM pre-bundling emits the *entire* CommonJS module
// exports object as the package's default export, rather than the
// `default` property on it.  That means
//   `import Vue3DraggableResizable from 'vue3-draggable-resizable'`
// actually receives `{ default: Component, DraggableContainer: Component }`
// instead of `Component`, and Vue reports
//   "Component is missing template or render function".
//
// We work around this by importing the package's own entry file (a sub-path
// that bypasses the `vue3-draggable-resizable` alias) and unwrapping the
// real component before re-exporting it.  CSS is bundled here so callers
// do not have to import the sub-path themselves.
import Vue3DraggableResizablePackage from 'vue3-draggable-resizable/src/index.js'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

// The pre-bundled module exposes its components as the CJS exports
// object:  { default: Component, DraggableContainer: Component }.
// Pull the real components off it before re-exporting.
const Vue3DraggableResizable =
  Vue3DraggableResizablePackage.default ?? Vue3DraggableResizablePackage
const DraggableContainer =
  Vue3DraggableResizablePackage.DraggableContainer ??
  (typeof Vue3DraggableResizablePackage === 'function'
    ? Vue3DraggableResizablePackage
    : null)

export { DraggableContainer }
export default Vue3DraggableResizable
