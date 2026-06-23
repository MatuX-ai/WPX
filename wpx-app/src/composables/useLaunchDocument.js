import { onMounted } from 'vue'
import { loadEditorDraft } from '@/composables/useAutoSave'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { getDocPathFromUrl, getWindowId } from '@/utils/windowContext'
import { loadDocumentFromPath } from '@/utils/launchDocument'

/**
 * 启动时根据 URL docPath 加载文档；多窗口模式下无 docPath 时打开空白文档。
 * @param {{
 *   onOpen: (payload: { path?: string, content: string, title?: string, format?: object | null }) => void,
 *   onBlank?: () => void,
 * }} handlers
 */
export function useLaunchDocument({ onOpen, onBlank }) {
  onMounted(async () => {
    const docPath = getDocPathFromUrl()

    if (docPath) {
      const payload = await loadDocumentFromPath(docPath)
      if (payload) {
        onOpen(payload)
      }
      return
    }

    const generalSettings = useGeneralSettingsStore()

    if (generalSettings.startupBehavior === 'restore-last') {
      const draft = loadEditorDraft()
      if (draft?.content) {
        onOpen({
          content: draft.content,
          title: draft.title,
        })
        return
      }
    }

    if (getWindowId() > 0 || generalSettings.startupBehavior === 'blank') {
      onBlank?.()
    }
  })
}
