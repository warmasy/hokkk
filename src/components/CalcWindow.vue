<template>
  <div
    v-if="item && inst"
    ref="rootRef"
    class="calc-window"
    :class="[{ active: isActive }, { 'is-pinned': win.pinned }, { 'is-minimizing': minimizing }]"
    :style="winStyle"
    @pointerdown="workbench.focusWindow(win.id)"
  >
    <!-- 标题栏（拖动区） -->
    <div class="calc-window__header" @pointerdown="startDrag">
      <i :class="item.icon"></i>
      <span class="calc-window__title">{{ nodeLabel || item.label }}</span>
      <span v-if="nodeLabel && nodeLabel !== item.label" class="calc-window__subtitle">{{ item.label }}</span>
      <span class="calc-window__spacer"></span>
      <button
        class="calc-window__btn pin"
        :class="{ active: win.pinned }"
        :title="win.pinned ? '取消固定（不再一直显示在最上层）' : '固定在最上层：一直显示，可实时操作'"
        @pointerdown.stop
        @click="onTogglePin"
      >
        <i class="fa-solid fa-thumbtack"></i>
      </button>
      <button
        class="calc-window__btn"
        title="最小化到左侧浏览树"
        @pointerdown.stop
        @click="onMinimize"
      >
        <i class="fa-solid fa-window-minimize"></i>
      </button>
      <button
        class="calc-window__btn"
        :title="win.maximized ? '向下还原' : '最大化'"
        @pointerdown.stop
        @click="onToggleMaximize"
      >
        <i :class="win.maximized ? 'fa-regular fa-window-restore' : 'fa-regular fa-window-maximize'"></i>
      </button>
      <button class="calc-window__btn close" title="关闭（同时删除左侧标签）" @pointerdown.stop @click="workbench.closeAndRemove(win.id)">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- 内容区：单位换算为单栏紧凑面板；公式计算为 左参数/结果 + 右曲线 -->
    <div class="calc-window__body" :class="{ 'no-chart': !hasChart, 'is-unit': item.kind === 'unit' }">
      <!-- ============ 单位换算 ============ -->
      <div v-if="item.kind === 'unit'" class="unit-panel">
        <div class="unit-row">
          <input type="number" step="any" :value="inst.unitValue" @input="onUnitValueInput" />
          <select :value="inst.unitFrom" @change="workbench.setUnitFrom(inst.id, $event.target.value)">
            <option v-for="u in unitOptions" :key="u.key" :value="u.key">{{ u.label }}</option>
          </select>
          <button class="unit-swap" title="交换源单位与目标单位" @click="onSwap">
            <i class="fa-solid fa-arrow-right-arrow-left" :class="{ spin: swapping }"></i>
          </button>
          <select :value="inst.unitTo" @change="workbench.setUnitTo(inst.id, $event.target.value)">
            <option v-for="u in unitOptions" :key="u.key" :value="u.key">{{ u.label }}</option>
          </select>
        </div>

        <div class="unit-result">
          <span class="unit-result__expr">{{ formatNumber(inst.unitValue) }} {{ inst.unitFrom }}</span>
          <span class="unit-result__eq">=</span>
          <span class="unit-result__value">{{ formatNumber(targetValue) }}</span>
          <span class="unit-result__unit">{{ inst.unitTo }}</span>
        </div>

        <div class="unit-table">
          <div class="unit-table__head"><span>单位</span><span>数值</span></div>
          <div
            v-for="u in orderedUnits"
            :key="u.key"
            class="unit-table__row"
            :class="{ 'is-highlight': u.key === inst.unitFrom || u.key === inst.unitTo }"
          >
            <span class="unit-table__name" :title="u.full || u.label">{{ u.label }}</span>
            <span class="unit-table__leader"></span>
            <span class="unit-table__num">{{ formatNumber(convertTo(u.key)) }}</span>
          </div>
        </div>
      </div>

      <!-- ============ 函数绘图 ============ -->
      <template v-else-if="item.kind === 'function'">
        <div ref="leftRef" class="calc-window__left">
          <div class="calc-window__section-title">函数表达式</div>
          <div class="calc-window__expr">{{ item.expr }}</div>

          <div class="calc-window__section-title">参数</div>
          <div class="prop-field" v-for="p in item.params" :key="p.key">
            <label :title="p.label">{{ p.label }}</label>
            <div class="prop-control">
              <input
                type="number"
                :step="p.step || 'any'"
                :value="formatInput(inst.values[p.key])"
                @input="onFieldInput(p.key, $event)"
              />
            </div>
          </div>

          <div class="calc-window__section-title">横轴范围</div>
          <div class="prop-field">
            <label>起始 x</label>
            <div class="prop-control">
              <input type="number" step="any" :value="formatInput(inst.values.xFrom)" @input="onFieldInput('xFrom', $event)" />
            </div>
          </div>
          <div class="prop-field">
            <label>结束 x</label>
            <div class="prop-control">
              <input type="number" step="any" :value="formatInput(inst.values.xTo)" @input="onFieldInput('xTo', $event)" />
            </div>
          </div>

          <div v-if="inst.loading" class="calc-window__hint">
            <i class="fa-solid fa-spinner fa-spin"></i> 正在请求后端计算…
          </div>
          <div v-else-if="inst.error" class="calc-window__hint error">
            <i class="fa-solid fa-triangle-exclamation"></i> {{ inst.error }}
          </div>

          <div v-if="rangeWarn" class="calc-window__hint warn">
            <i class="fa-solid fa-triangle-exclamation"></i> {{ rangeWarn }}
          </div>

          <div v-if="results.length" class="result-block">
            <div class="calc-window__section-title">函数特性</div>
            <div class="result-list">
              <div v-for="(row, idx) in results" :key="idx" class="result-row">
                <span class="result-label">{{ row.label }}</span>
                <span class="result-value">{{ fmtValue(row.value) }}<em v-if="row.unit">{{ row.unit }}</em></span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasChart" class="calc-window__right">
          <div class="calc-window__section-head">
            <span class="calc-window__section-title">函数图像</span>
            <span v-if="hoverInfo" class="chart-readout">
              <em v-if="hoverInfo.note">{{ hoverInfo.note }}</em>
              x = {{ hoverInfo.xText }} &nbsp; y = {{ hoverInfo.yText }}
            </span>
            <div class="chart-toolbar">
              <button title="放大" @click="zoomIn"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
              <button title="缩小" @click="zoomOut"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
              <button title="重置视图" @click="resetView"><i class="fa-solid fa-rotate-right"></i></button>
              <button title="截图" @click="shot"><i class="fa-solid fa-camera"></i></button>
            </div>
          </div>
          <div class="calc-window__chart">
            <canvas ref="chartRef"></canvas>
            <div v-if="noSeries" class="calc-window__chart-empty">
              当前参数下没有可绘制的点（检查参数取值或横轴范围）
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 公式计算 ============ -->
      <template v-else>
        <div ref="leftRef" class="calc-window__left">
          <div class="calc-window__section-title">参数输入</div>
          <div v-if="item.desc" class="calc-window__desc">{{ item.desc }}</div>
          <div class="prop-field" v-for="field in item.fields" :key="field.key">
            <label :title="field.label">{{ field.label }}</label>
            <div class="prop-control">
              <input type="number" step="any" :value="inst.values[field.key]" @input="onFieldInput(field.key, $event)" />
              <span v-if="field.unit" class="prop-unit">{{ field.unit }}</span>
            </div>
          </div>

          <div v-if="inst.loading" class="calc-window__hint">
            <i class="fa-solid fa-spinner fa-spin"></i> 正在请求后端计算…
          </div>
          <div v-else-if="inst.error" class="calc-window__hint error">
            <i class="fa-solid fa-triangle-exclamation"></i> {{ inst.error }}
          </div>

          <div v-if="rangeWarn" class="calc-window__hint warn">
            <i class="fa-solid fa-triangle-exclamation"></i> {{ rangeWarn }}
          </div>

          <div v-if="results.length" class="result-block">
            <div class="calc-window__section-title">计算结果</div>
            <div class="result-list">
              <div v-for="(row, idx) in results" :key="idx" class="result-row">
                <span class="result-label">{{ row.label }}</span>
                <span class="result-value">{{ fmtValue(row.value) }}<em v-if="row.unit">{{ row.unit }}</em></span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasChart" class="calc-window__right">
          <div class="calc-window__section-head">
            <span class="calc-window__section-title">关系曲线</span>
            <span v-if="hoverInfo" class="chart-readout">
              <em v-if="hoverInfo.note">{{ hoverInfo.note }}</em>
              x = {{ hoverInfo.xText }} &nbsp; y = {{ hoverInfo.yText }}
            </span>
            <div class="chart-toolbar">
              <button title="放大" @click="zoomIn"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
              <button title="缩小" @click="zoomOut"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
              <button title="重置视图" @click="resetView"><i class="fa-solid fa-rotate-right"></i></button>
              <button title="截图" @click="shot"><i class="fa-solid fa-camera"></i></button>
            </div>
          </div>
          <div class="calc-window__chart">
            <canvas ref="chartRef"></canvas>
            <div v-if="noSeries" class="calc-window__chart-empty">
              当前参数下没有可绘制的点（检查参数取值或横轴范围）
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 操作（统一样式：第一个为主操作，第二个为复位） -->
    <div class="calc-window__footer">
      <button v-if="item.kind === 'unit'" class="primary" @click="onSwap">交换单位</button>
      <button v-else class="primary" @click="workbench.compute(inst.id)">重新计算</button>
      <button @click="workbench.resetInstance(inst.id)">复位</button>
    </div>

    <!-- 被目录树点名时的高亮圈：单独一层做动画，
         绝不能把动画挂在窗口本体上 —— 那会和入场动画（mc-window-in）抢同一个 animation 属性，
         类一移除就会把入场动画重新播一遍（看起来就是"过一会又弹一次"） -->
    <div v-if="pulsing" class="calc-window__pulse"></div>

    <!-- 尺寸调整把手：四边 + 四角，和 Windows 一样随便拉 -->
    <div
      v-for="dir in RESIZE_HANDLES"
      :key="dir"
      class="calc-window__rz"
      :class="'rz-' + dir"
      @pointerdown.stop="startResize($event, dir)"
    ></div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { saveAs } from 'file-saver'
