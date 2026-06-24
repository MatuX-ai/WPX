<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <section class="wpx-section flex min-h-[70vh] items-center pt-32">
    <div class="wpx-container text-center">
      <div
        class="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-wpx-gradient text-5xl text-white shadow-wpx-glow"
      >
        404
      </div>
      <h1 class="mt-8 text-3xl font-extrabold md:text-5xl">
        <span class="wpx-gradient-text">这一页走丢了</span>
      </h1>
      <p class="mx-auto mt-4 max-w-md text-dark/60">
        也许链接过期了，也许它从未存在过。
        不如回到首页，从头开始？
      </p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          class="wpx-btn-primary"
          @click="router.push('/')"
        >
          回到首页
        </button>
        <button
          class="wpx-btn-ghost"
          @click="router.back()"
        >
          返回上一页
        </button>
      </div>
    </div>
  </section>
</template>
