// Compatibility shim for the `extend` CJS package.
//
// `extend` is a tiny deep-merging utility used transitively by CopilotKit
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
// History: we originally tried routing the bare `extend` import through
// Vite `resolve.alias` + `optimizeDeps.include`, but the package was
// still occasionally served from `node_modules/extend/index.js` (Vite
// 8 caching, sub-path imports inside pre-bundled deps, etc.) and the
// browser kept throwing
//   "The requested module '/node_modules/extend/index.js?v=…'
//    does not provide an export named 'default'".
//
// To make this 100% reliable we **inline** the upstream implementation
// (vendored verbatim from `extend@3.0.2/index.js`, MIT © Stefan
// Thomas / Jordan Harband).  No runtime dependency on the upstream
// CJS file at all — the alias keeps pointing here as a defensive
// guarantee, but the shim never imports it.

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var defineProperty = Object.defineProperty;
var gOPD = Object.getOwnPropertyDescriptor;

var isArray = function isArray(arr) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(arr);
  }
  return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
  if (!obj || toStr.call(obj) !== '[object Object]') {
    return false;
  }
  var hasOwnConstructor = hasOwn.call(obj, 'constructor');
  var hasIsPrototypeOf =
    obj.constructor &&
    obj.constructor.prototype &&
    hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
  if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
    return false;
  }
  var key;
  for (key in obj) {
    /**/
  }
  return typeof key === 'undefined' || hasOwn.call(obj, key);
};

var setProperty = function setProperty(target, options) {
  if (defineProperty && options.name === '__proto__') {
    defineProperty(target, options.name, {
      enumerable: true,
      configurable: true,
      value: options.newValue,
      writable: true,
    });
  } else {
    target[options.name] = options.newValue;
  }
};

var getProperty = function getProperty(obj, name) {
  if (name === '__proto__') {
    if (!hasOwn.call(obj, name)) {
      return void 0;
    } else if (gOPD) {
      return gOPD(obj, name).value;
    }
  }
  return obj[name];
};

var extend = function extend() {
  var options, name, src, copy, copyIsArray, clone;
  var target = arguments[0];
  var i = 1;
  var length = arguments.length;
  var deep = false;

  if (typeof target === 'boolean') {
    deep = target;
    target = arguments[1] || {};
    i = 2;
  }
  if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
    target = {};
  }

  for (; i < length; ++i) {
    options = arguments[i];
    if (options != null) {
      for (name in options) {
        src = getProperty(target, name);
        copy = getProperty(options, name);

        if (target !== copy) {
          if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && isArray(src) ? src : [];
            } else {
              clone = src && isPlainObject(src) ? src : {};
            }
            setProperty(target, { name: name, newValue: extend(deep, clone, copy) });
          } else if (typeof copy !== 'undefined') {
            setProperty(target, { name: name, newValue: copy });
          }
        }
      }
    }
  }
  return target;
};

export default extend;
export { extend };
