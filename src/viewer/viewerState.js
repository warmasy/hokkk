/**
 * 功能区按钮的"真实状态"读取
 *
 * 目的：功能区的选中态要反映**当前实际状态**，而不是"点过就一直亮着"：
 *   - 一次性动作（视角预设 / 适应屏幕 / 重置 / 截图 …）点完不该一直高亮；
 *   - 开关类（显示边线 / 测量 / 自动旋转 / 透视·正交 / Z·Y 轴向上 / 锁定·自由旋转）
 *     以及面板类（模型详情 / 导入设置）的选中态，等于它们的真实状态，关掉就灭。
 *
 * 每个 stateKey 对应一条判定规则，配置写在 config/ribbon/modelView.js 的 state 字段。
 */
import { modelViewer } from '@/viewer/modelController'

/** 面板浮层容器 id 前缀（与 o3dvPanels.js 保持一致；这里直接查 DOM，避免模块循环依赖） */
const OVERLAY_PREFIX = 'ov_panel_overlay_'

function site() {
  return window.o3dvWebsite || null
}

function viewer() {
  const ws = site()
  return ws && ws.viewer ? ws.viewer : null
}

/** 上方向是否被锁定（对应功能区「自由旋转」；锁定上方向的按钮已按要求移除） */
function isUpVectorFixed() {
  const v = viewer()
  return !!(v && v.upVector && v.upVector.isFixed)
}

/**
 * 读取某个 stateKey 的当前状态
 * @returns {Boolean|null} null 表示读不到（按不选中处理）
 */
export function readViewerState(stateKey) {
  if (!stateKey) return null
  const [name, arg] = String(stateKey).split(':')
  switch (name) {
    case 'overlay':
      // 面板浮层是否打开（关掉浮层高亮立刻消失）
      return !!document.getElementById(OVERLAY_PREFIX + arg)
    case 'edges': {
      const ws = site()
      const es = ws && ws.settings && ws.settings.edgeSettings
      return es ? !!es.showEdges : null
    }
    case 'measure': {
      const ws = site()
      const mt = ws && ws.measureTool
      if (!mt) return null
      try {
        return typeof mt.IsActive === 'function' ? !!mt.IsActive() : null
      } catch (e) {
        return null
      }
    }
    case 'autoRotate':
      return !!modelViewer.isAutoRotating()
    case 'projection': {
      const v = viewer()
      if (!v || typeof v.GetProjectionMode !== 'function') return null
      // 引擎：1 = 透视，2 = 正交
      let mode = null
      try {
        mode = v.GetProjectionMode()
      } catch (e) {
        return null
      }
      return arg === 'orthographic' ? mode === 2 : mode === 1
    }
    case 'upFixed':
      return isUpVectorFixed() === (arg === 'true')
    default:
      return null
  }
}

/** 通知功能区立即刷新按钮状态（命令执行后 / 面板开关后调用） */
export function notifyViewerStateChanged() {
  try {
    window.dispatchEvent(new CustomEvent('mc:viewer-state-changed'))
  } catch (e) { /* ignore */ }
}

export const VIEWER_STATE_EVENT = 'mc:viewer-state-changed'
