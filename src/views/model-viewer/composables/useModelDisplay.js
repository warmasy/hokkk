// 模型显示优化 Composable
// 负责：默认清晰边线显示、导航器中文名乱码修复、默认视角/投影、回到 intro 界面

import { findControl } from '@/viewer/o3dvControls'

// 默认开启清晰边线显示：
// - Show Edges 打开（O3DV 默认关闭，模型看着"糊"）
// - Edge Color 默认 50（RGB(50,50,50) 深灰）
// - Edge Threshold 用 60°：只画锐利特征棱线（默认 1° 会把所有三角面折痕
//   都画出来，曲面细分密线满屏反而看不清）
export function applyClearEdges() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.settings || !ws.settings.edgeSettings) return
  const es = ws.settings.edgeSettings
  es.showEdges = true
  es.edgeThreshold = 60
  // Edge Color 默认 50（深灰），用 O3DV 的 RGBColor 类型
  const Engine = window.OV.Engine || window.OV
  if (Engine && typeof Engine.RGBColor === 'function') {
    es.edgeColor = new Engine.RGBColor(50, 50, 50)
  } else {
    es.edgeColor = { r: 50, g: 50, b: 50 }
  }
  ws.UpdateEdgeDisplay()
  if (ws.sidebar) {
    ws.sidebar.UpdateControlsStatus()
  }
}

// 修复模型节点名的乱码：
// occt-import-js wasm 解析含中文名的 STEP 文件时，会把 UTF-8 中文名按错误编码
// 解码成 U+FFFD 替换符（如「初始模型」→「��ʼģ��」），导航器 Meshes/Materials
// 树里显示乱码。这里把含替换符的乱码节点名替换为正确的模型文件名（去扩展名），
// 并同步更新导航器已渲染的树文本。
export function fixGarbledModelNames() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return
  const model = ws.model
  // 取当前文件名（去掉扩展名）作为正确名称
  const fileName = (ws.parameters && ws.parameters.fileNameDiv && ws.parameters.fileNameDiv.textContent) || ''
  let correctName = fileName.replace(/\.\w+$/, '').trim()
  if (!correctName) return

  const hasGarbled = (s) => /[\uFFFD]/.test(s || '')
  const fixName = (node) => {
    if (!node || typeof node.GetName !== 'function') return
    const name = node.GetName()
    if (hasGarbled(name)) {
      try { node.SetName(correctName) } catch (e) { /* ignore */ }
    }
  }
  // 根节点
  const root = model.GetRootNode ? model.GetRootNode() : null
  if (root) {
    fixName(root)
    if (typeof root.EnumerateChildren === 'function') {
      root.EnumerateChildren((node) => {
        fixName(node)
        if (typeof node.EnumerateChildren === 'function') {
          node.EnumerateChildren((child) => fixName(child))
        }
      })
    }
  }
  // 同步修复导航器树中已渲染的乱码文本（Meshes/Materials 面板）
  const navigator = document.getElementById('main_navigator')
  if (navigator) {
    navigator.querySelectorAll('.ov_tree_item_name').forEach((el) => {
      if (hasGarbled(el.textContent)) {
        el.textContent = correctName
      }
    })
  }
}

// 回到初始页（显示 intro 拖放界面；小房子按钮点击调用）
export function restartWithIntro() {
  // 显示 intro（模板默认隐藏，Home 按钮需要它）
  const intro = document.getElementById('intro')
  if (intro) intro.style.display = 'block'
  const ws = window.o3dvWebsite
  if (!ws) return
  ws.ClearModel()
  if (typeof ws.SetUIState === 'function') {
    // 通过公开 API 回到 intro；内部方法若不可用则忽略
    try { ws.SetUIState(1) } catch (e) { /* ignore */ }
  }
}

