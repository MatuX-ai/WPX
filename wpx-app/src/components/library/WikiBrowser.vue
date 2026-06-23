<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { fetchLibraryTree, searchLibrary } from '@/utils/libraryApi'
import { isZipOr7zArchive, zipFeatureAvailable } from '@/utils/zipApi'
import { isElectron } from '@/utils/electron'
import { useAppStore } from '@/stores/app'
import WikiTreeNode from '@/components/library/WikiTreeNode.vue'

const props = defineProps({
  activePath: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['open', 'refresh'])

const appStore = useAppStore()
const zipArchiveHost = inject('zipArchiveHost', ref(null))

const loading = ref(false)
const error = ref('')
const tree = ref(null)
const tags = ref([])
const total = ref(0)
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const expandedFolders = ref(new Set(['']))
const activeTag = ref('')
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  node: null,
})

const archiveFeatureEnabled = computed(() => isElectron() && zipFeatureAvailable())

const isSearchMode = computed(() => searchQuery.value.trim().length > 0)

const displayTags = computed(() => {
  if (!activeTag.value) return tags.value
  return tags.value.filter((item) => item.tag === activeTag.value)
})

async function loadTree() {
  loading.value = true
  error.value = ''

  try {
    const data = await fetchLibraryTree()
    tree.value = data.tree
    tags.value = data.tags || []
    total.value = data.total || 0
    emit('refresh', data)
  } catch (err) {
    error.value = err.message || '加载文库失败'
  } finally {
    loading.value = false
  }
}

let searchTimer = null

async function runSearch(query) {
  const keyword = query.trim()
  if (!keyword) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  error.value = ''

  try {
    const data = await searchLibrary(keyword)
    searchResults.value = data.items || []
  } catch (err) {
    error.value = err.message || '搜索失败'
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function onSearchInput() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    runSearch(searchQuery.value)
  }, 280)
}

function toggleFolder(path) {
  const next = new Set(expandedFolders.value)
  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }
  expandedFolders.value = next
}

function openDocument(node) {
  if (!node?.relativePath) return
  emit('open', {
    relativePath: node.relativePath,
    title: node.title || node.name,
    path: node.path,
    tags: node.tags || [],
  })
}

function handleTagClick(tag) {
  activeTag.value = activeTag.value === tag ? '' : tag
  searchQuery.value = tag
  runSearch(tag)
}

function closeContextMenu() {
  contextMenu.value.visible = false
  contextMenu.value.node = null
}

function canShowArchiveMenu(node) {
  if (!node) return false
  if (node.type === 'folder') return true
  if (node.type === 'file') return Boolean(node.relativePath)
  return false
}

function isZipOr7zFile(node) {
  return node?.type === 'file' && isZipOr7zArchive(node.relativePath)
}

function handleTreeContextMenu({ node, event }) {
  if (!archiveFeatureEnabled.value || !canShowArchiveMenu(node)) return

  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node,
  }
}

function runArchiveAction(action) {
  const host = zipArchiveHost.value
  const node = contextMenu.value.node
  closeContextMenu()
  if (!host || !node) return
  action(host, node)
}

function handleGlobalClick() {
  if (contextMenu.value.visible) closeContextMenu()
}

onMounted(() => {
  loadTree()
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})

function ensureParentExpanded(relativePath) {
  if (!relativePath) return

  const parts = relativePath.split('/')
  parts.pop()
  let current = ''
  const next = new Set(expandedFolders.value)

  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    next.add(current)
  }

  expandedFolders.value = next
}

watch(
  () => appStore.libraryRefreshTick,
  () => {
    loadTree()
  },
)

watch(
  () => props.activePath,
  (path) => {
    if (path) ensureParentExpanded(path)
  },
  { immediate: true },
)

defineExpose({ reload: loadTree })
</script>

