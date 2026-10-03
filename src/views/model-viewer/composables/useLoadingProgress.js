// 模型加载进度增强 Composable
// O3DV 的加载弹窗只有文字（Loading Model / Importing Model / Visualizing Model），
// 这里给弹窗加上百分比数字与进度动画：
//   - 弹窗出现时插入百分比元素，按时间模拟 0%→95% 增长
//   - 若模型加载很快（弹窗显示时间过短），用假进度弹窗补足最小展示时长，
//     让用户能看到加载全过程；加载时间正常时不做额外延时
import { onMounted, onBeforeUnmount } from 'vue'

const MIN_DISPLAY_MS = 900   // 加载界面最短展示时长（快速加载时补足）
const PERCENT_MS = 2200      // 百分比从 5% 走到 95% 的模拟时长

let observer = null
let watchedProgress = null   // 当前正在观察的 O3DV 进度弹窗
let showStartTime = 0
let percentEl = null
let animRaf = null
let fakeProgress = null      // 补足展示时长的假进度弹窗
let fakeStartTime = 0

// 百分比元素（挂在进度弹窗内）
function ensurePercentEl(prog) {
  let el = prog.querySelector('.ov_progress_percent')
  if (!el) {
    el = document.createElement('div')
    el.className = 'ov_progress_percent'
    el.textContent = '0%'
    prog.appendChild(el)
  }
  return el
}

// 按经过时间更新百分比
function updatePercent(el, startTime, base) {
  const elapsed = Date.now() - startTime
  const pct = Math.min(95, base + (elapsed / PERCENT_MS) * 90)
  el.textContent = Math.max(0, Math.round(pct)) + '%'
}

function stopAnim() {
  if (animRaf) {
    cancelAnimationFrame(animRaf)
    animRaf = null
  }
}

// 启动百分比动画
function startPercent(el, startTime, base) {
  stopAnim()
  const step = () => {
    if (el && el.isConnected) {
      updatePercent(el, startTime, base)
      animRaf = requestAnimationFrame(step)
    } else {
      animRaf = null
    }
  }
  animRaf = requestAnimationFrame(step)
}

// 移除假进度弹窗（含遮罩）
function removeFake() {
  if (fakeProgress && fakeProgress.parentNode) {
    fakeProgress.parentNode.removeChild(fakeProgress)
  }
  fakeProgress = null
  stopAnim()
}

// 模型查看卡片区域（加载界面只显示在卡片内，不盖住侧边栏/顶栏）
function getCardRect() {
  const card = document.querySelector('.model-card')
  if (!card) return null
  const r = card.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

// 把进度弹窗定位到卡片区域中心
function positionInCard(el) {
  const rect = getCardRect()
  if (!rect || !el) return
  el.style.setProperty('position', 'fixed', 'important')
  el.style.setProperty('top', (rect.top + rect.height / 2 - el.offsetHeight / 2) + 'px', 'important')
  el.style.setProperty('left', (rect.left + rect.width / 2 - el.offsetWidth / 2) + 'px', 'important')
  el.style.setProperty('transform', 'none', 'important')
  el.style.setProperty('margin', '0', 'important')
}

// 补足展示时长：O3DV 弹窗关闭太早时，用卡片区域遮罩 + 假进度弹窗延续到最短时长，
// 遮罩盖住已渲染的模型（只在卡片区域内），等加载界面结束再显示模型
function showFakeProgress(remainMs) {
  removeFake()
  // 遮罩：覆盖模型查看卡片区域（不盖侧边栏/顶栏/页脚）
  fakeProgress = document.createElement('div')
  fakeProgress.className = 'ov_progress_mask'
  fakeProgress.__ovFake = true // 标记：observer 忽略假弹窗，避免循环
  const rect = getCardRect()
  if (rect) {
    fakeProgress.style.setProperty('position', 'fixed', 'important')
    fakeProgress.style.setProperty('inset', 'auto', 'important')
    fakeProgress.style.setProperty('left', rect.left + 'px', 'important')
    fakeProgress.style.setProperty('top', rect.top + 'px', 'important')
    fakeProgress.style.setProperty('width', rect.width + 'px', 'important')
    fakeProgress.style.setProperty('height', rect.height + 'px', 'important')
  }
  const box = document.createElement('div')
  box.className = 'ov_progress'
  const text = document.createElement('div')
  text.className = 'ov_progress_text'
  text.textContent = 'Loading Model'
  const pct = document.createElement('div')
  pct.className = 'ov_progress_percent'
  pct.textContent = '0%'
  box.appendChild(text)
  box.appendChild(pct)
  fakeProgress.appendChild(box)
  document.body.appendChild(fakeProgress)
  fakeStartTime = Date.now()
  const base = 0
  startPercent(pct, fakeStartTime, base)
  // 到达最短时长后移除（并结束动画）
  setTimeout(() => {
    removeFake()
  }, remainMs)
}

// 观察 body 下 O3DV 进度弹窗的出现与移除
function scanProgress() {
  const prog = document.querySelector('body > div.ov_progress')
  // 假进度弹窗（补足展示用）由自身定时器管理，observer 忽略
  if (prog && prog.__ovFake) return

  // 新弹窗出现：开始观察
  if (prog && prog !== watchedProgress) {
    watchedProgress = prog
    showStartTime = Date.now()
    percentEl = ensurePercentEl(prog)
    startPercent(percentEl, showStartTime, 0)
    // 定位到模型查看卡片区域中心（等一帧渲染后 offsetWidth 可用）
    setTimeout(() => {
      positionInCard(prog)
    }, 0)
    return
  }

  // 被观察的弹窗被移除（O3DV 关闭加载界面）
  if (watchedProgress && !document.body.contains(watchedProgress)) {
    const elapsed = Date.now() - showStartTime
    watchedProgress = null
    percentEl = null
    stopAnim()
    // 加载太快（小于最短展示时长）：补足显示，让用户看到加载过程
    if (elapsed < MIN_DISPLAY_MS) {
      showFakeProgress(MIN_DISPLAY_MS - elapsed)
    }
  }
}

export function initLoadingProgress() {
  if (observer) return
  observer = new MutationObserver(() => {
    // 每次 DOM 变化都检查进度弹窗状态
    scanProgress()
  })
  observer.observe(document.body, { childList: true, subtree: false })
}

export function disposeLoadingProgress() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  watchedProgress = null
  percentEl = null
  stopAnim()
  removeFake()
}
