/**
 * PM2 部署配置（ecosystem.config.cjs）
 *
 * 用法：
 *   pm2 start ecosystem.config.cjs                  # 启动
 *   pm2 reload ecosystem.config.cjs                 # 平滑重载（zero-downtime）
 *   pm2 logs wpx-api                                # 跟踪日志
 *   pm2 save                                        # 保存进程列表，开机自启
 *
 * 配套：
 *   - .env 放在 server/ 目录，PM2 会自动加载
 *   - 日志目录：./logs/pm2.{out,error}.log（被 PM2 自动创建）
 */
'use strict';

module.exports = {
  apps: [
    {
      name: 'wpx-api',
      script: './server.js',
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || 2, // 多实例或 'max'
      exec_mode: process.env.PM2_EXEC_MODE || 'cluster', // cluster / fork
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 8000,
      wait_ready: true, // 等 process.send('ready') 才认为启动完成；server.js 已就绪
      listen_timeout: 15000,
      node_args: ['--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production'
      },
      // 合并 .env 中的所有变量（pm2 start --env production 会覆盖 env 块）
      env_production: {
        NODE_ENV: 'production'
      },
      // 日志
      out_file: './logs/pm2.out.log',
      error_file: './logs/pm2.error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 高级
      time: true,
      vizion: false
    }
  ],

  /**
   * 部署段（用于多机部署）
   * 用法：pm2 deploy production setup / pm2 deploy production
   * 需要在 ~/.ssh/config 中配置好免密登录
   */
  deploy: {
    production: {
      user: 'deploy',
      host: 'api.proclaw.cc',
      ref: 'origin/main',
      repo: 'git@github.com:proclaw-team/wpx.git',
      path: '/var/www/wpx-server',
      'pre-deploy': 'git fetch --all',
      'post-deploy':
        'npm ci --omit=dev && ' +
        'psql -U $PG_USER -h $PG_HOST -d $PG_DATABASE -f sql/init.sql && ' +
        'pm2 reload ecosystem.config.cjs --env production'
    }
  }
};