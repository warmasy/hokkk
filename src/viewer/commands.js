/**
 * 模型查看命令表
 *
 * 功能区按钮只声明 command，真正的动作集中在这里 ——
 * 新增一个 3D 功能只要在 VIEWER_COMMANDS 里加一条，再在 config/ribbon/modelView.js 加个按钮。
 *
 * 命令签名：run(args) -> Boolean | Promise<Boolean>  （false 表示当前不可用，会给出提示）
 */
import { saveAs } from 'file-saver'
import { modelViewer, VIEW_PRESETS, BACKGROUND_PRESETS } from '@/viewer/modelController'
import { triggerInPanel, findControl, triggerControl } from '@/viewer/o3dvControls'
import { togglePanelOverlay } from '@/viewer/o3dvPanels'
import { notifyViewerStateChanged } from '@/viewer/viewerState'
import { useModelViewStore } from '@/store/modules/modelView'
import { useWorkbenchStore } from '@/store/modules/workbench'
import modal from '@/plugins/modal'

/** 环境贴图面板里可点的选项（按 3dviewer.net 文案） */
const ENV_MAP_OPTIONS = ['citadella', 'fishermans_bastion', 'ice_river', 'maskonaive', 'park', 'teide']

let envCursor = -1

function stores() {
  return { view: useModelViewStore(), workbench: useWorkbenchStore() }
}

/** 打开本地模型（优先用 O3DV 自带的文件对话框，格式判断最完整） */
function openFileDialog() {
  return modelViewer.openFileDialog()
}

/** 3D 引擎/站点是否可用（功能区早于引擎初始化被点击时要用） */
function isViewerReady() {
  const ws = window.o3dvWebsite
  const E = window.OV && (window.OV.Engine || window.OV)
  return !!(ws && E && E.ImportSettings)
}

/**
 * 查看器是否空闲（没有正在进行的模型加载）。
 * O3DV 同一时间只能加载一个模型：加载中再发一次会被直接丢掉（就是"点了没反应"），
 * 所以请求要排队到空闲再发。加载中的标志是引擎挂到 body 的加载弹窗。
 */
function isViewerIdle() {
  return !document.querySelector('body > div.ov_progress, body > div.ov_progress_mask')
}

/**
 * 等查看器就绪且空闲后再执行：用户刚进模型查看就点示例/打开文件时（引擎还在初始化、
 * 或者默认模型正在加载），请求排队而不是直接失败/被丢掉。
 */
function whenViewerReady(action, tries = 60, interval = 150) {
  if (isViewerReady() && isViewerIdle()) {
    action()
    return
  }
  if (tries <= 0) {
    modal.msgWarning('3D 引擎还在加载，请稍后再试')
    return
  }
  setTimeout(() => whenViewerReady(action, tries - 1, interval), interval)
}

