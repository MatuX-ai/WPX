<template>
  <div class="space-y-6">
    <!-- 顶部标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Skills 管理</h1>
        <p class="text-sm text-gray-500 mt-1">
          管理内置 Skills、在线 Skills 与社区 Skills 审核
        </p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="[
            'pb-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === t.key
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          ]"
          @click="activeTab = t.key"
        >
          {{ t.title }}
          <span
            v-if="t.count !== null && t.count !== undefined"
            class="ml-1 text-xs text-gray-400"
          >({{ t.count }})</span>
        </button>
      </nav>
    </div>

    <!-- ============ Tab 1: 内置 Skills ============ -->
    <div
      v-if="activeTab === 'builtin'"
      class="space-y-4"
    >
      <!-- 分类筛选 -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="c in builtInCategoryOptions"
          :key="c.value"
          type="button"
          :class="[
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            builtInCategory === c.value
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
          ]"
          @click="builtInCategory = c.value"
        >
          {{ c.label }}
          <span class="ml-1 opacity-70">{{ categoryCount(c.value) }}</span>
        </button>
        <div class="ml-auto text-xs text-gray-400">
          共 {{ filteredBuiltIn.length }} 款 · 已启用 {{ enabledBuiltInCount }}
        </div>
      </div>

      <!-- 内置列表 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="s in filteredBuiltIn"
          :key="s.id"
          class="wpx-card p-4 flex flex-col gap-2"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-wpx-gradient-soft text-primary-700 flex items-center justify-center text-xl shrink-0"
            >
              {{ s.icon || '⚡' }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 truncate">{{ s.name }}</span>
                <span class="wpx-badge-gray">{{ categoryLabel(s.category) }}</span>
              </div>
              <p class="text-xs text-gray-500 mt-1 line-clamp-2">
                {{ s.description || '—' }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between mt-1">
            <span
              v-if="s.enabled"
              class="wpx-badge-success"
            >● 启用中</span>
            <span
              v-else
              class="wpx-badge-gray"
            >○ 已停用</span>

            <button
              type="button"
              :class="[
                'text-xs px-2 py-1 rounded-md transition-colors',
                s.enabled
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-primary-600 hover:bg-primary-50'
              ]"
              @click="onToggleBuiltIn(s)"
            >
              {{ s.enabled ? '停用' : '启用' }}
            </button>
          </div>
        </div>

        <div
          v-if="!builtInLoading && filteredBuiltIn.length === 0"
          class="col-span-full wpx-card p-12 text-center text-gray-400"
        >
          当前分类下暂无 Skills
        </div>
      </div>
    </div>

    <!-- ============ Tab 2: 在线 Skills ============ -->
    <div
      v-else-if="activeTab === 'online'"
      class="space-y-4"
    >
      <!-- 工具栏 -->
      <div class="wpx-card p-4 flex flex-wrap items-center gap-3">
        <input
          v-model="onlineFilters.keyword"
          type="text"
          placeholder="按名称搜索"
          class="wpx-input w-56"
        >
        <select
          v-model="onlineFilters.category"
          class="wpx-input w-40"
        >
          <option value="">全部分类</option>
          <option
            v-for="c in onlineCategoryOptions"
            :key="c"
            :value="c"
          >
            {{ c }}
          </option>
        </select>
        <select
          v-model="onlineFilters.status"
          class="wpx-input w-32"
        >
          <option value="">全部状态</option>
          <option value="on">已上架</option>
          <option value="off">已下架</option>
        </select>
        <span class="text-xs text-gray-400">
          共 {{ filteredOnline.length }} 款
        </span>
        <button
          type="button"
          class="wpx-btn-primary ml-auto"
          @click="openOnlineCreate"
        >
          <span>+</span>
          <span>添加 Skill</span>
        </button>
      </div>

      <!-- 在线 Skills 列表 -->
      <div class="wpx-card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-4 py-3 font-medium">名称</th>
              <th class="text-left px-4 py-3 font-medium">分类</th>
              <th class="text-left px-4 py-3 font-medium">调用次数</th>
              <th class="text-left px-4 py-3 font-medium">活跃用户</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">最近更新</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="s in filteredOnline"
              :key="s.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-md bg-wpx-gradient-soft text-primary-700 flex items-center justify-center text-base shrink-0"
                  >
                    {{ s.icon || '⚡' }}
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium text-gray-900 truncate">{{ s.name }}</div>
                    <div class="text-xs text-gray-400 truncate max-w-[260px]">
                      {{ s.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="wpx-badge-primary">{{ s.category }}</span>
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-700">
                {{ formatNumber(s.callCount) }}
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-700">
                {{ formatNumber(s.activeUsers) }}
              </td>
              <td class="px-4 py-3">
                <span :class="s.status === 'on' ? 'wpx-badge-success' : 'wpx-badge-gray'">
                  {{ s.status === 'on' ? '● 已上架' : '○ 已下架' }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500">
                {{ formatTime(s.updatedAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-primary-600 hover:text-primary-700"
                    @click="openOnlineEdit(s)"
                  >编辑</button>
                  <button
                    type="button"
                    class="text-xs text-gray-600 hover:text-gray-700"
                    @click="onToggleOnline(s)"
                  >
                    {{ s.status === 'on' ? '下架' : '上架' }}
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700"
                    @click="onDeleteOnline(s)"
                  >删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="!onlineLoading && filteredOnline.length === 0">
              <td
                colspan="7"
                class="px-4 py-12 text-center text-gray-400"
              >
                暂无在线 Skills，点击右上角"添加 Skill"开始
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ Tab 3: 社区 Skills 审核 ============ -->
    <div
      v-else
      class="space-y-4"
    >
      <div class="wpx-card p-4 flex flex-wrap items-center gap-3">
        <span class="text-sm text-gray-700">社区贡献的 Skills 审核</span>
        <span class="wpx-badge-warning">未来功能</span>
        <select
          v-model="communityStatus"
          class="wpx-input w-32 ml-auto"
        >
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="c in filteredCommunity"
          :key="c.id"
          class="wpx-card p-4"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-lg bg-wpx-gradient-soft text-primary-700 flex items-center justify-center text-xl shrink-0"
            >
              {{ c.icon || '⚡' }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 truncate">{{ c.name }}</span>
                <span class="wpx-badge-primary">{{ c.category }}</span>
                <span :class="communityStatusClass(c.status)">
                  {{ communityStatusLabel(c.status) }}
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                作者：{{ c.author || '匿名' }} · 提交时间：{{ formatTime(c.submittedAt) }}
              </div>
              <p class="text-xs text-gray-600 mt-2 line-clamp-3">
                {{ c.description }}
              </p>
            </div>
          </div>

          <div
            v-if="c.status === 'pending'"
            class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100"
          >
            <button
              type="button"
              class="wpx-btn-danger"
              @click="onRejectCommunity(c)"
            >
              拒绝
            </button>
            <button
              type="button"
              class="wpx-btn-primary"
              @click="onApproveCommunity(c)"
            >
              通过并上架
            </button>
          </div>
        </div>

        <div
          v-if="!communityLoading && filteredCommunity.length === 0"
          class="col-span-full wpx-card p-12 text-center text-gray-400"
        >
          当前状态下暂无社区 Skill
        </div>
      </div>
    </div>

    <!-- ============ 在线 Skill 添加/编辑弹窗 ============ -->
    <transition name="page">
      <div
        v-if="onlineFormOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeOnlineForm"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 class="text-base font-semibold text-gray-900">
              {{ onlineForm.id ? '编辑 Skill' : '添加 Skill' }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="closeOnlineForm"
            >✕</button>
          </div>

          <form
            class="px-5 py-4 space-y-4 overflow-y-auto"
            @submit.prevent="onSubmitOnline"
          >
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  名称 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="onlineForm.name"
                  type="text"
                  required
                  placeholder="例如：周报生成"
                  class="wpx-input"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">图标</label>
                <input
                  v-model="onlineForm.icon"
                  type="text"
                  maxlength="4"
                  placeholder="⚡"
                  class="wpx-input text-center"
                >
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  分类 <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="onlineForm.category"
                  type="text"
                  required
                  placeholder="例如：办公 / 写作 / 编程"
                  list="online-category-list"
                  class="wpx-input"
                >
                <datalist id="online-category-list">
                  <option
                    v-for="c in onlineCategoryOptions"
                    :key="c"
                    :value="c"
                  ></option>
                </datalist>
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
                  <input
                    v-model="onlineForm.statusOn"
                    type="checkbox"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  >
                  立即上架
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                v-model="onlineForm.description"
                rows="2"
                placeholder="一句话说明 Skill 的用途"
                class="wpx-input resize-none"
              ></textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-medium text-gray-700">
                  Prompt 模板 <span class="text-red-500">*</span>
                </label>
                <span class="text-xs text-gray-400">
                  可用 <code class="px-1 rounded bg-gray-100 font-mono">{{ promptHint }}</code> 占位输入字段
                </span>
              </div>
              <textarea
                v-model="onlineForm.promptTemplate"
                rows="6"
                required
                placeholder="例：请根据用户的「{{ topic }}」撰写一份周报..."
                class="wpx-input resize-none font-mono text-xs"
              ></textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-medium text-gray-700">输入字段</label>
                <button
                  type="button"
                  class="text-xs text-primary-600 hover:text-primary-700"
                  @click="addInputField"
                >
                  + 添加字段
                </button>
              </div>

              <div
                v-if="onlineForm.inputFields.length === 0"
                class="text-xs text-gray-400 px-3 py-3 border border-dashed border-gray-200 rounded-lg text-center"
              >
                暂无输入字段。可添加让用户在调用时填写的参数。
              </div>

              <ul class="space-y-2">
                <li
                  v-for="(f, idx) in onlineForm.inputFields"
                  :key="idx"
                  class="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50"
                >
                  <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-3">
                      <input
                        v-model="f.name"
                        type="text"
                        placeholder="字段名（英文）"
                        class="wpx-input text-xs font-mono"
                      >
                    </div>
                    <div class="col-span-3">
                      <input
                        v-model="f.label"
                        type="text"
                        placeholder="显示标签"
                        class="wpx-input text-xs"
                      >
                    </div>
                    <div class="col-span-2">
                      <select
                        v-model="f.type"
                        class="wpx-input text-xs"
                      >
                        <option value="text">单行文本</option>
                        <option value="textarea">多行文本</option>
                        <option value="number">数字</option>
                        <option value="select">下拉选择</option>
                      </select>
                    </div>
                    <div class="col-span-3 flex items-center gap-3">
                      <label class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input
                          v-model="f.required"
                          type="checkbox"
                          class="rounded border-gray-300 text-primary-600"
                        >
                        必填
                      </label>
                      <button
                        type="button"
                        class="text-xs text-gray-400 hover:text-red-600 ml-auto"
                        @click="onlineForm.inputFields.splice(idx, 1)"
                      >删除</button>
                    </div>
                  </div>
                  <input
                    v-model="f.placeholder"
                    type="text"
                    placeholder="占位提示（可选）"
                    class="wpx-input text-xs"
                  >
                  <input
                    v-if="f.type === 'select'"
                    v-model="f.optionsText"
                    type="text"
                    placeholder="下拉选项，英文逗号分隔，如：周一,周二,周三"
                    class="wpx-input text-xs"
                  >
                </li>
              </ul>
            </div>

            <div
              v-if="onlineFormError"
              class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
            >
              {{ onlineFormError }}
            </div>
          </form>

          <div class="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="closeOnlineForm"
            >
              取消
            </button>
            <button
              type="button"
              class="wpx-btn-primary"
              :disabled="onlineFormSubmitting"
              @click="onSubmitOnline"
            >
              {{ onlineFormSubmitting ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ============ 拒绝原因弹窗 ============ -->
    <transition name="page">
      <div
        v-if="rejectModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="rejectModal.open = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="px-5 py-4 border-b border-gray-100">
            <h3 class="text-base font-semibold text-gray-900">拒绝该 Skill</h3>
          </div>
          <div class="px-5 py-4 space-y-3">
            <p class="text-sm text-gray-600">
              拒绝「{{ rejectModal.name }}」时给作者留言（可选）
            </p>
            <textarea
              v-model="rejectModal.reason"
              rows="3"
              placeholder="例如：Prompt 不符合规范、缺少必要字段..."
              class="wpx-input resize-none"
            ></textarea>
          </div>
          <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              class="wpx-btn-secondary"
              @click="rejectModal.open = false"
            >
              取消
            </button>
            <button
              type="button"
              class="wpx-btn-danger"
              @click="confirmRejectCommunity"
            >
              确认拒绝
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  fetchBuiltInSkills,
  toggleBuiltInSkill,
  fetchOnlineSkills,
  createOnlineSkill,
  updateOnlineSkill,
  toggleOnlineSkill,
  deleteOnlineSkill,
  fetchCommunitySkills,
  approveCommunitySkill,
  rejectCommunitySkill
} from '@/utils/skills-api'

defineOptions({ name: 'SkillsManageView' })

// ============ Tabs ============
const tabs = computed(() => [
  { key: 'builtin', title: '内置 Skills', count: builtIn.value.length },
  { key: 'online', title: '在线 Skills', count: onlineSkills.value.length },
  { key: 'community', title: '社区审核', count: communitySkills.value.length }
])
const activeTab = ref('builtin')

// ============ 内置 Skills ============
const builtIn = ref([])
const builtInLoading = ref(false)
const builtInCategory = ref('all')

const builtInCategoryOptions = [
  { value: 'all', label: '全部' },
  { value: 'teacher', label: '教师专用' },
  { value: 'student', label: '学生专用' },
  { value: 'general', label: '通用' }
]

const BUILTIN_CATEGORY_LABELS = {
  teacher: '教师',
  student: '学生',
  general: '通用'
}

const filteredBuiltIn = computed(() => {
  if (builtInCategory.value === 'all') return builtIn.value
  return builtIn.value.filter((s) => s.category === builtInCategory.value)
})

const enabledBuiltInCount = computed(
  () => builtIn.value.filter((s) => s.enabled).length
)

function categoryLabel(c) {
  return BUILTIN_CATEGORY_LABELS[c] || c || '—'
}

function categoryCount(c) {
  if (c === 'all') return builtIn.value.length
  return builtIn.value.filter((s) => s.category === c).length
}

async function loadBuiltIn() {
  builtInLoading.value = true
  try {
    const data = await fetchBuiltInSkills()
    if (Array.isArray(data)) {
      builtIn.value = data
    } else if (data && Array.isArray(data.list)) {
      builtIn.value = data.list
    } else {
      builtIn.value = demoBuiltIn()
    }
  } finally {
    builtInLoading.value = false
  }
}

function demoBuiltIn() {
  const make = (id, name, category, icon, desc) => ({
    id,
    name,
    category,
    icon,
    description: desc,
    enabled: true,
    updatedAt: Date.now()
  })
  const teachers = [
    make('t1', '课件大纲生成', 'teacher', '📚', '根据学科与章节快速生成课件大纲'),
    make('t2', '教案润色', 'teacher', '✍️', '优化教案结构与表达'),
    make('t3', '试卷出题', 'teacher', '📝', '根据知识点自动出题'),
    make('t4', '学情分析', 'teacher', '📊', '分析学生答题数据'),
    make('t5', '家长沟通', 'teacher', '💬', '生成家长沟通话术'),
    make('t6', '教学反思', 'teacher', '🔍', '辅助撰写教学反思'),
    make('t7', '作业点评', 'teacher', '✅', '批量点评学生作业'),
    make('t8', '评语生成', 'teacher', '⭐', '生成个性化学生评语'),
    make('t9', '板书设计', 'teacher', '🖼️', '建议板书布局与重点'),
    make('t10', '课堂导入', 'teacher', '🎬', '生成课堂导入方案'),
    make('t11', '知识点总结', 'teacher', '📖', '汇总章节核心要点'),
    make('t12', '试卷分析', 'teacher', '📈', '分析试卷难度与区分度'),
    make('t13', '教研资料', 'teacher', '🗂️', '检索教研参考资料'),
    make('t14', '论文辅导', 'teacher', '🎓', '教师科研论文写作'),
    make('t15', '教学计划', 'teacher', '📅', '制定学期教学计划'),
    make('t16', '学生评语库', 'teacher', '💡', '积累常用评语模板')
  ]
  const students = [
    make('s1', '论文润色', 'student', '📝', '优化论文表达与结构'),
    make('s2', '错别字校对', 'student', '🔤', '发现并纠正错别字'),
    make('s3', '总结要点', 'student', '📌', '提取文档核心要点'),
    make('s4', '翻译助手', 'student', '🌐', '多语种翻译辅助'),
    make('s5', '简历优化', 'student', '💼', '优化简历内容'),
    make('s6', '代码解释', 'student', '💻', '解释代码逻辑'),
    make('s7', '周报生成', 'student', '📅', '自动生成绩效周报'),
    make('s8', '会议纪要', 'student', '🗒️', '总结会议纪要'),
    make('s9', '邮件回复', 'student', '📧', '辅助撰写邮件'),
    make('s10', '标题优化', 'student', '✨', '优化标题吸引力'),
    make('s11', '读书笔记', 'student', '📚', '整理读书笔记'),
    make('s12', 'PPT 大纲', 'student', '🎤', '快速生成演示大纲'),
    make('s13', '公式推导', 'student', '🧮', '解释数学公式'),
    make('s14', '概念解释', 'student', '📖', '通俗解释专业概念'),
    make('s15', '答题思路', 'student', '💡', '梳理题目解题思路'),
    make('s16', '实验报告', 'student', '🧪', '辅助撰写实验报告')
  ]
  const general = [
    make('g1', '通用对话', 'general', '💬', '通用 AI 对话'),
    make('g2', '文本改写', 'general', '✏️', '改写文本保持原意'),
    make('g3', '信息提取', 'general', '🔍', '从文本提取结构化信息'),
    make('g4', '情感分析', 'general', '❤️', '分析文本情感倾向'),
    make('g5', '文本分类', 'general', '🏷️', '自动分类文本主题')
  ]
  return [...teachers, ...students, ...general].map((s, i) => ({
    ...s,
    enabled: i % 7 !== 0 // 部分停用便于演示
  }))
}

async function onToggleBuiltIn(s) {
  const next = !s.enabled
  s.enabled = next
  try {
    const updated = await toggleBuiltInSkill(s.id, next)
    if (updated && updated.id) {
      Object.assign(s, updated)
    }
  } catch (err) {
    s.enabled = !next
    // eslint-disable-next-line no-console
    console.error('[Skills] toggle builtIn failed:', err)
  }
}

// ============ 在线 Skills ============
const onlineSkills = ref([])
const onlineLoading = ref(false)
const onlineFilters = reactive({ keyword: '', category: '', status: '' })

const onlineCategoryOptions = computed(() => {
  const set = new Set([
    '办公',
    '写作',
    '编程',
    '设计',
    '教育',
    '营销',
    '翻译',
    '其他'
  ])
  for (const s of onlineSkills.value) {
    if (s.category) set.add(s.category)
  }
  return Array.from(set).sort()
})

const filteredOnline = computed(() => {
  const kw = onlineFilters.keyword.trim().toLowerCase()
  return onlineSkills.value.filter((s) => {
    if (kw && !(s.name || '').toLowerCase().includes(kw)) return false
    if (onlineFilters.category && s.category !== onlineFilters.category) return false
    if (onlineFilters.status && s.status !== onlineFilters.status) return false
    return true
  })
})

async function loadOnline() {
  onlineLoading.value = true
  try {
    const data = await fetchOnlineSkills()
    if (Array.isArray(data)) {
      onlineSkills.value = data
    } else if (data && Array.isArray(data.list)) {
      onlineSkills.value = data.list
    } else {
      onlineSkills.value = demoOnline()
    }
  } finally {
    onlineLoading.value = false
  }
}

function demoOnline() {
  const make = (id, name, category, icon, desc, status, calls, users) => ({
    id,
    name,
    category,
    icon,
    description: desc,
    status,
    callCount: calls,
    activeUsers: users,
    promptTemplate: `请根据用户的输入完成【${name}】任务。`,
    inputFields: [
      { name: 'topic', label: '主题', type: 'text', required: true, placeholder: '请输入主题' }
    ],
    updatedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 14)
  })
  return [
    make('o1', '公众号标题生成', '营销', '✍️', '为公众号文章生成吸引人的标题', 'on', 3420, 512),
    make('o2', '短视频脚本', '营销', '🎬', '生成 60 秒以内的短视频脚本', 'on', 2156, 348),
    make('o3', 'OKR 生成器', '办公', '🎯', '根据目标生成 OKR', 'on', 1843, 256),
    make('o4', '正则表达式助手', '编程', '💻', '由自然语言生成正则', 'on', 1287, 198),
    make('o5', '海报文案', '设计', '🎨', '为海报生成简短文案', 'off', 642, 96),
    make('o6', '小学数学应用题', '教育', '🧮', '生成小学数学应用题', 'on', 985, 142)
  ]
}

async function onToggleOnline(s) {
  const next = s.status === 'on' ? 'off' : 'on'
  s.status = next
  try {
    const updated = await toggleOnlineSkill(s.id, next)
    if (updated && updated.id) {
      Object.assign(s, updated)
    }
  } catch (err) {
    s.status = next === 'on' ? 'off' : 'on'
    // eslint-disable-next-line no-console
    console.error('[Skills] toggle online failed:', err)
  }
}

async function onDeleteOnline(s) {
  const ok = window.confirm(`确定删除 Skill「${s.name}」？该操作不可恢复。`)
  if (!ok) return
  const original = onlineSkills.value.slice()
  onlineSkills.value = onlineSkills.value.filter((x) => x.id !== s.id)
  try {
    await deleteOnlineSkill(s.id)
  } catch (err) {
    onlineSkills.value = original
    // eslint-disable-next-line no-console
    console.error('[Skills] delete online failed:', err)
  }
}

// 在线 Skill 表单
const onlineFormOpen = ref(false)
const onlineFormSubmitting = ref(false)
const onlineFormError = ref('')
const onlineForm = reactive({
  id: '',
  name: '',
  category: '',
  icon: '⚡',
  description: '',
  promptTemplate: '',
  statusOn: false,
  inputFields: []
})

function resetOnlineForm() {
  onlineForm.id = ''
  onlineForm.name = ''
  onlineForm.category = ''
  onlineForm.icon = '⚡'
  onlineForm.description = ''
  onlineForm.promptTemplate = ''
  onlineForm.statusOn = false
  onlineForm.inputFields = []
  onlineFormError.value = ''
}

function openOnlineCreate() {
  resetOnlineForm()
  onlineFormOpen.value = true
}

function openOnlineEdit(s) {
  resetOnlineForm()
  onlineForm.id = s.id
  onlineForm.name = s.name
  onlineForm.category = s.category || ''
  onlineForm.icon = s.icon || '⚡'
  onlineForm.description = s.description || ''
  onlineForm.promptTemplate = s.promptTemplate || ''
  onlineForm.statusOn = s.status === 'on'
  onlineForm.inputFields = (s.inputFields || []).map((f) => ({
    ...f,
    optionsText: Array.isArray(f.options) ? f.options.join(',') : ''
  }))
  onlineFormOpen.value = true
}

function closeOnlineForm() {
  onlineFormOpen.value = false
  onlineFormError.value = ''
}

function addInputField() {
  onlineForm.inputFields.push({
    name: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    optionsText: ''
  })
}

async function onSubmitOnline() {
  onlineFormError.value = ''
  if (!onlineForm.name.trim()) {
    onlineFormError.value = '请填写名称'
    return
  }
  if (!onlineForm.category.trim()) {
    onlineFormError.value = '请填写分类'
    return
  }
  if (!onlineForm.promptTemplate.trim()) {
    onlineFormError.value = '请填写 Prompt 模板'
    return
  }
  // 校验字段名唯一且非空
  const fieldNames = onlineForm.inputFields.map((f) => f.name.trim()).filter(Boolean)
  const uniqueNames = new Set(fieldNames)
  if (fieldNames.length !== uniqueNames.size) {
    onlineFormError.value = '输入字段名必须唯一'
    return
  }
  for (const f of onlineForm.inputFields) {
    if (!f.name.trim()) {
      onlineFormError.value = '字段名不能为空'
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.name.trim())) {
      onlineFormError.value = `字段名 "${f.name}" 不合法（仅字母数字下划线，且不能以数字开头）`
      return
    }
    if (f.type === 'select' && !f.optionsText?.trim()) {
      onlineFormError.value = `字段 "${f.label || f.name}" 为下拉框，必须填写选项`
      return
    }
  }

  onlineFormSubmitting.value = true
  try {
    const payload = {
      name: onlineForm.name.trim(),
      category: onlineForm.category.trim(),
      icon: onlineForm.icon || '⚡',
      description: onlineForm.description.trim(),
      promptTemplate: onlineForm.promptTemplate,
      status: onlineForm.statusOn ? 'on' : 'off',
      inputFields: onlineForm.inputFields.map((f) => {
        const out = {
          name: f.name.trim(),
          label: f.label.trim() || f.name.trim(),
          type: f.type,
          required: !!f.required
        }
        if (f.placeholder?.trim()) out.placeholder = f.placeholder.trim()
        if (f.type === 'select' && f.optionsText) {
          out.options = f.optionsText
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean)
        }
        return out
      })
    }

    if (onlineForm.id) {
      const updated = await updateOnlineSkill(onlineForm.id, payload)
      const idx = onlineSkills.value.findIndex((x) => x.id === onlineForm.id)
      if (idx >= 0 && updated) onlineSkills.value[idx] = { ...onlineSkills.value[idx], ...updated }
    } else {
      const created = await createOnlineSkill(payload)
      if (created && created.id) {
        onlineSkills.value.unshift(created)
      } else {
        await loadOnline()
      }
    }
    closeOnlineForm()
  } catch (err) {
    onlineFormError.value = err?.message || '保存失败'
  } finally {
    onlineFormSubmitting.value = false
  }
}

// ============ 社区 Skills 审核 ============
const communitySkills = ref([])
const communityLoading = ref(false)
const communityStatus = ref('pending')

const filteredCommunity = computed(() =>
  communitySkills.value.filter((c) => c.status === communityStatus.value)
)

async function loadCommunity() {
  communityLoading.value = true
  try {
    const data = await fetchCommunitySkills({ status: communityStatus.value })
    if (Array.isArray(data)) {
      communitySkills.value = data
    } else if (data && Array.isArray(data.list)) {
      communitySkills.value = data.list
    } else {
      communitySkills.value = demoCommunity()
    }
  } finally {
    communityLoading.value = false
  }
}

function demoCommunity() {
  return [
    {
      id: 'c1',
      name: '小红书爆款标题',
      category: '营销',
      icon: '✨',
      description: '生成符合小红书平台调性的爆款标题，含 emoji 与关键词',
      author: '小红薯@example.com',
      status: 'pending',
      submittedAt: Date.now() - 1000 * 60 * 60 * 4
    },
    {
      id: 'c2',
      name: 'SQL 自然语言转换',
      category: '编程',
      icon: '🗄️',
      description: '由自然语言查询条件生成 SQL 语句',
      author: 'data_dev@example.com',
      status: 'pending',
      submittedAt: Date.now() - 1000 * 60 * 60 * 12
    },
    {
      id: 'c3',
      name: '菜谱改编',
      category: '其他',
      icon: '🍳',
      description: '根据现有食材推荐菜谱',
      author: 'cook@example.com',
      status: 'pending',
      submittedAt: Date.now() - 1000 * 60 * 60 * 24
    }
  ]
}

function communityStatusLabel(s) {
  return s === 'pending' ? '待审核' : s === 'approved' ? '已通过' : '已拒绝'
}

function communityStatusClass(s) {
  if (s === 'pending') return 'wpx-badge-warning'
  if (s === 'approved') return 'wpx-badge-success'
  return 'wpx-badge-danger'
}

async function onApproveCommunity(c) {
  const original = communitySkills.value.slice()
  communitySkills.value = communitySkills.value.filter((x) => x.id !== c.id)
  try {
    await approveCommunitySkill(c.id)
  } catch (err) {
    communitySkills.value = original
    // eslint-disable-next-line no-console
    console.error('[Skills] approve community failed:', err)
  }
}

const rejectModal = reactive({ open: false, id: '', name: '', reason: '' })

function onRejectCommunity(c) {
  rejectModal.id = c.id
  rejectModal.name = c.name
  rejectModal.reason = ''
  rejectModal.open = true
}

async function confirmRejectCommunity() {
  const id = rejectModal.id
  const original = communitySkills.value.slice()
  communitySkills.value = communitySkills.value.filter((x) => x.id !== id)
  rejectModal.open = false
  try {
    await rejectCommunitySkill(id, rejectModal.reason)
  } catch (err) {
    communitySkills.value = original
    // eslint-disable-next-line no-console
    console.error('[Skills] reject community failed:', err)
  }
}

watch(communityStatus, () => {
  loadCommunity()
})

// ============ Helpers ============
const promptHint = '{{ fieldName }}'

function formatNumber(n) {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN')
}

function formatTime(t) {
  if (!t) return '—'
  const d = typeof t === 'number' ? new Date(t) : new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 1000 * 60 * 60 * 24) {
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m} 分钟前`
    return `${Math.floor(m / 60)} 小时前`
  }
  if (diff < 1000 * 60 * 60 * 24 * 30) {
    return `${Math.floor(diff / (1000 * 60 * 60 * 24))} 天前`
  }
  return d.toLocaleDateString('zh-CN')
}

// ============ Lifecycle ============
onMounted(async () => {
  await loadBuiltIn()
  if (activeTab.value === 'online') await loadOnline()
  if (activeTab.value === 'community') await loadCommunity()
})

// 切换 Tab 时按需懒加载
watch(activeTab, async (tab) => {
  if (tab === 'online' && onlineSkills.value.length === 0) {
    await loadOnline()
  } else if (tab === 'community' && communitySkills.value.length === 0) {
    await loadCommunity()
  }
})
</script>