import { findItem } from '@/config/ribbon'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { useThemeStore } from '@/store/modules/theme'
import { formatNumber, convertUnit, formatInput } from '@/utils/units'
import { registerWindow, unregisterWindow } from '@/utils/windowRegistry'
import modal from '@/plugins/modal'

const props = defineProps({
  win: { type: Object, required: true }
})

const workbench = useWorkbenchStore()
const themeStore = useThemeStore()

const rootRef = ref(null)
const leftRef = ref(null)
const chartRef = ref(null)
const zoom = ref(1)
/** 最小化动画进行中 */
const minimizing = ref(false)
/** 鼠标悬停在曲线上的读数（显示在图外标题行，避免遮挡曲线） */
const hoverInfo = ref(null)
let chart = null

const inst = computed(() => workbench.instances[props.win.instanceId] || null)
const item = computed(() => (inst.value ? findItem(inst.value.itemKey) : null))
const nodeLabel = computed(() => {
  if (!inst.value) return ''
  return workbench.findNodeByInstance(inst.value.id)?.label || ''
})
const isActive = computed(() => workbench.activeWindowId === props.win.id)

/** 被激活 / 被目录树点名时闪一下边框，方便一眼找到是哪个窗口 */
const pulsing = ref(false)
let pulseTimer = null
function pulse() {
  pulsing.value = true
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    pulsing.value = false
    pulseTimer = null
  }, 700)
}
watch(isActive, (v) => {
  if (v) pulse()
})
// 已在最前、又被目录树点了一次：也要闪一下（active 没变化，watch 不会触发）
watch(
  () => props.win.flashAt,
  () => pulse()
)
onBeforeUnmount(() => {
  if (pulseTimer) clearTimeout(pulseTimer)
})
/**
 * 实际层级：固定的窗口统一加一个很大的基数（8000），
 * 所以它永远盖在未固定的窗口之上（标签数量弹窗是 12000，仍在最上层）
 */
const PIN_Z_BASE = 8000
const effectiveZ = computed(() => (props.win.pinned ? PIN_Z_BASE + (props.win.z || 0) : props.win.z || 0))

