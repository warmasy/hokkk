/**
 * 力学计算（纯 JS 本地计算，结构同 calc/inertia.js）
 */

export const mechanicsCalcs = {
  /** 牛顿第二定律 a = F / m */
  'mech-newton2'(v) {
    const a = v.m ? v.F / v.m : 0
    return [
      { label: '加速度 a', value: a, unit: 'm/s²' },
      { label: '重力 G', value: v.m * 9.80665, unit: 'N' },
      { label: '末速度 v', value: a * v.t, unit: 'm/s' },
      { label: '位移 s', value: 0.5 * a * v.t * v.t, unit: 'm' }
    ]
  },

  /** 动量与冲量 p = m·v ，I = F·t */
  'mech-momentum'(v) {
    const p = v.m * v.v
    const I = v.F * v.t
    const dv = v.m ? I / v.m : 0
    return [
      { label: '动量 p', value: p, unit: 'kg·m/s' },
      { label: '冲量 I', value: I, unit: 'N·s' },
      { label: '速度增量 Δv', value: dv, unit: 'm/s' },
      { label: '末动量 p′', value: v.m * (v.v + dv), unit: 'kg·m/s' }
    ]
  },

  /** 一维碰撞（完全非弹性 / 完全弹性） */
  'mech-collision'(v) {
    const sum = v.m1 + v.m2
    if (!sum) return [{ label: '合计质量', value: 0, unit: 'kg' }]
    const vInelastic = (v.m1 * v.v1 + v.m2 * v.v2) / sum
    const v1After = ((v.m1 - v.m2) * v.v1 + 2 * v.m2 * v.v2) / sum
    const v2After = ((v.m2 - v.m1) * v.v2 + 2 * v.m1 * v.v1) / sum
    const ekBefore = 0.5 * v.m1 * v.v1 * v.v1 + 0.5 * v.m2 * v.v2 * v.v2
    const ekAfterInelastic = 0.5 * sum * vInelastic * vInelastic
    return [
      { label: '动量总和 p', value: v.m1 * v.v1 + v.m2 * v.v2, unit: 'kg·m/s' },
      { label: '非弹性共同速度', value: vInelastic, unit: 'm/s' },
      { label: '弹性 v₁′', value: v1After, unit: 'm/s' },
      { label: '弹性 v₂′', value: v2After, unit: 'm/s' },
      { label: '非弹性动能损失', value: ekBefore - ekAfterInelastic, unit: 'J' }
    ]
  },

  /** 滑动摩擦 f = μ·N */
  'mech-friction'(v) {
    const f = v.mu * v.N
    const net = v.F - f
    return [
      { label: '摩擦力 f', value: f, unit: 'N' },
      { label: '合力 F−f', value: net, unit: 'N' },
      { label: '加速度 a', value: v.m ? net / v.m : 0, unit: 'm/s²' },
      { label: '状态', value: net > 0 ? '可动' : '静止', unit: '' }
    ]
  },

  /** 功 / 功率 / 效率 */
  'mech-work'(v) {
    const W = v.F * v.s
    const P = v.t ? W / v.t : 0
    const eff = v.Pin > 0 ? (P / 1000 / v.Pin) * 100 : 0
    return [
      { label: '功 W', value: W, unit: 'J' },
      { label: '输出功率 P', value: P, unit: 'W' },
      { label: '输出功率 P', value: P / 1000, unit: 'kW' },
      { label: '效率 η', value: eff, unit: '%' }
    ]
  }
}

export default mechanicsCalcs
