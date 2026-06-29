<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  rows: {
    type: Number,
    default: 3,
  },
  cols: {
    type: Number,
    default: 3,
  },
})

const emit = defineEmits(['confirm', 'cancel', 'update:rows', 'update:cols'])

function clamp(value, min, max) {
  const n = Number(value)
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function onRowsInput(event) {
  emit('update:rows', clamp(event.target.value, 1, 20))
}

function onColsInput(event) {
  emit('update:cols', clamp(event.target.value, 1, 20))
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4"
    style="z-index: var(--z-modal, 1100)"
    @click.self="emit('cancel')"
  >
    <div
      class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      role="dialog"
      aria-labelledby="table-dialog-title"
    >
      <h3 id="table-dialog-title" class="text-base font-semibold text-slate-900">
        插入表格
      </h3>
      <p class="mt-1 text-sm text-slate-500">设置表格行数与列数（首行作为表头）</p>

      <div class="mt-4 grid grid-cols-2 gap-4">
        <label class="block text-sm text-slate-700">
          行数
          <input
            type="number"
            min="1"
            max="20"
            class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            :value="rows"
            @input="onRowsInput"
          />
        </label>
        <label class="block text-sm text-slate-700">
          列数
          <input
            type="number"
            min="1"
            max="20"
            class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            :value="cols"
            @input="onColsInput"
          />
        </label>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          @click="emit('confirm')"
        >
          插入 {{ rows }}×{{ cols }}
        </button>
      </div>
    </div>
  </div>
</template>