// 取画布尺寸，专门规避"画布刚被引擎重置为 0"的瞬间：
// O3DV 在加载 / 可视化阶段会把 viewer 画布的位图尺寸设成 0，下一帧再恢复。
// 如果这一刻按 canvas.width/canvas.height 算宽高比，会得到 0 → sin(0)=0 →
// 相机距离 = 半径/0 = Infinity（模型直接飞出视野、看不见了）。
// 因此：位图尺寸无效时回退到 CSS 尺寸（clientWidth/Height），再不行就不做宽高比修正。
function getSafeCanvasSize(viewer) {
  const canvas = viewer && typeof viewer.GetCanvas === 'function' ? viewer.GetCanvas() : null
  let w = canvas ? canvas.width : 0
  let h = canvas ? canvas.height : 0
  if (!(w > 0) || !(h > 0)) {
    if (canvas) {
      w = canvas.clientWidth || 0
      h = canvas.clientHeight || 0
    }
    if ((!(w > 0) || !(h > 0)) && canvas && typeof canvas.getBoundingClientRect === 'function') {
      const rect = canvas.getBoundingClientRect()
      w = rect.width || 0
      h = rect.height || 0
    }
  }
  return { w, h }
}

// 包围球适配距离（半角正弦公式）。画布尺寸异常时不做宽高比修正，
// 并兜底 halfFov = fov/2，保证结果永远是有限正数。
function getFitDistance(viewer, sphere, camera) {
  if (!sphere || !(sphere.radius > 0) || !camera) return 0
  const size = getSafeCanvasSize(viewer)
  let halfFov = camera.fov / 2.0
  if (size.w > 0 && size.h > 0 && size.w < size.h) {
    halfFov = halfFov * (size.w / size.h)
  }
  if (!(halfFov > 0) || !isFinite(halfFov)) halfFov = camera.fov / 2.0
  const distance = sphere.radius / Math.sin((halfFov * Math.PI) / 180)
  return isFinite(distance) && distance > 0 ? distance : 0
}

/**
 * 适配距离优先用**引擎自己的算法**：viewer.navigation.GetFitToSphereCamera(center, radius)
 * 返回引擎算好的"刚好装下包围球"的相机（引擎内部还会考虑画布宽高比、正交/透视等），
 * 我们只取它的距离，方向仍用项目的 SolidWorks 等轴测方向。
 * 这样无论加载 STEP / STL / GLTF 还是用户改过投影方式，适配结果都和"适应屏幕"按钮一致，
 * 不会出现"有时很大、有时很小"。
 */
function getEngineFitDistance(viewer, sphere) {
  try {
    const nav = viewer && viewer.navigation
    if (!nav || typeof nav.GetFitToSphereCamera !== 'function') return 0
    const Engine = window.OV.Engine || window.OV
    if (!Engine || typeof Engine.Coord3D !== 'function') return 0
    const center = new Engine.Coord3D(sphere.center.x, sphere.center.y, sphere.center.z)
    const fitCamera = nav.GetFitToSphereCamera(center, sphere.radius)
    if (!fitCamera || !fitCamera.eye || !fitCamera.center) return 0
    const d = Math.sqrt(
      (fitCamera.eye.x - fitCamera.center.x) ** 2 +
        (fitCamera.eye.y - fitCamera.center.y) ** 2 +
        (fitCamera.eye.z - fitCamera.center.z) ** 2
    )
    return isFinite(d) && d > 0 ? d : 0
  } catch (e) {
    return 0
  }
}

/** 当前模型包围球是否可用（模型刚加载完时可能还没进场景，需要等它） */
export function hasValidBoundingSphere(viewer) {
  const v = viewer || (window.o3dvWebsite && window.o3dvWebsite.viewer)
  if (!v || typeof v.GetBoundingSphere !== 'function') return false
  try {
    const sphere = v.GetBoundingSphere(() => true)
    return !!sphere && isFinite(sphere.radius) && sphere.radius > 0
  } catch (e) {
    return false
  }
}