/** 拖动/缩放过程中的临时几何（松手才写回 store，界面更跟手） */
const dragPos = ref(null)
const dragSize = ref(null)
const posX = computed(() => (dragPos.value ? dragPos.value.x : props.win.x))
const posY = computed(() => (dragPos.value ? dragPos.value.y : props.win.y))
const sizeW = computed(() => (dragSize.value ? dragSize.value.w : props.win.w))
const sizeH = computed(() => (dragSize.value ? dragSize.value.h : props.win.h))
const winStyle = computed(() => ({
  left: `${posX.value}px`,
  top: `${posY.value}px`,
  width: `${sizeW.value}px`,
  height: `${sizeH.value}px`,
  zIndex: effectiveZ.value
}))
const unitOptions = computed(() => (inst.value ? workbench.unitOptionsOf(inst.value.id) : []))
const results = computed(() => (inst.value ? workbench.resultsOf(inst.value.id) : []))
const series = computed(() => (inst.value ? workbench.seriesOf(inst.value.id) : null))
/** 会画图的类型（公式 / 函数），图表区始终保留，没有数据时给提示而不是整块消失 */
const hasChart = computed(() => item.value?.kind === 'formula' || item.value?.kind === 'function')
/** 当前参数下没有可绘制的点 */
const noSeries = computed(() => hasChart.value && !series.value)
/** 纵轴范围过大时的提醒（例如衰减系数取负导致指数爆炸，曲线会被压平） */
const rangeWarn = computed(() => {
  if (!series.value?.points?.length) return ''
  const maxAbs = series.value.points.reduce((m, p) => Math.max(m, Math.abs(p.y)), 0)
  if (!isFinite(maxAbs) || maxAbs < 1e6) return ''
  return `纵轴范围已达 ±${formatNumber(maxAbs)}，曲线会被压平成一条直线，请检查参数`
})

/** 单位换算：当前数值换算到目标单位 */
const targetValue = computed(() => {
  if (!inst.value || item.value?.kind !== 'unit') return NaN
  return convertUnit(item.value.unitType, inst.value.unitValue, inst.value.unitFrom, inst.value.unitTo)
})

/** 单位换算：换算到指定单位 */
function convertTo(unitKey) {
  if (!inst.value || item.value?.kind !== 'unit') return NaN
  return convertUnit(item.value.unitType, inst.value.unitValue, inst.value.unitFrom, unitKey)
}

/** 换算表顺序：第一行永远是原单位，第二行永远是目标单位，其余按单位表顺序 */
const orderedUnits = computed(() => {
  const list = unitOptions.value
  if (!inst.value) return list
  const { unitFrom, unitTo } = inst.value
  const source = list.find((u) => u.key === unitFrom)
  const target = unitTo === unitFrom ? null : list.find((u) => u.key === unitTo)
  const rest = list.filter((u) => u.key !== unitFrom && u.key !== unitTo)
  return [...(source ? [source] : []), ...(target ? [target] : []), ...rest]
})

// ------------------------------------------------------------ 输入
function onFieldInput(fieldKey, e) {
  const raw = e.target.value
  workbench.setInstanceValue(inst.value.id, fieldKey, raw === '' ? '' : Number(raw))
}
function onUnitValueInput(e) {
  const raw = e.target.value
  workbench.setUnitValue(inst.value.id, raw === '' ? '' : Number(raw))
}

/** 交换单位：按钮图标转一下，作为点击反馈 */
const swapping = ref(false)
function onSwap() {
  if (!inst.value) return
  workbench.swapUnits(inst.value.id)
  swapping.value = true
  window.setTimeout(() => (swapping.value = false), 320)
}

// ------------------------------------------------------------ 自动适配尺寸（尽量让内容全部可见、不留滚动条）
async function autoFit() {
  await nextTick()
  // 最大化状态下不要按内容改尺寸（会和最大化互相打架）
  if (!props.win.fitted || props.win.maximized) return
  const host = document.querySelector('.center-canvas')
  const rect = host?.getBoundingClientRect()
  const maxW = (rect?.width || 1200) - 36
  const maxH = (rect?.height || 700) - props.win.y - 10
  let w = props.win.w
  if (w > maxW) w = maxW
  // 量取实际内容高度：单位换算量整块面板，其余量左栏
  const measured = item.value?.kind === 'unit' ? rootRef.value?.querySelector('.unit-panel')?.scrollHeight : leftRef.value?.scrollHeight
  const contentH = measured || 0
  // 头部 32 + 底栏 42 + 上下内边距 20，再多留 6px 余量，避免刚好卡出滚动条
  const needH = contentH + 32 + 42 + 20 + 6
  const h = Math.max(200, Math.min(needH, Math.max(maxH, 240)))
  if (w !== props.win.w || h !== props.win.h) workbench.resizeWindow(props.win.id, w, h, false)
  await nextTick()
  chart?.resize()
}

// ------------------------------------------------------------ 拖动窗口
/** 拖动/缩放的可视区域：中栏（窗口不能拖出中栏） */
function dragBounds() {
  const host = document.querySelector('.window-layer') || document.querySelector('.center-canvas')
  const rect = host?.getBoundingClientRect()
  return { w: Math.round(rect?.width || 1200), h: Math.round(rect?.height || 700) }
}

/** 拖动判定阈值：小于它算点击，避免手抖一两个像素就把窗口挪歪 */
const MOVE_THRESHOLD = 3
/** 往下拖时至少留在可视区内的头部高度（窗口可以被拖出下边界，只留标题栏可操作） */
const HEADER_KEEP = 40

