<script setup>
import { onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useMyFonts } from '@/composables/useMyFonts'

const {
  loading,
  recordsLoading,
  fonts,
  consumeRecords,
  timeFilter,
  customFrom,
  customTo,
  timeFilters,
  loadConsumeRecords,
  setFontEnabled,
  initialize,
  formatRecordTime,
} = useMyFonts()

watch(timeFilter, () => {
  if (timeFilter.value !== 'custom') {
    void loadConsumeRecords()
  }
})

watch([customFrom, customTo], () => {
  if (timeFilter.value === 'custom' && customFrom.value && customTo.value) {
    void loadConsumeRecords()
  }
})

onMounted(() => {
  void initialize()
})
</script>

<template>
  <section class="my-fonts">
    <header class="my-fonts__header">
      <div>
        <RouterLink to="/fonts" class="my-fonts__back">← 返回字体商店</RouterLink>
        <h1 class="my-fonts__title">我的字体</h1>
      </div>
    </header>

    <section class="my-fonts__section">
      <h2 class="my-fonts__section-title">已下载字体</h2>

      <div v-if="loading" class="my-fonts__empty">加载中…</div>
      <div v-else-if="fonts.length === 0" class="my-fonts__empty">暂无已下载字体</div>

      <div v-else class="my-fonts__table-wrap">
        <table class="my-fonts__table">
          <thead>
            <tr>
              <th scope="col">字体名称</th>
              <th scope="col">类型</th>
              <th scope="col">字重</th>
              <th scope="col">启用</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="font in fonts" :key="font.id">
              <td class="my-fonts__name-cell">
                <span>{{ font.name }}</span>
                <span v-if="font.isCommercial" class="my-fonts__paid-badge" title="商业字体">⚡</span>
              </td>
              <td>{{ font.typeLabel }}</td>
              <td>{{ font.weightLabel }}</td>
              <td>
                <label class="my-fonts__switch">
                  <input
                    type="checkbox"
                    :checked="font.enabled"
                    :aria-label="font.enabled ? `停用 ${font.name}` : `启用 ${font.name}`"
                    @change="(event) => setFontEnabled(font, event.target.checked)"
                  />
                  <span class="my-fonts__switch-slider" aria-hidden="true" />
                  <span class="my-fonts__switch-text">{{ font.enabled ? '已启用' : '已停用' }}</span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="my-fonts__section">
      <div class="my-fonts__section-head">
        <h2 class="my-fonts__section-title">Token 消费明细</h2>

        <div class="my-fonts__filters" role="group" aria-label="时间筛选">
          <button
            v-for="filter in timeFilters"
            :key="filter.key"
            type="button"
            class="my-fonts__filter"
            :class="{ 'my-fonts__filter--active': timeFilter === filter.key }"
            @click="timeFilter = filter.key"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <div v-if="timeFilter === 'custom'" class="my-fonts__custom-range">
        <label>
          开始
          <input v-model="customFrom" type="date" class="my-fonts__date-input" />
        </label>
        <label>
          结束
          <input v-model="customTo" type="date" class="my-fonts__date-input" />
        </label>
        <button type="button" class="my-fonts__filter-apply" @click="loadConsumeRecords">
          应用
        </button>
      </div>

      <div v-if="recordsLoading" class="my-fonts__empty">加载中…</div>
      <div v-else-if="consumeRecords.length === 0" class="my-fonts__empty">暂无消费记录</div>

      <div v-else class="my-fonts__table-wrap">
        <table class="my-fonts__table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">字体名称</th>
              <th scope="col">字数</th>
              <th scope="col">Token 消耗</th>
              <th scope="col">文档名称</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in consumeRecords" :key="record.id">
              <td>{{ formatRecordTime(record.created_at) }}</td>
              <td>{{ record.font_name || record.font_id }}</td>
              <td>{{ record.char_count }}</td>
              <td>{{ record.token_used }}</td>
              <td>{{ record.document_name || record.doc_name || '未命名文档' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.my-fonts {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: var(--theme-bg, #fff);
}

.my-fonts__header {
  margin-bottom: 24px;
}

.my-fonts__back {
  display: inline-block;
  margin-bottom: 8px;
  color: var(--theme-fg-muted, #64748b);
  font-size: 13px;
  text-decoration: none;
}

.my-fonts__back:hover {
  color: var(--theme-accent, #2563eb);
}

.my-fonts__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.my-fonts__section {
  margin-bottom: 32px;
}

.my-fonts__section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.my-fonts__section-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.my-fonts__section-head .my-fonts__section-title {
  margin-bottom: 0;
}

.my-fonts__empty {
  padding: 24px;
  text-align: center;
  color: var(--theme-fg-muted, #64748b);
  font-size: 14px;
}

.my-fonts__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 12px;
}

.my-fonts__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.my-fonts__table th,
.my-fonts__table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--theme-border, #e2e8f0);
}

.my-fonts__table th {
  background: var(--theme-bg-subtle, #f8fafc);
  color: var(--theme-fg-muted, #64748b);
  font-weight: 500;
}

.my-fonts__table tbody tr:last-child td {
  border-bottom: none;
}

.my-fonts__name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.my-fonts__paid-badge {
  color: #d97706;
  font-size: 12px;
}

.my-fonts__switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.my-fonts__switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.my-fonts__switch-slider {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: #cbd5e1;
  transition: background 0.2s ease;
}

.my-fonts__switch-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.my-fonts__switch input:checked + .my-fonts__switch-slider {
  background: var(--theme-accent, #2563eb);
}

.my-fonts__switch input:checked + .my-fonts__switch-slider::after {
  transform: translateX(16px);
}

.my-fonts__switch-text {
  font-size: 12px;
  color: var(--theme-fg-muted, #64748b);
}

.my-fonts__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.my-fonts__filter {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg, #fff);
  font-size: 12px;
  cursor: pointer;
}

.my-fonts__filter--active {
  border-color: var(--theme-accent, #2563eb);
  color: var(--theme-accent, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}

.my-fonts__custom-range {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.my-fonts__custom-range label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.my-fonts__date-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
}

.my-fonts__filter-apply {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 6px;
  background: var(--theme-bg, #fff);
  cursor: pointer;
}
</style>
