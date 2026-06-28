<!--
  SectionSkills · 内置技能区
-->
<script setup>
const skills = [
  { name: '论文排版', desc: '一键应用 GB/T 7714 引用与学术模板', emoji: '🎓' },
  { name: 'AI 改写', desc: '支持 12 种语气与 6 种长度档位', emoji: '✍️' },
  { name: '图片去背景', desc: '本地 rembg 离线推理，隐私无忧', emoji: '🪄' },
  { name: '商业字体', desc: '嵌入合法授权字体，导出 PDF 无忧', emoji: '🔤' },
  { name: '压缩 / 解压', desc: '基于 7-Zip 引擎，目录树可视化', emoji: '📦' },
  { name: '知识库', desc: '把资料喂给 AI，回答有据可循', emoji: '📚' }
]
</script>

<template>
  <section
    id="skills"
    class="wpx-section"
    aria-labelledby="skills-title"
  >
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">内置技能</span>
        <h2
          id="skills-title"
          class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-5xl"
        >
          <span class="wpx-gradient-text">开箱即用的学生 / 教师工具</span>
        </h2>
        <p class="mt-4 text-dark/60">
          论文排版、备课模板、图片处理、文件整理，一键调用。
        </p>
      </div>

      <div class="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="s in skills"
          :key="s.name"
          class="flex items-center gap-4 rounded-2xl border border-dark/5 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient-soft text-2xl"
            role="img"
            :aria-label="s.name + ' 图标'"
          >
            {{ s.emoji }}
          </div>
          <div>
            <div class="text-base font-bold">
              {{ s.name }}
            </div>
            <div class="text-sm text-dark/60">
              {{ s.desc }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