function startDrag(e) {
  if (e.button !== 0) return
  const handle = e.currentTarget
  const startX = e.clientX
  const startY = e.clientY
  const layer = document.querySelector('.window-layer') || document.querySelector('.center-canvas')
  // 最大化状态下拖标题栏：先还原成小窗口，再按比例跟随鼠标继续拖（和 Windows 一样顺手）
  if (props.win.maximized) {
    const lr = layer ? layer.getBoundingClientRect() : null
    const ratio = lr && lr.width ? (startX - lr.left) / lr.width : 0.5
    workbench.toggleMaximize(props.win.id, {})
    const rest = props.win.restoreRect || {}
    const w = Number.isFinite(rest.w) ? rest.w : props.win.w
    const bounds = dragBounds()
    props.win.x = Math.round(Math.max(0, Math.min((lr ? startX - lr.left : 0) - w * ratio, bounds.w - w)))
    props.win.y = Math.max(0, Math.round(startY - 16))
    workbench.moveWindow(props.win.id, props.win.x, props.win.y)
  }
  workbench.focusWindow(props.win.id)
  const originX = props.win.x
  const originY = props.win.y
  const bounds = dragBounds()
  const winW = props.win.w
  const winH = props.win.h
  // 左右/上边界照旧不让挡住；**下边界允许拖出去**，只要标题栏还留着能操作
  const maxX = Math.max(0, bounds.w - winW)
  const maxY = Math.max(0, bounds.h - HEADER_KEEP)

  let moving = false
  let pending = null
  let raf = 0

  // 每帧只处理一次：把这一帧里收到的多个 pointermove 合并掉，拖动就顺了
  const flush = () => {
    raf = 0
    if (!pending) return
    const cur = dragPos.value
    if (!cur || cur.x !== pending.x || cur.y !== pending.y) dragPos.value = { x: pending.x, y: pending.y }
  }

  const onMove = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!moving) {
      if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) return
      moving = true
      document.body.classList.add('mc-window-moving') // 全程保持"移动"光标、不选中文字
    }
    pending = {
      x: Math.round(Math.max(0, Math.min(originX + dx, maxX))),
      y: Math.round(Math.max(0, Math.min(originY + dy, maxY)))
    }
    if (!raf) raf = requestAnimationFrame(flush)
  }
  const finish = (commit) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    handle?.releasePointerCapture?.(e.pointerId)
    document.body.classList.remove('mc-window-moving')
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    // 松手前把最后一帧落位补上，避免"松手位置和看到的位置差一点"
    if (commit && pending) flush()
    pending = null
    const pos = dragPos.value
    dragPos.value = null
    if (commit && moving && pos) workbench.moveWindow(props.win.id, pos.x, pos.y)
  }
  const onUp = () => finish(true)
  const onCancel = () => finish(false)

  // 指针捕获：指针拖出窗口/浏览器也继续收到事件，不会"拖一半断掉"
  try {
    handle?.setPointerCapture?.(e.pointerId)
  } catch (err) { /* ignore */ }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  e.preventDefault()
}

// ------------------------------------------------------------ 调整大小（四边 + 四角，和 Windows 一样）
/** 8 个方向的把手 */
const RESIZE_HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const MIN_W = 340
const MIN_H = 220

function startResize(e, dir) {
  if (e.button !== 0 || props.win.maximized) return
  const handle = e.currentTarget
  const startX = e.clientX
  const startY = e.clientY
  const o = { x: props.win.x, y: props.win.y, w: props.win.w, h: props.win.h }
  const bounds = dragBounds()
  const clamp = (v, min, max) => Math.max(min, Math.min(v, max))
  let sizeRaf = 0
  let chartTimer = 0
  let pending = null
  let moved = false

  // 尺寸每帧落位一次（合并同一帧的多个事件）；图表重绘限制在 ~150ms 一次
  const flushSize = () => {
    sizeRaf = 0
    if (!pending) return
    const cur = dragSize.value
    if (!cur || cur.w !== pending.w || cur.h !== pending.h) dragSize.value = { w: pending.w, h: pending.h }
    const curPos = dragPos.value || { x: o.x, y: o.y }
    if (curPos.x !== pending.x || curPos.y !== pending.y) dragPos.value = { x: pending.x, y: pending.y }
  }
  const onMove = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    let { x, y, w, h } = o
    if (dir.includes('e')) w = clamp(o.w + dx, MIN_W, bounds.w - o.x)
    if (dir.includes('s')) h = clamp(o.h + dy, MIN_H, bounds.h - o.y)
    if (dir.includes('w')) {
      const nw = clamp(o.w - dx, MIN_W, o.x + o.w)
      x = o.x + (o.w - nw)
      w = nw
    }
    if (dir.includes('n')) {
      const nh = clamp(o.h - dy, MIN_H, o.y + o.h)
      y = o.y + (o.h - nh)
      h = nh
    }
    pending = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
    moved = true
    if (!document.body.classList.contains('mc-window-moving')) document.body.classList.add('mc-window-moving')
    if (!sizeRaf) sizeRaf = requestAnimationFrame(flushSize)
    if (chart && !chartTimer) {
      chartTimer = setTimeout(() => {
        chartTimer = 0
        chart?.resize()
      }, 150)
    }
  }
  const finish = (commit) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    handle?.releasePointerCapture?.(e.pointerId)
    document.body.classList.remove('mc-window-moving')
    if (sizeRaf) cancelAnimationFrame(sizeRaf)
    if (chartTimer) clearTimeout(chartTimer)
    sizeRaf = 0
    chartTimer = 0
    if (moved) flushSize()
    const size = dragSize.value
    const pos = dragPos.value
    dragSize.value = null
    dragPos.value = null
    pending = null
    if (commit && size) {
      if (pos) workbench.moveWindow(props.win.id, pos.x, pos.y)
      workbench.resizeWindow(props.win.id, size.w, size.h)
    }
    chart?.resize()
  }
  const onUp = () => finish(true)
  const onCancel = () => finish(false)

  try {
    handle?.setPointerCapture?.(e.pointerId)
  } catch (err) { /* ignore */ }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  e.preventDefault()
}

/** 最大化 / 还原：按中栏实际可用区域计算 */
function onToggleMaximize() {
  const host = document.querySelector('.center-canvas')
  const rect = host?.getBoundingClientRect()
  workbench.toggleMaximize(props.win.id, {
    x: 0,
    y: 0,
    w: rect ? Math.round(rect.width) : undefined,
    h: rect ? Math.round(rect.height) : undefined
  })
}

/** 固定 / 取消固定到最上层 */
function onTogglePin() {
  workbench.togglePin(props.win.id)
}

/**
 * 最小化：窗口像苹果那样“收进左侧浏览树里的标签”，动画结束后再真正关闭窗口
 */
function onMinimize() {
  if (minimizing.value) return
  const nodeId = inst.value ? workbench.findNodeByInstance(inst.value.id)?.id : null
  const target = nodeId ? document.querySelector(`.left-panel [data-node="${nodeId}"]`) : null
  const el = rootRef.value
  const host = el?.getBoundingClientRect()
  const to = target?.getBoundingClientRect()

  if (!el || !host || !to) {
    workbench.minimizeWindow(props.win.id)
    return
  }
  const dx = to.left + to.width / 2 - (host.left + host.width / 2)
  const dy = to.top + to.height / 2 - (host.top + host.height / 2)
  const scale = Math.max(0.08, Math.min(0.4, to.width / host.width))
  minimizing.value = true
  // 动画期间允许窗口越出中栏，才能看出“飞向左侧标签”的效果
  const canvasEl = document.querySelector('.center-canvas')
  const layerEl = document.querySelector('.window-layer')
  if (canvasEl) canvasEl.style.overflow = 'visible'
  if (layerEl) layerEl.style.overflow = 'visible'
  el.style.transformOrigin = '50% 50%'
  el.style.transition = 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1), opacity 420ms ease'
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
  el.style.opacity = '0.15'
  window.setTimeout(() => {
    if (canvasEl) canvasEl.style.overflow = ''
    if (layerEl) layerEl.style.overflow = ''
    workbench.minimizeWindow(props.win.id)
  }, 400)
}

