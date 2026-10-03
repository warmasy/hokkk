<template>
  <div class="workspace">
    <AppHeader />
    <RibbonToolbar />
    <div class="main-container">
      <LeftPanel />
      <CenterCanvas />
      <RightPanel />
    </div>
    <StatusBar />

    <!-- 标签数量达到上限时的"选择要删除的标签"弹窗（可多选） -->
    <TagLimitDialog />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import RibbonToolbar from '@/components/RibbonToolbar.vue'
import LeftPanel from '@/components/LeftPanel.vue'
import CenterCanvas from '@/components/CenterCanvas.vue'
import RightPanel from '@/components/RightPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import TagLimitDialog from '@/components/TagLimitDialog.vue'
import { useWorkbenchStore } from '@/store/modules/workbench'

const workbench = useWorkbenchStore()

let unsubscribe = null
let saveTimer = null
let savedOnLeave = false

/**
 * 存一条"计算记录"：只记录当前打开的计算框与它们的参数（最多留最近 3 条）。
 * 触发时机：状态变化后防抖 1.5s、页面隐藏/离开时立即——
 * 这样即使浏览器不触发 beforeunload（例如 headless / 某些刷新方式）也不会漏记。
 */
function saveRecord() {
  workbench.saveHistory()
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveRecord, 1500)
}
function saveOnLeave() {
  if (savedOnLeave) return
  savedOnLeave = true
  saveRecord()
}
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') saveRecord()
}

onMounted(() => {
  // 刷新后**不做工作区恢复**：计算树 / 计算框都从空白开始，就像新打开页面一样。
  // 只读取"最近三次计算记录"，首页（中栏空状态）里点一下即可调出当时的标签与参数。
  workbench.loadHistory()
  unsubscribe = workbench.$subscribe(() => scheduleSave(), { detached: true })
  window.addEventListener('pagehide', saveOnLeave)
  window.addEventListener('beforeunload', saveOnLeave)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
  if (saveTimer) clearTimeout(saveTimer)
  window.removeEventListener('pagehide', saveOnLeave)
  window.removeEventListener('beforeunload', saveOnLeave)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
</style>
