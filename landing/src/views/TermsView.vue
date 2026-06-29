<script setup>
/**
 * TermsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 用户协议
 *
 *  - 左右两栏布局：左侧 sticky 目录 + 右侧滚动内容
 *  - 10 节专业详尽条款
 *  - 底部含免责声明
 * ------------------------------------------------------------
 */
import { useRoute } from 'vue-router'
const route = useRoute()

const sections = [
  { id: 'acceptance', title: '1. 接受条款' },
  { id: 'service', title: '2. 服务说明' },
  { id: 'account', title: '3. 账户与注册' },
  { id: 'conduct', title: '4. 用户行为规范' },
  { id: 'ip', title: '5. 知识产权' },
  { id: 'ai', title: '6. AI 生成内容' },
  { id: 'fonts', title: '7. 字体版权与商用授权' },
  { id: 'changes', title: '8. 服务变更与终止' },
  { id: 'liability', title: '9. 责任限制与免责声明' },
  { id: 'law', title: '10. 适用法律与争议解决' }
]

const lastUpdated = '2026-06-18'
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">法律 · 条款</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">用户协议</span>
        </h1>
        <p class="mt-4 text-dark/60">
          使用许可、行为规范、知识产权与免责声明 —— 在使用 WPX 前请仔细阅读。
        </p>
        <p class="mt-2 text-xs text-dark/40">
          最后更新：{{ lastUpdated }}
        </p>
      </div>

      <!-- Body: 两栏布局 -->
      <div class="mt-14 grid gap-10 lg:grid-cols-[220px_1fr]">
        <!-- 左侧 sticky 目录 -->
        <aside class="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <nav
            class="overflow-hidden rounded-2xl border border-dark/5 bg-white p-4"
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
        <article class="min-w-0 max-w-none">
          <section :id="sections[0].id" class="scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[0].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              欢迎使用 WPX（以下简称"本服务"）。本协议是 WPX Team（以下简称"我们"）与你之间就使用本服务所订立的契约。
            </p>
            <p class="mt-3 leading-relaxed text-dark/75">
              <strong class="text-dark">下载、安装或使用本服务即视为你已阅读、理解并同意本协议全部条款。</strong>
              如你不同意任何条款，请立即停止使用并卸载本服务。
            </p>
          </section>

          <section :id="sections[1].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[1].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              WPX 是一款基于 Electron + Vue 3 的桌面端 AI 智能文档编辑器，核心特性包括：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>本地优先的文档编辑（Markdown / 富文本 / 虚拟纸张）；</li>
              <li>多窗口独立编辑与多任务并行；</li>
              <li>内置 Skills 体系（含学生专用、教师专用与通用 Skills）；</li>
              <li>内置 8 款免费开源字体及在线字体按需下载；</li>
              <li>可选云端 AI 推理（需用户自行配置兼容 OpenAI 协议的 API Key）；</li>
              <li>文件压缩 / 解压（7z、ZIP）；</li>
              <li>图片处理（去背景、裁剪、滤镜）。</li>
            </ul>
            <p class="mt-3 leading-relaxed text-dark/75">
              <strong class="text-dark">默认本地优先：</strong>除非你主动启用云同步或调用云端 AI，否则你的所有数据均存储于本机。
            </p>
          </section>

          <section :id="sections[2].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[2].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              本服务的大部分功能<strong class="text-dark">无需注册</strong>即可使用。注册账户时你需要提供有效的邮箱，并设置安全密码。
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>你应保证账户信息的真实性、合法性；</li>
              <li>你有责任妥善保管账户密码与 API Key；</li>
              <li>因你主动泄露或保管不善导致的损失，由你自行承担；</li>
              <li>发现账户被盗用应立即联系我们，我们将协助你冻结与恢复；</li>
              <li>你可随时注销账户，注销后云端数据将在 30 天内删除（法律法规另有规定除外）。</li>
            </ul>
          </section>

          <section :id="sections[3].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[3].title }}</h2>
            <p class="mt-3 leading-relaxed text-dark/75">
              使用本服务时，你承诺不从事以下行为：
            </p>
            <ul class="mt-3 space-y-2 text-dark/75">
              <li>违反中华人民共和国法律法规或你所居住国/地区法律法规；</li>
              <li>传播违法、淫秽、暴力、恐怖、赌博、诈骗、谣言等内容；</li>
              <li>侵犯任何第三方的著作权、商标权、专利权、商业秘密等合法权益；</li>
              <li>利用 Skills 或 AI 能力批量生成垃圾内容、刷量、作弊；</li>
              <li>对 WPX 进行逆向工程、反编译、反汇编（法律法规明确允许的情形除外）；</li>
              <li>绕过或破坏我们用于保护服务安全的技术措施；</li>
              <li>从事任何干扰本服务正常运行、损害其他用户权益的行为。</li>
            </ul>
            <p class="mt-3 leading-relaxed text-dark/75">
              如违反上述规范，我们有权采取警告、限制功能、暂停或终止服务等措施，并保留追究法律责任的权利。
            </p>
          </section>

          <section :id="sections[4].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[4].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                <strong class="text-dark">你的内容归你所有：</strong>
                你通过 WPX 创建、编辑、上传、下载的文档、图片、模板等内容，其所有权仍归你或你授权的第三方所有。
              </p>
              <p>
                <strong class="text-dark">WPX 知识产权归我们所有：</strong>
                WPX 应用本身（包括源代码、UI 设计、品牌商标、文档、图标）的著作权、商标权等知识产权归我们或合法授权方所有。
              </p>
              <p>
                <strong class="text-dark">反馈与建议：</strong>
                如你向我们提交反馈、建议或创意，我们将有权为改进产品之目的免费使用该等内容，且不向你承担任何对价义务。
              </p>
              <p>
                <strong class="text-dark">开源贡献：</strong>
                第三方通过我们的代码仓库提交的贡献，将遵循仓库所声明的开源协议。
              </p>
            </div>
          </section>

          <section :id="sections[5].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[5].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                WPX 提供的 AI 能力基于第三方大语言模型与本地模型。<strong class="text-dark">AI 生成的内容仅供参考，不构成专业意见</strong>（包括但不限于医疗、法律、金融、学术评价等）。
              </p>
              <p>
                <strong class="text-dark">不保证准确性：</strong>
                AI 模型可能产生错误、遗漏、偏见或与事实不符的内容，你应在使用前自行核实关键信息。
              </p>
              <p>
                <strong class="text-dark">不用于训练：</strong>
                我们承诺不会将你主动调用的云端 AI 内容用于模型训练；本地推理数据完全保留在你的设备上。
              </p>
              <p>
                <strong class="text-dark">责任承担：</strong>
                因依赖 AI 生成内容而产生的后果，由你自行判断与承担。
              </p>
            </div>
          </section>

          <section :id="sections[6].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[6].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                WPX 内置字体均为<strong class="text-dark">免费可商用</strong>的开源或官方授权字体（详见
                <router-link to="/legal/licenses" class="text-primary-600 hover:underline">开源许可证</router-link>
                ）。
              </p>
              <p>
                <strong class="text-dark">导入字体：</strong>
                你自行导入的第三方字体，需自行确保已获得合法授权；由此产生的版权纠纷由你承担。
              </p>
              <p>
                <strong class="text-dark">商业字体：</strong>
                你自行采购并导入的商业字体，需自行确保已获得合法授权并按对应授权范围使用；不得转售或二次分发。V1.1 起，平台不再销售或充值商业字体。
              </p>
              <p>
                <strong class="text-dark">嵌入导出：</strong>
                嵌入到导出的 PDF / DOCX 中的字体，需符合对应字体的嵌入许可；我们会按导出选项自动处理。
              </p>
            </div>
          </section>

          <section :id="sections[7].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[7].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                我们保留随时修改、暂停或终止本服务（或其中任何部分）的权利。<strong class="text-dark">重大变更将提前通过应用内通知、官网公告或邮件告知你。</strong>
              </p>
              <p>
                如你违反本协议或相关法律法规，我们有权立即暂停或终止你的访问权限，且无需承担任何责任。
              </p>
              <p>
                你可随时停止使用本服务并卸载客户端。<strong class="text-dark">卸载不会自动删除你本机的本地数据</strong>，如需彻底清除可在「设置 → 数据 → 清除全部数据」中操作。
              </p>
            </div>
          </section>

          <section :id="sections[8].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[8].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                在法律允许的最大范围内，<strong class="text-dark">本服务按"现状"提供</strong>。我们不对以下事项作出任何明示或暗示的保证：
              </p>
              <ul class="list-disc space-y-1 pl-6">
                <li>服务将不中断、及时、安全或无错误；</li>
                <li>通过服务获取的任何内容准确、可靠或适合特定用途；</li>
                <li>AI 生成内容的合法性、准确性与适用性。</li>
              </ul>
              <p>
                在任何情况下，我们因本协议产生的或与之相关的<strong class="text-dark">累计责任不超过你在过去 12 个月内为使用本服务实际支付的费用</strong>（如未付费，则不超过人民币 100 元）。
              </p>
              <p>
                某些司法管辖区不允许限制或排除某些责任，上述限制可能不适用于你。
              </p>
            </div>
          </section>

          <section :id="sections[9].id" class="mt-12 scroll-mt-24">
            <h2 class="text-2xl font-extrabold">{{ sections[9].title }}</h2>
            <div class="mt-3 space-y-3 leading-relaxed text-dark/75">
              <p>
                本协议的订立、生效、解释、履行、修改和争议解决均适用<strong class="text-dark">中华人民共和国法律</strong>（为本协议之目的，不包括香港特别行政区、澳门特别行政区和台湾地区的法律）。
              </p>
              <p>
                如本协议的任何条款被有管辖权的人民法院认定为无效或不可执行，不影响其他条款的效力。
              </p>
              <p>
                因本协议产生的争议，双方应友好协商解决；协商不成的，任一方有权将争议提交至<strong class="text-dark">我们所在地有管辖权的人民法院</strong>通过诉讼解决。
              </p>
              <p class="mt-4">
                如有任何问题，欢迎联系我们：
              </p>
              <ul class="space-y-1 text-dark/75">
                <li>邮箱：<a class="text-primary-600 hover:underline" href="mailto:legal@wpx.app">legal@wpx.app</a></li>
                <li>一般咨询：<a class="text-primary-600 hover:underline" href="mailto:hello@wpx.app">hello@wpx.app</a></li>
              </ul>
            </div>
          </section>

          <!-- 免责声明 -->
          <div class="mt-16 rounded-2xl border border-amber-300/40 bg-amber-50/60 p-6 text-sm leading-relaxed text-amber-900">
            <p class="font-semibold">免责声明</p>
            <p class="mt-2">
              本协议为通用模板，旨在清晰传达 WPX 团队与用户之间的权利义务。正式发布前将由法律顾问审定并以最终版本为准。如本协议与适用法律存在冲突，以适用法律规定为准。
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
