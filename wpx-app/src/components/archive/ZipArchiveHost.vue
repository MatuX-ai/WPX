<script setup>
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import {
  buildDefaultOutputPath,
  getLibraryRoot,
  isArchivePath,
  joinLibraryAbsolutePath,
  MAX_ARCHIVE_PREVIEWS,
  pickExtractDirectory,
  zipFeatureAvailable,
} from '@/utils/zipApi'
import {
  collectDocumentPackSources,
  dirname,
  writeDocumentContent,
} from '@/utils/documentPack'
import CompressDialog from '@/components/zip/CompressDialog.vue'
import ArchivePreview from '@/components/zip/ArchivePreview.vue'
import { useZipStore } from '@/stores/zip'

const toast = useToast()
const appStore = useAppStore()
const zipStore = useZipStore()

const compressVisible = ref(false)
const compressTargetPaths = ref([])

const archivePreviews = ref([])

function createPreviewId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function closeArchivePreview(id) {
  archivePreviews.value = archivePreviews.value.filter((item) => item.id !== id)
}

function openArchivePreviews(paths = []) {
  if (!zipFeatureAvailable()) {
    toast.error('压缩包预览仅在 WPX 桌面端可用')
    return
  }

  const incoming = [...new Set(paths.filter((item) => isArchivePath(item)))]
  if (!incoming.length) return

  let skipped = 0
  const next = [...archivePreviews.value]

  for (const archivePath of incoming) {
    const existingIndex = next.findIndex(
      (item) => item.archivePath.toLowerCase() === archivePath.toLowerCase(),
    )

    if (existingIndex >= 0) {
      const [existing] = next.splice(existingIndex, 1)
      next.push(existing)
      continue
    }

    while (next.length >= MAX_ARCHIVE_PREVIEWS) {
      next.shift()
      skipped += 1
    }

    next.push({
      id: createPreviewId(),
      archivePath,
    })
  }

  archivePreviews.value = next

  if (skipped > 0) {
    toast.info(`最多同时预览 ${MAX_ARCHIVE_PREVIEWS} 个压缩包，已替换最早打开的窗口`)
  }
}

function openArchivePreview(archivePath) {
  openArchivePreviews([archivePath])
}

function openCompressDialog({ sources }) {
  if (!zipFeatureAvailable()) {
    toast.error('压缩功能仅在 WPX 桌面端可用，且需要内置 7za')
    return
  }

  compressTargetPaths.value = sources
  compressVisible.value = true
}

function handleCompressClose() {
  compressVisible.value = false
}

async function resolveLibraryAbsolutePath(relativePath) {
  const root = await getLibraryRoot()
  if (!root) throw new Error('无法获取文库根目录')
  return joinLibraryAbsolutePath(root, relativePath)
}

async function resolveNodeSources(node) {
  if (node.type === 'file') {
    return [await resolveLibraryAbsolutePath(node.relativePath)]
  }

  if (node.type === 'folder') {
    const folderPath = node.path ? await resolveLibraryAbsolutePath(node.path) : await getLibraryRoot()
    if (!folderPath) throw new Error('无法获取文件夹路径')
    return [folderPath]
  }

  throw new Error('无法准备压缩路径')
}

async function openLibraryCompress(node) {
  try {
    const sources = await resolveNodeSources(node)
    openCompressDialog({ sources })
  } catch (err) {
    toast.error(err.message || '无法准备压缩路径')
  }
}

async function openLibraryQuickCompress(node) {
  try {
    const sources = await resolveNodeSources(node)
    const outputPath = buildDefaultOutputPath(sources, '7z')
    const result = await zipStore.runCompress(
      {
        sources,
        outputPath,
        format: '7z',
        level: 5,
      },
      '正在压缩…',
    )

    if (result?.cancelled) return

    toast.success(`压缩完成：${result.outputPath || outputPath}`)
    appStore.bumpLibraryRefresh()
  } catch (err) {
    toast.error(err.message || '压缩失败')
  }
}

