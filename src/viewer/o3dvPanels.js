/**
 * O3DV 自带面板（详情 / 设置）的独立浮层
 *
 * 【设计】
 * 每个面板一个**独立浮层**（模型详情、导入设置互不干扰，不再共用一个框里互相切换）：
 *   #ov_panel_overlay_details  → 只装「详情」面板
 *   #ov_panel_overlay_settings → 只装「设置」面板
 * 浮层默认停在模型展示区（中栏）左上角，标题栏可拖动，拖动范围夹在中栏内。
 *
 * 【为什么不用 CSS 把 O3DV 的侧栏容器显示出来】
 * O3DV 的 Layouter.Resize() 用 "main 宽度 - 左容器宽度 - 右容器宽度" 算画布宽度，
 * 容器一旦有宽度，画布就会变窄且不会自动恢复（就是"界面变小"）。所以这里
 * **完全不动 O3DV 的容器**，只把面板元素（panel.panelDiv）搬进自建浮层：
 *   1. 浮层脱离文档流，引擎量到的容器宽度仍是 0 → 画布永远铺满中栏；
 *   2. 关闭时把面板元素按原顺序搬回 `.ov_panel_set_content`，引擎状态不变；
 *   3. 浮层放在 .o3dv-root 内部，O3DV 的 prefixed CSS 与 CSS 变量才作用得到。
 *
 * 【两个注意点】
 * 1) O3DV 会给侧栏/内容层写**行内高度**（容器隐藏时算出来是 0），行内样式优先级高，
 *    所以样式表里用 !important 把高度改成 auto，否则浮层只剩标题栏那么高。
 * 2) O3DV 的 ShowPanel() 会隐藏其它面板（单选用法），而我们允许两个浮层同时打开，
 *    因此样式表对浮层内的面板强制 display:block !important，不受引擎的显示/隐藏影响。
 */

import { placeElementInCanvas, makeCanvasDraggable } from '@/viewer/o3dvDialogs'
import { notifyViewerStateChanged } from '@/viewer/viewerState'

const WRAPPER_PREFIX = 'ov_panel_overlay_'
/** 面板浮层宽度（O3DV 面板本身按 ~280-320 设计） */
const OVERLAY_WIDTH = 340

/** 可独立打开的面板（chrome 与计算弹窗一致：图标+标题+窗口按钮 / 内容 / 底栏按钮） */
const PANELS = {
  details: {
    prop: 'detailsPanel',
    label: '详情',
    title: '模型详情',
    icon: 'fa-solid fa-circle-info',
    primary: { text: '适应屏幕', action: 'fit' }
  },
  settings: {
    prop: 'settingsPanel',
    label: '设置',
    title: '导入设置',
    icon: 'fa-solid fa-sliders',
    primary: { text: '复位默认', action: 'reset' }
  }
}

/** 别名（功能区里的叫法 -> 面板名） */
const ALIASES = {
  detail: 'details',
  modelDetails: 'details',
  importSettings: 'settings',
  import: 'settings'
}

function normalize(kind) {
  return ALIASES[kind] || kind
}

function rootEl() {
  return document.querySelector('.o3dv-root')
}

function sidebar() {
  const ws = window.o3dvWebsite
  return ws && ws.sidebar ? ws.sidebar : null
}

function panelSet() {
  const sb = sidebar()
  return sb && sb.panelSet && typeof sb.panelSet.ShowPanel === 'function' ? sb.panelSet : null
}

function wrapperId(key) {
  return WRAPPER_PREFIX + key
}

function wrapperEl(key) {
  return document.getElementById(wrapperId(key))
}

/** 面板内容容器（关闭时把面板元素放回这里） */
function panelContentDiv() {
  const ps = panelSet()
  if (ps && typeof ps.GetContentDiv === 'function') {
    try {
      const div = ps.GetContentDiv()
      if (div) return div
    } catch (e) { /* ignore */ }
  }
  return document.querySelector('.o3dv-root .ov_panel_set_content')
}

/** 找面板对象（找不到返回 null） */
function panelObject(key) {
  const sb = sidebar()
  if (!sb) return null
  const cfg = PANELS[key]
  if (!cfg) return null
  if (sb[cfg.prop]) return sb[cfg.prop]
  const ps = panelSet()
  const byLabel = ps && ps.panels
    ? ps.panels.find(
        (p) => (p.titleDiv?.textContent || '').trim() === cfg.label ||
          (typeof p.GetName === 'function' ? p.GetName() : '') === cfg.label
      )
    : null
  return byLabel || null
}

