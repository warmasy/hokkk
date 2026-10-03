<template>
  <footer class="status-bar">
    <div class="status-left">
      <span>
        <i class="fa-solid fa-circle-check" :style="{ color: 'var(--success)' }"></i>
        <span>{{ workbench.statusText }}</span>
      </span>
      <span>耗时: <span>{{ workbench.statusSeconds }}</span>s</span>
      <template v-if="hint">
        <span>|</span>
        <span>{{ hint }}</span>
      </template>
    </div>
    <div class="status-right">
      <span>单位: {{ unitText }}</span>
      <span><i class="fa-solid fa-gear" title="偏好设置" @click="onSetting"></i></span>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { useModelViewStore } from '@/store/modules/modelView'
import modal from '@/plugins/modal'

const workbench = useWorkbenchStore()
const modelView = useModelViewStore()

const hint = computed(() => {
  if (workbench.activeMenuKey === 'model-view') {
    const s = modelView.stats
    if (!modelView.hasModel) return '把 3D 模型拖到中栏，或用功能区「打开模型」/ 示例按钮'
    const tri = s.triangles ? ` · ${s.triangles.toLocaleString()} 面` : ''
    return `零件 ${s.partCount} 个（显示 ${modelView.visibleParts}）${tri}`
  }
  const count = workbench.windows.length
  if (!count) return ''
  return `已打开 ${count} 个计算框`
})

const unitText = computed(() => {
  if (workbench.activeMenuKey === 'model-view') {
    return modelView.hasModel ? `模型: ${modelView.modelName || '未命名'}` : '模型查看'
  }
  return workbench.activeItem?.kind === 'unit' ? '单位换算模式' : '公制 (mm, kW, N·m)'
})
function onSetting() {
  modal.msg({ message: '主题可在右上角图标处循环切换：亮色 / 暗色 / 科技蓝 / 翡翠绿', type: 'info' })
}
</script>
