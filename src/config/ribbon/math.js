/**
 * 数学计算按钮（函数绘图，mode: 'local'）
 * 函数本体在 src/calc/math.js，这里只描述展示信息（表达式、参数、横轴范围、图标）
 */
import { mathFunctions } from '@/calc/math'

const A = { key: 'A', label: '系数 A', def: 1, step: 0.1 }
const W = { key: 'w', label: '角频率 ω', def: 1, step: 0.1 }
const TAU = Math.PI * 2

/** 组装一个函数按钮 */
function fnItem(key, label, icon, expr, params, domain, tip, piAxis = false) {
  const def = mathFunctions[key] || {}
  return {
    key,
    label,
    icon,
    kind: 'function',
    mode: 'local',
    tip,
    expr,
    params,
    domain,
    /** 横轴以 π 为单位显示刻度（三角函数等） */
    piAxis,
    fn: def.fn,
    stats: def.stats
  }
}

export const MATH_GROUPS = [
  {
    key: 'math-trig',
    label: '三角函数',
    items: [
      fnItem('math-sin', 'sin', 'fa-solid fa-wave-square', 'y = A · sin(ωx)', [A, W], { from: -TAU, to: TAU }, '正弦函数 y = A·sin(ωx)', true),
      fnItem('math-cos', 'cos', 'fa-solid fa-wave-square', 'y = A · cos(ωx)', [A, W], { from: -TAU, to: TAU }, '余弦函数 y = A·cos(ωx)', true),
      fnItem('math-tan', 'tan', 'fa-solid fa-chart-line', 'y = A · tan(ωx)', [A, W], { from: -1.5, to: 1.5 }, '正切函数 y = A·tan(ωx)', true),
      fnItem('math-asin', 'asin', 'fa-solid fa-arrows-up-down', 'y = A · asin(x)', [A], { from: -1, to: 1 }, '反正弦 y = A·asin(x)（|x| ≤ 1）'),
      fnItem('math-acos', 'acos', 'fa-solid fa-arrows-up-down', 'y = A · acos(x)', [A], { from: -1, to: 1 }, '反余弦 y = A·acos(x)（|x| ≤ 1）'),
      fnItem('math-atan', 'atan', 'fa-solid fa-arrows-up-down', 'y = A · atan(x)', [A], { from: -5, to: 5 }, '反正切 y = A·atan(x)')
    ]
  },
  {
    key: 'math-hyperbolic',
    label: '双曲函数',
    items: [
      fnItem('math-sinh', 'sinh', 'fa-solid fa-water', 'y = A · sinh(ωx)', [A, W], { from: -3, to: 3 }, '双曲正弦 y = A·sinh(ωx)'),
      fnItem('math-cosh', 'cosh', 'fa-solid fa-water', 'y = A · cosh(ωx)', [A, W], { from: -3, to: 3 }, '双曲余弦 y = A·cosh(ωx)'),
      fnItem('math-tanh', 'tanh', 'fa-solid fa-water', 'y = A · tanh(ωx)', [A, W], { from: -5, to: 5 }, '双曲正切 y = A·tanh(ωx)')
    ]
  },
  {
    key: 'math-exp',
    label: '指数与对数',
    items: [
      fnItem('math-exp', 'eˣ', 'fa-solid fa-arrow-trend-up', 'y = A · e^(kx)', [A, { key: 'k', label: '指数系数 k', def: 1, step: 0.1 }], { from: -3, to: 3 }, '指数函数 y = A·e^(kx)'),
      fnItem('math-ln', 'ln x', 'fa-solid fa-arrow-trend-down', 'y = A · ln(x)', [A], { from: 0.1, to: 10 }, '自然对数 y = A·ln(x)（x > 0）'),
      fnItem('math-log10', 'lg x', 'fa-solid fa-arrow-trend-down', 'y = A · log₁₀(x)', [A], { from: 0.1, to: 10 }, '常用对数 y = A·log₁₀(x)（x > 0）'),
      fnItem('math-pow', 'xⁿ', 'fa-solid fa-superscript', 'y = A · xⁿ', [A, { key: 'n', label: '指数 n', def: 2, step: 0.5 }], { from: -5, to: 5 }, '幂函数 y = A·xⁿ'),
      fnItem('math-sqrt', '√x', 'fa-solid fa-square-root-variable', 'y = A · √x', [A], { from: 0, to: 10 }, '平方根 y = A·√x（x ≥ 0）'),
      fnItem('math-abs', '|x|', 'fa-solid fa-arrows-left-right', 'y = A · |x|', [A], { from: -5, to: 5 }, '绝对值 y = A·|x|')
    ]
  },
  {
    key: 'math-engineering',
    label: '工程曲线',
    items: [
      fnItem(
        'math-damped',
        '阻尼振荡',
        'fa-solid fa-signal',
        'y = A · e^(−δx) · sin(ωx)',
        [A, { key: 'd', label: '衰减 δ', def: 0.3, step: 0.1 }, W],
        { from: 0, to: 4 * Math.PI },
        '衰减振荡 y = A·e^(−δx)·sin(ωx)',
        true
      ),
      fnItem(
        'math-gauss',
        '高斯脉冲',
        'fa-solid fa-bell',
        'y = A · e^(−(x − μ)² / 2σ²)',
        [A, { key: 'mu', label: '中心 μ', def: 0, step: 0.5 }, { key: 'sigma', label: '标准差 σ', def: 1, step: 0.1 }],
        { from: -6, to: 6 },
        '高斯函数 y = A·e^(−(x−μ)² / 2σ²)'
      )
    ]
  }
]

export default MATH_GROUPS