/** 让 O3DV 重算布局与画布尺寸（左右容器宽度都是 0，画布会铺满中栏） */
function relayout() {
  const ws = window.o3dvWebsite
  if (!ws) return
  try {
    if (ws.layouter && typeof ws.layouter.Resize === 'function') ws.layouter.Resize()
  } catch (e) { /* ignore */ }
  try {
    if (ws.viewer && typeof ws.viewer.Render === 'function') ws.viewer.Render()
  } catch (e) { /* ignore */ }
}

function relayoutSoon() {
  relayout()
  setTimeout(relayout, 80)
  setTimeout(relayout, 260)
}

/** 把模型适配到窗口（详情面板底栏的「适应屏幕」） */
function fitModelToWindow() {
  const ws = window.o3dvWebsite
  try {
    if (ws && ws.viewer && typeof ws.viewer.FitSphereToWindow === 'function') {
      const sphere = typeof ws.viewer.GetBoundingSphere === 'function' ? ws.viewer.GetBoundingSphere(() => true) : null
      if (sphere) {
        ws.viewer.FitSphereToWindow(sphere, true)
        return true
      }
    }
    if (ws && typeof ws.FitModelToWindow === 'function') {
      ws.FitModelToWindow()
      return true
    }
  } catch (e) { /* ignore */ }
  return false
}

/** 复位面板默认设置（设置面板底栏的「复位默认」= 点引擎面板自带的 Reset to Default） */
function resetPanelDefaults(key) {
  const panel = panelObject(key)
  const btn =
    (panel && panel.resetToDefaultsButton) ||
    (panel && panel.panelDiv ? panel.panelDiv.querySelector('.ov_button') : null)
  if (btn && typeof btn.click === 'function') {
    btn.click()
    return true
  }
  return false
}

/** 面板底栏 / 标题栏按钮的动作 */
function runPanelAction(key, action) {
  if (action === 'close') {
    closePanelOverlay(key)
    return
  }
  if (action === 'fit') {
    fitModelToWindow()
    return
  }
  if (action === 'reset') {
    resetPanelDefaults(key)
  }
}

/** 摆到中栏左上角（拖动过就沿用拖动后的位置；与已打开的其它面板错开，避免完全重叠） */
function placeOverlay(key) {
  const wrapper = wrapperEl(key)
  if (!wrapper) return
  placeElementInCanvas(wrapper, { width: OVERLAY_WIDTH, minWidth: 280 })
  if (wrapper.__mcPos) return // 用户拖动过 → 保持不动
  const host = document.querySelector('.center-canvas')
  const hostRect = host ? host.getBoundingClientRect() : null
  if (!hostRect) return
  const others = openPanelOverlayKeys()
    .filter((k) => k !== key)
    .map((k) => wrapperEl(k))
    .filter(Boolean)
  if (!others.length) return
  const mine = wrapper.getBoundingClientRect()
  let left = mine.left
  let top = mine.top
  let step = 0
  const taken = (l, t) =>
    others.some((o) => {
      const r = o.getBoundingClientRect()
      return Math.abs(r.left - l) < 6 && Math.abs(r.top - t) < 6
    })
  while (taken(left, top) && step < 8) {
    step++
    left += 24
    top += 24
  }
  if (!step) return
  wrapper.__mcPos = {
    left: Math.min(left, Math.max(hostRect.left, hostRect.right - mine.width)),
    top: Math.min(top, Math.max(hostRect.top, hostRect.bottom - mine.height))
  }
  placeElementInCanvas(wrapper, { width: OVERLAY_WIDTH, minWidth: 280 })
}

/** 内容变化后重新摆位（面板数据是异步长出来的） */
function watchOverlay(key) {
  const wrapper = wrapperEl(key)
  if (!wrapper) return
  placeOverlay(key)
  requestAnimationFrame(() => placeOverlay(key))
  ;[60, 180, 420].forEach((ms) => setTimeout(() => placeOverlay(key), ms))
  if (!wrapper.__mcResizeBound) {
    window.addEventListener('resize', () => placeOverlay(key))
    wrapper.__mcResizeBound = true
  }
  if (typeof ResizeObserver === 'function' && !wrapper.__mcRo) {
    const body = wrapper.querySelector('.ov_panel_overlay_body')
    if (body && body.firstElementChild) {
      const ro = new ResizeObserver(() => placeOverlay(key))
      ro.observe(body.firstElementChild)
      wrapper.__mcRo = ro
    }
  }
}

