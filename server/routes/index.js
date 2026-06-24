/**
 * 路由汇总
 */
'use strict';

const router = require('express').Router();

router.use('/', require('./health.routes'));
router.use('/api/auth', require('./auth.routes'));
router.use('/api/users', require('./user.routes'));
router.use('/api/admin', require('./admin.routes'));

module.exports = router;
