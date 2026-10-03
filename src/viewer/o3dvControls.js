/**
 * O3DV 自带控件的定位与点击（兜底通道）
 *
 * 说明：O3DV 有一部分能力（显示边线、透明背景、环境贴图、测量等）只在它自己的侧边栏/工具栏里暴露，
 * 没有对外 API。这些控件依然存在于 DOM 中（本项目的界面把它们隐藏，只用功能区操作），
 * 因此这里用「英文界面文案」定位控件并触发点击，功能与 O3DV 官方界面完全一致。
 *
 * 3dviewer.net 的英文文案固定（来自其源码 Loc() 表），所以这种定位方式稳定、可维护：
 * 想加功能，只要在 O3DV 界面上找到对应文案，登记一条即可。
 */

/** 文案 -> 备用选择器（都不写也能用，按文案找） */
const CONTROL_LABELS = {
  fitModel: ['Fit model to window', 'Fit meshes to window', 'Fit mesh to window'],
  showEdges: ['Show Edges'],
  transparentBackground: ['Transparent background'],
  measure: ['Measure'],
  treeView: ['Tree view'],
  flatList: ['Flat list'],
  showAllMeshes: ['Show all meshes'],
  removeIsolation: ['Remove isolation'],
  upZ: ['Set Z axis as up vector'],
  upY: ['Set Y axis as up vector'],
  flipUp: ['Flip up vector', '翻转向上向量'],
  environment: ['Environment'],
  rotation: ['Rotation'],
  modelDisplay: ['Model Display'],
  settings: ['Settings'],
  fixUp: ['Fixed up vector', '固定向上向量'],
  freeOrbit: ['Free orbit', '自由旋转'],
  download: ['Download', '下载'],
  // O3DV 自带界面里的按钮/面板：本项目功能区取代了它自己的工具栏，按文案定位后触发
  details: ['详情'],
  importSettings: ['设置'],
  snapshot: ['创建快照'],
  exportModel: ['导出'],
  share: ['分享'],
  openFromUrl: ['从 URL 打开']
}

function root() {
  return document.querySelector('.o3dv-root') || document
}

/** 在 O3DV 界面里按文案找可点击元素（按钮/标签/勾选框） */
export function findControl(name, scope) {
  const labels = CONTROL_LABELS[name]
  if (!labels) return null
  const box = scope || root()
  const candidates = box.querySelectorAll('button, a, label, div[title], span[title], div[alt], input[type="checkbox"], div, span')
  for (const label of labels) {
    for (const el of candidates) {
      const text = (el.textContent || '').trim()
      const title = el.getAttribute('title') || ''
      const alt = el.getAttribute('alt') || ''
      const aria = el.getAttribute('aria-label') || ''
      if (text === label || title === label || alt === label || aria === label) return el
    }
  }
  return null
}

/**
 * 触发某个控件（勾选框会切换选中态并派发 change 事件，按钮直接 click）
 * @returns {Boolean} 是否找到并触发
 */
export function triggerControl(name) {
  const el = findControl(name)
  if (!el) return false
  const input = el.matches?.('input[type="checkbox"]') ? el : el.querySelector?.('input[type="checkbox"]')
  if (input) {
    input.checked = !input.checked
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  el.click()
  return true
}

/** 某个勾选类控件当前是否勾选 */
export function isControlChecked(name) {
  const el = findControl(name)
  if (!el) return null
  const input = el.matches?.('input[type="checkbox"]') ? el : el.querySelector?.('input[type="checkbox"]')
  return input ? !!input.checked : null
}

/** 面板里所有可选缩略图（例如环境贴图） */
export function findOptionsInPanel(panelLabel, optionText) {
  const panel = findControl(panelLabel)
  if (!panel) return null
  const container = panel.closest('.ov_panel') || panel.parentElement || panel
  const els = [...container.querySelectorAll('div, button, a, span')]
  return els.find((el) => (el.textContent || '').trim() === optionText) || null
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 触发侧栏面板里的控件：面板未展开时先点开面板再触发
 * @param {String} panelLabel 面板标题（英文文案），如 'Model Display'
 * @param {String} controlName 控件名，见 CONTROL_LABELS
 */
export async function triggerInPanel(panelLabel, controlName) {
  if (triggerControl(controlName)) return true
  const header = findControl(panelLabel)
  if (header) {
    header.click()
    await wait(80)
    if (triggerControl(controlName)) return true
  }
  return false
}

export { CONTROL_LABELS }
