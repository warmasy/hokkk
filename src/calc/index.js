/**
 * 计算内核注册表
 *
 * 每个功能区按钮通过 key 对应到这里的三种执行方式之一：
 *   mode: 'local'    —— 前端 JS 直接算（单位换算、数学函数、机械公式）
 *   mode: 'api'      —— 调后端接口算（见 api/calc.js 的 executeCalc）
 *   mode: 'builtin'  —— 由 store 内部处理（单位换算）
 *
 * 约定：
 *   localRunners[key](values) -> [{ label, value, unit }]
 *   seriesProviders[key](item, values) -> { label, unit, points: [{x, y}] }
 *   functionFns[key] = { fn(x, p), stats(p) }
 */
import { inertiaCalcs } from '@/calc/inertia'
import { mechanicsCalcs } from '@/calc/mechanics'
import { kinematicsCalcs } from '@/calc/kinematics'
import { mathFunctions } from '@/calc/math'

/** 全部本地公式计算：key -> (values) => rows */
export const LOCAL_RUNNERS = {
  ...inertiaCalcs,
  ...mechanicsCalcs,
  ...kinematicsCalcs
}

/** 全部数学函数：key -> { fn, stats } */
export const FUNCTION_FNS = mathFunctions

/** 取本地计算函数 */
export function getLocalRunner(key) {
  return LOCAL_RUNNERS[key] || null
}

/** 取数学函数定义 */
export function getFunctionFn(key) {
  return FUNCTION_FNS[key] || null
}

export { inertiaCalcs, mechanicsCalcs, kinematicsCalcs, mathFunctions }
