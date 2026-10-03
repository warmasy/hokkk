/**
 * 模型查看控制器（3D 查看器内核）
 *
 * 基于 3dviewer.net / Online3DViewer 开源引擎（O3DV）封装，所有调用都对着实测过的真实 API：
 *   window.o3dvWebsite  -> 站点实例：model / viewer / settings / 加载 / 清空 / 面板刷新
 *   window.OV.Engine    -> 引擎：Camera、Coord3D、RGBColor、ProjectionMode、Direction…
 *
 * 分层：
 *   本文件只做「引擎能力 -> 稳定命令」的映射；功能区按钮的注册与状态在
 *   src/viewer/commands.js 与 src/store/modules/modelView.js。
 */
import { ensureO3dvAssets, releaseO3dvAssets, O3DV_PATHS } from './o3dvLoader'
import { triggerInPanel } from './o3dvControls'

/**
 * 标准视角。
 *
 * ⚠️ 坐标约定（本项目的 3D 视图统一按这套来，改之前先对齐）：
 *   - **Y 轴向上**（和默认视角 / SolidWorks 风格默认视角一致，`setSolidWorksDefaultView` 用的就是 up = (0,1,0)）
 *   - **+Z 是正前方**（默认等轴测相机的方向是 (+X, +Y, +Z)，也就是从"前-右-上"看模型，所以正视图=相机在 +Z）
 *   - +X 向右
 * 六面视角都按这个约定给 dir（相机相对模型中心的方向）与 up（画面上方向）：
 *   正视 = +Z、后视 = -Z、左视 = -X、右视 = +X、俯视 = +Y、仰视 = -Y。
 * 俯视/仰视的 up 取 ∓Z，这样"正前方(+Z)"在俯视图里朝下、在仰视图里朝上，符合工程制图习惯。
 */
export const VIEW_PRESETS = {
  iso: { label: '等轴测', dir: [1.8, 1, 1], up: [0, 1, 0] },
  front: { label: '正视', dir: [0, 0, 1], up: [0, 1, 0] },
  back: { label: '后视', dir: [0, 0, -1], up: [0, 1, 0] },
  left: { label: '左视', dir: [-1, 0, 0], up: [0, 1, 0] },
  right: { label: '右视', dir: [1, 0, 0], up: [0, 1, 0] },
  top: { label: '俯视', dir: [0, 1, 0], up: [0, 0, -1] },
  bottom: { label: '仰视', dir: [0, -1, 0], up: [0, 0, 1] }
}

/** 背景色预设 */
export const BACKGROUND_PRESETS = {
  light: { label: '浅色', rgb: [255, 255, 255] },
  gray: { label: '灰色', rgb: [200, 200, 200] },
  dark: { label: '深色', rgb: [40, 42, 46] },
  tech: { label: '科技蓝', rgb: [10, 18, 34] }
}

const site = () => window.o3dvWebsite || null
const engine = () => window.OV?.Engine || null

/** 默认模型（第一次进入模型查看时自动加载的那个，「重置」也回到它） */
const DEFAULT_MODEL_URL = '/初始模型.STEP'

function call(obj, method, ...args) {
  if (obj && typeof obj[method] === 'function') {
    try {
      return obj[method](...args)
    } catch (e) {
      console.warn(`[modelViewer] ${method} 调用失败`, e)
    }
  }
  return undefined
}

function makeCoord(x, y, z) {
  const E = engine()
  if (E?.Coord3D) return new E.Coord3D(x, y, z)
  return { x, y, z }
}

function makeColor(r, g, b) {
  const E = engine()
  if (E?.RGBColor) return new E.RGBColor(r, g, b)
  if (E?.Color) return new E.Color(r, g, b)
  return { r, g, b }
}

