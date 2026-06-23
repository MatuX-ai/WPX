import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  cancelZipOperation,
  compressPaths,
  extractArchive,
  isZipCancelled,
  listArchive,
  subscribeZipProgress,
} from '@/utils/zipApi'

export const MAX_ZIP_PROGRESS_ITEMS = 3

export const useZipStore = defineStore('zip', () => {
  const operations = ref([])
  let unsubscribeProgress = null

  const progress = computed(() => operations.value.find((item) => item.status === 'running') || null)

  const isBusy = computed(() => operations.value.some((item) => item.status === 'running'))

  function ensureProgressListener() {
    if (unsubscribeProgress) return

    unsubscribeProgress = subscribeZipProgress((payload) => {
      const index = operations.value.findIndex(
        (item) => item.operationId === payload.operationId && item.status === 'running',
      )
      if (index === -1) return

      operations.value[index] = {
        ...operations.value[index],
        percent: payload.percent,
        currentFile: payload.currentFile || '',
      }
    })
  }

  function trimFinishedOperations() {
    while (operations.value.length > MAX_ZIP_PROGRESS_ITEMS) {
      const removableIndex = operations.value.findIndex((item) => item.status !== 'running')
      if (removableIndex === -1) break
      operations.value.splice(removableIndex, 1)
    }
  }

  function beginOperation({ operationId, label, type }) {
    ensureProgressListener()
    operations.value.push({
      operationId,
      label,
      type,
      percent: 0,
      currentFile: '',
      status: 'running',
      error: '',
    })
  }

  function completeOperation(operationId, { status, error = '' }) {
    const target = operations.value.find((item) => item.operationId === operationId)
    if (!target) return

    target.status = status
    target.error = error
    if (status === 'success') {
      target.percent = 100
    }
    trimFinishedOperations()
  }

  function removeOperation(operationId) {
    operations.value = operations.value.filter((item) => item.operationId !== operationId)
  }

  function clearProgress() {
    operations.value = operations.value.filter((item) => item.status === 'running')
  }

  function createOperationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  async function runCompress(payload, label = '正在压缩…') {
    const operationId = createOperationId()
    beginOperation({ operationId, label, type: 'compress' })

    try {
      const result = await compressPaths({ ...payload, operationId })
      if (isZipCancelled(result)) {
        completeOperation(operationId, { status: 'cancelled' })
        return { cancelled: true, operationId }
      }
      if (!result.ok) {
        const message = result.error || result.message || '压缩失败'
        completeOperation(operationId, { status: 'error', error: message })
        throw new Error(message)
      }

      completeOperation(operationId, { status: 'success' })
      return { ...result, operationId }
    } catch (err) {
      const target = operations.value.find((item) => item.operationId === operationId)
      if (target?.status === 'running') {
        completeOperation(operationId, { status: 'error', error: err.message || '压缩失败' })
      }
      throw err
    }
  }

  async function runExtract(payload, label = '正在解压…') {
    const operationId = createOperationId()
    beginOperation({ operationId, label, type: 'extract' })

    try {
      const result = await extractArchive({ ...payload, operationId })
      if (isZipCancelled(result)) {
        completeOperation(operationId, { status: 'cancelled' })
        return { cancelled: true, operationId }
      }
      if (!result.ok) {
        const message = result.error || result.message || '解压失败'
        completeOperation(operationId, { status: 'error', error: message })
        throw new Error(message)
      }

      completeOperation(operationId, { status: 'success' })
      return { ...result, operationId }
    } catch (err) {
      const target = operations.value.find((item) => item.operationId === operationId)
      if (target?.status === 'running') {
        completeOperation(operationId, { status: 'error', error: err.message || '解压失败' })
      }
      throw err
    }
  }

  async function cancelOperation(operationId) {
    if (!operationId) return false

    const target = operations.value.find((item) => item.operationId === operationId)
    if (!target || target.status !== 'running') return false

    await cancelZipOperation(operationId)
    completeOperation(operationId, { status: 'cancelled' })
    return true
  }

  async function cancelCurrent() {
    const running = operations.value.find((item) => item.status === 'running')
    if (!running) return false
    return cancelOperation(running.operationId)
  }

  async function loadArchiveEntries(archivePath, password) {
    const result = await listArchive(archivePath, password)
    if (!result.ok) {
      throw new Error(result.error || result.message || '无法读取压缩包')
    }
    return result.files || []
  }

  return {
    operations,
    progress,
    isBusy,
    beginOperation,
    completeOperation,
    removeOperation,
    clearProgress,
    runCompress,
    runExtract,
    cancelOperation,
    cancelCurrent,
    loadArchiveEntries,
  }
})