/** 创建浮层骨架：标题栏（图标 + 标题 + 窗口按钮，可拖动）+ 内容 + 底栏，与计算弹窗同构 */
function ensureOverlay(key) {
  let wrapper = wrapperEl(key)
  if (wrapper) return wrapper
  const root = rootEl()
  if (!root) return null
  const cfg = PANELS[key]
  wrapper = document.createElement('div')
  wrapper.id = wrapperId(key)
  wrapper.className = 'ov_panel_overlay'
  wrapper.dataset.panel = key
  wrapper.innerHTML =
    '<div class="ov_panel_overlay_bar">' +
    `<i class="${cfg ? cfg.icon : 'fa-solid fa-table-columns'}"></i>` +
    `<span class="ov_panel_overlay_title">${cfg ? cfg.title : key}</span>` +
    '<span class="ov_panel_overlay_spacer"></span>' +
    `<button class="ov_panel_overlay_btn" data-action="primary" title="${cfg && cfg.primary ? cfg.primary.text : ''}"><i class="fa-solid fa-expand"></i></button>` +
    '<button class="ov_panel_overlay_btn close" data-action="close" title="关闭"><i class="fa-solid fa-xmark"></i></button>' +
    '</div>' +
    '<div class="ov_panel_overlay_body"></div>' +
    '<div class="ov_panel_overlay_footer">' +
    `<button class="primary" data-action="primary">${cfg && cfg.primary ? cfg.primary.text : '确定'}</button>` +
    '<button data-action="close">关闭</button>' +
    '</div>'
  const primaryIcon = cfg && cfg.primary && cfg.primary.action === 'reset'
    ? 'fa-solid fa-rotate-left'
    : 'fa-solid fa-expand'
  const iconEl = wrapper.querySelector('.ov_panel_overlay_btn[data-action="primary"] i')
  if (iconEl) iconEl.className = primaryIcon
  wrapper.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.getAttribute('data-action')
    btn.addEventListener('click', () => {
      const resolved = action === 'primary' ? (cfg && cfg.primary ? cfg.primary.action : 'close') : action
      runPanelAction(key, resolved)
    })
  })
  makeCanvasDraggable(wrapper, wrapper.querySelector('.ov_panel_overlay_bar'))
  root.appendChild(wrapper)
  watchOverlay(key)
  return wrapper
}

/** 该面板的浮层是否已打开 */
export function isPanelOverlayOpen(kind) {
  return !!wrapperEl(normalize(kind))
}

/** 已打开的面板浮层列表 */
export function openPanelOverlayKeys() {
  return Object.keys(PANELS).filter((key) => !!wrapperEl(key))
}

/**
 * 打开某个面板浮层（每个面板独立一个框，可同时打开）
 * @returns {Boolean} 是否成功
 */
export function openPanelOverlay(kind) {
  const key = normalize(kind)
  if (!PANELS[key]) return false
  const root = rootEl()
  const panel = panelObject(key)
  if (!root || !panel || !panel.panelDiv) return false
  const wrapper = ensureOverlay(key)
  if (!wrapper) return false
  const body = wrapper.querySelector('.ov_panel_overlay_body')
  if (body && panel.panelDiv.parentElement !== body) body.appendChild(panel.panelDiv)
  // 让引擎把面板内容准备好（它内部是单选用法：会隐藏别的面板，靠 CSS 强制显示兜住）
  const ps = panelSet()
  if (ps) {
    try {
      ps.ShowPanels(true)
      ps.ShowPanel(panel)
    } catch (e) { /* ignore */ }
  }
  watchOverlay(key)
  relayoutSoon()
  notifyViewerStateChanged()
  return true
}

/** 关闭某个面板浮层：把该面板元素放回引擎的内容容器（其它浮层不受影响） */
export function closePanelOverlay(kind) {
  const key = normalize(kind)
  const wrapper = wrapperEl(key)
  if (!wrapper) return false
  wrapper.__mcRo?.disconnect()
  wrapper.__mcRo = null
  const panel = panelObject(key)
  const content = panelContentDiv()
  if (panel && panel.panelDiv && content && panel.panelDiv.parentElement !== content) {
    content.appendChild(panel.panelDiv)
  }
  wrapper.remove()
  relayoutSoon()
  notifyViewerStateChanged()
  return true
}

/** 打开 / 关闭某个面板浮层，返回打开后的状态 */
export function togglePanelOverlay(kind) {
  const key = normalize(kind)
  if (isPanelOverlayOpen(key)) {
    closePanelOverlay(key)
    return false
  }
  return openPanelOverlay(key)
}

/** 重新摆位所有已打开的面板浮层（中栏尺寸恢复后调用） */
export function placeAllPanelOverlays() {
  openPanelOverlayKeys().forEach((key) => {
    watchOverlay(key)
    placeOverlay(key)
  })
}

export { PANELS, OVERLAY_WIDTH }
