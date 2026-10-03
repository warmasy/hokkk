// 模型显示界面的 XYZ 坐标轴指示器 Composable
// 在 3D 查看器左下角显示一个固定的 XYZ 轴指示器（HUD 覆盖层）：
//   - 用相机矩阵投影出世界 XYZ 在当前视角的屏幕方向，跟随旋转实时更新
//   - 固定在画面左下角，永不离开视口（不会像场景内物体那样被移出画面）
//   - 样式与 O3DV 工具栏功能按钮图标一致：单色细线条、圆头线帽、V 形箭头、
//     无填充无光晕，颜色跟随主题（暗色浅 / 亮色深）
// 实现：在 .o3dv-root .main_viewer 内挂一个绝对定位的 2D Canvas，每帧绘制三条轴线与 XYZ 标签。

let axisEl = null     // HUD 覆盖层容器
let canvas = null     // 2D 画布
let ctx = null
let rafId = null
let disposed = false

// 当前主题的轴线/文字颜色（单色，与 O3DV 工具栏图标同风格）
let axisColor = '#e8e8e8'   // 暗色主题
let bgIsDark = true

const HUD_SIZE = 104   // HUD 画布边长（px）
const AXIS_PIXEL = 32  // 轴线绘制长度（px）
const GAP = 10         // 距左下角距离（px）

// 世界坐标三轴（X / Y / Z，标签用于区分各轴方向）
const AXES = [
  { label: 'X', dir: [1, 0, 0] },
  { label: 'Y', dir: [0, 1, 0] },
  { label: 'Z', dir: [0, 0, 1] }
]

// 是否深色主题：本项目主题写在 body 上（dark-theme / tech-theme），
// 原项目用 html.dark，两者都判断，避免坐标轴在深色主题下用深色线条看不见
function isDarkTheme() {
  return (
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark-theme') ||
    document.body.classList.contains('tech-theme')
  )
}

function getViewer() {
  const ws = window.o3dvWebsite
  return ws && ws.viewer ? ws.viewer : null
}

// 场景中的活动相机（O3DV 切换投影模式时会替换 camera，因此每帧实时查找）
function getSceneCamera(viewer) {
  if (!viewer || !viewer.scene) return null
  for (const c of viewer.scene.children) {
    if (c.isCamera) return c
  }
  return null
}

// 创建 HUD 元素（挂在 main_viewer 内，绝对定位左下角）
function ensureEl() {
  if (axisEl) return true
  const container = document.querySelector('.o3dv-root .main_viewer')
  if (!container) return false
  axisEl = document.createElement('div')
  axisEl.id = 'ov_axis_indicator_hud'
  axisEl.style.cssText = 'position:absolute;left:' + GAP + 'px;bottom:' + GAP + 'px;width:' + HUD_SIZE + 'px;height:' + HUD_SIZE + 'px;z-index:200;pointer-events:none;'
  canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:' + HUD_SIZE + 'px;height:' + HUD_SIZE + 'px;display:block;'
  axisEl.appendChild(canvas)
  container.appendChild(axisEl)
  ctx = canvas.getContext('2d')
  return true
}

// 把世界坐标轴方向转换到相机空间（正交投影），
// 返回 { x, y, len, z }：
//   x / y = 该轴在屏幕上的**投影分量**（不做单位化！长度就是它在画面上的真实比例）
//   len   = 投影长度（1 = 与视线垂直、完全展开；0 = 正对/背对镜头）
//   z     = 相机空间深度（> 0 指向观察者，< 0 背向观察者）
//
// ⚠️ 这里刻意**不做"每根轴各自归一化"**：那样会把被压缩的轴拉回等长，
// 轴的方向在接近正对镜头时还会剧烈抖动，三根轴之间的相对角度就"乱跳"了，
// 看起来不像一个刚体坐标架。保持原始投影分量，三根轴就是一个整体。
function projectAxis(axis, camera, tmp) {
  tmp.set(axis[0], axis[1], axis[2]).transformDirection(camera.matrixWorldInverse)
  const sx = tmp.x
  const sy = -tmp.y // 屏幕 y 向下
  return { x: sx, y: sy, len: Math.hypot(sx, sy), z: tmp.z }
}