async function openLibraryArchive(node) {
  try {
    const archivePath = await resolveLibraryAbsolutePath(node.relativePath)
    openArchivePreview(archivePath)
  } catch (err) {
    toast.error(err.message || '无法打开压缩包')
  }
}

async function extractArchiveHere(archivePath) {
  const lastSep = Math.max(archivePath.lastIndexOf('\\'), archivePath.lastIndexOf('/'))
  const parentDir = lastSep >= 0 ? archivePath.slice(0, lastSep) : archivePath
  const fileName = lastSep >= 0 ? archivePath.slice(lastSep + 1) : archivePath
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'extracted'
  const sep = archivePath.includes('\\') ? '\\' : '/'
  const outputDir = `${parentDir}${sep}${baseName}`

  const result = await zipStore.runExtract({ archivePath, outputDir }, '正在解压…')
  if (result?.cancelled) return

  toast.success(`解压完成：${outputDir}`)
  appStore.bumpLibraryRefresh()
}

async function openLibraryExtractHere(node) {
  try {
    const archivePath = await resolveLibraryAbsolutePath(node.relativePath)
    await extractArchiveHere(archivePath)
  } catch (err) {
    toast.error(err.message || '解压失败')
  }
}

async function openLibraryExtractTo(node) {
  try {
    const archivePath = await resolveLibraryAbsolutePath(node.relativePath)
    const defaultDir = archivePath.replace(/[\\/][^\\/]+$/, '')
    const pickResult = await pickExtractDirectory(defaultDir)
    if (!pickResult.ok || pickResult.canceled || !pickResult.directoryPath) return

    const result = await zipStore.runExtract(
      { archivePath, outputDir: pickResult.directoryPath },
      '正在解压…',
    )
    if (result?.cancelled) return

    toast.success(`解压完成：${pickResult.directoryPath}`)
    appStore.bumpLibraryRefresh()
  } catch (err) {
    toast.error(err.message || '解压失败')
  }
}

async function packDocument({ documentPath, markdown, format = '7z' }) {
  if (!zipFeatureAvailable()) {
    toast.error('打包功能仅在 WPX 桌面端可用，且需要内置 7za')
    return
  }

  if (!documentPath) {
    toast.warning('请先保存文档到本地路径后再打包')
    return
  }

  try {
    await writeDocumentContent(documentPath, markdown)
    const sources = await collectDocumentPackSources(documentPath, markdown)
    const outputPath = buildDefaultOutputPath([documentPath], format)
    const result = await zipStore.runCompress(
      {
        sources,
        outputPath,
        format,
        level: 5,
        archiveBaseDir: dirname(documentPath),
      },
      format === 'zip' ? '正在打包为 zip…' : '正在打包为 7z…',
    )

    if (result?.cancelled) return

    const imageCount = Math.max(0, sources.length - 1)
    const suffix = imageCount > 0 ? `（含 ${imageCount} 张本地图片）` : ''
    toast.success(`打包完成：${result.outputPath || outputPath}${suffix}`)
  } catch (err) {
    toast.error(err.message || '打包失败')
  }
}

function openDocumentCompress(documentPath) {
  if (!documentPath) {
    toast.warning('请先保存文档后再打包')
    return
  }

  openCompressDialog({ sources: [documentPath] })
}

defineExpose({
  openCompressDialog,
  openLibraryCompress,
  openLibraryQuickCompress,
  openLibraryArchive,
  openLibraryExtractHere,
  openLibraryExtractTo,
  openArchivePreview,
  openArchivePreviews,
  packDocument,
  openDocumentCompress,
  isArchivePath,
  zipFeatureAvailable,
})
</script>

<template>
  <CompressDialog
    :visible="compressVisible"
    :target-paths="compressTargetPaths"
    @close="handleCompressClose"
  />

  <ArchivePreview
    v-for="(preview, index) in archivePreviews"
    :key="preview.id"
    :visible="true"
    :archive-path="preview.archivePath"
    :stack-index="index"
    @close="closeArchivePreview(preview.id)"
  />
</template>
