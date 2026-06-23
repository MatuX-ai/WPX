<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useMyFonts } from '@/composables/useMyFonts'
import { fetchConsumeRecords, fetchTokenBalance, formatRecordTime } from '@/utils/tokenApi'

const { loading: fontsLoading, fonts, loadFonts } = useMyFonts()

const balance = ref(0)
const balanceLoading = ref(true)
const recordsLoading = ref(true)
const consumeRecords = ref([])
const loadError = ref('')

const downloadedFontCount = computed(() => fonts.value.length)

const recentConsumeRecords = computed(() => consumeRecords.value)

async function refreshDashboard() {
  loadError.value = ''
  balanceLoading.value = true
  recordsLoading.value = true

  try {
    const [nextBalance, records] = await Promise.all([
      fetchTokenBalance(),
      fetchConsumeRecords({ limit: 10 }),
      loadFonts(),
    ])
    balance.value = nextBalance
    consumeRecords.value = Array.isArray(records) ? records : []
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载数据失败'
    consumeRecords.value = []
  } finally {
    balanceLoading.value = false
    recordsLoading.value = false
  }
}

onMounted(() => {
  void refreshDashboard()
})
</script>

<template>
  <section class="settings-panel fonts-settings">
    <header class="settings-panel__header">
      <h2 class="settings-panel__title">字体与 Token</h2>
      <p class="settings-panel__desc">查看已下载字体、Token 余额与消费概览，快速进入相关功能。</p>
      <p v-if="loadError" class="settings-notice settings-notice--error">{{ loadError }}</p>
    </header>

    <div class="fonts-settings__grid">
      <article class="fonts-settings__card">
        <div class="fonts-settings__card-head">
          <h3 class="fonts-settings__card-title">我的字体</h3>
          <p class="fonts-settings__card-desc">管理已下载并启用/停用的字体资源。</p>
        </div>
        <div class="fonts-settings__metric">
          <span v-if="fontsLoading" class="fonts-settings__metric-value">…</span>
          <span v-else class="fonts-settings__metric-value">{{ downloadedFontCount }}</span>
          <span class="fonts-settings__metric-label">已下载字体</span>
        </div>
        <RouterLink to="/my-fonts" class="settings-btn-secondary fonts-settings__action">
          管理我的字体
        </RouterLink>
      </article>

      <article class="fonts-settings__card">
        <div class="fonts-settings__card-head">
          <h3 class="fonts-settings__card-title">Token 余额</h3>
          <p class="fonts-settings__card-desc">用于字体商店下载与高级 AI 功能消费。</p>
        </div>
        <div class="fonts-settings__metric">
          <span v-if="balanceLoading" class="fonts-settings__metric-value">…</span>
          <span v-else class="fonts-settings__metric-value fonts-settings__metric-value--accent">
            {{ balance }}
          </span>
          <span class="fonts-settings__metric-label">当前余额（Token）</span>
        </div>
        <RouterLink to="/token/recharge" class="settings-btn-primary fonts-settings__action">
          充值
        </RouterLink>
      </article>

      <article class="fonts-settings__card fonts-settings__card--wide">
        <div class="fonts-settings__card-head fonts-settings__card-head--row">
          <div>
            <h3 class="fonts-settings__card-title">消费记录</h3>
            <p class="fonts-settings__card-desc">最近 10 条 Token 消费明细。</p>
          </div>
          <RouterLink to="/my-fonts" class="fonts-settings__link">查看全部</RouterLink>
        </div>

        <div v-if="recordsLoading" class="fonts-settings__empty">加载消费记录中…</div>
        <div v-else-if="recentConsumeRecords.length === 0" class="fonts-settings__empty">暂无消费记录</div>
        <ul v-else class="fonts-settings__records">
          <li v-for="record in recentConsumeRecords" :key="record.id" class="fonts-settings__record">
            <div class="fonts-settings__record-main">
              <span class="fonts-settings__record-font">{{ record.font_name || record.font_id }}</span>
              <span class="fonts-settings__record-doc">
                {{ record.document_name || record.doc_name || '未命名文档' }}
              </span>
            </div>
            <div class="fonts-settings__record-meta">
              <span>{{ formatRecordTime(record.created_at) }}</span>
              <strong>-{{ record.token_used }} Token</strong>
            </div>
          </li>
        </ul>
      </article>

      <article class="fonts-settings__card">
        <div class="fonts-settings__card-head">
          <h3 class="fonts-settings__card-title">字体商店</h3>
          <p class="fonts-settings__card-desc">浏览、预览并下载更多字体到本地。</p>
        </div>
        <RouterLink to="/font-market" class="settings-btn-secondary fonts-settings__action">
          前往字体商店
        </RouterLink>
      </article>
    </div>
  </section>
</template>

<style scoped>
@import './settings-shared.css';

.fonts-settings {
  max-width: 56rem;
}

.fonts-settings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.fonts-settings__card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  padding: 20px;
  box-shadow: var(--theme-shadow-sm);
}

.fonts-settings__card--wide {
  grid-column: 1 / -1;
}

.fonts-settings__card-head--row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.fonts-settings__card-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-fg);
}

.fonts-settings__card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--theme-fg-muted);
}

.fonts-settings__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fonts-settings__metric-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--theme-fg);
}

.fonts-settings__metric-value--accent {
  color: var(--theme-accent);
}

.fonts-settings__metric-label {
  font-size: 12px;
  color: var(--theme-fg-subtle);
}

.fonts-settings__action {
  align-self: flex-start;
  text-decoration: none;
  text-align: center;
}

.fonts-settings__link {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--theme-accent);
  text-decoration: none;
}

.fonts-settings__link:hover {
  text-decoration: underline;
}

.fonts-settings__empty {
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: var(--theme-fg-subtle);
}

.fonts-settings__records {
  margin: 0;
  padding: 0;
  list-style: none;
}

.fonts-settings__record {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--theme-border);
}

.fonts-settings__record:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.fonts-settings__record-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fonts-settings__record-font {
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg);
}

.fonts-settings__record-doc {
  font-size: 12px;
  color: var(--theme-fg-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fonts-settings__record-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--theme-fg-subtle);
}

.fonts-settings__record-meta strong {
  font-size: 13px;
  color: var(--theme-fg-muted);
}

@media (max-width: 768px) {
  .fonts-settings__grid {
    grid-template-columns: 1fr;
  }

  .fonts-settings__card--wide {
    grid-column: auto;
  }
}
</style>