export const VIEWER_COMMANDS = {
  /** 打开本地模型 */
  openFile() {
    const { view } = stores()
    if (!isViewerReady() || !isViewerIdle()) {
      view.setMessage('正在准备 3D 引擎，稍后自动打开文件对话框')
      whenViewerReady(() => modelViewer.openFileDialog())
      return true
    }
    const ok = openFileDialog()
    if (ok) view.setMessage('请选择模型文件（支持多选：obj + mtl + 贴图）')
    return ok
  },

  /** 打开内置示例 */
  loadExample(args = {}) {
    const { view } = stores()
    if (!args.file) return false
    if (!isViewerReady() || !isViewerIdle()) {
      view.setMessage(`正在加载中，稍后自动切换到示例：${args.file}`)
      whenViewerReady(() => modelViewer.loadExample(args.file, args.aux || []))
      return true
    }
    const ok = modelViewer.loadExample(args.file, args.aux || [])
    if (ok) view.setMessage(`正在加载示例：${args.file}`)
    return ok
  },

  /** 清空 */
  clear() {
    return modelViewer.clear()
  },

  /** 重置：恢复默认模型 + 默认设置（背景 / 显示项 / 视角） */
  reset() {
    const { view } = stores()
    if (!isViewerReady() || !isViewerIdle()) {
      view.setMessage('正在加载中，稍后自动重置')
      whenViewerReady(() => modelViewer.reset())
      return true
    }
    const ok = modelViewer.reset()
    view.setMessage(ok ? '已重置为默认模型与默认设置' : '重置失败：查看器未就绪')
    if (ok) {
      const { workbench } = stores()
      workbench.setStatus('已重置为默认模型与默认设置', 2600)
    }
    return ok
  },

  /** 标准视角 */
  view(args = {}) {
    const ok = modelViewer.setView(args.key)
    if (ok) {
      const { workbench } = stores()
      workbench.setStatus(`视角已切换：${VIEW_PRESETS[args.key]?.label || args.key}`, 0)
    }
    return ok
  },

  /** 适应屏幕 */
  fit() {
    return modelViewer.fit()
  },

  /** 投影方式 */
  projection(args = {}) {
    const ok = modelViewer.setProjection(args.mode)
    const { view } = stores()
    if (ok) view.setMessage(args.mode === 'orthographic' ? '已切换为正交投影' : '已切换为透视投影')
    return ok
  },

  /** 自动旋转（控制器内部用 rAF 绕向上轴旋转） */
  autoRotate() {
    const { view } = stores()
    const running = modelViewer.isAutoRotating()
    modelViewer.toggleAutoRotate()
    view.setMessage(running ? '已停止自动旋转' : '已开始自动旋转')
    return true
  },

  /** 显示边线 */
  toggleEdges() {
    const { view } = stores()
    const result = modelViewer.toggleEdges()
    if (result === false) {
      view.setMessage('边线显示当前不可用（引擎边线设置未就绪）')
      return true
    }
    view.setMessage(result ? '已显示边线' : '已隐藏边线')
    return true
  },

  /** 透明背景 */
  async toggleTransparentBg() {
    const { view } = stores()
    const ok = await modelViewer.toggleTransparentBackground()
    view.setMessage(ok ? '已切换透明背景' : '透明背景当前不可用')
    return true
  },

  /** 测量工具 */
  async measure() {
    const { view } = stores()
    const ok = await modelViewer.measure()
    view.setActiveTool(ok ? 'measure' : '')
    view.setMessage(ok ? '测量工具：依次点击两个点即可量出距离' : '测量工具当前不可用')
    return true
  },

  /** 显示全部零件 */
  showAllParts() {
    const ok = modelViewer.showAllMeshes()
    const { view } = stores()
    if (ok) view.setMessage('已显示全部零件')
    return ok
  },

  /** 背景色 */
  background(args = {}) {
    const ok = modelViewer.setBackground(args.key)
    const { view } = stores()
    if (ok) view.setMessage(`背景：${BACKGROUND_PRESETS[args.key]?.label || args.key}`)
    return ok
  },

  /** 依次切换环境贴图（与 3dviewer.net 官方 Environment 面板同一套贴图） */
  cycleEnvMap() {
    const { view } = stores()
    envCursor = (envCursor + 1) % ENV_MAP_OPTIONS.length
    const name = ENV_MAP_OPTIONS[envCursor]
    const ok = modelViewer.setEnvironmentMap(name)
    view.setMessage(ok ? `环境贴图：${name}` : '环境贴图切换失败')
    return ok
  },

  /** 模型详情：独立浮层（可拖动标题栏；再点一次收起） */
  modelDetails() {
    const { view } = stores()
    const open = togglePanelOverlay('details')
    view.setMessage(open ? '模型详情已打开（标题栏可拖动）' : '模型详情已收起')
    return true
  },

  /** 导入设置：独立浮层，与「模型详情」互不干扰，可同时打开 */
  importSettings() {
    const { view } = stores()
    const open = togglePanelOverlay('settings')
    view.setMessage(open ? '导入设置已打开（标题栏可拖动）' : '导入设置已收起')
    return true
  },

  /** 创建快照（O3DV 官方快照对话框：可选输出尺寸并保存） */
  createSnapshot() {
    const { view } = stores()
    const ok = triggerControl('snapshot')
    view.setMessage(ok ? '已打开快照对话框' : '快照功能当前不可用')
    return true
  },

  /** 导出模型（obj / stl / ply / gltf 等格式转换导出） */
  exportModel() {
    const { view } = stores()
    const ok = triggerControl('exportModel')
    view.setMessage(ok ? '已打开导出对话框' : '导出功能当前不可用')
    return true
  },

  /** 下载当前模型的原始文件 */
  downloadFiles() {
    const { view } = stores()
    const ok = triggerControl('download')
    view.setMessage(ok ? '已开始下载模型原文件' : '下载当前不可用')
    return true
  },

  /** 翻转向上向量（模型上下颠倒时用） */
  flipUpVector() {
    const { view } = stores()
    const ok = triggerControl('flipUp')
    view.setMessage(ok ? '已翻转向上向量' : '翻转向上向量当前不可用')
    return true
  },

  /** 自由旋转（不锁定上方向，可任意翻转观察） */
  freeOrbit() {
    const { view } = stores()
    const ok = triggerControl('freeOrbit')
    view.setMessage(ok ? '已切换为自由旋转' : '自由旋转当前不可用')
    return true
  },

  /** 截图 */
  screenshot() {
    const { view } = stores()
    const dataUrl = modelViewer.screenshot()
    if (!dataUrl) {
      modal.msgError('截图失败：没有可用的渲染画布')
      return true
    }
    const name = (view.modelName || 'model').replace(/\.[^.]+$/, '')
    saveAs(dataUrl, `${name}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`)
    view.setMessage('截图已保存')
    return true
  },

  /** 中栏全屏 */
  fullscreen() {
    const el = document.querySelector('.model-canvas') || document.querySelector('.center-canvas')
    if (!el) return false
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
      return true
    }
    el.requestFullscreen?.()
    return true
  }
}

/** 执行功能区命令 */
export async function runViewerCommand(command, args) {
  const fn = VIEWER_COMMANDS[command]
  if (typeof fn !== 'function') {
    modal.msgWarning(`未实现的查看器命令：${command}`)
    return false
  }
  try {
    const ok = await fn(args)
    if (ok === false) modal.msgWarning('该功能当前不可用（模型或引擎未就绪）')
    // 命令可能改变了开关状态（边线 / 投影 / 上方向 / 测量 …），通知功能区刷新按钮状态
    notifyViewerStateChanged()
    return ok
  } catch (e) {
    console.error('[viewer] 命令执行失败', command, e)
    modal.msgError(`操作失败：${e?.message || e}`)
    notifyViewerStateChanged()
    return false
  }
}

export default VIEWER_COMMANDS
