/**
 * 本地“AI 助手”解析器
 * 不依赖后端：从自然语言中提取关键词与数值，匹配计算模块并回填参数。
 * 后期接入真实大模型接口时，可保留本文件作为离线兜底（见 api/ai.js）。
 */
import { RIBBON_ITEMS, findItem } from '@/config/ribbon'
import { formatNumber } from '@/utils/units'

/** 关键词 -> 计算模块 */
const KEYWORD_RULES = [
  { re: /(转动惯量|惯量|飞轮矩|扭矩.*惯量)/, itemKey: 'inertia-composite' },
  { re: /(直杆|杆件|细杆)/, itemKey: 'inertia-rod-center' },
  { re: /(圆环|环形)/, itemKey: 'inertia-ring' },
  { re: /(矩形|方板|矩形板)/, itemKey: 'inertia-rect' },
  { re: /(椭圆)/, itemKey: 'inertia-ellipse' },
  { re: /(牛顿第二定律|牛顿|F\s*=\s*m\s*\*?\s*a|加速度)/i, itemKey: 'mech-newton2' },
  { re: /(动量|冲量)/, itemKey: 'mech-momentum' },
  { re: /(碰撞|弹性碰撞)/, itemKey: 'mech-collision' },
  { re: /(摩擦|摩擦因数|摩擦系数)/, itemKey: 'mech-friction' },
  { re: /(功|功率|效率)/, itemKey: 'mech-work' },
  { re: /(匀速)/, itemKey: 'kin-uniform' },
  { re: /(匀加速)/, itemKey: 'kin-accel' },
  { re: /(圆周运动角速度|角速度|转速)/, itemKey: 'kin-angular' },
  { re: /(圆周运动|向心)/, itemKey: 'kin-circular' },
  { re: /(变加速|跃度)/, itemKey: 'kin-jerk' },
  { re: /(运动学求解|反求加速度)/, itemKey: 'kin-solve' }
]

/** 单位别名 -> 规范单位（与 fields[].unit 对齐） */
const UNIT_ALIAS = {
  kg: 'kg', 千克: 'kg', 公斤: 'kg',
  g: 'g', 克: 'g',
  n: 'N', 牛: 'N', 牛顿: 'N',
  kn: 'kN',
  mm: 'mm', 毫米: 'mm',
  cm: 'cm', 厘米: 'cm',
  m: 'm', 米: 'm',
  s: 's', 秒: 's',
  分: 'min', min: 'min',
  'm/s': 'm/s', '米/秒': 'm/s',
  'm/s2': 'm/s²', 'm/s²': 'm/s²',
  'm/s3': 'm/s³', 'm/s³': 'm/s³',
  'r/min': 'r/min', rpm: 'r/min', '转/分': 'r/min',
  'rad/s': 'rad/s',
  'rad/s2': 'rad/s²', 'rad/s²': 'rad/s²',
  kw: 'kW', 千瓦: 'kW',
  'kg.m2': 'kg·m²', 'kg·m²': 'kg·m²',
  'n.m': 'N·m', 'n·m': 'N·m',
  度: '°', '°': '°',
  '%': '%', 百分号: '%'
}

/** 提取 “数值 + 单位” */
function extractNumbers(text) {
  const result = []
  const re = /(-?\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5·/²³%°]*)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[1])
    const rawUnit = (m[2] || '').trim().toLowerCase()
    let unit = rawUnit
    if (rawUnit) {
      unit = UNIT_ALIAS[rawUnit] || UNIT_ALIAS[rawUnit.replace(/\s/g, '')] || ''
    } else {
      unit = ''
    }
    result.push({ value, unit })
  }
  return result
}

function matchItem(text) {
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) return rule.itemKey
  }
  return null
}

/**
 * 解析并生成回复
 * @param {String} text 用户输入
 * @param {Object} workbench workbench store 实例
 * @returns {{ html: String, ok: Boolean, itemKey: String|null }}
 */
export function reply(text, workbench) {
  const input = String(text || '').trim()
  if (!input) return { html: '请输入计算需求，例如：帮我计算 10kg 物体在 100N 力作用下的加速度。', ok: false, itemKey: null }

  const itemKey = matchItem(input)
  if (!itemKey) {
    const names = RIBBON_ITEMS.filter((i) => i.kind === 'formula').map((i) => i.label).join('、')
    return {
      html: `暂未识别出计算类型。<br>目前支持：${names}。<br>示例：帮我计算 10kg 物体在 100N 力作用下的加速度。`,
      ok: false,
      itemKey: null
    }
  }

  const item = findItem(itemKey)
  const numbers = extractNumbers(input)
  const patch = {}
  const used = new Set()
  const fields = item.fields || []

  // 1) 优先按单位匹配，未匹配到的数值留待顺序补齐
  const pending = []
  numbers.forEach((n) => {
    if (!n.unit) {
      pending.push(n)
      return
    }
    const field = fields.find((f) => f.unit === n.unit && !used.has(f.key))
    if (field) {
      patch[field.key] = n.value
      used.add(field.key)
    } else {
      pending.push(n)
    }
  })
  // 2) 剩余数值按字段顺序补齐
  pending.forEach((n) => {
    const field = fields.find((f) => !used.has(f.key))
    if (field) {
      patch[field.key] = n.value
      used.add(field.key)
    }
  })

  const applied = Object.keys(patch).length
  // 打开一个独立计算框，并把识别到的参数写进去
  const opened = workbench.openWindow(itemKey, { patch: applied ? patch : null })
  const rows = (workbench.resultsOf(opened.instanceId) || [])
    .filter((r) => typeof r.value === 'number' && isFinite(r.value))
    .slice(0, 4)
    .map((r) => `${r.label} = <strong>${formatNumber(r.value)} ${r.unit || ''}</strong>`)
    .join('<br>')

  const paramText = applied
    ? Object.entries(patch)
        .map(([k, v]) => {
          const f = fields.find((x) => x.key === k)
          return `${f?.label || k} = ${v} ${f?.unit || ''}`
        })
        .join('，')
    : '（未识别到数值，已使用默认参数）'

  return {
    ok: true,
    itemKey,
    html: `已在中间打开「${item.label}」计算框${item.desc ? `（${item.desc}）` : ''}。<br>识别参数：${paramText}<br>计算结果：<br>${rows || '暂无结果'}<br>可继续调整窗口里的参数，曲线会同步刷新。`
  }
}
