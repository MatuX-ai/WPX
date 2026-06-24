/**
 * 异步控制器包装
 * 自动捕获 async 函数中的 reject，转交给 next(err)
 */
'use strict';

module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
