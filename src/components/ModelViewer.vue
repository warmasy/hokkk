<template>
  <!-- 模型查看：直接复用原项目已跑通的 3D 查看器实现，填满中栏，不加额外卡片 -->
  <main ref="rootRef" class="center-canvas model-canvas">
    <ModelViewerPage />
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ModelViewerPage from '@/views/model-viewer/index.vue'
import { modelViewer } from '@/viewer/modelController'
import { setSolidWorksDefaultView } from '@/views/model-viewer/composables/useModelDisplay.js'
import { initO3dvDialogTheme, disposeO3dvDialogTheme, placeO3dvCards } from '@/viewer/o3dvDialogs'
import { placeAllPanelOverlays } from '@/viewer/o3dvPanels'
import { useModelViewStore } from '@/store/modules/modelView'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { useThemeStore } from '@/store/modules/theme'
import { watch } from 'vue'

const view = useModelViewStore()
const workbench = useWorkbenchStore()
const themeStore = useThemeStore()
const rootRef = ref(null)

/**
 * 原项目的查看器自己负责加载/渲染，这里只做“状态同步”：
 * 轮询 O3DV 实例，把零件、统计、模型名同步给左侧零件树和状态栏。
 * （不用事件回调，避免和原实现的 SetWebsiteEventHandler 互相覆盖）
 */
let timer = null
let lastSignature = ''
let captured = false
let healStreak = 0

/**
 * 自愈：O3DV 在"加载 / 可视化 / 布局"阶段偶尔会把画布算错或把相机算飞，
 * 表现为"模型一闪就没了、有时又不显示"：
 *   1) 画布没铺满中栏（引擎按隐藏的左右容器宽度多减了一截）→ 界面看起来变小；
 *   2) 画布位图被引擎重置为 0（没恢复）→ 画面空白；
 *   3) 相机距离被算成 Infinity（引擎把画布尺寸当 0 时做半角正弦适配）→ 模型飞出视野。
 * 每次轮询顺手纠正一次；恢复正常后计数归零，异常持续时最多连续纠正 10 次，避免死循环。
 */
function selfHeal() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer) return
  if (typeof ws.HasLoadedModel === 'function' && !ws.HasLoadedModel()) return
  const center = document.querySelector('.center-canvas')
  const viewerEl = document.getElementById('main_viewer')
  const canvas = viewerEl ? viewerEl.querySelector('canvas') : null
  if (!center || !viewerEl || !canvas) return

  const cRect = center.getBoundingClientRect()
  // 切到别的菜单时查看器是隐藏的（display:none），此时不做任何"纠正"
  if (cRect.width < 80 || cRect.height < 80) return
  const vRect = viewerEl.getBoundingClientRect()
  const needLayout =
    Math.abs(Math.round(cRect.width) - Math.round(vRect.width)) > 2 ||
    Math.abs(Math.round(cRect.height) - Math.round(vRect.height)) > 2 ||
    canvas.width === 0 ||
    canvas.height === 0

  let cam = null
  try {
    cam = typeof ws.viewer.GetCamera === 'function' ? ws.viewer.GetCamera() : null
  } catch (e) { cam = null }
  let cameraBroken = false
  if (cam && cam.eye && cam.center) {
    const d = Math.sqrt(
      (cam.eye.x - cam.center.x) ** 2 + (cam.eye.y - cam.center.y) ** 2 + (cam.eye.z - cam.center.z) ** 2
    )
    cameraBroken = !isFinite(d) || d <= 0
  }

  if (!needLayout && !cameraBroken) {
    healStreak = 0
    return
  }
  if (healStreak >= 10) return
  healStreak++
  if (needLayout) modelViewer.syncLayout()
  if (cameraBroken) setSolidWorksDefaultView(false)
}

function syncState() {
  const ws = window.o3dvWebsite
  if (!ws) return
  const has = typeof ws.HasLoadedModel === 'function' ? !!ws.HasLoadedModel() : !!ws.model
  view.hasModel = has
  view.ready = true
  const stats = modelViewer.stats()
  const signature = `${has ? 1 : 0}|${stats.partCount}|${stats.triangles}|${stats.name}`
  if (signature === lastSignature) {
    if (has) selfHeal()
    return
  }
  lastSignature = signature
  if (!has) {
    view.parts = []
    view.modelName = ''
    captured = false
    return
  }
  // 首次加载完成后记录默认视角（点「等轴测」时精确还原）
  if (!captured) {
    captured = modelViewer.captureDefaultCamera()
  }
  view.parts = modelViewer.refreshParts()
  view.modelName = stats.name || view.modelName
  workbench.setStatus(`模型已加载：零件 ${stats.partCount} 个 · ${stats.triangles.toLocaleString()} 面`, 0)
  selfHeal()
}

/** 本项目主题 -> O3DV 主题联动（黑 / 科技蓝 走 O3DV 暗色，白走亮色）
    只在主题真的不同时才切换：O3DV 的 SwitchTheme 会重刷界面状态，
    每 800ms 无脑调用会让画面反复重建（模型看起来像在闪） */
function syncO3dvTheme() {
  const ws = window.o3dvWebsite
  if (!ws || typeof ws.SwitchTheme !== 'function') return
  const dark = themeStore.theme === 'dark' || themeStore.theme === 'tech'
  const target = dark ? 2 : 1
  if (ws.settings && ws.settings.themeId === target) return
  ws.SwitchTheme(target, true)
}

watch(() => themeStore.theme, () => setTimeout(syncO3dvTheme, 120))

onMounted(() => {
  view.bindController()
  // O3DV 自带弹窗（对话框/弹层/加载进度）统一改成项目主题样式，并在中栏内定位
  initO3dvDialogTheme()
  timer = setInterval(() => {
    syncState()
    syncO3dvTheme()
  }, 800)
  setTimeout(() => {
    modelViewer.syncLayout()
    syncO3dvTheme()
    placeO3dvCards()
  }, 1500)
  syncState()
  watchHostVisibility()
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
  hostObserver?.disconnect()
  hostObserver = null
  disposeO3dvDialogTheme()
})

/**
 * 从别的菜单切回模型查看时：中栏在隐藏期间尺寸是 0，引擎算不出画布尺寸，
 * 所以重新可见时补一次布局重算 + 弹窗/浮层重新摆位（模型本身不会重新加载）。
 */
let hostObserver = null
function watchHostVisibility() {
  const el = rootRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  let wasVisible = el.getBoundingClientRect().width > 80
  hostObserver = new ResizeObserver(() => {
    const r = el.getBoundingClientRect()
    const visible = r.width > 80 && r.height > 80
    if (visible && !wasVisible) {
      const nudge = () => {
        modelViewer.syncLayout()
        placeO3dvCards()
        placeAllPanelOverlays()
      }
      nudge()
      setTimeout(nudge, 120)
      setTimeout(nudge, 400)
    }
    wasVisible = visible
  })
  hostObserver.observe(el)
}
</script>
