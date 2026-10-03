<template>
  <main class="center-canvas">
    <!-- 模型查看：整个中栏就是 3D 查看器。
         v-if + v-show 组合的用意：
         - 只有**第一次进入**「模型查看」时才挂载查看器 → 刷新页面停留在别的界面时
           不会去加载 3D 引擎和模型（也就不会弹出"正在导入模型"）；
         - 挂载之后用 v-show 保留实例 → 切菜单再回来时不销毁，模型/视角/设置都还在。 -->
    <ModelViewer v-if="modelMounted" v-show="isModelView" />

    <!-- 计算工作台：浮动的计算框（同样用 v-show，切菜单不销毁图表与输入） -->
    <div v-show="!isModelView" class="window-layer">
      <!-- 空状态引导：靠上排布"常用计算"卡片（中栏没有计算框时显示） -->
      <CanvasEmptyState v-if="!workbench.windows.length" />
      <CalcWindow v-for="win in workbench.windows" :key="win.id" :win="win" />
    </div>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CalcWindow from '@/components/CalcWindow.vue'
import CanvasEmptyState from '@/components/CanvasEmptyState.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import { useWorkbenchStore } from '@/store/modules/workbench'

const workbench = useWorkbenchStore()
const isModelView = computed(() => workbench.activeMenuKey === 'model-view')

/** 是否曾经进入过模型查看（进入过一次后就一直保留查看器实例） */
const everOpened = ref(false)
watch(
  isModelView,
  (v) => {
    if (v) everOpened.value = true
  },
  { immediate: true }
)
const modelMounted = computed(() => isModelView.value || everOpened.value)
</script>
