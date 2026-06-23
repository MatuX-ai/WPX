<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { BUILT_IN_FONT_LICENSES } from '@/constants/builtInFontLicenses'
import {
  APP_NAME,
  APP_TAGLINE,
  FEEDBACK_URL,
  getCopyrightText,
  SEVEN_ZIP_DECLARATION,
  THIRD_PARTY_ACKNOWLEDGMENTS,
  WEBSITE_URL,
} from '@/constants/aboutInfo'
import {
  checkForAppUpdates,
  fetchAppInfo,
  openBuiltInFontLicense,
  openSevenZipLicense,
  readSevenZipLicense,
} from '@/utils/aboutApi'
import { isElectron } from '@/utils/electron'

const toast = useToast()

const appVersion = ref('')
const checkingUpdate = ref(false)
const updateMessage = ref('')
const sevenZipDialogVisible = ref(false)
const sevenZipLicenseText = ref('')
const sevenZipLoading = ref(false)

const copyrightText = computed(() => getCopyrightText())

onMounted(async () => {
  const info = await fetchAppInfo()
  appVersion.value = info.version || ''
})

async function handleCheckUpdate() {
  checkingUpdate.value = true
  updateMessage.value = ''

  try {
    const result = await checkForAppUpdates()
    updateMessage.value = result.message || ''

    if (result.status === 'available') {
      toast.info(result.message || '发现新版本')
      return
    }

    if (result.ok === false || result.status === 'error') {
      toast.error(result.message || '检查更新失败')
      return
    }

    toast.success(result.message || '当前已是最新版本')
  } catch (error) {
    toast.error(error?.message || '检查更新失败，请稍后重试')
  } finally {
    checkingUpdate.value = false
  }
}

async function handleOpenFontLicense(fontId) {
  try {
    const result = await openBuiltInFontLicense(fontId)
    if (result?.ok === false) {
      toast.error(result.error || '无法打开字体许可证')
    }
  } catch (error) {
    toast.error(error?.message || '无法打开字体许可证')
  }
}

async function handleShowSevenZipLicense() {
  sevenZipLoading.value = true

  try {
    const result = await readSevenZipLicense()
    if (!result?.ok || !result.content) {
      if (isElectron()) {
        const opened = await openSevenZipLicense()
        if (opened?.ok) {
          toast.success('已在系统默认应用中打开许可证')
          return
        }
      }
      throw new Error(result?.error || '无法读取 7-Zip 许可证')
    }

    sevenZipLicenseText.value = result.content
    sevenZipDialogVisible.value = true
  } catch (error) {
    toast.error(error?.message || '无法读取 7-Zip 许可证')
  } finally {
    sevenZipLoading.value = false
  }
}

async function handleOpenSevenZipLicenseExternally() {
  try {
    const result = await openSevenZipLicense()
    if (result?.ok) {
      toast.success('已在系统默认应用中打开许可证')
      return
    }
    toast.error(result?.error || '无法打开许可证文件')
  } catch (error) {
    toast.error(error?.message || '无法打开许可证文件')
  }
}

function closeSevenZipDialog() {
  sevenZipDialogVisible.value = false
}
</script>

