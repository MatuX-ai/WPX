<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { BookOpen, FileText, Library, Settings, Type } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { shortcutTooltip } from '@/composables/useGlobalShortcuts'
import { requestCreateAppWindow } from '@/composables/useCreateAppWindow'
import { isEditorRoute } from '@/utils/windowContext'
import { isElectron } from '@/utils/electron'

const router = useRouter()
const appStore = useAppStore()

const newDocumentTooltip = shortcutTooltip('新建文档', 'newDocument')

const navItems = [
  { label: '文档', to: '/editor', icon: FileText },
  { label: '文库', to: '/library', icon: Library },
  { label: '资料库', to: '/materials', icon: BookOpen },
  { label: '字体商店', to: '/fonts', icon: Type },
  { label: '设置', to: '/settings', icon: Settings },
]

async function handleNewDocument() {
  if (isElectron()) {
    await requestCreateAppWindow()
    return
  }

  if (!isEditorRoute(router.currentRoute.value)) {
    await router.push({ name: 'editor' })
  }
  appStore.requestNewDocument()
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
      <div class="flex items-center gap-8">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold text-slate-900">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white"
          >
            W
          </span>
          <span>WPX</span>
        </RouterLink>

        <nav class="hidden items-center gap-1 sm:flex" aria-label="主导航">
          <RouterLink
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="bg-brand-50 text-brand-700"
            :aria-label="`前往${item.label}`"
          >
            <component :is="item.icon" :size="16" aria-hidden="true" />
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          :title="newDocumentTooltip"
          :aria-label="newDocumentTooltip"
          @click="handleNewDocument"
        >
          新建文档
        </button>
        <RouterLink
          to="/settings"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          title="设置"
          aria-label="打开设置"
        >
          <Settings :size="16" aria-hidden="true" />
        </RouterLink>
      </div>
    </div>
  </header>
</template>