// ------------------------------------------------------------ 图表
function themeColors() {
  const css = getComputedStyle(document.body)
  const pick = (name, fallback) => (css.getPropertyValue(name) || '').trim() || fallback
  return {
    accent: pick('--accent', '#1677ff'),
    grid: pick('--chart-grid', '#e5e8ef'),
    text: pick('--chart-text', '#767a82'),
    axis: pick('--text-secondary', '#a8b0bd'),
    panel: pick('--bg-panel', '#ffffff'),
    marker: pick('--marker', '#fa8c16'),
    markerSoft: pick('--marker-soft', 'rgba(250,140,22,0.22)')
  }
}

/** 取“好看”的刻度间隔（1 / 2 / 2.5 / 5 / 10 序列） */
function niceStep(span, target) {
  if (!isFinite(span) || span <= 0 || target <= 0) return 1
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return mult * mag
}

/** 按间隔生成刻度值（避免浮点累加误差） */
function ticksFor(min, max, target) {
  const step = niceStep(max - min, target)
  if (!isFinite(step) || step <= 0) return []
  const out = []
  const from = Math.ceil(min / step - 1e-9)
  const to = Math.floor(max / step + 1e-9)
  if (to - from > 200) return []
  for (let i = from; i <= to; i++) {
    const v = i * step
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)))
  }
  return out
}

/** π 刻度候选：π/4、π/2、π、2π */
const PI_STEPS = [
  { value: Math.PI / 4, p: 1, q: 4 },
  { value: Math.PI / 2, p: 1, q: 2 },
  { value: Math.PI, p: 1, q: 1 },
  { value: Math.PI * 2, p: 2, q: 1 }
]

/** 以 π 为步长生成刻度（横轴用 π 表示时） */
function piTicksFor(min, max, target) {
  const span = max - min
  if (!(span > 0) || target <= 0) return []
  const ideal = span / target
  let best = PI_STEPS[0]
  let bestDiff = Infinity
  PI_STEPS.forEach((s) => {
    const d = Math.abs(s.value - ideal)
    if (d < bestDiff) {
      bestDiff = d
      best = s
    }
  })
  const step = best.value
  const out = []
  const from = Math.ceil(min / step - 1e-9)
  const to = Math.floor(max / step + 1e-9)
  if (to - from > 60) return []
  for (let i = from; i <= to; i++) out.push(i * step)
  return out
}

/** 把数值转成 π 形式（π/2、3π/2、−π …），转不了返回 null */
function toPiLabel(v) {
  if (Math.abs(v) < 1e-6) return '0'
  const k = v / Math.PI
  for (const q of [1, 2, 3, 4, 6]) {
    const p = Math.round(k * q)
    if (p !== 0 && Math.abs(k - p / q) < 2e-4) {
      const sign = p < 0 ? '-' : ''
      const ap = Math.abs(p)
      const numer = ap === 1 ? 'π' : `${ap}π`
      return q === 1 ? `${sign}${numer}` : `${sign}${numer}/${q}`
    }
  }
  return null
}

/** 刻度标签：π 轴优先用 π 表示，否则用普通数字 */
function tickLabel(v, usePi) {
  if (Math.abs(v) < 1e-6) return '0'
  if (usePi) {
    const pi = toPiLabel(v)
    if (pi) return pi
  }
  return String(Number(Number(v).toPrecision(3)))
}

/** 坐标轴插件：网格 + 带箭头的 x/y 轴 + 刻度线与轴上数字 + 原点 O + 轴名 */
const axisPlugin = {
  id: 'mcAxis',
  /** 画布尺寸变化（例如最大化/还原、窗口拉伸）后必须重算关键点像素，否则吸附会失效 */
  resize(chart) {
    chart.$cross = null
    refreshKeyPoints()
  },
  afterUpdate() {
    refreshKeyPoints()
  },
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const x = chart.scales.x
    const y = chart.scales.y
    if (!x || !y) return
    const c = themeColors()
    const clamp = (v, a, b) => Math.max(a, Math.min(v, b))
    const y0 = clamp(y.getPixelForValue(0), y.top + 1, y.bottom - 1) // x 轴所在高度
    const x0 = clamp(x.getPixelForValue(0), x.left + 1, x.right - 1) // y 轴所在位置
    const ARROW = 7

    // 刻度数量按绘图区尺寸自适应，保证数字不挤在一起
    const xTarget = Math.max(4, Math.min(14, Math.floor((x.right - x.left) / 46)))
    const yTarget = Math.max(4, Math.min(12, Math.floor((y.bottom - y.top) / 24)))
    const usePi = !!chart.options.plugins?.mcAxis?.pi
    const xTicks = usePi ? piTicksFor(x.min, x.max, xTarget) : ticksFor(x.min, x.max, xTarget)
    const yTicks = ticksFor(y.min, y.max, yTarget)

    const fmt = (v) => tickLabel(v, usePi)

    ctx.save()
    ctx.font = '10px "Segoe UI", Tahoma, sans-serif'

    // ---- 网格（浅色，画在轴线之下） ----
    ctx.strokeStyle = c.grid
    ctx.lineWidth = 1
    xTicks.forEach((v) => {
      if (v === 0) return
      const px = Math.round(x.getPixelForValue(v)) + 0.5
      if (px < x.left || px > x.right) return
      ctx.beginPath()
      ctx.moveTo(px, y.top)
      ctx.lineTo(px, y.bottom)
      ctx.stroke()
    })
    yTicks.forEach((v) => {
      if (v === 0) return
      const py = Math.round(y.getPixelForValue(v)) + 0.5
      if (py < y.top || py > y.bottom) return
      ctx.beginPath()
      ctx.moveTo(x.left, py)
      ctx.lineTo(x.right, py)
      ctx.stroke()
    })

    // ---- 坐标轴 ----
    ctx.strokeStyle = c.axis
    ctx.fillStyle = c.axis
    ctx.beginPath()
    ctx.moveTo(x.left, y0 + 0.5)
    ctx.lineTo(x.right - ARROW, y0 + 0.5)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x.right, y0 + 0.5)
    ctx.lineTo(x.right - ARROW, y0 - 3)
    ctx.lineTo(x.right - ARROW, y0 + 4)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x0 + 0.5, y.bottom)
    ctx.lineTo(x0 + 0.5, y.top + ARROW)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x0 + 0.5, y.top)
    ctx.lineTo(x0 - 3, y.top + ARROW)
    ctx.lineTo(x0 + 4, y.top + ARROW)
    ctx.closePath()
    ctx.fill()

    // ---- 轴名 ----
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('x', x.right - 2, y0 + 4)
    ctx.textBaseline = 'middle'
    ctx.fillText('y', x0 + 6, y.top + ARROW - 2)

    // ---- 原点 ----
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('O', x0 - 4, y0 + 3)

    // 轴靠边时把数字翻到另一侧
    const xLabelsBelow = y0 < y.bottom - 16
    const yLabelsLeft = x0 > x.left + 34

    // ---- x 轴刻度与数字 ----
    ctx.textAlign = 'center'
    ctx.textBaseline = xLabelsBelow ? 'top' : 'bottom'
    xTicks.forEach((v) => {
      const px = x.getPixelForValue(v)
      if (px < x.left + 2 || px > x.right - 10) return
      ctx.beginPath()
      ctx.moveTo(px + 0.5, y0)
      ctx.lineTo(px + 0.5, y0 + (xLabelsBelow ? 4 : -4))
      ctx.stroke()
      if (v === 0) return
      ctx.fillText(fmt(v), px, y0 + (xLabelsBelow ? 7 : -7))
    })

    // ---- y 轴刻度与数字 ----
    ctx.textAlign = yLabelsLeft ? 'right' : 'left'
    ctx.textBaseline = 'middle'
    yTicks.forEach((v) => {
      const py = y.getPixelForValue(v)
      if (py < y.top + 6 || py > y.bottom - 5) return
      ctx.beginPath()
      ctx.moveTo(x0, py + 0.5)
      ctx.lineTo(x0 + (yLabelsLeft ? -4 : 4), py + 0.5)
      ctx.stroke()
      if (v === 0) return
      ctx.fillText(fmt(v), x0 + (yLabelsLeft ? -7 : 7), py)
    })

    ctx.restore()
  }
}