// 每帧绘制（单色线条风格，与 O3DV 工具栏按钮图标一致）
function draw() {
  if (disposed || !axisEl) return
  const viewer = getViewer()
  const camera = getSceneCamera(viewer)
  if (camera && ctx) {
    try {
      camera.updateMatrixWorld()
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
    } catch (e) { /* 相机未就绪时跳过本帧 */ }
    // 每帧同步主题（跟随本项目主题，不依赖事件链）
    const isDark = isDarkTheme()
    if (isDark !== bgIsDark) updateAxisIndicatorTheme()
    // 每帧把 HUD 定位到 3D 画布左下角（main_viewer 是 static 时锚定到 .o3dv-root，
    // 这里手动换算成相对 .o3dv-root 的坐标，保证永远贴在画布左下角）
    const rootEl = document.querySelector('.o3dv-root')
    let glCanvas = null
    try { glCanvas = viewer ? viewer.GetCanvas() : null } catch (e) { glCanvas = null }
    if (rootEl && glCanvas) {
      const rr = rootEl.getBoundingClientRect()
      const cr = glCanvas.getBoundingClientRect()
      axisEl.style.left = (cr.left - rr.left + GAP) + 'px'
      axisEl.style.bottom = (rr.bottom - cr.bottom + GAP) + 'px'
    }
    const dpr = window.devicePixelRatio || 1
    const cssSize = HUD_SIZE * dpr
    if (canvas.width !== cssSize || canvas.height !== cssSize) {
      canvas.width = cssSize
      canvas.height = cssSize
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, HUD_SIZE, HUD_SIZE)

    const center = HUD_SIZE / 2
    const tmp = new (window.THREE.Vector3)()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // 先算三根轴的投影，再统一按「最长的那根 = AXIS_PIXEL」缩放：
    // 这样三根轴的相对长度与夹角完全由投影决定（刚体坐标架），
    // 而整体大小又不会在不同视角下忽大忽小。
    const items = AXES.map((a) => ({ a, s: projectAxis(a.dir, camera, tmp) }))
    const maxLen = Math.max(...items.map((it) => it.s.len), 1e-6)
    const unit = AXIS_PIXEL / maxLen

    for (const { a, s } of items) {
      // 朝向观察者（或与视线垂直）= 实线；背向观察者 = 半透明虚线
      const toward = s.z > -1e-3
      ctx.globalAlpha = toward ? 1 : 0.35

      // 与视线几乎平行（正对着 / 背对着你）：画一个小圆点 + 标签，而不是整条线消失
      if (s.len * unit < 3) {
        ctx.save()
        ctx.strokeStyle = axisColor
        ctx.fillStyle = axisColor
        ctx.lineWidth = 1.6
        ctx.setLineDash(toward ? [] : [3, 3])
        ctx.beginPath()
        ctx.arc(center, center, 3.4, 0, Math.PI * 2)
        if (toward) ctx.fill()
        else ctx.stroke()
        ctx.restore()
        ctx.font = 'bold 11px Quicksand, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = axisColor
        ctx.fillText(a.label, center, center - 15)
        ctx.globalAlpha = 1
        continue
      }

      // 轴线终点 = 投影分量 × 统一比例（不做单轴归一化，角度与长短都保持真实比例）
      const endX = center + s.x * unit
      const endY = center + s.y * unit
      const ux = s.x / s.len // 仅用于画箭头与标签的朝向
      const uy = s.y / s.len
      ctx.save()
      ctx.strokeStyle = axisColor
      ctx.lineWidth = 1.6
      ctx.setLineDash(toward ? [] : [3, 3])
      // 轴线
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      // V 形线条箭头（与 O3DV 图标箭头同风格：两段线、圆头线帽，非实心填充）
      const ARR_LEN = 7   // 箭头伸出长度
      const ARR_W = 3.5   // 箭头两翼张开宽度
      const tipX = endX + ux * ARR_LEN
      const tipY = endY + uy * ARR_LEN
      const backX = endX - ux * 2
      const backY = endY - uy * 2
      const px = -uy
      const py = ux
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(backX + px * ARR_W, backY + py * ARR_W)
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(backX - px * ARR_W, backY - py * ARR_W)
      ctx.stroke()
      ctx.restore()
      // 字母标签：箭头尖端外沿方向偏移 7px，与轴同色（无光晕，简洁线条风格）
      const lx = tipX + ux * 7
      const ly = tipY + uy * 7
      ctx.font = 'bold 11px Quicksand, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = axisColor
      ctx.globalAlpha = toward ? 1 : 0.35
      ctx.fillText(a.label, lx, ly)
      ctx.globalAlpha = 1
    }
  }
  rafId = requestAnimationFrame(draw)
}

// 初始化并启动 HUD 指示器
export function initAxisIndicator() {
  if (!ensureEl()) return
  if (rafId) cancelAnimationFrame(rafId)
  disposed = false
  updateAxisIndicatorTheme()
  rafId = requestAnimationFrame(draw)
}

// 主题切换时更新颜色（明暗两种模式都清晰可见）
export function updateAxisIndicatorTheme() {
  const isDark = isDarkTheme()
  axisColor = isDark ? '#e8e8e8' : '#2a2a2a'
  bgIsDark = isDark
}

// 卸载时清理
export function disposeAxisIndicator() {
  disposed = true
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (axisEl && axisEl.parentNode) {
    axisEl.parentNode.removeChild(axisEl)
  }
  axisEl = null
  canvas = null
  ctx = null
}
