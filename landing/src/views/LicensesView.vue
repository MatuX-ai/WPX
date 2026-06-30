<script setup>
/**
 * LicensesView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 开源许可证
 *
 *  - 项目自身：注明 private / UNLICENSED
 *  - 内置开源字体列表（表格）
 *  - 关键依赖（按许可证分组）
 *  - 完整第三方许可文本生成指引
 * ------------------------------------------------------------
 */

const builtInFonts = [
  { name: '思源黑体 (Source Han Sans)', author: 'Adobe、Google', license: 'SIL Open Font License 1.1' },
  { name: '思源宋体 (Source Han Serif)', author: 'Adobe、Google', license: 'SIL Open Font License 1.1' },
  { name: '霞鹜文楷 (LXGW WenKai)', author: '落霞孤鹜 (lxgw)', license: 'SIL Open Font License 1.1' },
  { name: '霞鹜文楷等宽 (LXGW WenKai Mono)', author: '落霞孤鹜 (lxgw)', license: 'SIL Open Font License 1.1' },
  { name: '阿里巴巴普惠体 (Alibaba PuHuiTi)', author: '阿里巴巴', license: '阿里巴巴字体免费商用授权' },
  { name: 'HarmonyOS Sans', author: '华为 (Huawei)', license: 'HarmonyOS Sans 字体许可（免费可商用）' },
  { name: 'JetBrains Mono', author: 'JetBrains', license: 'SIL Open Font License 1.1' },
  { name: 'Noto Color Emoji', author: 'Google', license: 'SIL Open Font License 1.1' }
]

const mitDeps = [
  'vue', 'vue-router', 'express', 'cors', 'multer', 'electron-is-dev',
  'wait-on', 'concurrently', 'cross-env', 'sharp', 'jszip', 'fontkit',
  'mammoth', '@mozilla/readability', '@imgly/background-removal',
  'linkedom', 'pdf-parse', 'subset-font', 'electron-store', 'lowdb'
]

const bsdDeps = [
  { name: 'electron', note: 'Core framework' },
  { name: 'electron-builder', note: 'Packaging & distribution' }
]

