/**
 * 计算框注册表
 * 中间区域的画布工具条（放大/缩小/适应/重置/截图）需要操作「当前激活的计算框」中的图表，
 * 这里用一张 Map 把窗口 id 与图表操作绑定起来，避免层层透传 props / emit。
 */
const registry = new Map()

export function registerWindow(windowId, api) {
  registry.set(windowId, api)
}

export function unregisterWindow(windowId) {
  registry.delete(windowId)
}

export function getWindowApi(windowId) {
  return registry.get(windowId) || null
}
