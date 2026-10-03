/**
 * 惯量计算（纯 JS 本地计算）
 *
 * 每个函数接收已转成 Number 的参数对象，返回 [{ label, value, unit }]
 * 后续若要改成后端计算，只需在 config/ribbon/inertia.js 里把对应按钮标成
 * mode: 'api' 并填写接口地址即可，本文件可保持不动。
 */

export const inertiaCalcs = {
  /** 直杆1：绕过中心且垂直于杆的轴 —— J = m·L² / 12 */
  'inertia-rod-center'(v) {
    const L = v.L / 1000
    const J = (v.m * L * L) / 12
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '转动惯量 J', value: J * 1e6, unit: 'kg·mm²' },
      { label: '回转半径 i', value: J > 0 && v.m > 0 ? Math.sqrt(J / v.m) * 1000 : 0, unit: 'mm' }
    ]
  },

  /** 直杆2：绕过端点且垂直于杆的轴 —— J = m·L² / 3 */
  'inertia-rod-end'(v) {
    const L = v.L / 1000
    const J = (v.m * L * L) / 3
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '转动惯量 J', value: J * 1e6, unit: 'kg·mm²' },
      { label: '相对中心轴', value: J / 4, unit: 'kg·m²' }
    ]
  },

  /** 圆弧杆：绕圆心轴 —— J = m·R² */
  'inertia-arc'(v) {
    const R = v.R / 1000
    const J = v.m * R * R
    const theta = (v.angle * Math.PI) / 180
    const arc = R * theta
    const centroid = theta > 0 ? (R * Math.sin(theta / 2)) / (theta / 2) : R
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '弧长 L', value: arc * 1000, unit: 'mm' },
      { label: '重心半径', value: centroid * 1000, unit: 'mm' }
    ]
  },

  /** U 型（半圆环）杆：绕直径轴 —— J = m·R² / 2 */
  'inertia-u'(v) {
    const R = v.R / 1000
    const J = (v.m * R * R) / 2
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '整圆环对比', value: v.m * R * R, unit: 'kg·m²' },
      { label: '回转半径 i', value: Math.sqrt(J / v.m) * 1000, unit: 'mm' }
    ]
  },

  /** 矩形（薄板）：绕中心垂直轴 —— J = m·(a² + b²) / 12 */
  'inertia-rect'(v) {
    const a = v.a / 1000
    const b = v.b / 1000
    const J = (v.m * (a * a + b * b)) / 12
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '绕 a 边轴', value: (v.m * b * b) / 3, unit: 'kg·m²' },
      { label: '绕 b 边轴', value: (v.m * a * a) / 3, unit: 'kg·m²' }
    ]
  },

  /** 椭圆板：绕中心垂直轴 —— J = m·(a² + b²) / 4 */
  'inertia-ellipse'(v) {
    const a = v.a / 1000
    const b = v.b / 1000
    const J = (v.m * (a * a + b * b)) / 4
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '绕长轴', value: (v.m * b * b) / 4, unit: 'kg·m²' },
      { label: '离心惯量 Jxy', value: 0, unit: 'kg·m²' }
    ]
  },

  /** 细圆环：绕中心垂直轴 —— J = m·R² */
  'inertia-ring'(v) {
    const R = v.R / 1000
    const J = v.m * R * R
    return [
      { label: '转动惯量 J', value: J, unit: 'kg·m²' },
      { label: '绕直径轴', value: J / 2, unit: 'kg·m²' },
      { label: '飞轮矩 GD²', value: 4 * J, unit: 'kg·m²' }
    ]
  },

  /** 复合惯量：平行轴定理 + 加速转矩 —— J = J₀ + m·d² ，T = J·α */
  'inertia-composite'(v) {
    const d = v.d / 1000
    const J = v.J0 + v.m * d * d
    return [
      { label: '合成惯量 J', value: J, unit: 'kg·m²' },
      { label: '加速转矩 T', value: J * v.alpha, unit: 'N·m' },
      { label: '飞轮矩 GD²', value: 4 * J, unit: 'kg·m²' },
      { label: '附加惯量占比', value: J > 0 ? ((v.m * d * d) / J) * 100 : 0, unit: '%' }
    ]
  }
}

export default inertiaCalcs
