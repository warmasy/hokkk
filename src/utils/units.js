/**
 * 单位换算表
 * 每一项为 “单位 -> 相对基准单位的倍率”，基准单位排在第一项。
 * 换算方式： 目标值 = 源值 * 源倍率 / 目标倍率
 *
 * 字段说明：
 *   key   单位标识（程序内部使用，与 fields[].unit 对应）
 *   label 界面展示的英文简写
 *   full  中文全称（仅用于鼠标悬停提示）
 *   factor 相对基准单位的倍率
 */

export const UNIT_TYPES = {
  force: {
    name: '力',
    units: [
      { key: 'N', label: 'N', full: '牛顿', factor: 1 },
      { key: 'kN', label: 'kN', full: '千牛', factor: 1000 },
      { key: 'kgf', label: 'kgf', full: '千克力', factor: 9.80665 },
      { key: 'tf', label: 'tf', full: '吨力', factor: 9806.65 },
      { key: 'lbf', label: 'lbf', full: '磅力', factor: 4.4482216152605 },
      { key: 'dyn', label: 'dyn', full: '达因', factor: 1e-5 }
    ]
  },
  pressure: {
    name: '压力',
    units: [
      { key: 'Pa', label: 'Pa', full: '帕斯卡', factor: 1 },
      { key: 'kPa', label: 'kPa', full: '千帕', factor: 1e3 },
      { key: 'MPa', label: 'MPa', full: '兆帕', factor: 1e6 },
      { key: 'GPa', label: 'GPa', full: '吉帕', factor: 1e9 },
      { key: 'bar', label: 'bar', full: '巴', factor: 1e5 },
      { key: 'atm', label: 'atm', full: '标准大气压', factor: 101325 },
      { key: 'mmHg', label: 'mmHg', full: '毫米汞柱', factor: 133.322387415 },
      { key: 'kgfcm2', label: 'kgf/cm²', full: '千克力每平方厘米', factor: 98066.5 },
      { key: 'psi', label: 'psi', full: '磅力每平方英寸', factor: 6894.757293168 }
    ]
  },
  stress: {
    name: '应力',
    units: [
      { key: 'Pa', label: 'Pa', full: '帕斯卡', factor: 1 },
      { key: 'kPa', label: 'kPa', full: '千帕', factor: 1e3 },
      { key: 'MPa', label: 'MPa', full: '兆帕', factor: 1e6 },
      { key: 'GPa', label: 'GPa', full: '吉帕', factor: 1e9 },
      { key: 'kgfmm2', label: 'kgf/mm²', full: '千克力每平方毫米', factor: 9806.65 },
      { key: 'Nmm2', label: 'N/mm²', full: '牛顿每平方毫米', factor: 1e6 },
      { key: 'psi', label: 'psi', full: '磅力每平方英寸', factor: 6894.757293168 }
    ]
  },
  torque: {
    name: '转矩',
    units: [
      { key: 'N.m', label: 'N·m', full: '牛米', factor: 1 },
      { key: 'N.mm', label: 'N·mm', full: '牛毫米', factor: 0.001 },
      { key: 'kN.m', label: 'kN·m', full: '千牛米', factor: 1000 },
      { key: 'kgf.m', label: 'kgf·m', full: '千克力米', factor: 9.80665 },
      { key: 'kgf.cm', label: 'kgf·cm', full: '千克力厘米', factor: 0.0980665 },
      { key: 'lbf.ft', label: 'lbf·ft', full: '磅力英尺', factor: 1.3558179483314 },
      { key: 'lbf.in', label: 'lbf·in', full: '磅力英寸', factor: 0.11298482902762 }
    ]
  },
  length: {
    name: '长度',
    units: [
      { key: 'mm', label: 'mm', full: '毫米', factor: 0.001 },
      { key: 'cm', label: 'cm', full: '厘米', factor: 0.01 },
      { key: 'm', label: 'm', full: '米', factor: 1 },
      { key: 'km', label: 'km', full: '千米', factor: 1000 },
      { key: 'um', label: 'μm', full: '微米', factor: 1e-6 },
      { key: 'in', label: 'in', full: '英寸', factor: 0.0254 },
      { key: 'ft', label: 'ft', full: '英尺', factor: 0.3048 },
      { key: 'mil', label: 'mil', full: '密耳', factor: 2.54e-5 }
    ]
  },
  speed: {
    name: '速度',
    units: [
      { key: 'm/s', label: 'm/s', full: '米每秒', factor: 1 },
      { key: 'mm/s', label: 'mm/s', full: '毫米每秒', factor: 0.001 },
      { key: 'mm/min', label: 'mm/min', full: '毫米每分', factor: 1 / 60000 },
      { key: 'm/min', label: 'm/min', full: '米每分', factor: 1 / 60 },
      { key: 'km/h', label: 'km/h', full: '千米每小时', factor: 1 / 3.6 },
      { key: 'mph', label: 'mph', full: '英里每小时', factor: 0.44704 },
      { key: 'kn', label: 'kn', full: '节', factor: 0.5144444444 }
    ]
  },
  mass: {
    name: '质量',
    units: [
      { key: 'kg', label: 'kg', full: '千克', factor: 1 },
      { key: 'g', label: 'g', full: '克', factor: 0.001 },
      { key: 'mg', label: 'mg', full: '毫克', factor: 1e-6 },
      { key: 't', label: 't', full: '吨', factor: 1000 },
      { key: 'lb', label: 'lb', full: '磅', factor: 0.45359237 },
      { key: 'oz', label: 'oz', full: '盎司', factor: 0.028349523125 }
    ]
  },
  density: {
    name: '密度',
    units: [
      { key: 'kg/m3', label: 'kg/m³', full: '千克每立方米', factor: 1 },
      { key: 'g/cm3', label: 'g/cm³', full: '克每立方厘米', factor: 1000 },
      { key: 'kg/L', label: 'kg/L', full: '千克每升', factor: 1000 },
      { key: 't/m3', label: 't/m³', full: '吨每立方米', factor: 1000 },
      { key: 'lb/ft3', label: 'lb/ft³', full: '磅每立方英尺', factor: 16.01846337396 },
      { key: 'lb/in3', label: 'lb/in³', full: '磅每立方英寸', factor: 27679.904710203 }
    ]
  },
  time: {
    name: '时间',
    units: [
      { key: 's', label: 's', full: '秒', factor: 1 },
      { key: 'ms', label: 'ms', full: '毫秒', factor: 0.001 },
      { key: 'us', label: 'μs', full: '微秒', factor: 1e-6 },
      { key: 'min', label: 'min', full: '分', factor: 60 },
      { key: 'h', label: 'h', full: '小时', factor: 3600 },
      { key: 'd', label: 'd', full: '天', factor: 86400 }
    ]
  },
  angularVelocity: {
    name: '转速',
    units: [
      { key: 'rpm', label: 'r/min', full: '转每分', factor: 0.10471975511965977 },
      { key: 'rad/s', label: 'rad/s', full: '弧度每秒', factor: 1 },
      { key: 'deg/s', label: '°/s', full: '度每秒', factor: 0.017453292519943295 },
      { key: 'r/s', label: 'r/s', full: '转每秒', factor: 6.283185307179586 }
    ]
  },
  acceleration: {
    name: '加速度',
    units: [
      { key: 'm/s2', label: 'm/s²', full: '米每平方秒', factor: 1 },
      { key: 'mm/s2', label: 'mm/s²', full: '毫米每平方秒', factor: 0.001 },
      { key: 'gal', label: 'Gal', full: '伽（厘米每平方秒）', factor: 0.01 },
      { key: 'g', label: 'g', full: '重力加速度', factor: 9.80665 },
      { key: 'ft/s2', label: 'ft/s²', full: '英尺每平方秒', factor: 0.3048 }
    ]
  },
  power: {
    name: '功率',
    units: [
      { key: 'kW', label: 'kW', full: '千瓦', factor: 1000 },
      { key: 'W', label: 'W', full: '瓦', factor: 1 },
      { key: 'MW', label: 'MW', full: '兆瓦', factor: 1e6 },
      { key: 'PS', label: 'PS', full: '公制马力', factor: 735.49875 },
      { key: 'hp', label: 'hp', full: '英制马力', factor: 745.6998715823 },
      { key: 'kgf.m/s', label: 'kgf·m/s', full: '千克力米每秒', factor: 9.80665 },
      { key: 'cal/s', label: 'cal/s', full: '卡每秒', factor: 4.184 }
    ]
  }
}