<template>
  <section class="settings-panel about-panel">
    <header class="about-hero">
      <img class="about-hero__logo" src="/favicon.svg" width="64" height="64" alt="" />
      <div class="about-hero__text">
        <h2 class="about-hero__title">{{ APP_NAME }}</h2>
        <p class="about-hero__tagline">{{ APP_TAGLINE }}</p>
        <p v-if="appVersion" class="about-hero__version">版本 {{ appVersion }}</p>
      </div>
    </header>

    <div class="about-actions">
      <button
        type="button"
        class="settings-btn-primary"
        :disabled="checkingUpdate"
        @click="handleCheckUpdate"
      >
        {{ checkingUpdate ? '检查中…' : '检查更新' }}
      </button>
      <p v-if="updateMessage" class="about-update-message">{{ updateMessage }}</p>
    </div>

    <div class="settings-card about-section">
      <h3 class="settings-card__title">许可证</h3>

      <details class="about-collapse">
        <summary class="about-collapse__summary">开源字体许可证（{{ BUILT_IN_FONT_LICENSES.length }} 项）</summary>
        <div class="font-license-table-wrap">
          <table class="font-license-table">
            <thead>
              <tr>
                <th scope="col">字体</th>
                <th scope="col">作者</th>
                <th scope="col">许可证</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="font in BUILT_IN_FONT_LICENSES" :key="font.id">
                <td>{{ font.name }}</td>
                <td>{{ font.author }}</td>
                <td>{{ font.licenseType }}</td>
                <td>
                  <button
                    type="button"
                    class="font-license-link"
                    :disabled="!isElectron()"
                    @click="handleOpenFontLicense(font.id)"
                  >
                    查看
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <div class="about-seven-zip">
        <h4 class="about-subtitle">7-Zip LGPL 声明</h4>
        <p class="about-seven-zip__text">{{ SEVEN_ZIP_DECLARATION }}</p>
        <div class="about-seven-zip__actions">
          <button
            type="button"
            class="settings-btn-secondary"
            :disabled="sevenZipLoading"
            @click="handleShowSevenZipLicense"
          >
            {{ sevenZipLoading ? '加载中…' : '查看全文' }}
          </button>
          <button
            v-if="isElectron()"
            type="button"
            class="settings-btn-secondary"
            @click="handleOpenSevenZipLicenseExternally"
          >
            在系统中打开
          </button>
        </div>
      </div>
    </div>

    <div class="settings-card about-section">
      <h3 class="settings-card__title">第三方依赖致谢</h3>
      <p class="settings-card__desc">WPX 构建于以下开源项目与技术之上（简要清单，非完整列表）。</p>
      <ul class="about-deps">
        <li v-for="item in THIRD_PARTY_ACKNOWLEDGMENTS" :key="item.name">
          <strong>{{ item.name }}</strong>
          <span>{{ item.role }}</span>
        </li>
      </ul>
    </div>

    <div class="about-links">
      <a
        class="settings-link-card"
        :href="WEBSITE_URL"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div>
          <p class="settings-link-card__title">官方网站</p>
          <p class="settings-link-card__desc">{{ WEBSITE_URL }}</p>
        </div>
        <span class="settings-link-card__arrow" aria-hidden="true">↗</span>
      </a>

      <a class="settings-link-card" :href="FEEDBACK_URL">
        <div>
          <p class="settings-link-card__title">用户反馈</p>
          <p class="settings-link-card__desc">发送邮件告诉我们您的建议或问题</p>
        </div>
        <span class="settings-link-card__arrow" aria-hidden="true">↗</span>
      </a>
    </div>

    <footer class="about-footer">
      <p>{{ copyrightText }}</p>
    </footer>
  </section>

  <Teleport to="body">
    <Transition name="about-dialog">
      <div
        v-if="sevenZipDialogVisible"
        class="confirm-backdrop"
        @click.self="closeSevenZipDialog"
      >
        <div
          class="about-license-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seven-zip-license-title"
          @click.stop
        >
          <header class="about-license-dialog__header">
            <h3 id="seven-zip-license-title" class="about-license-dialog__title">7-Zip LGPL 许可证</h3>
            <button
              type="button"
              class="about-license-dialog__close"
              aria-label="关闭"
              @click="closeSevenZipDialog"
            >
              ×
            </button>
          </header>
          <pre class="about-license">{{ sevenZipLicenseText }}</pre>
          <footer class="about-license-dialog__footer">
            <button type="button" class="settings-btn-secondary" @click="closeSevenZipDialog">
              关闭
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './settings-shared.css';

.about-panel {
  max-width: 52rem;
}

.about-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.about-hero__logo {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  box-shadow: var(--theme-shadow-sm);
}

.about-hero__title {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--theme-fg);
}

.about-hero__tagline {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--theme-fg-muted);
}

.about-hero__version {
  margin: 0;
  font-size: 13px;
  color: var(--theme-fg-subtle);
}

.about-actions {
  margin-bottom: 24px;
}

.about-update-message {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--theme-fg-muted);
}

.about-section + .about-section {
  margin-top: 16px;
}

.about-collapse {
  margin-bottom: 20px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm, 6px);
  background: var(--theme-bg-subtle);
  padding: 0 14px;
}

.about-collapse__summary {
  cursor: pointer;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg);
  list-style: none;
}

.about-collapse__summary::-webkit-details-marker {
  display: none;
}

.about-collapse__summary::before {
  content: '▸ ';
  color: var(--theme-fg-subtle);
}

.about-collapse[open] .about-collapse__summary::before {
  content: '▾ ';
}

.about-collapse .font-license-table-wrap {
  padding-bottom: 14px;
}

.about-subtitle {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-fg);
}

.about-seven-zip__text {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--theme-fg-muted);
}

.about-seven-zip__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.about-deps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.about-deps li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--theme-border);
  font-size: 13px;
}

.about-deps li:last-child {
  border-bottom: none;
}

.about-deps strong {
  min-width: 140px;
  color: var(--theme-fg);
}

.about-deps span {
  color: var(--theme-fg-muted);
}

.about-links {
  margin-top: 16px;
}

.about-footer {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--theme-border);
  text-align: center;
}

.about-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--theme-fg-subtle);
}

.about-license-dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  max-height: min(80vh, 720px);
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-lg);
  overflow: hidden;
}

.about-license-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme-border);
}

.about-license-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-fg);
}

.about-license-dialog__close {
  border: none;
  background: transparent;
  padding: 0 4px;
  font-size: 24px;
  line-height: 1;
  color: var(--theme-fg-subtle);
  cursor: pointer;
}

.about-license-dialog__close:hover {
  color: var(--theme-fg);
}

.about-license-dialog .about-license {
  flex: 1;
  margin: 0;
  max-height: none;
}

.about-license-dialog__footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--theme-border);
}

.about-dialog-enter-active,
.about-dialog-leave-active {
  transition: opacity 0.15s ease;
}

.about-dialog-enter-from,
.about-dialog-leave-to {
  opacity: 0;
}
</style>
