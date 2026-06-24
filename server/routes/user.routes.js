/**
 * 路由：用户
 * 受 JWT 鉴权保护
 */
'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getProfile, syncProfile } = require('../controllers/user.controller');

router.get('/me', requireAuth, getProfile);
router.post('/me/sync', requireAuth, syncProfile);

module.exports = router;
