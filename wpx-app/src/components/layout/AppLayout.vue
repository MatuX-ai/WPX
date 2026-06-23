<script setup>
import { computed, onMounted, onUnmounted, provide, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useArchiveDropTarget } from '@/composables/useArchiveDrop'
import { useOpenSettings } from '@/composables/useOpenSettings'
import { useAppStore } from '@/stores/app'
import { useTrayStore } from '@/stores/tray'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { isEditorRoute } from '@/utils/windowContext'
import TitleBar from './TitleBar.vue'
import AppNavbar from './AppNavbar.vue'
import SaveDialog from '@/components/library/SaveDialog.vue'
import ToastNotification from '@/components/ui/ToastNotification.vue'
import ProgressBar from '@/components/zip/ProgressBar.vue'
import ZipArchiveHost from '@/components/archive/ZipArchiveHost.vue'
import TraySimulator from '@/components/tray/TraySimulator.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const trayStore = useTrayStore()
const { openSettings } = useOpenSettings()
const zipArchiveHostRef = ref(null)
const appShellRef = ref(null)

provide('zipArchiveHost', zipArchiveHostRef)

function handleDropArchives(paths) {
  zipArchiveHostRef.value?.openArchivePreviews?.(paths)
}

const { isArchiveDragOver } = useArchiveDropTarget(() => appShellRef.value, handleDropArchives)

const showNavbar = computed(() => !isEditorRoute(route))

function handleSaveDialogClose() {
  appStore.closeSaveDialog()
}

function handleDocumentSaved(item) {
  appStore.notifyDocumentSaved(item)
  trayStore.addRecentDocument(item)
}

let unsubscribeExternalFileRoute = null
let unsubscribeOpenArchive = null
let unsubscribeOpenSettings = null

onMounted(() => {
  if (!isElectron()) return

  const api = getElectronAPI()

  if (typeof api?.onOpenSettings === 'function') {
    unsubscribeOpenSettings = api.onOpenSettings(() => {
      openSettings()
    })
  }

  const subscribe = api?.files?.onOpenFile || api?.onOpenFile
  if (typeof subscribe === 'function') {
    unsubscribeExternalFileRoute = subscribe((payload) => {
      if (!isEditorRoute(route)) {
        appStore.queueExternalFile(payload)
        router.push({ name: 'editor' })
        return
      }

      if (!appStore.hasOpenDocument) {
        appStore.queueExternalFile(payload)
        appStore.openDocument()
      }
    })
  }

  const subscribeArchive = api?.files?.onOpenArchive || api?.onOpenArchive
  if (typeof subscribeArchive === 'function') {
    unsubscribeOpenArchive = subscribeArchive((payload) => {
      const archivePath = payload?.archivePath
      if (!archivePath) return
      zipArchiveHostRef.value?.openArchivePreview?.(archivePath)
    })
  }
})

onUnmounted(() => {
  unsubscribeOpenSettings?.()
  unsubscribeExternalFileRoute?.()
  unsubscribeOpenArchive?.()
})
</script>

<template>
  <div
    v-show="trayStore.mainWindowVisible"
    ref="appShellRef"
    class="app-shell"
    :class="{ 'app-shell--archive-drag': isArchiveDragOver }"
  >
    <TitleBar
      :document-name="appStore.documentTitle"
      :save-status="appStore.documentSaveStatus"
      :save-status-refresh-tick="appStore.saveStatusRefreshTick"
    />
    <AppNavbar v-if="showNavbar" />

    <main class="app-main" :class="{ 'app-main--immersive': !showNavbar }">
      <RouterView />
    </main>

    <SaveDialog
      :visible="appStore.saveDialog.open"
      :content="appStore.saveDialog.content"
      :default-title="appStore.saveDialog.defaultTitle"
      @close="handleSaveDialogClose"
      @saved="handleDocumentSaved"
    />

    <ToastNotification />
    <ProgressBar />
    <ZipArchiveHost ref="zipArchiveHostRef" />
  </div>

  <TraySimulator v-if="trayStore.isHiddenToTray" />
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--theme-bg);
  color: var(--theme-fg);
}

.app-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.app-main--immersive {
  overflow: hidden;
}

.app-shell--archive-drag {
  outline: 2px dashed #8b5cf6;
  outline-offset: -4px;
}
</style>
