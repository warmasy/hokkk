/**
 * 模型查看功能区配置（顶部菜单：模型查看）
 *
 * 每个按钮：kind: 'action'，action: 'viewer'，command 对应 src/viewer/commands.js 里的实现
 * 新增功能：在 commands.js 里加一条命令 -> 这里加一个按钮即可
 *
 * 注意按钮顺序 = **按列优先**排列（功能区是 flex-direction:column + wrap，每列 3 个）：
 * 数组前 3 个是第 1 列，接着 3 个是第 2 列，以此类推。
 * state 字段（可选）声明该按钮选中态的真实来源，见 src/viewer/viewerState.js；
 * 没写 state 的都是一次性动作，只在点击后短暂高亮。
 */
export const MODEL_GROUP = {
  key: 'model-file',
  label: '模型',
  items: [
    // 第 1 列
    { key: 'mv-open', label: '打开模型', icon: 'fa-solid fa-folder-open', kind: 'action', action: 'viewer', command: 'openFile', tip: '从本地选择模型文件（支持多文件，如 obj + mtl + 贴图）' },
    { key: 'mv-import-settings', label: '导入设置', icon: 'fa-solid fa-sliders', kind: 'action', action: 'viewer', command: 'importSettings', state: 'overlay:settings', tip: '浮层显示导入设置面板（单位 / 显示选项等）' },
    { key: 'mv-details', label: '模型详情', icon: 'fa-solid fa-circle-info', kind: 'action', action: 'viewer', command: 'modelDetails', state: 'overlay:details', tip: '浮层显示模型详情：零件 / 面数 / 顶点 / 材质等' },
    // 第 2 列
    { key: 'mv-demo-step', label: '示例 STEP', icon: 'fa-solid fa-cube', kind: 'action', action: 'viewer', command: 'loadExample', args: { file: 'as1_pe_203.stp' }, tip: '加载内置 STEP 示例（经 OCCT 解析，最快验证导入链路）' },
    { key: 'mv-demo-stl', label: '示例 STL', icon: 'fa-regular fa-gem', kind: 'action', action: 'viewer', command: 'loadExample', args: { file: 'utah_teapot.stl' }, tip: '加载内置 STL 示例' },
    { key: 'mv-demo-gltf', label: '示例 GLTF', icon: 'fa-solid fa-cubes', kind: 'action', action: 'viewer', command: 'loadExample', args: { file: 'DamagedHelmet.glb' }, tip: '加载内置 GLTF 示例（带 PBR 材质）' },
    // 第 3 列
    { key: 'mv-export', label: '导出模型', icon: 'fa-solid fa-file-export', kind: 'action', action: 'viewer', command: 'exportModel', tip: '导出为 obj / stl / ply / gltf 等格式' },
    { key: 'mv-reset', label: '重置', icon: 'fa-solid fa-rotate-left', kind: 'action', action: 'viewer', command: 'reset', tip: '恢复默认模型与默认设置（背景 / 显示项 / 视角全部复位）' }
  ]
}

export const MODEL_VIEW_GROUP = {
  key: 'model-view-dir',
  label: '视角',
  // 顺序 = 按列优先（功能区 flex-direction: column + wrap，每列 3 个）：
  //   第 1 列 正视 / 后视 / 等轴测
  //   第 2 列 左视 / 右视 / 适应屏幕
  //   第 3 列 仰视 / 俯视 / 自动旋转
  // 视角按钮统一用轴测立方体图标：cube 指定「看哪一面」，该面会被涂黑或画成虚线
  //（看不到的面用虚线），见 components/ViewCubeIcon.vue
  items: [
    // ── 第 1 列 ──
    { key: 'mv-front', label: '正视', icon: 'fa-solid fa-square', cube: 'front', kind: 'action', action: 'viewer', command: 'view', args: { key: 'front' }, tip: '前视图（把立方体前面涂黑）' },
    { key: 'mv-back', label: '后视', icon: 'fa-solid fa-square-full', cube: 'back', kind: 'action', action: 'viewer', command: 'view', args: { key: 'back' }, tip: '后视图（把立方体后面画成虚线）' },
    { key: 'mv-iso', label: '等轴测', icon: 'fa-solid fa-cube', cube: 'iso', kind: 'action', action: 'viewer', command: 'view', args: { key: 'iso' }, tip: '切换到等轴测视角（默认视角）' },
    // ── 第 2 列 ──
    { key: 'mv-left', label: '左视', icon: 'fa-solid fa-arrow-left', cube: 'left', kind: 'action', action: 'viewer', command: 'view', args: { key: 'left' }, tip: '左视图（把立方体左面画成虚线）' },
    { key: 'mv-right', label: '右视', icon: 'fa-solid fa-arrow-right', cube: 'right', kind: 'action', action: 'viewer', command: 'view', args: { key: 'right' }, tip: '右视图（把立方体右面涂黑）' },
    { key: 'mv-fit', label: '适应屏幕', icon: 'fa-solid fa-expand', kind: 'action', action: 'viewer', command: 'fit', tip: '把模型缩放到刚好铺满视图' },
    // ── 第 3 列 ──
    { key: 'mv-bottom', label: '仰视', icon: 'fa-solid fa-arrow-up-wide-short', cube: 'bottom', kind: 'action', action: 'viewer', command: 'view', args: { key: 'bottom' }, tip: '仰视图（把立方体下面画成虚线）' },
    { key: 'mv-top', label: '俯视', icon: 'fa-solid fa-arrow-down-wide-short', cube: 'top', kind: 'action', action: 'viewer', command: 'view', args: { key: 'top' }, tip: '俯视图（把立方体上面涂黑）' },
    { key: 'mv-rotate', label: '自动旋转', icon: 'fa-solid fa-rotate', kind: 'action', action: 'viewer', command: 'autoRotate', state: 'autoRotate', tip: '打开/关闭自动旋转' }
  ]
}