/** 关键点像素缓存（极值 / 与坐标轴交点），绘制与吸附都用它 */
let keyPixels = []
/** 曲线纵坐标量级（用于把浮点残差显示成 0），必须是响应式的，否则复位后结果栏不会刷新 */
const yMagRef = ref(1)

/**
 * 读数格式化：小于量级百万分之一的数值直接显示 0
 * （极值点/交点是用数值方法逼近的，cos(-π/2) 这类结果会带 1e-7 量级残差）
 */
function fmtValue(v) {
  const num = Number(v)
  if (!isFinite(num)) return '-'
  if (Math.abs(num) < Math.max(yMagRef.value, 1e-12) * 1e-6) return '0'
  return formatNumber(num, 4)
}

/** 计算关键点：最大值、最小值、与 x 轴交点、与 y 轴交点 */
function refreshKeyPoints() {
  keyPixels = []
  if (!chart) return
  const s = series.value
  if (!s?.points?.length) {
    yMagRef.value = 1
    return
  }
  const x = chart.scales.x
  const y = chart.scales.y
  if (!x || !y) return
  const pts = s.points
  const usePi = !!item.value?.piAxis
  // 记录纵坐标量级，供 fmtValue 判断“残差即零”
  yMagRef.value = pts.reduce((m, p) => Math.max(m, Math.abs(p.y)), 0) || 1
  const push = (type, short, px_, py_) => {
    const px = x.getPixelForValue(px_)
    const py = y.getPixelForValue(py_)
    if (!isFinite(px) || !isFinite(py)) return
    keyPixels.push({
      type,
      short,
      x: px_,
      y: py_,
      px,
      py,
      text: `${tickLabel(px_, usePi)}, ${fmtValue(py_)}`
    })
  }

  // 极值点：取所有局部极大 / 极小（最多各 4 个），插值精修后作为关键点
  const fn = item.value?.fn
  const step = pts.length > 1 ? Math.abs(pts[1].x - pts[0].x) : 0
  const refine = (p, dir) => {
    if (typeof fn !== 'function' || !step) return p
    let lo = p.x - step
    let hi = p.x + step
    for (let i = 0; i < 60; i++) {
      const m1 = lo + (hi - lo) / 3
      const m2 = hi - (hi - lo) / 3
      const f1 = dir * fn(m1, inst.value?.values || {})
      const f2 = dir * fn(m2, inst.value?.values || {})
      if (!isFinite(f1)) {
        lo = m1
        continue
      }
      if (!isFinite(f2)) {
        hi = m2
        continue
      }
      if (f1 < f2) lo = m1
      else hi = m2
    }
    const x = (lo + hi) / 2
    const y = fn(x, inst.value?.values || {})
    return isFinite(y) ? { x, y } : p
  }
  const maxima = []
  const minima = []
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const c2 = pts[i + 1]
    if (b.y >= a.y && b.y >= c2.y && (b.y > a.y || b.y > c2.y)) maxima.push(b)
    if (b.y <= a.y && b.y <= c2.y && (b.y < a.y || b.y < c2.y)) minima.push(b)
  }
  const dedupe = (list) => {
    const out = []
    list.forEach((p) => {
      if (!out.length || Math.abs(p.x - out[out.length - 1].x) > step * 2) out.push(p)
    })
    return out
  }
  dedupe(maxima)
    .slice(0, 6)
    .forEach((p) => {
      const r = refine(p, 1)
      push('极大值点', '极大', r.x, r.y)
    })
  dedupe(minima)
    .slice(0, 6)
    .forEach((p) => {
      const r = refine(p, -1)
      push('极小值点', '极小', r.x, r.y)
    })

  // 与 x 轴交点（线性插值找零点）
  const zeros = []
  for (let i = 1; i < pts.length && zeros.length < 6; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (a.y === 0) zeros.push(a)
    else if ((a.y < 0 && b.y > 0) || (a.y > 0 && b.y < 0)) {
      const t = a.y / (a.y - b.y)
      zeros.push({ x: a.x + t * (b.x - a.x), y: 0 })
    }
  }
  zeros.forEach((z) => push('与 x 轴交点', 'x轴', z.x, 0))

  // 与 y 轴交点
  if (x.min <= 0 && x.max >= 0) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      if ((a.x <= 0 && b.x >= 0) || (a.x >= 0 && b.x <= 0)) {
        const t = b.x === a.x ? 0 : (0 - a.x) / (b.x - a.x)
        push('与 y 轴交点', 'y轴', 0, a.y + t * (b.y - a.y))
        break
      }
    }
  }
  if (import.meta.env.DEV) window.__mcKeyPixels = keyPixels
}

