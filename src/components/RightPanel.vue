<template>
  <aside class="right-panel">
    <div class="ai-assistant">
      <div class="ai-header"><i class="fa-solid fa-robot"></i> AI 计算助手</div>

      <div ref="chatRef" class="ai-chat">
        <div v-for="(m, idx) in messages" :key="idx" class="chat-message" :class="m.role" v-html="m.html"></div>
        <div v-if="pending" class="chat-message ai typing">正在解析计算需求...</div>
      </div>

      <div class="ai-input-area">
        <input
          ref="inputRef"
          v-model="draft"
          type="text"
          placeholder="输入您的计算需求..."
          @keyup.enter="send"
        />
        <button :disabled="pending" @click="send"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { reply } from '@/utils/assistant'
import { chat } from '@/api/ai'

const workbench = useWorkbenchStore()

const chatRef = ref(null)
const inputRef = ref(null)
const draft = ref('')
const pending = ref(false)

const messages = ref([
  {
    role: 'user',
    html: '帮我计算一个 10kg 物体在 100N 力作用下的加速度。'
  },
  {
    role: 'ai',
    html:
      '根据牛顿第二定律 F = m·a：<br>加速度 a = F / m = 100N / 10kg = <strong>10 m/s²</strong><br>' +
      '直接在这里输入需求，我会自动在中间打开对应的计算框并回填参数。'
  }
])

function scrollToEnd() {
  nextTick(() => {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
  })
}

/** 点击顶部“AI 助手”按钮时聚焦输入框 */
watch(
  () => workbench.activeItemKey,
  (key) => {
    if (key === 'ai-assistant') nextTick(() => inputRef.value?.focus())
  }
)

async function send() {
  const text = draft.value.trim()
  if (!text || pending.value) return
  messages.value.push({ role: 'user', html: escapeHtml(text) })
  draft.value = ''
  pending.value = true
  scrollToEnd()

  let html = ''
  try {
    // 配置了后端大模型接口时优先走接口，否则使用本地解析
    const remote = await chat(text, messages.value)
    html = remote || reply(text, workbench).html
  } catch (e) {
    html = reply(text, workbench).html
  } finally {
    pending.value = false
  }

  messages.value.push({ role: 'ai', html })
  scrollToEnd()
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
</script>