export const MODEL_CAMERA_GROUP = {
  key: 'model-camera',
  label: '相机',
  items: [
    { key: 'mv-perspective', label: '透视', icon: 'fa-solid fa-camera', kind: 'action', action: 'viewer', command: 'projection', args: { mode: 'perspective' }, state: 'projection:perspective', tip: '透视投影（近大远小）' },
    { key: 'mv-ortho', label: '正交', icon: 'fa-solid fa-camera-retro', kind: 'action', action: 'viewer', command: 'projection', args: { mode: 'orthographic' }, state: 'projection:orthographic', tip: '正交投影（工程图习惯）' },
    { key: 'mv-flipup', label: '翻转上下', icon: 'fa-solid fa-arrows-rotate', kind: 'action', action: 'viewer', command: 'flipUpVector', tip: '模型上下颠倒时翻转向上向量' },
    { key: 'mv-freeorbit', label: '自由旋转', icon: 'fa-solid fa-unlock', kind: 'action', action: 'viewer', command: 'freeOrbit', state: 'upFixed:false', tip: '切换导航模式：正常转动（锁定上方向，默认）↔ 自由旋转（斜着拖会滚转）；高亮表示当前是自由旋转' }
  ]
}

export const MODEL_DISPLAY_GROUP = {
  key: 'model-display',
  label: '显示',
  items: [
    { key: 'mv-edges', label: '显示边线', icon: 'fa-solid fa-border-all', kind: 'action', action: 'viewer', command: 'toggleEdges', state: 'edges', tip: '显示/隐藏零件边线（便于看清结构）' },
    { key: 'mv-transparent', label: '透明背景', icon: 'fa-regular fa-square', kind: 'action', action: 'viewer', command: 'toggleTransparentBg', tip: '隐藏背景色（截图时常用）' },
    { key: 'mv-measure', label: '测量', icon: 'fa-solid fa-ruler', kind: 'action', action: 'viewer', command: 'measure', state: 'measure', tip: '打开测量工具：依次点两个点量距离' },
    { key: 'mv-showall', label: '显示全部', icon: 'fa-solid fa-eye', kind: 'action', action: 'viewer', command: 'showAllParts', tip: '把所有零件恢复显示' }
  ]
}

export const MODEL_ENV_GROUP = {
  key: 'model-env',
  label: '环境',
  items: [
    { key: 'mv-bg-light', label: '浅色背景', icon: 'fa-regular fa-sun', kind: 'action', action: 'viewer', command: 'background', args: { key: 'light' }, tip: '白色背景，适合截图与文档' },
    { key: 'mv-bg-gray', label: '灰色背景', icon: 'fa-solid fa-circle-half-stroke', kind: 'action', action: 'viewer', command: 'background', args: { key: 'gray' }, tip: '中性灰背景' },
    { key: 'mv-bg-dark', label: '深色背景', icon: 'fa-solid fa-moon', kind: 'action', action: 'viewer', command: 'background', args: { key: 'dark' }, tip: '深色背景，适合查看细节' },
    { key: 'mv-bg-tech', label: '科技蓝', icon: 'fa-solid fa-satellite-dish', kind: 'action', action: 'viewer', command: 'background', args: { key: 'tech' }, tip: '与系统科技蓝主题一致' },
    { key: 'mv-envmap', label: '环境贴图', icon: 'fa-solid fa-image', kind: 'action', action: 'viewer', command: 'cycleEnvMap', tip: '依次切换环境贴图（金属/玻璃材质效果更真实）' }
  ]
}

export const MODEL_OUTPUT_GROUP = {
  key: 'model-output',
  label: '输出',
  items: [
    { key: 'mv-snapshot', label: '创建快照', icon: 'fa-solid fa-images', kind: 'action', action: 'viewer', command: 'createSnapshot', tip: 'O3DV 官方快照：可选输出尺寸并保存' },
    { key: 'mv-download', label: '下载原文件', icon: 'fa-solid fa-download', kind: 'action', action: 'viewer', command: 'downloadFiles', tip: '下载当前模型的原始文件（不改格式）' },
    { key: 'mv-shot', label: '截图', icon: 'fa-solid fa-camera', kind: 'action', action: 'viewer', command: 'screenshot', tip: '把当前视图导出成 PNG' },
    { key: 'mv-fullscreen', label: '全屏', icon: 'fa-solid fa-up-right-and-down-left-from-center', kind: 'action', action: 'viewer', command: 'fullscreen', tip: '中栏全屏查看' }
  ]
}

export const MODEL_GROUPS = [
  MODEL_GROUP,
  MODEL_VIEW_GROUP,
  MODEL_CAMERA_GROUP,
  MODEL_DISPLAY_GROUP,
  MODEL_ENV_GROUP,
  MODEL_OUTPUT_GROUP
]

export default MODEL_GROUPS