/** 十字准线插件：轻微吸附（关键点更近才算），悬停时才画标记点与说明 */
const crosshairPlugin = {
  id: 'mcCrosshair',
  afterEvent(chart, args) {
    const e = args.event
    const emit = chart.options.plugins?.mcCrosshair?.onMove
    if (!e) return
    if (e.type === 'mouseout') {
      if (chart.$cross) {
        chart.$cross = null
        if (emit) emit(null)
        args.changed = true
      }
      return
    }
    if (e.type !== 'mousemove' && e.type !== 'click') return
    const x = chart.scales.x
    const y = chart.scales.y
    if (!x || !y) return
    const inside = e.x >= x.left && e.x <= x.right && e.y >= y.top && e.y <= y.bottom
    if (!inside) {
      if (chart.$cross) {
        chart.$cross = null
        if (emit) emit(null)
        args.changed = true
      }
      return
    }

    // 关键点吸附：范围收紧，只有鼠标真的靠近才吸（避免"老远被拽走"）
    let snapKey = null
    let bestKeyD = Infinity
    keyPixels.forEach((k) => {
      const d = Math.hypot(k.px - e.x, k.py - e.y)
      if (d < bestKeyD) {
        bestKeyD = d
        snapKey = k
      }
    })
    if (snapKey && bestKeyD > 12) snapKey = null

    // 其余位置轻微吸附到最近的曲线采样点（采样很密，基本就是贴合曲线）
    const meta = chart.getDatasetMeta(0)
    let nearest = null
    let bestDx = Infinity
    if (meta?.data?.length) {
      meta.data.forEach((el, i) => {
        if (!el || !isFinite(el.x) || !isFinite(el.y)) return
        const dx = Math.abs(el.x - e.x)
        if (dx < bestDx) {
          bestDx = dx
          nearest = { px: el.x, py: el.y, raw: chart.data.datasets[0].data[i] }
        }
      })
    }
    if (nearest && (bestDx > 8 || !nearest.raw)) nearest = null

    let next
    if (snapKey) {
      // 关键点：y 直接用函数值重算，保证标记点严格落在曲线上
      const fn = item.value?.fn
      const values = inst.value?.values
      let yv = snapKey.y
      if (typeof fn === 'function' && values) {
        const fy = fn(snapKey.x, values)
        if (isFinite(fy)) yv = fy
      }
      next = { px: snapKey.px, py: y.getPixelForValue(yv), xv: snapKey.x, yv, note: snapKey.type }
    } else if (nearest) {
      next = {
        px: nearest.px,
        py: nearest.py,
        xv: Number(nearest.raw.x),
        yv: Number(nearest.raw.y),
        note: ''
      }
    } else {
      next = { px: e.x, py: e.y, xv: x.getValueForPixel(e.x), yv: y.getValueForPixel(e.y), note: '' }
    }

    const prev = chart.$cross
    const moved = !prev || Math.abs(prev.px - next.px) > 0.4 || Math.abs(prev.py - next.py) > 0.4
    chart.$cross = next
    if (emit) {
      const usePi = !!chart.options.plugins?.mcAxis?.pi
      emit({
        note: next.note || '',
        xText: tickLabel(next.xv, usePi),
        yText: fmtValue(next.yv),
        snapped: !!next.note
      })
    }
    if (moved) args.changed = true
  },
  afterDatasetsDraw(chart) {
    const cross = chart.$cross
    if (!cross) return
    const { ctx } = chart
    const x = chart.scales.x
    const y = chart.scales.y
    const c = themeColors()
    ctx.save()
    // 辅助虚线
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = c.marker
    ctx.globalAlpha = 0.75
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cross.px + 0.5, y.top)
    ctx.lineTo(cross.px + 0.5, y.bottom)
    ctx.moveTo(x.left, cross.py + 0.5)
    ctx.lineTo(x.right, cross.py + 0.5)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // 与曲线相交处的标记：细环 + 中心实心点，曲线正好从环中心穿过（峰值处不会显得“偏出去”）
    ctx.beginPath()
    ctx.arc(cross.px, cross.py, 4, 0, Math.PI * 2)
    ctx.strokeStyle = c.marker
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cross.px, cross.py, 1.6, 0, Math.PI * 2)
    ctx.fillStyle = c.marker
    ctx.fill()

    // 只有吸附到关键点时，才在点旁给出简短说明（平时不标）
    if (cross.note) {
      ctx.font = '10px "Segoe UI", Tahoma, sans-serif'
      const text = `${cross.note} (${tickLabel(cross.xv, !!chart.options.plugins?.mcAxis?.pi)}, ${fmtValue(cross.yv)})`
      const tw = ctx.measureText(text).width
      // 说明框以标记点为中心水平对齐，默认放在点的上方（不遮住曲线尖顶）
      let bx = cross.px - tw / 2 - 4
      bx = Math.max(x.left + 2, Math.min(bx, x.right - tw - 10))
      let by = cross.py - 26
      if (by < y.top + 2) by = cross.py + 12
      if (by > y.bottom - 17) by = cross.py - 26
      ctx.globalAlpha = 0.94
      ctx.fillStyle = c.panel
      ctx.fillRect(bx, by, tw + 8, 15)
      ctx.globalAlpha = 1
      ctx.strokeStyle = c.markerSoft
      ctx.strokeRect(bx + 0.5, by + 0.5, tw + 8, 15)
      ctx.fillStyle = c.marker
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, bx + 4, by + 7.5)
      // 从说明框到标记点画一条短线，明确指向关系
      ctx.beginPath()
      ctx.moveTo(cross.px, cross.py - 9)
      ctx.lineTo(cross.px, by + (by < cross.py ? 15 : 0))
      ctx.strokeStyle = c.markerSoft
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
  }
}