// SolidWorks 坐标系方向：默认视角 = 等轴测，观察方向从第一象限 (X+, Y+, Z+) 偏 X 侧，
// 与 SolidWorks 的默认等轴测观感一致：
//   - 屏幕上 X 轴指向右下（较陡，约 38°）
//   - Y 轴向上（垂直）
//   - Z 轴往左偏转（接近水平，约 14°）
// O3DV 默认相机在 (-17, 23, 35)（X 负方向），三轴在屏幕上的方向与 SolidWorks 相反，
// 这里纠正。相机距离按模型包围球适配（与标准视图按钮一致），因此无论用户如何缩放，
// 点击"默认视图"都会把模型还原到完整、合适的位置；方向固定为 SolidWorks 等轴测。
// animate=true 时用 MoveCamera 平滑过渡（按钮点击）；模型加载初始定位用
// animate=false 直接到位（避免加载时跳一个多余的过渡动画）。
export function setSolidWorksDefaultView(animate = true) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer) return false
  try {
    const Engine = window.OV.Engine || window.OV
    const Coord3D = Engine.Coord3D
    const viewer = ws.viewer
    // 模型包围球（中心 + 半径）；模型刚加载完时可能还没进场景 → 返回 false 让调用方重试
    const sphere = viewer.GetBoundingSphere ? viewer.GetBoundingSphere(() => true) : null
    if (!sphere || !isFinite(sphere.radius) || !(sphere.radius > 0)) return false
    const center = new Coord3D(sphere.center.x, sphere.center.y, sphere.center.z)

    // 相机适配距离：优先用引擎自己的适配算法，退化时用半角正弦公式兜底
    const camera = viewer.GetCamera()
    if (!camera) return false
    const distance = getEngineFitDistance(viewer, sphere) || getFitDistance(viewer, sphere, camera)
    // 距离算不出来（画布尺寸异常等）就不要动相机，避免把模型甩到视野外
    if (!(distance > 0)) return false
    // 方向 (1.8, 1, 1) 归一化后 * 适配距离
    const dirLen = Math.sqrt(1.8 * 1.8 + 1 + 1)
    const d = distance / dirLen
    const eye = new Coord3D(center.x + 1.8 * d, center.y + d, center.z + d)
    const up = new Coord3D(0, 1, 0)
    const newCamera = new Engine.Camera(eye, center, up, camera.fov)
    if (animate) {
      // 平滑动画过渡（与 Set Y/Z axis as up vector 相同机制）
      const steps = (viewer.settings && viewer.settings.animationSteps) || 40
      viewer.navigation.MoveCamera(newCamera, steps)
    } else {
      // 初始加载直接到位，不播放过渡动画
      viewer.SetCamera(newCamera)
    }
    return true
  } catch (e) {
    return false
  }
}

// 模型默认用正交投影（orthographic）显示。
// O3DV 默认透视投影；优先点击工具栏"正交相机"按钮完成切换，
// 让 O3DV 自己处理相机与按钮选中状态（"透视相机"按钮已被禁用）。
export function setDefaultOrthographic() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer) return
  try {
    if (ws.viewer.GetProjectionMode && ws.viewer.GetProjectionMode() === 2) return
    const toolbar = document.getElementById('toolbar')
    const orthoBtn = toolbar ? Array.from(toolbar.querySelectorAll('.ov_toolbar_button'))
      .find(b => (b.getAttribute('alt') || '').trim() === '正交相机') : null
    if (orthoBtn) {
      orthoBtn.click()
    } else {
      ws.viewer.SetProjectionMode(2)
    }
  } catch (e) { /* ignore */ }
}

// 默认导航模式 = **锁定上方向（正常转动）**：
// 水平拖 → 绕竖直轴转，竖直拖 → 俯仰，地平线始终水平。
// 之前默认的是"自由旋转"（绕相机轴转），斜着拖动会带上滚转，看起来就像模型在螺旋翻转，
// 所以改成默认锁定；想要任意翻转的话点功能区「相机 → 自由旋转」切换（再点一次恢复）。
export function setDefaultFixedUp() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer) return
  try {
    // GetNavigationMode：1 = 锁定上方向，2 = 自由旋转
    if (ws.viewer.GetNavigationMode && ws.viewer.GetNavigationMode() === 1) return
    if (typeof ws.viewer.SetNavigationMode === 'function') {
      ws.viewer.SetNavigationMode(1)
      if (typeof ws.viewer.GetNavigationMode !== 'function' || ws.viewer.GetNavigationMode() === 1) return
    }
    // 兜底：走 O3DV 自带控件
    const ctrl = findControl('fixUp')
    if (ctrl && typeof ctrl.click === 'function') ctrl.click()
  } catch (e) { /* ignore */ }
}

