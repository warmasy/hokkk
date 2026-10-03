/**
 * 左侧「浏览」树的文件夹配置
 * 文件夹是拖放的目标容器；具体功能节点由用户从功能区拖入后动态生成（见 store/modules/workbench.js）
 *
 * defaultMaximize：该文件夹里的标签**打开时**计算框是否默认最大化
 *   - 计算浏览 = true ：用来做复杂计算，铺满中栏更好看参数与曲线
 *   - 计算稿   = false：用来做辅助/实时计算，开一个小窗口即可
 * defaultPinned：该文件夹里的标签**打开时**是否默认固定在最上层
 *   - 计算稿 = true：辅助计算窗默认就浮在最上面，主计算窗怎么切换都不会被盖住
 */
export const FOLDERS = [
  { key: 'folder-calc', label: '计算浏览', icon: 'fa-solid fa-folder', defaultMaximize: true, defaultPinned: false },
  { key: 'folder-draft', label: '计算稿', icon: 'fa-solid fa-folder', defaultMaximize: false, defaultPinned: true }
]

/**
 * 默认节点：**空**（打开页面时浏览树是干净的，不放任何标签）。
 * 想预置标签的话，往数组里加 { folderKey, itemKey, label } 即可。
 */
export const INITIAL_NODES = []

export function findFolder(key) {
  return FOLDERS.find((f) => f.key === key) || null
}
