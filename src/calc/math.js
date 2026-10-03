/**
 * 数学函数（纯 JS，仅用于函数绘图）
 *
 * 每个函数： fn(x, p) —— x 为自变量，p 为参数对象（已转 Number），返回 NaN 表示该点不绘制
 *           stats(p) —— 可选，附加的函数特性（周期等）
 */

/** 周期 → 频率（周期函数用） */
function periodStats(factor = 2) {
  return (p) => {
    const w = Math.abs(p.w)
    if (!w) return []
    const T = (factor * Math.PI) / w
    return [{ label: '周期 T', value: T, unit: '' }]
  }
}

export const mathFunctions = {
  'math-sin': { fn: (x, p) => p.A * Math.sin(p.w * x), stats: periodStats(2) },
  'math-cos': { fn: (x, p) => p.A * Math.cos(p.w * x), stats: periodStats(2) },
  'math-tan': {
    fn: (x, p) => {
      const v = Math.tan(p.w * x)
      return Math.abs(v) > 20 ? NaN : p.A * v
    },
    stats: periodStats(1)
  },
  'math-asin': { fn: (x, p) => (Math.abs(x) > 1 ? NaN : p.A * Math.asin(x)) },
  'math-acos': { fn: (x, p) => (Math.abs(x) > 1 ? NaN : p.A * Math.acos(x)) },
  'math-atan': { fn: (x, p) => p.A * Math.atan(x) },
  'math-sinh': { fn: (x, p) => p.A * Math.sinh(p.w * x) },
  'math-cosh': { fn: (x, p) => p.A * Math.cosh(p.w * x) },
  'math-tanh': { fn: (x, p) => p.A * Math.tanh(p.w * x) },
  'math-exp': { fn: (x, p) => p.A * Math.exp(p.k * x) },
  'math-ln': { fn: (x, p) => (x <= 0 ? NaN : p.A * Math.log(x)) },
  'math-log10': { fn: (x, p) => (x <= 0 ? NaN : p.A * Math.log10(x)) },
  'math-pow': {
    fn: (x, p) => {
      const v = Math.pow(x, p.n)
      return isFinite(v) ? p.A * v : NaN
    }
  },
  'math-sqrt': { fn: (x, p) => (x < 0 ? NaN : p.A * Math.sqrt(x)) },
  'math-abs': { fn: (x, p) => p.A * Math.abs(x) },
  'math-damped': {
    fn: (x, p) => p.A * Math.exp(-p.d * x) * Math.sin(p.w * x),
    stats: periodStats(2)
  },
  'math-gauss': {
    fn: (x, p) => (p.sigma ? p.A * Math.exp(-Math.pow(x - p.mu, 2) / (2 * p.sigma * p.sigma)) : NaN),
    stats: (p) => (p.sigma ? [{ label: '半高宽 FWHM', value: 2.3548 * Math.abs(p.sigma), unit: '' }] : [])
  }
}

export default mathFunctions
