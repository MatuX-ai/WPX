<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useFontMarket } from '@/composables/useFontMarket'
import FontPreviewDialog from '@/components/font/FontPreviewDialog.vue'
import FontMarketCard from '@/components/font/FontMarketCard.vue'

const {
  loading,
  tokenBalance,
  activeCategory,
  categories,
  filteredFonts,
  previewVisible,
  previewFont,
  defaultPreviewText,
  initialize,
  openPreview,
  closePreview,
  useFontInEditor,
  downloadMarketFont,
} = useFontMarket()

onMounted(() => {
  void initialize()
})
</script>

<template>
  <section class="font-market">
    <header class="font-market__header">
      <div>
        <h1 class="font-market__title">字体库</h1>
        <p class="font-market__subtitle">浏览、预览、下载开源免费字体，或在「我的字体」中导入本地已授权字体</p>
      </div>

      <div class="font-market__header-actions">
        <RouterLink to="/my-fonts" class="font-market__my-fonts-btn">我的字体</RouterLink>
        <a
          v-if="false"
          href="/token/recharge"
          class="font-market__recharge-btn"
        >
          充值
        </a>
      </div>
    </header>

    <div class="font-market__tabs" role="tablist" aria-label="字体分类">
      <button
        v-for="category in categories"
        :key="category.key"
        type="button"
        class="font-market__tab"
        :class="{ 'font-market__tab--active': activeCategory === category.key }"
        role="tab"
        :aria-selected="activeCategory === category.key ? 'true' : 'false'"
        @click="activeCategory = category.key"
      >
        {{ category.label }}
      </button>
    </div>

    <div v-if="loading" class="font-market__empty">加载字体商店中…</div>

    <div v-else-if="filteredFonts.length === 0" class="font-market__empty">
      当前分类暂无字体
    </div>

    <div v-else class="font-market__grid">
      <FontMarketCard
        v-for="font in filteredFonts"
        :key="font.id"
        :font="font"
        @preview="openPreview"
        @download="downloadMarketFont"
      />
    </div>

    <FontPreviewDialog
      :visible="previewVisible"
      :font="previewFont"
      :default-preview-text="defaultPreviewText"
      @close="closePreview"
      @use-in-editor="useFontInEditor"
    />
  </section>
</template>

<style scoped>
.font-market {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: var(--theme-bg, #fff);
}

.font-market__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.font-market__header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.font-market__my-fonts-btn {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
  font-size: 13px;
  text-decoration: none;
}

.font-market__my-fonts-btn:hover {
  border-color: var(--theme-accent, #2563eb);
  color: var(--theme-accent, #2563eb);
}

.font-market__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--theme-fg, #0f172a);
}

.font-market__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--theme-fg-muted, #64748b);
}

.font-market__token {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg-subtle, #f8fafc);
  font-size: 14px;
}

.font-market__token-value {
  color: var(--theme-accent, #2563eb);
}

.font-market__recharge-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: var(--theme-accent, #2563eb);
  color: #fff;
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
}

.font-market__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.font-market__tab {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 999px;
  background: var(--theme-bg, #fff);
  color: var(--theme-fg, #334155);
  font-size: 13px;
  cursor: pointer;
}

.font-market__tab--active {
  border-color: var(--theme-accent, #2563eb);
  background: rgba(37, 99, 235, 0.08);
  color: var(--theme-accent, #2563eb);
}

.font-market__empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--theme-fg-muted, #64748b);
  font-size: 14px;
}

.font-market__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 960px) {
  .font-market__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .font-market__grid {
    grid-template-columns: 1fr;
  }
}
</style>
