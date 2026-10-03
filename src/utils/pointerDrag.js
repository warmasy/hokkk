/**
 * 通用指针拖拽
 *
 * 为什么不用 HTML5 的 draggable：
 * 元素一旦设成 draggable="true"，鼠标按下后只要移动几个像素，浏览器就会进入原生拖拽，
 * click 事件根本不会触发 —— 表现为"点了没反应"。这里改用指针事件自己判定阈值：
 *   移动 < threshold：什么都不做，保留原生点击
 *   移动 ≥ threshold：进入拖拽（显示跟随光标的幽灵标签、高亮落点）
 */
let ghost = null

function createGhost(label) {
  const el = document.createElement('div')
  el.className = 'ptr-ghost'
  el.textContent = label
  document.body.appendChild(el)
  return el
}

/**
 * @param {PointerEvent} event  pointerdown 事件
 * @param {Object} options
 *   threshold  移动多少像素才算拖拽（默认 6）
 *   label      拖拽时跟随光标的文字
 *   onStart(ev)
 *   onMove(ev, elementUnderPointer)
 *   onDrop(ev, elementUnderPointer)
 *   onCancel()
 */
export function beginPointerDrag(event, options = {}) {
  const { threshold = 6, label = '', onStart, onMove, onDrop, onCancel } = options
  if (event.button !== 0) return
  const startX = event.clientX
  const startY = event.clientY
  let started = false

  const move = (ev) => {
    if (!started) {
      if (Math.abs(ev.clientX - startX) < threshold && Math.abs(ev.clientY - startY) < threshold) return
      started = true
      document.body.classList.add('mc-dragging')
      ghost = label ? createGhost(label) : null
      onStart?.(ev)
    }
    if (ghost) ghost.style.transform = `translate3d(${ev.clientX + 12}px, ${ev.clientY + 10}px, 0)`
    onMove?.(ev, document.elementFromPoint(ev.clientX, ev.clientY))
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('blur', cancel)
    document.body.classList.remove('mc-dragging')
    if (ghost) {
      ghost.remove()
      ghost = null
    }
  }

  function up(ev) {
    cleanup()
    if (started) onDrop?.(ev, document.elementFromPoint(ev.clientX, ev.clientY))
  }

  function cancel() {
    cleanup()
    if (started) onCancel?.()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('blur', cancel)
}

/**
 * 浏览树的落点判定：指针下面是文件夹还是节点（节点的上半/下半决定插到前面还是后面）
 * @returns {{ folderKey, nodeId, pos }} pos 为 'before' | 'after' | ''
 */
export function treeDropTarget(ev, el) {
  const empty = { folderKey: '', nodeId: '', pos: '' }
  if (!el || !el.closest) return empty
  const itemEl = el.closest('.tree-item')
  if (itemEl?.dataset?.node) {
    const r = itemEl.getBoundingClientRect()
    return {
      folderKey: itemEl.dataset.folder || '',
      nodeId: itemEl.dataset.node,
      pos: ev.clientY > r.top + r.height / 2 ? 'after' : 'before'
    }
  }
  const folderEl = el.closest('.tree-folder')
  if (folderEl?.dataset?.folder) return { folderKey: folderEl.dataset.folder, nodeId: '', pos: '' }
  return empty
}