/**
 * 单位换算
 * @param {String} unitType UNIT_TYPES 的键
 * @param {Number|String} value 源数值
 * @param {String} from 源单位 key
 * @param {String} to 目标单位 key
 * @returns {Number} 目标数值（无法换算返回 NaN）
 */
export function convertUnit(unitType, value, from, to) {
  const type = UNIT_TYPES[unitType]
  if (!type) return NaN
  const num = Number(value)
  if (!isFinite(num)) return NaN
  const f = type.units.find((u) => u.key === from)
  const t = type.units.find((u) => u.key === to)
  if (!f || !t) return NaN
  return (num * f.factor) / t.factor
}

/** 判断某个单位 key 是否属于该单位类型（用于恢复本地缓存时校验） */
export function isValidUnit(unitType, key) {
  const type = UNIT_TYPES[unitType]
  if (!type) return false
  return type.units.some((u) => u.key === key)
}

/**
 * 取某个单位类型的默认单位
 */
export function defaultUnits(unitType) {
  const type = UNIT_TYPES[unitType]
  if (!type) return { from: '', to: '' }
  const first = type.units[0]
  const second = type.units[1] || first
  return { from: first.key, to: second.key }
}

/**
 * 数值格式化：保留有效数字，去掉多余的 0
 */
export function formatNumber(value, digits = 6) {
  const num = Number(value)
  if (!isFinite(num)) return '-'
  if (num === 0) return '0'
  const abs = Math.abs(num)
  // 只有真正的极大/极小值才用科学计数法（1e6 直接显示整数，避免 1.0000e+06 这种别扭写法）
  if (abs >= 1e9 || abs < 1e-6) {
    return num.toExponential(4).replace(/e([+-])(\d)$/, 'e$10$2')
  }
  const fixed = num.toPrecision(digits)
  return String(parseFloat(fixed))
}

/**
 * 输入框里的数值显示：最多 6 位有效数字、去掉多余的 0
 * （2π 显示成 6.28319，而不是 6.283185307179586）
 */
export function formatInput(value) {
  const num = Number(value)
  if (!isFinite(num)) return ''
  if (num === 0) return '0'
  return String(Number(num.toPrecision(6)))
}

/**
 * 单位换算类按钮：把数值换算成该类型下的所有单位
 * @returns {Array<{label, value, unit}>}
 */
export function buildUnitRows(item, value, fromKey) {
  const type = UNIT_TYPES[item?.unitType]
  if (!type) return []
  const num = Number(value)
  if (!isFinite(num)) return []
  const src = type.units.find((u) => u.key === fromKey) || type.units[0]
  return type.units.map((u) => ({
    label: u.label,
    value: (num * src.factor) / u.factor,
    unit: u.key
  }))
}