function buildChart() {
  if (!chartRef.value || chart) return
  const c = themeColors()
  chart = new Chart(chartRef.value.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: '',
          data: [],
          borderColor: c.accent,
          backgroundColor: c.accent + '22',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.25,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      layout: { padding: { top: 10, right: 14, bottom: 4, left: 4 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          border: { display: false },
          ticks: { display: false },
          title: { display: false }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { display: false },
          title: { display: false }
        }
      }
    },
    plugins: [axisPlugin, crosshairPlugin]
  })
  // 自定义插件配置（横轴 π 刻度 / 悬停读数回调）
  chart.options.plugins.mcAxis = { pi: !!item.value?.piAxis }
  chart.options.plugins.mcCrosshair = { onMove: (info) => (hoverInfo.value = info) }
  updateChart()
}
/**
 * 刷新关系曲线。
 * @param animate 是否播放 Chart.js 的过渡动画：只有数据/缩放变化才需要；
 *   纯换主题（只改颜色）时传 false，用 'none' 直接重绘，避免看起来像"重新加载了一次"
 */
function updateChart(animate = true) {
  if (!chart) return
  const c = themeColors()
  const s = series.value
  const ds = chart.data.datasets[0]
  if (s?.points?.length) {
    ds.data = s.points
    ds.label = s.label
    ds.borderColor = c.accent
    ds.backgroundColor = c.accent + '22'
    ds.pointBackgroundColor = c.accent
    // y 轴围绕 0 对称，横轴两端保持用户设定的区间
    const ys = s.points.map((p) => p.y)
    let maxAbs = Math.max(...ys.map((v) => Math.abs(v)))
    if (!isFinite(maxAbs) || maxAbs === 0) maxAbs = 1
    maxAbs *= zoom.value
    // 上下各留出 18% 余量，避免最大值顶到边框
    chart.options.scales.y.min = -maxAbs * 1.18
    chart.options.scales.y.max = maxAbs * 1.18
  } else {
    ds.data = []
  }
  // 网格颜色跟随主题
  chart.options.scales.x.grid.color = c.grid
  chart.options.scales.y.grid.color = c.grid
  if (animate) chart.update()
  else chart.update('none')
  // 关键点（最大值 / 最小值 / 与坐标轴交点）需要在坐标轴范围确定后再算像素位置
  refreshKeyPoints()
}

function zoomIn() {
  zoom.value = Math.max(0.1, zoom.value * 0.8)
  updateChart()
  workbench.setStatus('视图已放大', 0)
}
function zoomOut() {
  zoom.value = Math.min(8, zoom.value * 1.25)
  updateChart()
  workbench.setStatus('视图已缩小', 0)
}
/** 重置视图：把显示比例恢复成 1:1（原来的「适应屏幕」与它完全等价，已删除） */
function resetView() {
  zoom.value = 1
  updateChart()
  workbench.setStatus('视图已重置', 0)
}
function shot() {
  if (!chartRef.value || !chart) return
  try {
    const name = nodeLabel.value || item.value?.label || 'chart'
    saveAs(chartRef.value.toDataURL('image/png'), `${name}.png`)
    workbench.setStatus('截图已保存', 0)
  } catch (e) {
    modal.msgError('截图失败：' + (e?.message || e))
  }
}

/** 把"打开来源"换算成入场动画的位移，写成 CSS 变量（位移做上限，避免长距离飞入） */
function applyEntranceOrigin() {
  const el = rootRef.value
  const o = props.win.origin
  if (!el || !o) return
  // 默认最大化的窗口本来就铺满中栏，位移再大就"甩"得难看：只用 1/3
  const scale = props.win.maximized || props.win.pendingMaximize ? 1 / 3 : 1
  const clamp = (v, m) => Math.max(-m, Math.min(m, v))
  const dx = clamp(((Number(o.x) || 0) - props.win.x) * scale, 260)
  const dy = clamp(((Number(o.y) || 0) - props.win.y) * scale, 220)
  el.style.setProperty('--mc-in-dx', `${Math.round(dx)}px`)
  el.style.setProperty('--mc-in-dy', `${Math.round(dy)}px`)
  // 缩放锚点朝向来处（左上/右上…），看起来就是"从这里长出来"
  el.style.setProperty('--mc-in-origin', `${dx < 0 ? '0%' : '100%'} ${dy < 0 ? '0%' : '100%'}`)
}

/** 新打开的功能窗口默认最大化：铺满中栏（之后手动还原/改尺寸会按你的设置记着） */
function maximizeOnOpenIfNeeded() {
  if (!props.win.pendingMaximize) return
  const host = document.querySelector('.window-layer') || document.querySelector('.center-canvas')
  const rect = host?.getBoundingClientRect()
  workbench.toggleMaximize(props.win.id, {
    x: 0,
    y: 0,
    w: rect ? Math.round(rect.width) : undefined,
    h: rect ? Math.round(rect.height) : undefined
  })
  workbench.clearPendingMaximize(props.win.id)
}

// 拖到别的文件夹时，store 会把 pendingMaximize 置为 true（该文件夹默认最大化）→ 这里执行
watch(
  () => props.win.pendingMaximize,
  (v) => {
    if (v) maximizeOnOpenIfNeeded()
  }
)

onMounted(async () => {
  // 入场动画：从"被点击的功能区按钮 / 引导卡片 / 树节点"位置放大出现
  applyEntranceOrigin()
  registerWindow(props.win.id, {
    zoomIn: () => {
      zoom.value = Math.max(0.1, zoom.value * 0.8)
      updateChart()
    },
    zoomOut: () => {
      zoom.value = Math.min(8, zoom.value * 1.25)
      updateChart()
    },
    fit: () => {
      zoom.value = 1
      updateChart()
    },
    reset: () => {
      zoom.value = 1
      updateChart()
    },
    screenshot: () => (chartRef.value ? chartRef.value.toDataURL('image/png') : null),
    hasChart: () => !!chart
  })
  if (hasChart.value) buildChart()
  // 默认最大化：新开的功能窗口直接铺满中栏（在入场动画这一帧完成，不会看到尺寸跳动）
  maximizeOnOpenIfNeeded()
  await autoFit()
})

onBeforeUnmount(() => {
  unregisterWindow(props.win.id)
  chart?.destroy()
  chart = null
})

watch(
  series,
  () => {
    if (hasChart.value && !chart) buildChart()
    updateChart()
  },
  { deep: true, flush: 'post' }
)

// 图表区始终存在（canvas 不会被移除），因此这里只在首次挂载时构建；
// 若画布被重建（理论上不再发生），下面的 watch 会负责重建实例
watch(
  hasChart,
  (v) => {
    if (v && !chart) {
      buildChart()
      autoFit()
    }
  },
  { flush: 'post' }
)

// 换主题只改配色：关掉 Chart.js 过渡动画，直接重绘（否则曲线会重播一次生长动画）
watch(() => themeStore.theme, () => updateChart(false))
</script>
