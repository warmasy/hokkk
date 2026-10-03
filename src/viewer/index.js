/**
 * 模型查看模块统一出口
 *
 * 目录约定（新增功能改这里就够了）：
 *   modelController.js  查看器内核：加载、相机、显示、零件、截图（新命令加在这里）
 *   o3dvLoader.js       O3DV 资源加载 / 示例模型清单
 *   o3dvControls.js     O3DV 自带控件的定位与点击（官方未开放 API 的能力走这里）
 *   viewPresets / 背景预设等常量都在 modelController.js 顶部
 */
export { modelViewer, VIEW_PRESETS, BACKGROUND_PRESETS } from './modelController'
export { ensureO3dvAssets, releaseO3dvAssets, EXAMPLE_MODELS, O3DV_PATHS } from './o3dvLoader'
export { triggerControl, findControl, isControlChecked, CONTROL_LABELS } from './o3dvControls'
