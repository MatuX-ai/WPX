/**
 * 路由：鉴权
 * - /api/auth/me      当前登录用户
 * - /api/auth/verify  主动校验 token
 */
'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { me, verify } = require('../controllers/auth.controller');

router.get('/me', requireAuth, me);
router.get('/verify', requireAuth, verify);

module.exports = router;
