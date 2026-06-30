/**
 * 路由：鉴权（WPX 自托管邮箱认证）
 *
 *  - POST /api/auth/register        { email, password, nickname? }   公开
 *  - GET  /api/auth/verify-email?token=...                          公开
 *  - POST /api/auth/login           { email, password }             公开
 *  - POST /api/auth/refresh         { refresh_token }               公开（用 refresh token）
 *  - POST /api/auth/logout                                            可选（前端可直清 token）
 *  - POST /api/auth/forgot-password { email }                       公开
 *  - POST /api/auth/reset-password  { token, password }             公开
 *  - GET  /api/auth/me                                                requireAuth
 *  - GET  /api/auth/verify                                            requireAuth
 */
'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/register', ctrl.register);
router.get('/verify-email', ctrl.verifyEmail);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);

router.get('/me', requireAuth, ctrl.me);
router.get('/verify', requireAuth, ctrl.verify);

module.exports = router;

