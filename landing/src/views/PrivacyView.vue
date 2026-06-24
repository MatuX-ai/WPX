<script setup>
/**
 * PrivacyView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 隐私政策
 *
 *  - 左右两栏布局：左侧 sticky 目录 + 右侧滚动内容
 *  - 每节顶部带锚点 id，配合 router scrollBehavior 已实现 hash 滚动
 *  - 底部含免责声明（正式发布前由法律顾问审定）
 * ------------------------------------------------------------
 */
import { useRoute } from 'vue-router'
const route = useRoute()

const sections = [
  { id: 'overview', title: '1. 概述与适用范围' },
  { id: 'collect', title: '2. 我们收集的信息' },
  { id: 'usage', title: '3. 信息的使用方式' },
  { id: 'storage', title: '4. 信息的存储与本地优先' },
  { id: 'third-party', title: '5. 第三方服务清单' },
  { id: 'cookie', title: '6. Cookie 与同类技术' },
  { id: 'rights', title: '7. 你的权利' },
  { id: 'minor', title: '8. 未成年人保护' },
  { id: 'changes', title: '9. 政策变更与通知' },
  { id: 'contact', title: '10. 联系我们' }
]

const lastUpdated = '2026-06-18'
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">法律 · 隐私</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
          <span class="wpx-gradient-text">隐私政策</span>
        </h1>
        <p class="mt-4 text-dark/60">
          WPX 致力于把数据留在本地 —— 这是我们设计产品的第一原则。
        </p>
        <p class="mt-2 text-xs text-dark/40">
          最后更新：{{ lastUpdated }}
        </p>
      </div>

      <!-- Body: 两栏布局 -->
      <div class="mt-14 grid gap-10 lg:grid-cols-[220px_1fr]">
        <!-- 左侧 sticky 目录 -->
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <nav
            class="rounded-2xl border border-dark/5 bg-white p-4"
            aria-label="目录"
          >
            <div class="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-dark/40">
              目录
            </div>
            <ul class="space-y-1">
              <li v-for="s in sections" :key="s.id">
                <a
                  :href="`#${s.id}`"
                  class="block rounded-lg px-3 py-1.5 text-sm text-dark/70 transition-colors hover:bg-wpx-gradient-soft hover:text-primary-600"
                  :class="route.hash === `#${s.id}` ? 'bg-wpx-gradient-soft text-primary-600 font-semibold' : ''"
                >
                  {{ s.title }}
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <!-- 右侧内容 -->
        <article class="prose-like max-w-none">
          <section :id="sections[0].id" class="scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[0].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              本《隐私政策》适用于 WPX Team（以下简称"我们"）开发、运营的 WPX 桌面应用、配套官方网站（prowpx.com 及其子域名）以及相关服务（以下简称"本服务"）。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              我们深知个人信息对你的重要性，因此遵循"本地优先、最小必要、公开透明"的原则设计与运营本服务。请在使用前仔细阅读本政策；一旦你开始使用，即表示你已知悉并同意本政策的全部内容。
            </p>
          </section>

          <section :id="sections[1].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[1].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              我们仅在为你提供本服务所必需的范围内收集信息。具体包括：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>
                <strong class="text-dark">账户信息（可选）：</strong>当你注册账户时，我们收集你的邮箱地址、昵称、头像 URL；
                若使用第三方登录（如 GitHub），我们仅获取该平台授权范围内的公开信息。
              </li>
              <li>
                <strong class="text-dark">设备与运行环境信息：</strong>操作系统版本、WPX 版本号、CPU 架构、首选语言，用于兼容性诊断与崩溃分析。
              </li>
              <li>
                <strong class="text-dark">本地文件数据：</strong>你的文档、模板、字体、图片等<strong>全部存储于你本机</strong>，我们默认不会读取或上传这些内容。
              </li>
              <li>
                <strong class="text-dark">AI 调用记录（仅云端模式）：</strong>当你主动调用云端 AI 时，相关的输入文本与返回结果会经过我们的服务端用于推理；我们<strong>不会</strong>将其用于模型训练，并会在 30 天后自动清除（除非法律要求保留更久）。
              </li>
              <li>
                <strong class="text-dark">使用统计（匿名）：</strong>启用"发送匿名使用统计"后，我们仅收集功能点击次数等聚合数据，无法回溯到个人。
              </li>
            </ul>
          </section>

          <section :id="sections[2].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[2].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              我们仅将收集到的信息用于以下目的：
            </p>
            <ol class="mt-3 list-decimal space-y-2 pl-6 text-dark/75">
              <li>提供、维护与改进本服务的核心功能；</li>
              <li>同步你的偏好设置（如主题、字体、Skills 配置）至你的多设备（仅在你登录且启用同步时）；</li>
              <li>响应你的咨询、投诉与反馈；</li>
              <li>在你主动选择云端 AI 时，完成模型推理并将结果返回；</li>
              <li>检测、预防和应对欺诈、滥用、安全事件；</li>
              <li>履行法律法规规定的义务。</li>
            </ol>
          </section>

          <section :id="sections[3].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[3].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              WPX 的核心承诺是<strong class="text-dark">本地优先</strong>：你的所有文档、模板、字体、配置均存储在你本机的
              <code class="rounded bg-dark/5 px-1.5 py-0.5 text-sm">用户数据目录</code>
              中，我们的服务端无法访问。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              仅当以下情况发生时，相关信息才会离开你的设备：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>你主动启用「云同步」并将文档上传至服务端；</li>
              <li>你主动调用云端 AI 模型（OpenAI、Anthropic 等），相关上下文会发送至对应服务商；</li>
              <li>你主动提交 Bug 报告或反馈，并勾选了「附带日志/截图」选项。</li>
            </ul>
            <p class="mt-3 leading-relaxed text-dark/75">
              你可随时在「设置 → 数据」中关闭云同步、清除本地缓存、导出或删除全部本地数据。
            </p>
          </section>

          <section :id="sections[4].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[4].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              为提供完整服务，我们会与以下第三方共享<strong class="text-dark">最小必要</strong>的信息：
            </p>
            <div class="mt-4 overflow-hidden rounded-xl border border-dark/5">
              <table class="w-full text-left text-sm">
                <thead class="bg-wpx-gradient-soft text-xs uppercase tracking-wider text-dark/60">
                  <tr>
                    <th class="px-4 py-3">第三方</th>
                    <th class="px-4 py-3">用途</th>
                    <th class="px-4 py-3">共享信息</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark/5 bg-white text-dark/75">
                  <tr>
                    <td class="px-4 py-3 font-semibold">OpenAI / Anthropic / 自托管模型</td>
                    <td class="px-4 py-3">云端 AI 推理</td>
                    <td class="px-4 py-3">你输入的提示词与上下文</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 font-semibold">腾讯云 SES</td>
                    <td class="px-4 py-3">事务性邮件（验证码、账单）</td>
                    <td class="px-4 py-3">邮箱地址</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 font-semibold">字体 / 资源 CDN</td>
                    <td class="px-4 py-3">按需下载字体与素材</td>
                    <td class="px-4 py-3">IP、UA、请求资源标识</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 font-semibold">崩溃与遥测（可关闭）</td>
                    <td class="px-4 py-3">稳定性改进</td>
                    <td class="px-4 py-3">匿名堆栈与运行环境</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-xs text-dark/50">
              与第三方共享前，我们会进行安全与合规评估，并要求其按本政策与适用法律处理你的信息。
            </p>
          </section>

          <section :id="sections[5].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[5].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              在官方网站中，我们仅使用<strong class="text-dark">必要 Cookie</strong>维持登录态与偏好（主题、语言）。WPX 桌面应用不依赖任何追踪 Cookie。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              你可通过浏览器设置清除或拒绝 Cookie，但这可能影响网站的部分功能。
            </p>
          </section>

          <section :id="sections[6].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[6].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              你对自己的个人信息享有以下权利：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li><strong class="text-dark">访问与查阅：</strong>查看我们持有的关于你的信息；</li>
              <li><strong class="text-dark">更正与更新：</strong>修改账户资料、昵称、头像；</li>
              <li><strong class="text-dark">删除与撤回：</strong>随时注销账户、删除本地与云端数据；</li>
              <li><strong class="text-dark">数据导出：</strong>将你的文档、配置、Skill 自定义内容打包导出；</li>
              <li><strong class="text-dark">撤回授权：</strong>关闭云同步、撤回第三方授权；</li>
              <li><strong class="text-dark">投诉与申诉：</strong>如认为我们处理不当，可联系我们或向监管机构投诉。</li>
            </ul>
          </section>

          <section :id="sections[7].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[7].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              WPX 不向 14 周岁以下未成年人提供独立服务。如发现未成年人未经监护人同意注册，我们将在核实后尽快删除相关信息。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              监护人若发现被监护人未经同意向我们提供了个人信息，可通过下方联系方式要求删除。
            </p>
          </section>

          <section :id="sections[8].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[8].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              我们可能根据业务调整、法律法规变化修订本政策。重大变更将通过应用内通知、官网公告或邮件提醒你。继续使用本服务即视为接受修订后的政策。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              本政策的过往版本可在
              <a href="#" class="text-primary-600 hover:underline">归档页</a>
              查阅。
            </p>
          </section>

          <section :id="sections[9].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[9].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              如对本政策或你的个人信息处理有任何疑问、意见或投诉，请通过以下方式联系我们，我们将在 15 个工作日内回复：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>邮箱：<a class="text-primary-600 hover:underline" href="mailto:privacy@wpx.app">privacy@wpx.app</a></li>
              <li>一般咨询：<a class="text-primary-600 hover:underline" href="mailto:hello@wpx.app">hello@wpx.app</a></li>
              <li>GitHub Issues：<a class="text-primary-600 hover:underline" href="https://github.com/wpx-team/wpx/issues" target="_blank" rel="noopener noreferrer">wpx-team/wpx</a></li>
            </ul>
          </section>

          <!-- 免责声明 -->
          <div class="mt-16 rounded-2xl border border-amber-300/40 bg-amber-50/60 p-6 text-sm leading-relaxed text-amber-900">
            <p class="font-semibold">
              免责声明
            </p>
            <p class="mt-2">
              本政策为通用模板，旨在清晰传达 WPX 团队的隐私原则与实践。正式发布前将由法律顾问审定并以最终版本为准。如本政策与适用法律存在冲突，以适用法律规定为准。
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
