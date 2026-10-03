/**
 * 功能区（Ribbon）配置入口
 *
 * 目录划分：
 *   unitConvert.js  单位换算按钮（前端 JS，utils/units.js 的单位表）
 *   inertia.js      惯量计算按钮（前端 JS，calc/inertia.js）
 *   mechanics.js    力学计算按钮（前端 JS，calc/mechanics.js；可改走后端）
 *   kinematics.js   运动学按钮（前端 JS，calc/kinematics.js；可改走后端）
 *   math.js         数学函数按钮（前端 JS 绘图，calc/math.js）
 *   other.js        动作类按钮（AI 助手等）
 *
 * 每个按钮的 mode 字段决定计算方式：
 *   'local'    前端 JS 计算（calc/ 目录下的函数）
 *   'api'      请求后端（api/calc.js 的 executeCalc，接口地址写在 item.api.url）
 *   'builtin'  由 store 处理（单位换算）
 *   'none'     动作类按钮
 */
import { UNIT_GROUP } from './unitConvert'
import { INERTIA_GROUP } from './inertia'
import { MECHANICS_GROUP } from './mechanics'
import { KINEMATICS_GROUP } from './kinematics'
import { MATH_GROUPS } from './math'
import { OTHER_GROUP } from './other'
import { MODEL_GROUPS } from './modelView'
import { buildSeries } from '@/calc/plot'

export { MATH_GROUPS, MODEL_GROUPS }

/** 基本计算（机械计算）功能区 */
export const CALC_GROUPS = [UNIT_GROUP, INERTIA_GROUP, MECHANICS_GROUP, KINEMATICS_GROUP, OTHER_GROUP]

/** 顶部菜单 */
export const MENU_ITEMS = [
  { key: 'math', label: '数学计算' },
  { key: 'basic-calc', label: '基本计算' },
  { key: 'basic-select', label: '基本选型' },
  { key: 'model-view', label: '模型查看' },
  { key: 'data-center', label: '数据中心' },
  { key: 'help', label: '帮助' }
]

/** 每个菜单对应一套功能区 */
export const MENU_RIBBON_GROUPS = {
  'basic-calc': CALC_GROUPS,
  math: MATH_GROUPS,
  'model-view': MODEL_GROUPS
}

/** 兼容旧引用：默认展示基本计算的功能区 */
export const RIBBON_GROUPS = CALC_GROUPS

/** 扁平化后的全部按钮（含各菜单），便于按 key 查找 */
export const RIBBON_ITEMS = Object.values(MENU_RIBBON_GROUPS)
  .flat()
  .flatMap((g) => g.items.map((it) => ({ ...it, groupKey: g.key, groupLabel: g.label })))

/** 默认选中的按钮（空 = 默认不高亮，仅鼠标悬停高亮） */
export const DEFAULT_ITEM_KEY = ''

/** 某个菜单的功能区分组 */
export function groupsOfMenu(menuKey) {
  return MENU_RIBBON_GROUPS[menuKey] || []
}

export function findItem(key) {
  return RIBBON_ITEMS.find((it) => it.key === key) || null
}

export function findGroup(key) {
  return CALC_GROUPS.concat(MATH_GROUPS, MODEL_GROUPS).find((g) => g.key === key) || null
}

/** 公式类按钮的关系曲线（前端 JS 采样） */
export { buildSeries }
