/**
 * O3DV 自带弹窗（对话框 / 弹层 / 加载进度）的统一样式与位置
 *
 * 背景：O3DV 把它的弹窗 append 到 document.body，并按"整个浏览器窗口"居中。
 * 本项目是一个三栏工作台，模型只在中间栏显示，所以弹窗必须：
 *   1) 位置：默认停在**模型展示区（中栏）左上角**，并且任何时候都不超出中栏；
 *      标题栏可拖动（拖到哪就停在哪，同样夹在中栏内）；
 *   2) 样式：加 mc-ov-card 类，由样式表按本项目主题变量配色，
 *      与计算弹窗（CalcWindow）一致 —— 同一个标题栏 / 正文 / 底栏结构。
 *
 * 这里只负责"位置 + 拖动 + 标记类"，配色全部在 CSS 里（o3dv-fixes.css）。
 */

/** 需要接管的弹窗（测量面板是跟随鼠标的读数条，位置由 O3DV 自己算，不能动） */
const CARD_SELECTOR = 'body > div.ov_dialog, body > div.ov_popup, body > div.ov_progress'

/** 中栏四周留白（只作用于"默认位置"，拖动时可以贴边） */
const PADDING = 12

/** 拖动判定阈值（小于它算点击，不算拖动） */
const DRAG_THRESHOLD = 4

let observer = null
let resizeHandler = null

function hostRect() {
  const host = document.querySelector('.center-canvas')
  if (!host) return null
  const r = host.getBoundingClientRect()
  if (r.width < 80 || r.height < 80) return null
  return r
}

const clamp = (v, min, max) => (max < min ? min : Math.max(min, Math.min(v, max)))

/**
 * 把浮层放进中栏：默认左上角（内缩 12px）；用户拖动过就沿用拖动后的位置
 * 夹取时**允许完全贴边**（clampPadding=0），也就是能拖到中栏的最边上
 * @param {HTMLElement} el
 * @param {{width?:Number, inset?:Number, clampPadding?:Number, minWidth?:Number, minHeight?:Number}} opts
 */
export function placeElementInCanvas(el, opts = {}) {
  if (!el || !el.isConnected) return
  const r = hostRect()
  if (!r) return
  const inset = opts.inset === undefined ? PADDING : opts.inset
  const clampPad = opts.clampPadding === undefined ? 0 : opts.clampPadding
  const maxW = Math.max(opts.minWidth || 260, r.width - clampPad * 2)
  const maxH = Math.max(opts.minHeight || 200, r.height - clampPad * 2)
  el.style.setProperty('position', 'fixed', 'important')
  el.style.setProperty('max-width', maxW + 'px', 'important')
  el.style.setProperty('max-height', maxH + 'px', 'important')
  if (opts.width) el.style.setProperty('width', Math.min(opts.width, maxW) + 'px', 'important')
  // 内容可能是异步长出来的（预览图、文件列表、面板数据），用实际尺寸夹取
  const w = Math.min(el.offsetWidth || 0, maxW)
  const h = Math.min(el.offsetHeight || 0, maxH)
  const minLeft = r.left + clampPad
  const minTop = r.top + clampPad
  const maxLeft = Math.max(minLeft, r.right - clampPad - w)
  const maxTop = Math.max(minTop, r.bottom - clampPad - h)
  const saved = el.__mcPos
  const left = saved ? clamp(saved.left, minLeft, maxLeft) : r.left + inset
  const top = saved ? clamp(saved.top, minTop, maxTop) : r.top + inset
  if (saved) {
    saved.left = left
    saved.top = top
  }
  el.style.setProperty('left', Math.round(left) + 'px', 'important')
  el.style.setProperty('top', Math.round(top) + 'px', 'important')
  el.style.setProperty('transform', 'none', 'important')
  el.style.setProperty('margin', '0', 'important')
}

/**
 * 让浮层可以拖动（按住把手拖动，拖不出中栏）
 * @param {HTMLElement} el 被拖动的浮层
 * @param {HTMLElement} handle 拖动把手（一般是标题栏；不给就用整个浮层）
 */
