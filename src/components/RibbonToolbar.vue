<template>
  <div ref="toolbarRef" class="ribbon-toolbar">
    <div v-for="group in visibleGroups" :key="group.key" class="ribbon-group">
      <div class="ribbon-buttons">
        <button
          v-for="item in group.items"
          :key="item.key"
          :class="[item.large ? 'ribbon-btn-lg' : 'ribbon-btn', { active: isActive(item) }]"
          :title="item.tip || item.label"
          @pointerdown="onItemPointerDown($event, item)"
          @click="onItemClick(item, $event)"
        >
          <i :class="item.icon"></i><span>{{ item.label }}</span>
        </button>
      </div>
      <div class="ribbon-label">{{ group.label }}</div>
    </div>

    <!-- 超出 3 行 × 4 列的按钮收进“更多” -->
    <div v-if="overflowGroups.length" class="ribbon-group ribbon-group-more">
      <div class="ribbon-buttons ribbon-buttons-more">
        <button class="ribbon-btn ribbon-more-btn" @click.stop="toggleMore">
          <i class="fa-solid fa-ellipsis"></i><span>更多</span>
          <i class="fa-solid fa-caret-down" style="margin-left: 2px; font-size: 10px"></i>
        </button>
      </div>
      <div class="ribbon-label">更多</div>

      <div class="ribbon-more-panel" :class="{ open: moreOpen }">
        <div class="ribbon-more-inner">
          <div v-for="group in overflowGroups" :key="group.key" class="ribbon-group">
            <div class="ribbon-buttons">
              <button
                v-for="item in group.items"
                :key="item.key"
                :class="[item.large ? 'ribbon-btn-lg' : 'ribbon-btn', { active: isActive(item) }]"
                :title="item.tip || item.label"
                @pointerdown="onItemPointerDown($event, item)"
                @click="onItemClick(item, $event)"
              >
                <i :class="item.icon"></i><span>{{ item.label }}</span>
              </button>
            </div>
            <div class="ribbon-label">{{ group.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { groupsOfMenu } from '@/config/ribbon'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { beginPointerDrag, treeDropTarget } from '@/utils/pointerDrag'
import { runViewerCommand } from '@/viewer/commands'
import { readViewerState, VIEWER_STATE_EVENT } from '@/viewer/viewerState'

/** 每个分组最多显示 3 行 × 4 列 */
const MAX_VISIBLE = 12
/** 一次性动作按钮的"按下"高亮时长（之后自动熄灭，避免看起来像一直选中） */
const FLASH_MS = 420

const workbench = useWorkbenchStore()
const toolbarRef = ref(null)
const moreOpen = ref(false)

/** 当前菜单对应的功能区分组 */
const groups = computed(() => groupsOfMenu(workbench.activeMenuKey))

const visibleGroups = computed(() =>
  groups.value.map((g) => ({ ...g, items: g.items.slice(0, MAX_VISIBLE) })).filter((g) => g.items.length)
)

const overflowGroups = computed(() =>
  groups.value.map((g) => ({ ...g, items: g.items.slice(MAX_VISIBLE) })).filter((g) => g.items.length)
)

/**
 * 选中态分两类：
 * 1) item.state（开关类 / 面板类）：高亮 = 真实状态，状态没了高亮就没了；
 * 2) 其它按钮（一次性动作）：只在点击后短暂高亮一下，不保留。
 */
const liveStates = ref({})
const flashedKey = ref('')
let flashTimer = null
let stateTimer = null

function refreshLiveStates() {
  const next = {}
  groups.value.forEach((g) => {
    g.items.forEach((item) => {
      if (item.state) next[item.key] = !!readViewerState(item.state)
    })
  })
  liveStates.value = next
}

function flash(key) {
  flashedKey.value = key
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashedKey.value = ''
    flashTimer = null
  }, FLASH_MS)
}

function isActive(item) {
  if (item.state) return !!liveStates.value[item.key]
  return flashedKey.value === item.key
}

function onItemClick(item, e) {
  moreOpen.value = false
  if (item.kind === 'action') {
    if (item.action === 'viewer') {
      // 模型查看：按钮 -> 查看器命令（实现在 src/viewer/commands.js）
      if (!item.state) flash(item.key)
      runViewerCommand(item.command, item.args)
      refreshLiveStates()
      return
    }
    // 其他动作类按钮（AI 助手）：保持"选中态"语义，由右侧面板监听后响应
    workbench.activeItemKey = item.key
    if (item.action === 'ai') workbench.setStatus('AI 助手已就绪，可在右侧输入计算需求', 0)
    return
  }
  // 每次点击都新建一个独立计算框；把按钮位置作为入场动画起点（窗口从按钮处"长出来"）
  workbench.openWindow(item.key, { origin: buttonOrigin(e) })
}

/** 功能按钮中心在 .window-layer 里的坐标（供计算框入场动画使用） */
function buttonOrigin(e) {
  const layer = document.querySelector('.window-layer')
  const el = e?.currentTarget
  if (!layer || !el) return null
  const lr = layer.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top }
}

/**
 * 拖拽：把功能拖到左侧浏览树里保存成方案
 * 用指针事件实现（不用 HTML5 draggable），这样轻微手抖不会吞掉点击
 */
function onItemPointerDown(e, item) {
  if (item.kind === 'action') return // 动作类按钮（AI 助手）不参与拖拽
  beginPointerDrag(e, {
    label: item.label,
    onStart: () => workbench.setStatus(`拖动「${item.label}」到左侧浏览树的文件夹里可保存为方案`, 0),
    onMove: (ev, el) => workbench.setDragTarget(treeDropTarget(ev, el)),
    onDrop: (ev, el) => {
      const target = treeDropTarget(ev, el)
      workbench.clearDragTarget()
      if (target.nodeId) {
        workbench.dropItemAtNode(item.key, target.nodeId, target.pos)
      } else if (target.folderKey) {
        workbench.dropItem(target.folderKey, item.key, null)
      } else {
        workbench.setStatus('拖到左侧浏览树的文件夹里才能保存为方案', 0)
      }
    },
    onCancel: () => workbench.clearDragTarget()
  })
}

function toggleMore() {
  moreOpen.value = !moreOpen.value
}

function onDocClick(e) {
  if (!moreOpen.value) return
  if (toolbarRef.value && !toolbarRef.value.contains(e.target)) moreOpen.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape') moreOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  // 命令执行完 / 面板开关后立即刷新；同时低频轮询兜底（引擎内部变化，比如测量结束）
  window.addEventListener(VIEWER_STATE_EVENT, refreshLiveStates)
  refreshLiveStates()
  stateTimer = setInterval(refreshLiveStates, 700)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener(VIEWER_STATE_EVENT, refreshLiveStates)
  if (stateTimer) clearInterval(stateTimer)
  if (flashTimer) clearTimeout(flashTimer)
  stateTimer = null
  flashTimer = null
})

// 切换菜单时颜色状态重算（不同菜单的按钮集合不同）
watch(() => workbench.activeMenuKey, refreshLiveStates)
</script>