const otherDeps = [
  { name: '@vitejs/plugin-vue', license: 'MIT' },
  { name: 'vite', license: 'MIT' },
  { name: 'tailwindcss', license: 'MIT' },
  { name: 'gsap', license: 'GreenSock Standard License（免费可商用）' },
  { name: '@vue/server-renderer', license: 'MIT' },
  { name: 'autoprefixer', license: 'MIT' },
  { name: 'postcss', license: 'MIT' },
  { name: 'vite-plugin-compression', license: 'MIT' },
  { name: 'vite-plugin-html', license: 'MIT' }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">法律 · 许可证</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">WPX 站在开源的肩膀上</span>
        </h1>
        <p class="mt-4 text-dark/60">
          内置字体、核心依赖的许可证清单与致谢。
        </p>
      </div>

      <!-- 项目自身状态 -->
      <div class="mt-14">
        <div
          class="rounded-2xl border border-dark/5 bg-white p-6 md:p-8"
        >
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-wpx-gradient text-lg font-extrabold text-white shadow-wpx">
              W
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-extrabold">WPX 项目自身</h2>
              <p class="mt-2 text-sm leading-relaxed text-dark/75">
                当前 WPX 桌面客户端的源代码仓库标记为
                <code class="rounded bg-dark/5 px-1.5 py-0.5 text-sm">private: true</code>
                与
                <code class="rounded bg-dark/5 px-1.5 py-0.5 text-sm">license: "UNLICENSED"</code>
                （见
                <a class="text-primary-600 hover:underline" href="https://github.com/MatuX-ai/WPX/blob/main/package.json" target="_blank" rel="noopener noreferrer">package.json</a>
                ）。
                我们正在为开源版本做最后的代码清理与依赖检查，<strong class="text-dark">正式开源时间另行公告</strong>。
              </p>
              <p class="mt-2 text-sm leading-relaxed text-dark/75">
                在此之前，未经书面授权，请勿对 WPX 的二进制发行版进行再分发或商业转售。
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 内置开源字体 -->
      <div class="mt-16">
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">内置开源字体</span>
        </h2>
        <p class="mt-2 text-sm text-dark/60">
          以下字体随 WPX 安装包分发，均为免费可商用授权。使用或再分发时，请遵守各自许可条款（通常需保留版权声明与许可全文）。
        </p>

        <div class="mt-6 overflow-x-auto rounded-2xl border border-dark/5 bg-white">
          <table class="w-full min-w-[480px] text-left text-sm">
            <thead class="bg-wpx-gradient-soft text-xs uppercase tracking-wider text-dark/60">
              <tr>
                <th class="px-5 py-3">字体名称</th>
                <th class="px-5 py-3">作者 / 版权方</th>
                <th class="px-5 py-3">开源 / 授权协议</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark/5 text-dark/80">
              <tr v-for="f in builtInFonts" :key="f.name" class="hover:bg-wpx-gradient-soft/30">
                <td class="px-5 py-3 font-semibold">{{ f.name }}</td>
                <td class="px-5 py-3">{{ f.author }}</td>
                <td class="px-5 py-3">
                  <span class="rounded-full bg-accent-mint/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    {{ f.license }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-dark/50">
          许可全文链接见
          <a class="text-primary-600 hover:underline" href="https://scripts.sil.org/OFL" target="_blank" rel="noopener noreferrer">SIL Open Font License</a>
          、
          <a class="text-primary-600 hover:underline" href="https://www.alibabafonts.com/" target="_blank" rel="noopener noreferrer">阿里巴巴字体</a>
          、
          <a class="text-primary-600 hover:underline" href="https://developer.harmonyos.com/en/design/resource/" target="_blank" rel="noopener noreferrer">HarmonyOS Sans 字体许可</a>
          。
        </p>
      </div>

      <!-- 关键依赖（按许可证分组） -->
      <div class="mt-16 grid gap-6 md:grid-cols-2">
        <!-- MIT -->
        <div class="rounded-2xl border border-dark/5 bg-white p-6">
          <div class="flex items-center gap-3">
            <span class="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
              MIT
            </span>
            <h3 class="text-lg font-bold">宽松商用友好</h3>
          </div>
          <p class="mt-2 text-xs text-dark/60">
            {{ mitDeps.length }} 个核心依赖遵循 MIT 许可证。
          </p>
          <ul class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-dark/75">
            <li v-for="d in mitDeps" :key="d" class="font-mono">· {{ d }}</li>
          </ul>
        </div>

        <!-- BSD-3-Clause -->
        <div class="rounded-2xl border border-dark/5 bg-white p-6">
          <div class="flex items-center gap-3">
            <span class="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">
              BSD-3-Clause
            </span>
            <h3 class="text-lg font-bold">Electron 核心</h3>
          </div>
          <p class="mt-2 text-xs text-dark/60">
            Electron 及其打包工具采用 BSD-3-Clause 许可证。
          </p>
          <ul class="mt-3 space-y-2 text-sm text-dark/80">
            <li v-for="d in bsdDeps" :key="d.name" class="flex items-baseline gap-2">
              <code class="rounded bg-dark/5 px-1.5 py-0.5 font-mono text-xs">{{ d.name }}</code>
              <span class="text-xs text-dark/50">— {{ d.note }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- 其它依赖（补充说明） -->
      <div class="mt-6">
        <details class="group rounded-2xl border border-dark/5 bg-white p-6">
          <summary class="flex cursor-pointer items-center justify-between text-lg font-bold">
            <span>其它工具链依赖（点击展开）</span>
            <span class="text-dark/40 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul class="mt-4 grid gap-2 text-sm text-dark/80 md:grid-cols-2">
            <li
              v-for="d in otherDeps"
              :key="d.name"
              class="flex items-center justify-between gap-3 rounded-lg bg-dark/3 px-3 py-2"
            >
              <code class="font-mono text-xs">{{ d.name }}</code>
              <span class="rounded-full bg-wpx-gradient-soft px-2 py-0.5 text-[11px] font-semibold text-primary-600">
                {{ d.license }}
              </span>
            </li>
          </ul>
        </details>
      </div>

      <!-- 完整许可文本生成指引 -->
      <div class="mt-12 rounded-3xl bg-wpx-gradient-soft p-8 md:p-10">
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">需要完整的第三方许可文本？</span>
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-dark/75">
          可在仓库根目录执行以下命令，一键生成包含所有依赖许可证信息的 CSV：
        </p>
        <pre class="mt-4 overflow-x-auto rounded-xl bg-dark/95 px-4 py-3 text-xs leading-relaxed text-emerald-200"><code>npm install
npx license-checker --production --csv --customPath resources/licenses/THIRD_PARTY_LICENSES.csv</code></pre>
        <p class="mt-3 text-xs text-dark/50">
          完整许可文本将输出到
          <code class="rounded bg-white/60 px-1.5 py-0.5 text-[11px]">resources/licenses/</code>
          目录，便于审计与法务交付。
        </p>
      </div>

      <!-- 致谢 -->
      <div class="mt-16 text-center">
        <h3 class="text-lg font-bold text-dark/70">致谢</h3>
        <p class="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-dark/60">
          感谢所有开源作者与字体设计师 —— 是你们的慷慨让 WPX 成为可能。
          如果你发现我们的署名有误，欢迎通过
          <a class="text-primary-600 hover:underline" href="mailto:legal@wpx.app">legal@wpx.app</a>
          联系我们更正。
        </p>
      </div>
    </div>
  </section>
</template>