export function makeCanvasDraggable(el, handle) {
  const h = handle || el
  if (!el || !h || h.__mcDragBound) return
  h.__mcDragBound = true
  h.classList.add('mc-draggable')
  h.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    // 从输入框 / 按钮 / 关闭按钮上按下时不拖动（否则会吃掉点击）
    if (e.target.closest && e.target.closest('input, select, textarea, .ov_button, .ov_dialog_button, .ov_panel_overlay_close')) return
    const startX = e.clientX
    const startY = e.clientY
    const rect = el.getBoundingClientRect()
    let dragging = false
    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        dragging = true
        el.classList.add('mc-dragging')
        document.body.style.userSelect = 'none'
        ev.preventDefault()
      }
      const r = hostRect()
      if (!r) return
      // 拖动允许完全贴边（不内缩）
      const minLeft = r.left
      const minTop = r.top
      const maxLeft = Math.max(minLeft, r.right - el.offsetWidth)
      const maxTop = Math.max(minTop, r.bottom - el.offsetHeight)
      const left = clamp(rect.left + dx, minLeft, maxLeft)
      const top = clamp(rect.top + dy, minTop, maxTop)
      el.__mcPos = { left, top }
      el.style.setProperty('left', Math.round(left) + 'px', 'important')
      el.style.setProperty('top', Math.round(top) + 'px', 'important')
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      el.classList.remove('mc-dragging')
      if (dragging) el.__mcDragMoved = true
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  })
}

/** 弹窗：默认左上角 + 标题栏可拖动；中栏不可见时隐藏（避免在别的界面弹出模型加载框） */
function placeCard(el) {
  if (!hostRect()) {
    el.style.setProperty('display', 'none', 'important')
    el.__mcHidden = true
    return
  }
  if (el.__mcHidden) {
    el.style.removeProperty('display')
    el.__mcHidden = false
  }
  placeElementInCanvas(el)
  makeCanvasDraggable(el, el.querySelector('.ov_dialog_title') || el.querySelector('.ov_popup_list') || el)
}

/** 内容异步变大时重新居中（预览图 / 列表 / 多行文本） */
function watchCard(el) {
  if (el.__mcDialogRo) return
  placeCard(el)
  requestAnimationFrame(() => placeCard(el))
  ;[60, 180, 420, 900].forEach((ms) => setTimeout(() => placeCard(el), ms))
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => placeCard(el))
    ro.observe(el)
    el.__mcDialogRo = ro
  }
}

function handleNode(node) {
  if (!node || node.nodeType !== 1) return
  if (node.matches && node.matches(CARD_SELECTOR)) {
    node.classList.add('mc-ov-card')
    watchCard(node)
  }
  // 弹窗外层可能包一层容器，兜底往下找一层
  if (node.querySelectorAll) {
    node.querySelectorAll('div.ov_dialog, div.ov_popup, div.ov_progress').forEach((child) => {
      if (child.parentElement === document.body || child.closest('.o3dv-root')) {
        child.classList.add('mc-ov-card')
        watchCard(child)
      }
    })
  }
}

/** 中栏尺寸变化 / 主题切换时重新摆位 */
export function placeO3dvCards() {
  document.querySelectorAll('body > .mc-ov-card').forEach(placeCard)
}

/** 开始接管 O3DV 弹窗的位置与主题类（幂等，可重复调用） */
export function initO3dvDialogTheme() {
  document.querySelectorAll(CARD_SELECTOR).forEach((el) => {
    el.classList.add('mc-ov-card')
    watchCard(el)
  })
  if (!observer) {
    observer = new MutationObserver((records) => {
      records.forEach((rec) => {
        rec.addedNodes.forEach(handleNode)
      })
    })
    observer.observe(document.body, { childList: true })
  }
  if (!resizeHandler) {
    resizeHandler = () => placeO3dvCards()
    window.addEventListener('resize', resizeHandler)
  }
}

/** 停止接管：移除监听与标记类（弹窗本身由 O3DV 自己清理） */
export function disposeO3dvDialogTheme() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  document.querySelectorAll('body > .mc-ov-card').forEach((el) => {
    el.__mcDialogRo?.disconnect()
    el.__mcDialogRo = null
    el.classList.remove('mc-ov-card')
  })
}