export const modelViewer = {
  state: { ready: false, loading: false, hasModel: false, modelName: '', error: '' },

  _container: null,
  _callbacks: {},
  _parts: [],
  _rotating: false,
  /** 用户是否主动加载过模型（用于避免被启动时的默认模型覆盖） */
  _manualLoad: false,

  /** 用户主动加载过模型？（功能区示例 / 打开文件 / 重置都会置位） */
  hasManualLoad() {
    return !!this._manualLoad
  },

  on(handlers = {}) {
    this._callbacks = { ...this._callbacks, ...handlers }
  },
  _emit(type, payload) {
    const fn = this._callbacks[type]
    if (typeof fn === 'function') fn(payload)
  },

  // ------------------------------------------------------------ 初始化 / 卸载
  async init(container) {
    if (this.state.ready && this._container === container) return true
    this._container = container
    this.state.error = ''
    const OV = await ensureO3dvAssets()
    if (!OV || typeof OV.StartWebsite !== 'function') {
      this.state.error = '3D 引擎加载失败，请确认 public/o3dv 与 public/o3dv-site 资源存在'
      this._emit('error', this.state.error)
      return false
    }
    if (typeof OV.SetWebsiteEventHandler === 'function') {
      OV.SetWebsiteEventHandler((eventName) => {
        if (eventName === 'model_loaded') {
          this.state.hasModel = true
          this.state.loading = false
          this.refreshParts()
          this._emit('modelLoaded')
          // 加载完成后自动适应窗口，避免视角看不到模型
          setTimeout(() => this.fit(), 80)
        }
      })
    }
    OV.StartWebsite()
    const intro = document.getElementById('intro')
    if (intro) intro.style.display = 'none'
    this.state.ready = true
    this._bindResize()
    return true
  },

  _bindResize() {
    if (!this._container || typeof ResizeObserver === 'undefined') return
    this._ro?.disconnect()
    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(this._container)
  },

  /**
   * 让 O3DV 按当前容器重算布局与画布尺寸（隐藏了它自带的框架后必须调用）
   *
   * 【重要】不要调用 viewer.Resize()（不带参数）！
   * O3DV 的画布尺寸接口是 Resize(width, height)，内部会算 width - margin：
   *   viewer.Resize() → 宽高是 undefined → 减完是 NaN → three.js setSize(NaN, NaN)
   *   → canvas.width 被置为 0 → 画布位图 0×0，画面全空
   *   （现象就是"模型加载出来一闪就消失、有时又不显示"，而且画布 CSS 尺寸还是好的）
   * 正确做法是调 layouter.Resize()：它按 容器宽度 - 左右容器宽度 算出正确宽高。
   */
  syncLayout() {
    const ws = site()
    this._resizeByLayouter(ws)
    call(ws && ws.viewer, 'Render')
  },

  /** 按 layouter 重算尺寸；layouter 不可用时退化为显式传容器尺寸 */
  _resizeByLayouter(ws) {
    if (!ws) return
    if (ws.layouter && typeof ws.layouter.Resize === 'function') {
      call(ws.layouter, 'Resize')
      return
    }
    const box = this._container
    if (box && ws.viewer && typeof ws.viewer.Resize === 'function') {
      try {
        ws.viewer.Resize(box.clientWidth, box.clientHeight)
      } catch (e) { /* ignore */ }
    }
  },

  resize() {
    const ws = site()
    this._resizeByLayouter(ws)
    call(ws && ws.viewer, 'Render')
  },

  dispose() {
    this.stopAutoRotate()
    this._ro?.disconnect()
    this._ro = null
    document
      .querySelectorAll('body > div.pcr-app, body > div.ov_tooltip, body > div.ov_measure_panel, body > div.ov_modal, body > div.ov_dialog, body > div.ov_popup, body > div.ov_progress')
      .forEach((el) => el.remove())
    window.onhashchange = null
    releaseO3dvAssets()
    this.state.ready = false
    this.state.hasModel = false
    this.state.modelName = ''
    this._parts = []
    this._container = null
  },

  // ------------------------------------------------------------ 加载 / 清空
  loadFromUrls(urls, name = '') {
    const ws = site()
    const E = engine()
    if (!ws || !E) return false
    const Settings = E.ImportSettings
    if (!Settings) return false
    this._manualLoad = true // 用户主动加载过模型 → 启动时的"默认模型"不要再盖上去
    this.state.loading = true
    this.state.error = ''
    this.state.hasModel = false
    this.state.modelName = name || this._fileName(urls[0])
    this._emit('loading', { name: this.state.modelName })
    call(ws, 'LoadModelFromUrlList', urls, new Settings())
    return true
  },

  loadFromUrl(url, name = '') {
    return this.loadFromUrls([url], name)
  },

  /**
   * 重置：设置恢复默认 + 重新加载默认模型（功能区「重置」按钮）
   * 1) 先用引擎自带的 Reset to Default 把设置恢复默认（背景 / 环境贴图 / 显示项 / 导入参数）；
   * 2) 再重新加载默认模型，模型数据、材质颜色、视角由"模型加载完成"回调统一恢复为项目默认。
   */
  reset() {
    const ws = site()
    const E = engine()
    if (!ws) return false
    try {
      const panel = ws.sidebar && ws.sidebar.settingsPanel
      if (panel && typeof panel.ResetToDefaults === 'function') {
        panel.ResetToDefaults()
      } else if (ws.settings && typeof ws.settings.ResetToDefaults === 'function') {
        ws.settings.ResetToDefaults()
      }
    } catch (e) { /* ignore */ }
    const Settings = E && E.ImportSettings
    if (typeof ws.LoadModelFromUrlList === 'function' && Settings) {
      this.state.loading = true
      this.state.error = ''
      call(ws, 'LoadModelFromUrlList', [DEFAULT_MODEL_URL], new Settings())
      return true
    }
    return false
  },

  /** 本地文件（可多文件：obj + mtl + 贴图） */
  loadFromFiles(fileList) {
    const ws = site()
    const files = [...(fileList || [])]
    if (!ws || !files.length) return false
    this._manualLoad = true // 同上：用户自己打开的模型优先
    this.state.loading = true
    this.state.hasModel = false
    this.state.modelName = files[0].name
    this._emit('loading', { name: this.state.modelName })
    if (typeof ws.LoadModelFromFileList === 'function') {
      ws.LoadModelFromFileList(files)
      return true
    }
    return false
  },

  /** 打开系统的文件选择框（O3DV 自带流程，格式判断更完整） */
  openFileDialog() {
    const ws = site()
    if (typeof ws?.OpenFileBrowserDialog === 'function') {
      ws.OpenFileBrowserDialog()
      return true
    }
    const input = document.querySelector('.o3dv-root #open_file')
    if (input) {
      input.value = ''
      input.click()
      return true
    }
    return false
  },

  loadExample(fileName, auxFiles = []) {
    const urls = [O3DV_PATHS.modelsBase + fileName]
    auxFiles.forEach((f) => urls.push(O3DV_PATHS.modelsBase + f))
    return this.loadFromUrls(urls, fileName)
  },

  clear() {
    call(site(), 'ClearModel')
    this.state.hasModel = false
    this.state.modelName = ''
    this._parts = []
    this._emit('cleared')
    return true
  },

  hasModel() {
    const ws = site()
    if (typeof ws?.HasLoadedModel === 'function') return !!ws.HasLoadedModel()
    return !!ws?.model
  },

  _fileName(url = '') {
    try {
      return decodeURIComponent(url.split('/').pop() || '')
    } catch (e) {
      return url
    }
  },

  // ------------------------------------------------------------ 相机 / 视图
  /**
   * 记录“模型加载完成时的默认相机” —— 这就是本项目的默认显示（等轴测），
   * 点功能区「等轴测」时精确还原它，保证与默认显示完全一致。
   */
  captureDefaultCamera() {
    const cam = this._camera()
    if (!cam?.eye || !cam?.center) return false
    const copy = (v) => ({ x: v.x, y: v.y, z: v.z })
    this._defaultCamera = {
      eye: copy(cam.eye),
      center: copy(cam.center),
      up: copy(cam.up),
      fov: cam.fov
    }
    return true
  },

  _camera() {
    return call(site()?.viewer, 'GetCamera')
  },
  _setCamera(cam) {
    call(site()?.viewer, 'SetCamera', cam)
    call(site()?.viewer, 'Render')
  },

  /** 适应屏幕 */
  fit() {
    const ws = site()
    if (typeof ws?.FitModelToWindow === 'function') {
      ws.FitModelToWindow()
      call(ws.viewer, 'Render')
      this._emit('fitted')
      return true
    }
    const viewer = ws?.viewer
    if (typeof viewer?.FitSphereToWindow === 'function') {
      const sphere = call(viewer, 'GetBoundingSphere', () => true)
      if (sphere) viewer.FitSphereToWindow(sphere)
      this._emit('fitted')
      return true
    }
    return false
  },

  /** 标准视角：等轴测直接复用原项目的 SolidWorks 风格默认视角，其余按方向计算 */
  setView(key) {
    // 等轴测 = 模型加载后的默认视角（原项目实现，保证点「等轴测」与默认显示完全一致）
    if (key === 'iso' && this._defaultCamera) {
      const d = this._defaultCamera
      const cam0 = this._camera()
      if (cam0?.eye && cam0?.center && cam0?.up) {
        Object.assign(cam0.eye, d.eye)
        Object.assign(cam0.center, d.center)
        Object.assign(cam0.up, d.up)
        if (d.fov) cam0.fov = d.fov
        this._setCamera(cam0)
        this._emit('viewChanged', key)
        return true
      }
    }
    if (key === 'iso') {
      try {
        setSolidWorksDefaultView(false)
        this._emit('viewChanged', key)
        return true
      } catch (e) {
        console.warn('[modelViewer] 等轴测视角设置失败', e)
      }
    }
    const preset = VIEW_PRESETS[key]
    const cam = this._camera()
    if (!preset || !cam?.eye || !cam?.center) return false
    const [dx, dy, dz] = preset.dir
    const len = Math.hypot(dx, dy, dz) || 1
    const { center, eye } = cam
    const dist = Math.hypot(eye.x - center.x, eye.y - center.y, eye.z - center.z) || 1
    eye.x = center.x + (dx / len) * dist
    eye.y = center.y + (dy / len) * dist
    eye.z = center.z + (dz / len) * dist
    // 每个视角自带 up（见 VIEW_PRESETS 的注释），避免切视角时模型"莫名其妙转 90°"
    if (cam.up && preset.up) {
      cam.up.x = preset.up[0]
      cam.up.y = preset.up[1]
      cam.up.z = preset.up[2]
    }
    this._setCamera(cam)
    this._emit('viewChanged', key)
    return true
  },

  /** 投影方式 */
  setProjection(mode) {
    const viewer = site()?.viewer
    const E = engine()
    if (!viewer || typeof viewer.SetProjectionMode !== 'function') return false
    const PM = E?.ProjectionMode || {}
    const value = mode === 'orthographic' ? PM.Orthographic ?? 2 : PM.Perspective ?? 1
    viewer.SetProjectionMode(value)
    call(viewer, 'Render')
    this._emit('projectionChanged', mode)
    return true
  },

  /** 向上轴 */
  setUpAxis(axis) {
    const viewer = site()?.viewer
    if (typeof viewer?.SetUpVector !== 'function') return false
    viewer.SetUpVector(axis === 'y' ? makeCoord(0, 1, 0) : makeCoord(0, 0, 1))
    call(viewer, 'AdjustClippingPlanesToSphere')
    call(viewer, 'Render')
    this._emit('upAxisChanged', axis)
    return true
  },

  /** 自动旋转（绕向上轴匀速转，自己用 rAF 驱动） */
  toggleAutoRotate() {
    if (this._rotating) {
      this.stopAutoRotate()
      return false
    }
    const step = () => {
      if (!this._rotating) return
      const cam = this._camera()
      if (cam?.eye && cam?.center) {
        const { center, eye } = cam
        const a = 0.012
        const x = eye.x - center.x
        const y = eye.y - center.y
        eye.x = center.x + x * Math.cos(a) - y * Math.sin(a)
        eye.y = center.y + x * Math.sin(a) + y * Math.cos(a)
        this._setCamera(cam)
      }
      this._raf = requestAnimationFrame(step)
    }
    this._rotating = true
    this._raf = requestAnimationFrame(step)
    return true
  },
  stopAutoRotate() {
    this._rotating = false
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
  },
  isAutoRotating() {
    return this._rotating
  },

  // ------------------------------------------------------------ 显示 / 环境
  /**
   * 背景色：改 O3DV 自己的设置对象后走它的官方更新通道（UpdateEnvironmentMap），
   * 这样侧栏控件与渲染状态保持同步，不会出现"改了调不回来"。
   */
  setBackground(key) {
    const preset = BACKGROUND_PRESETS[key]
    const ws = site()
    if (!preset || !ws?.settings) return false
    const [r, g, b] = preset.rgb
    const color = makeColor(r, g, b)
    ws.settings.backgroundColor = color
    ws.settings.backgroundIsEnvMap = false
    // 1) 官方通道：按设置重算环境/背景
    const updated = call(ws, 'UpdateEnvironmentMap')
    // 2) 再直接落到引擎，双保险
    call(ws.viewer, 'SetBackgroundColor', color)
    call(ws.viewer, 'Render')
    call(ws.sidebar, 'UpdateControlsStatus')
    if (updated === undefined) console.warn('[modelViewer] O3DV 更新通道不可用，已直接设置引擎背景色')
    this._emit('backgroundChanged', key)
    return true
  },

  /**
   * 边线显示：只改 O3DV 的边线设置对象再让它自己刷新
   * （不要直接调 viewer.SetEdgeSettings，引擎要求完整的设置对象，否则会抛错）
   */
  toggleEdges() {
    const ws = site()
    const E = engine()
    const es = ws?.settings?.edgeSettings
    if (!es || typeof ws.UpdateEdgeDisplay !== 'function') return false
    es.showEdges = !es.showEdges
    if (es.showEdges && !es.edgeThreshold) es.edgeThreshold = 60
    if (!es.edgeColor && E?.RGBColor) es.edgeColor = E.RGBColor ? new E.RGBColor(50, 50, 50) : es.edgeColor
    // 优先让 O3DV 自己刷新（会同步侧栏控件）；侧栏未渲染时退回引擎设置，两种都失败也不报错
    const updated = call(ws, 'UpdateEdgeDisplay')
    if (updated === undefined) {
      call(ws.viewer, 'SetEdgeSettings', es)
      call(ws.viewer, 'Render')
    }
    call(ws.sidebar, 'UpdateControlsStatus')
    this._emit('edgesChanged', es.showEdges)
    return es.showEdges
  },

  /** 透明背景（O3DV 侧栏选项，走控件通道） */
  async toggleTransparentBackground() {
    return triggerInPanel('Model Display', 'transparentBackground')
  },

  /** 测量工具 */
  async measure() {
    const ws = site()
    if (!ws?.measureTool) return false
    // 测量按钮在 O3DV 顶栏，界面被隐藏但控件仍在 DOM 中
    const ok = await triggerInPanel('Measure', 'measure')
    this._emit('measureChanged', ok)
    return ok
  },

  /** 显示全部零件（逐实例设置可见性，引擎的 SetMeshesVisibility 需要回调参数，这里不用它） */
  showAllMeshes() {
    const count = this._parts.length
    for (let i = 0; i < count; i++) call(this._meshInstance(i), 'SetVisible', true)
    site()?.UpdateMeshesVisibility?.()
    call(site()?.viewer, 'Render')
    this.refreshParts()
    return true
  },

  // ------------------------------------------------------------ 零件
  refreshParts() {
    const ws = site()
    const model = ws?.model
    const list = []
    if (model && typeof model.MeshInstanceCount === 'function') {
      const count = model.MeshInstanceCount()
      for (let i = 0; i < count; i++) {
        const inst = call(model, 'GetMeshInstance', i)
        const mesh = call(inst, 'GetMesh')
        const name = call(inst, 'GetName') || call(mesh, 'GetName') || `零件 ${i + 1}`
        list.push({
          index: i,
          name,
          visible: typeof inst?.IsVisible === 'function' ? !!inst.IsVisible() : true,
          vertexCount: call(mesh, 'VertexCount') ?? 0,
          triangleCount: call(mesh, 'TriangleCount') ?? 0
        })
      }
    }
    this._parts = list
    this._emit('partsChanged', list)
    return list
  },

  getParts() {
    return this._parts
  },

  _meshInstance(index) {
    const model = site()?.model
    return call(model, 'GetMeshInstance', index)
  },

  setPartVisible(index, visible) {
    const inst = this._meshInstance(index)
    if (!inst) return false
    if (typeof inst.SetVisible === 'function') {
      inst.SetVisible(!!visible)
    } else {
      return false
    }
    site()?.UpdateMeshesVisibility?.()
    call(site()?.viewer, 'Render')
    this.refreshParts()
    return true
  },

  isolatePart(index) {
    this._parts.forEach((p, i) => {
      call(this._meshInstance(i), 'SetVisible', i === index)
    })
    site()?.UpdateMeshesVisibility?.()
    call(site()?.viewer, 'Render')
    this.refreshParts()
    return true
  },

  selectPart(index) {
    const ws = site()
    const viewer = ws?.viewer
    const inst = this._meshInstance(index)
    if (!viewer || !inst) return false
    const E = engine()
    const color = E?.RGBColor ? new E.RGBColor(255, 165, 0) : { r: 255, g: 165, b: 0 }
    if (typeof viewer.SetMeshesHighlight === 'function') {
      // 引擎签名：（高亮颜色, 判定函数）—— 只高亮选中的那个实例
      viewer.SetMeshesHighlight(color, (meshInstance) => meshInstance === inst)
      call(viewer, 'Render')
      return true
    }
    return false
  },

  clearHighlight() {
    const viewer = site()?.viewer
    if (typeof viewer?.SetMeshesHighlight === 'function') {
      viewer.SetMeshesHighlight(null, () => false)
      call(viewer, 'Render')
    }
  },

  // ------------------------------------------------------------ 环境贴图
  /** 环境贴图：改设置里的 environmentMapName 后让 O3DV 自己刷新（与官方 Environment 面板一致） */
  setEnvironmentMap(name) {
    const ws = site()
    if (!ws?.settings || typeof ws.UpdateEnvironmentMap !== 'function') return false
    ws.settings.environmentMapName = name
    ws.settings.backgroundIsEnvMap = false
    call(ws, 'UpdateEnvironmentMap')
    call(ws.sidebar, 'UpdateControlsStatus')
    call(ws.viewer, 'Render')
    this._emit('envMapChanged', name)
    return true
  },

  // ------------------------------------------------------------ 输出 / 统计
  /** 截图（用引擎自己的出图接口，分辨率可指定） */
  screenshot(width = 1920, height = 1080) {
    const viewer = site()?.viewer
    if (typeof viewer?.GetImageAsDataUrl === 'function') {
      const size = call(viewer, 'GetImageSize')
      const w = width || size?.width || 1920
      const h = height || size?.height || 1080
      const url = call(viewer, 'GetImageAsDataUrl', w, h)
      if (url) return url
    }
    const canvas = this._container?.querySelector('canvas')
    if (canvas) {
      try {
        return canvas.toDataURL('image/png')
      } catch (e) {
        return null
      }
    }
    return null
  },

  /** 单位（模型自带单位，可切换） */
  getUnit() {
    return call(site()?.model, 'GetUnit')
  },

  stats() {
    const model = site()?.model
    const parts = this._parts
    return {
      partCount: parts.length,
      triangles: call(model, 'TriangleCount') ?? parts.reduce((n, p) => n + (p.triangleCount || 0), 0),
      vertices: call(model, 'VertexCount') ?? parts.reduce((n, p) => n + (p.vertexCount || 0), 0),
      materials: call(model, 'MaterialCount') ?? 0,
      unit: this.getUnit(),
      name: this.state.modelName,
      hasModel: this.state.hasModel
    }
  }
}

export default modelViewer
