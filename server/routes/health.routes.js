/**
 * 路由：健康检查
 */
'use strict';

const router = require('express').Router();
const { healthz, readyz } = require('../controllers/health.controller');

router.get('/healthz', healthz);
router.get('/readyz', readyz);

module.exports = router;
