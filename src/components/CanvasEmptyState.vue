<template>
  <!-- 中栏空状态：靠上排布"常用计算"卡片（中栏没有计算框时显示，不再是一片空旷） -->
  <div class="empty-guide">
    <div class="empty-guide__label">常用计算</div>
    <div class="empty-guide__cards">
      <button
        v-for="card in cards"
        :key="card.key"
        class="empty-card"
        :title="card.tip"
        @click="openCard(card.key, $event)"
      >
        <i :class="card.icon"></i>
        <span class="empty-card__label">{{ card.label }}</span>
        <span class="empty-card__hint">{{ card.hint }}</span>
      </button>
    </div>

    <!-- 最近三次计算记录：点一下调出当时的标签与参数 -->
    <template v-if="history.length">
      <div class="empty-guide__label empty-guide__label--history">
        计算记录（最近三次）
        <button class="empty-guide__clear" title="清空计算记录" @click="clearHistory">
          <i class="fa-solid fa-trash-can"></i> 清空
        </button>
      </div>
      <div class="empty-guide__cards empty-guide__cards--history">
        <button
          v-for="(entry, idx) in history"
          :key="entry.at + '-' + idx"
          class="empty-card history-card"
          :title="entry.nodes.map((n) => n.label).join('、')"
          @click="restore(entry)"
        >
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span class="empty-card__label">
            {{ idx === 0 ? '最近一次' : `${idx + 1} 次前` }} · {{ entry.nodes.length }} 个计算
          </span>
          <span class="empty-card__hint">{{ formatTime(entry.at) }} · {{ previewLabels(entry) }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { findItem } from '@/config/ribbon'
import { useWorkbenchStore } from '@/store/modules/workbench'

/** 空状态展示的常用功能（都是功能区里真实存在的按钮） */
const CARD_KEYS = [
  'mech-newton2',
  'mech-friction',
  'kin-accel',
  'kin-circular',
  'inertia-rod-center',
  'inertia-ring',
  'unit-force',
  'math-sin'
]

const workbench = useWorkbenchStore()

const cards = computed(() =>
  CARD_KEYS.map((key) => findItem(key))
    .filter(Boolean)
    .map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      tip: item.tip || item.label,
      hint: item.desc || item.expr || item.groupLabel || ''
    }))
)

/** 点卡片 = 点功能区按钮；并把卡片位置作为窗口入场动画的起点 */
function openCard(key, e) {
  const layer = document.querySelector('.window-layer')
  const el = e?.currentTarget
  let origin = null
  if (layer && el) {
    const lr = layer.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    origin = { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top }
  }
  workbench.openWindow(key, { origin })
}

// ------------------------------------------------------------ 计算记录
const history = computed(() => workbench.calcHistory || [])

function formatTime(at) {
  const d = new Date(at || Date.now())
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function previewLabels(entry) {
  const labels = (entry.nodes || []).map((n) => n.label).filter(Boolean)
  const head = labels.slice(0, 3).join('、')
  return labels.length > 3 ? `${head}…` : head
}

function restore(entry) {
  workbench.restoreHistory(entry)
}

function clearHistory() {
  workbench.clearHistory()
  workbench.setStatus('已清空计算记录', 2000)
}
</script>

<style scoped>
.empty-guide {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: min(736px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  align-items: center; /* 卡片整体水平居中 */
  gap: 8px;
  pointer-events: none; /* 空白处不挡操作，仅卡片可点 */
  animation: mc-guide-in 240ms cubic-bezier(0.2, 0, 0.2, 1);
}
@keyframes mc-guide-in {
  from {
    opacity: 0;
    transform: translate(-50%, -6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
.empty-guide__label {
  align-self: flex-start; /* 标题与卡片左对齐 */
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}
.empty-guide__label--history {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.empty-guide__clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  pointer-events: auto;
}
.empty-guide__clear:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.empty-guide__cards--history .history-card {
  border-style: dashed;
}
.empty-guide__cards--history .history-card:hover {
  border-style: solid;
}
.empty-guide__cards {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.empty-card {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  text-align: left;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.12s, background-color 0.12s, transform 0.12s;
}
.empty-card:hover {
  border-color: var(--accent);
  background-color: var(--bg-toolbar-hover);
  transform: translateY(-1px);
}
.empty-card i {
  color: var(--accent);
  font-size: 14px;
  margin-bottom: 2px;
}
.empty-card__label {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
}
.empty-card__hint {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
