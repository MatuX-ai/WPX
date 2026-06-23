/** @typedef {'MAX_WINDOWS'} WindowCreateErrorCode */

/** @type {Record<string, WindowCreateErrorCode>} */
export const WINDOW_CREATE_ERROR = {
  MAX_WINDOWS: 'MAX_WINDOWS',
}

/** @type {Record<WindowCreateErrorCode, string>} */
export const WINDOW_CREATE_ERROR_MESSAGES = {
  [WINDOW_CREATE_ERROR.MAX_WINDOWS]: '最多只能打开8个窗口，请关闭一个后再试',
}