<template>
  <div class="wiki-browser">
    <div class="wiki-browser__toolbar">
      <input
        v-model="searchQuery"
        type="search"
        class="wiki-browser__search"
        placeholder="搜索标题、标签、正文…"
        @input="onSearchInput"
      />
      <button type="button" class="wiki-browser__refresh" :disabled="loading" @click="loadTree">
        刷新
      </button>
    </div>

    <p v-if="error" class="wiki-browser__error">{{ error }}</p>

    <div class="wiki-browser__main">
      <section class="wiki-browser__tree-panel">
        <div class="wiki-browser__panel-head">
          <h3 class="wiki-browser__panel-title">目录</h3>
          <span class="wiki-browser__count">{{ total }} 篇</span>
        </div>

        <div v-if="loading" class="wiki-browser__empty">加载中…</div>
        <div v-else-if="isSearchMode">
          <p v-if="searching" class="wiki-browser__empty">搜索中…</p>
          <p v-else-if="!searchResults.length" class="wiki-browser__empty">无匹配结果</p>
          <ul v-else class="wiki-browser__results">
            <li v-for="item in searchResults" :key="item.relativePath">
              <button
                type="button"
                class="wiki-browser__result"
                :class="{ 'wiki-browser__result--active': activePath === item.relativePath }"
                @click="openDocument(item)"
              >
                <span class="wiki-browser__result-title">{{ item.title }}</span>
                <span class="wiki-browser__result-path">{{ item.path || '根目录' }}</span>
                <span v-if="item.snippet" class="wiki-browser__result-snippet">{{ item.snippet }}</span>
                <span v-if="item.tags?.length" class="wiki-browser__result-tags">
                  <span v-for="tag in item.tags" :key="tag" class="wiki-browser__result-tag">{{ tag }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
        <div v-else-if="tree" class="wiki-browser__tree">
          <WikiTreeNode
            :node="tree"
            :active-path="activePath"
            :expanded-folders="expandedFolders"
            @toggle-folder="toggleFolder"
            @open="openDocument"
            @contextmenu="handleTreeContextMenu"
          />
        </div>
        <p v-else class="wiki-browser__empty">暂无文档</p>
      </section>

      <aside class="wiki-browser__tags-panel">
        <div class="wiki-browser__panel-head">
          <h3 class="wiki-browser__panel-title">标签云</h3>
          <button
            v-if="activeTag"
            type="button"
            class="wiki-browser__clear-tag"
            @click="handleTagClick(activeTag)"
          >
            清除筛选
          </button>
        </div>

        <div v-if="!displayTags.length" class="wiki-browser__empty">暂无标签</div>
        <div v-else class="wiki-browser__tag-cloud">
          <button
            v-for="item in displayTags"
            :key="item.tag"
            type="button"
            class="wiki-browser__tag"
            :class="{ 'wiki-browser__tag--active': activeTag === item.tag }"
            :style="{ fontSize: `${12 + Math.min(item.count, 8) * 1.5}px` }"
            @click="handleTagClick(item.tag)"
          >
            {{ item.tag }}
            <span class="wiki-browser__tag-count">{{ item.count }}</span>
          </button>
        </div>
      </aside>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="contextMenu.visible && contextMenu.node"
      class="wiki-browser__context-menu"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      @click.stop
    >
      <template v-if="isZipOr7zFile(contextMenu.node)">
        <button type="button" @click="runArchiveAction((host, node) => host.openLibraryExtractHere(node))">
          解压到当前文件夹
        </button>
        <button type="button" @click="runArchiveAction((host, node) => host.openLibraryExtractTo(node))">
          解压到…
        </button>
        <button type="button" @click="runArchiveAction((host, node) => host.openLibraryArchive(node))">
          预览压缩包内容
        </button>
        <div class="wiki-browser__context-menu-divider" role="separator" />
      </template>
      <button type="button" @click="runArchiveAction((host, node) => host.openLibraryQuickCompress(node))">
        压缩为 .7z
      </button>
      <button type="button" @click="runArchiveAction((host, node) => host.openLibraryCompress(node))">
        压缩…
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.wiki-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 420px;
}

.wiki-browser__toolbar {
  display: flex;
  gap: 8px;
}

.wiki-browser__search {
  flex: 1;
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  color: #0f172a;
  outline: none;
}

.wiki-browser__search:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
}

.wiki-browser__refresh {
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 0 14px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

.wiki-browser__refresh:hover:not(:disabled) {
  background: #f8fafc;
}

.wiki-browser__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wiki-browser__error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.wiki-browser__main {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.8fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.wiki-browser__tree-panel,
.wiki-browser__tags-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.wiki-browser__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.wiki-browser__panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.wiki-browser__count {
  font-size: 11px;
  color: #94a3b8;
}

.wiki-browser__clear-tag {
  border: none;
  background: transparent;
  color: #7c3aed;
  font-size: 11px;
  cursor: pointer;
}

.wiki-browser__tree,
.wiki-browser__results,
.wiki-browser__tag-cloud {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.wiki-browser__empty {
  padding: 24px 14px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.wiki-browser__results {
  margin: 0;
  padding: 8px;
  list-style: none;
}

.wiki-browser__result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  margin-bottom: 6px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.wiki-browser__result:hover,
.wiki-browser__result--active {
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.wiki-browser__result-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.wiki-browser__result-path {
  font-size: 11px;
  color: #94a3b8;
}

.wiki-browser__result-snippet {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.wiki-browser__result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.wiki-browser__result-tag {
  padding: 1px 6px;
  border-radius: 999px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 10px;
}

.wiki-browser__tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.wiki-browser__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  color: #475569;
  line-height: 1.2;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.wiki-browser__tag:hover,
.wiki-browser__tag--active {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #6d28d9;
}

.wiki-browser__tag-count {
  font-size: 10px;
  opacity: 0.75;
}

@media (max-width: 900px) {
  .wiki-browser__main {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.wiki-browser__context-menu {
  position: fixed;
  z-index: var(--z-modal);
  min-width: 168px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 6px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.15);
}

.wiki-browser__context-menu button {
  display: block;
  width: 100%;
  border: none;
  border-radius: 8px;
  background: transparent;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
}

.wiki-browser__context-menu button:hover {
  background: #f5f3ff;
  color: #6d28d9;
}

.wiki-browser__context-menu-divider {
  height: 1px;
  margin: 6px 4px;
  background: #e2e8f0;
}
</style>
