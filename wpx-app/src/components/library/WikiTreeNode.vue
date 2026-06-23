<script setup>
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  depth: {
    type: Number,
    default: 0,
  },
  activePath: {
    type: String,
    default: '',
  },
  expandedFolders: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggle-folder', 'open', 'contextmenu'])

function toggleFolder(path) {
  emit('toggle-folder', path)
}

function openDocument(node) {
  emit('open', node)
}

function handleContextMenu(event) {
  event.preventDefault()
  emit('contextmenu', { node: props.node, event })
}
</script>

<template>
  <div v-if="node.type === 'folder'" class="wiki-tree__folder">
    <button
      type="button"
      class="wiki-tree__folder-btn"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="toggleFolder(node.path ?? '')"
      @contextmenu="handleContextMenu"
    >
      <span class="wiki-tree__chevron">
        {{ expandedFolders.has(node.path ?? '') ? '▾' : '▸' }}
      </span>
      <span class="wiki-tree__folder-icon">📁</span>
      <span class="wiki-tree__folder-name">{{ node.name || '根目录' }}</span>
    </button>

    <div v-if="expandedFolders.has(node.path ?? '')" class="wiki-tree__children">
      <WikiTreeNode
        v-for="child in node.children || []"
        :key="child.type === 'file' ? child.relativePath : child.path"
        :node="child"
        :depth="depth + 1"
        :active-path="activePath"
        :expanded-folders="expandedFolders"
        @toggle-folder="toggleFolder"
        @open="openDocument"
        @contextmenu="(payload) => emit('contextmenu', payload)"
      />
    </div>
  </div>

  <button
    v-else
    type="button"
    class="wiki-tree__file"
    :class="{ 'wiki-tree__file--active': activePath === node.relativePath }"
    :style="{ paddingLeft: `${depth * 16 + 12}px` }"
    @click="openDocument(node)"
    @contextmenu="handleContextMenu"
  >
    <span class="wiki-tree__file-icon">📄</span>
    <span class="wiki-tree__file-title">{{ node.title || node.name }}</span>
  </button>
</template>

<style scoped>
.wiki-tree__folder-btn,
.wiki-tree__file {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.wiki-tree__folder-btn {
  padding-top: 6px;
  padding-bottom: 6px;
  padding-right: 8px;
  color: #475569;
  font-size: 13px;
}

.wiki-tree__file {
  padding-top: 7px;
  padding-bottom: 7px;
  padding-right: 10px;
  border-radius: 8px;
  color: #334155;
  font-size: 13px;
}

.wiki-tree__file:hover,
.wiki-tree__file--active {
  background: #f5f3ff;
  color: #6d28d9;
}

.wiki-tree__chevron {
  width: 12px;
  color: #94a3b8;
  font-size: 11px;
}

.wiki-tree__file-title,
.wiki-tree__folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