// 设置指定轴为向上向量：与"默认视图"一致——方向由 O3DV 计算（SetUpVector 更新内部
// 状态），但相机距离按模型包围球重新适配（而不是保留缩放后的距离）。
// 这样放大缩小后再点"设置 Y/Z 轴为向上向量"，模型会还原到完整、合适的显示位置。
// axis: 'y' | 'z'
export function setUpAxisWithFit(axis) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer) return
  try {
    const Engine = window.OV.Engine || window.OV
    const Coord3D = Engine.Coord3D
    const viewer = ws.viewer
    // 模型包围球（中心 + 半径）
    const sphere = viewer.GetBoundingSphere ? viewer.GetBoundingSphere(() => true) : null
    if (!sphere || !(sphere.radius > 0)) return
    const center = new Coord3D(sphere.center.x, sphere.center.y, sphere.center.z)

    // 1) 让 O3DV 计算目标相机方向（更新 upVector.direction 内部状态，供翻转/固定使用）
    //    UpVector 枚举：X=1, Y=2, Z=3（与 O3DV 内部一致）
    const axisValue = axis === 'z' ? 3 : 2

    // 2) 适配距离：与"默认视图"相同的包围球适配公式（画布尺寸异常时自动兜底）
    const camera = viewer.GetCamera()
    if (!camera) return
    const distance = getFitDistance(viewer, sphere, camera)
    if (!(distance > 0)) return

    // 3) 构造"距离适配、方向由 O3DV 决定"的中间相机：
    //    先把 eye 放到适配距离处（保持当前方向不变），再调用 SetUpVector，
    //    O3DV 会在该距离上旋转方向 → 最终相机 = 适配距离 + 目标轴向上。
    const cur = viewer.GetCamera()
    const curDirLen = Math.sqrt(
      (cur.eye.x - cur.center.x) ** 2 + (cur.eye.y - cur.center.y) ** 2 + (cur.eye.z - cur.center.z) ** 2
    )
    const scale = curDirLen > 0 ? distance / curDirLen : 1
    const eyeAtFitDist = new Coord3D(
      center.x + (cur.eye.x - cur.center.x) * scale,
      center.y + (cur.eye.y - cur.center.y) * scale,
      center.z + (cur.eye.z - cur.center.z) * scale
    )
    const upForInterim = new Coord3D(cur.up.x, cur.up.y, cur.up.z)
    const interimCamera = new Engine.Camera(eyeAtFitDist, center, upForInterim, cur.fov)

    // 4) 用 O3DV 官方 SetUpVector 完成方向旋转（内部更新 upVector 状态 + MoveCamera 动画）
    if (typeof viewer.SetUpVector === 'function') {
      // 先设中间相机（无动画），让 SetUpVector 基于适配距离旋转
      const nav = viewer.navigation
      if (nav && typeof nav.MoveCamera === 'function') {
        nav.MoveCamera(interimCamera, 0)
      } else {
        viewer.SetCamera(interimCamera)
      }
      viewer.SetUpVector(axisValue, true)
    } else {
      // 兜底：直接构造目标相机
      const axisDir = axis === 'z' ? [0, 0, 1] : [0, 1, 0]
      const up = new Coord3D(axisDir[0], axisDir[1], axisDir[2])
      const dirLen = Math.sqrt(
        (cur.eye.x - cur.center.x) ** 2 + (cur.eye.y - cur.center.y) ** 2 + (cur.eye.z - cur.center.z) ** 2
      )
      const d = dirLen > 0 ? distance / dirLen : 1
      const eye = new Coord3D(center.x + (cur.eye.x - cur.center.x) * d, center.y + (cur.eye.y - cur.center.y) * d, center.z + (cur.eye.z - cur.center.z) * d)
      const newCamera = new Engine.Camera(eye, center, up, cur.fov)
      const steps = (viewer.settings && viewer.settings.animationSteps) || 40
      viewer.navigation.MoveCamera(newCamera, steps)
    }
  } catch (e) { /* ignore */ }
}

// 绑定工具栏"设置 Y 轴为向上向量 / 设置 Z 轴为向上向量"按钮：
// 覆盖默认行为，改为"方向由 O3DV 计算 + 距离按包围球适配"。
export function customizeUpAxisButtons() {
  const toolbar = document.getElementById('toolbar')
  if (!toolbar) return
  const altMap = { '设置 Y 轴为向上向量': 'y', '设置 Z 轴为向上向量': 'z' }
  Array.from(toolbar.querySelectorAll('.ov_toolbar_button')).forEach((btn) => {
    const alt = (btn.getAttribute('alt') || '').trim()
    if (!altMap[alt]) return
    if (btn.__upAxisCustomized) return
    btn.__upAxisCustomized = true
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      setUpAxisWithFit(altMap[alt])
    }, true)
  })
}
