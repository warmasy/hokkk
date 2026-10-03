/**
 * 运动学计算（纯 JS 本地计算，结构同 calc/inertia.js）
 */

export const kinematicsCalcs = {
  /** 匀速直线运动 s = v·t */
  'kin-uniform'(v) {
    const s = v.v * v.t
    return [
      { label: '位移 s', value: s, unit: 'm' },
      { label: '位移 s', value: s * 1000, unit: 'mm' },
      { label: '平均速度', value: v.t ? s / v.t : v.v, unit: 'm/s' }
    ]
  },

  /** 匀加速直线运动 v = v₀ + a·t ，s = v₀t + ½at² */
  'kin-accel'(v) {
    const vt = v.v0 + v.a * v.t
    const s = v.v0 * v.t + 0.5 * v.a * v.t * v.t
    return [
      { label: '末速度 v', value: vt, unit: 'm/s' },
      { label: '位移 s', value: s, unit: 'm' },
      { label: 'v²−v₀²', value: vt * vt - v.v0 * v.v0, unit: 'm²/s²' },
      { label: '平均速度', value: v.t ? s / v.t : 0, unit: 'm/s' }
    ]
  },

  /** 匀速圆周运动 ω = v / r ，a = v² / r */
  'kin-circular'(v) {
    const r = v.r / 1000
    const omega = r ? v.v / r : 0
    const an = r ? (v.v * v.v) / r : 0
    return [
      { label: '角速度 ω', value: omega, unit: 'rad/s' },
      { label: '向心加速度 aₙ', value: an, unit: 'm/s²' },
      { label: '向心力 Fₙ(1kg)', value: an, unit: 'N/kg' },
      { label: '周期 T', value: omega ? (2 * Math.PI) / omega : 0, unit: 's' },
      { label: '转速 n', value: omega ? (omega * 60) / (2 * Math.PI) : 0, unit: 'r/min' }
    ]
  },

  /** 变加速运动（跃度 j 恒定） */
  'kin-jerk'(v) {
    const vt = v.v0 + v.a0 * v.t + 0.5 * v.j * v.t * v.t
    const s = v.v0 * v.t + 0.5 * v.a0 * v.t * v.t + (v.j * Math.pow(v.t, 3)) / 6
    return [
      { label: '末速度 v', value: vt, unit: 'm/s' },
      { label: '位移 s', value: s, unit: 'm' },
      { label: '末加速度 a', value: v.a0 + v.j * v.t, unit: 'm/s²' }
    ]
  },

  /** 由转速求角速度、线速度 ω = 2πn / 60 ，v = ω·r */
  'kin-angular'(v) {
    const omega = (2 * Math.PI * v.n) / 60
    const r = v.r / 1000
    return [
      { label: '角速度 ω', value: omega, unit: 'rad/s' },
      { label: '线速度 v', value: omega * r, unit: 'm/s' },
      { label: '周期 T', value: omega ? (2 * Math.PI) / omega : 0, unit: 's' },
      { label: '频率 f', value: v.n / 60, unit: 'Hz' }
    ]
  },

  /** 运动学求解 a = (v² − v₀²) / 2s ，t = 2s / (v₀ + v) */
  'kin-solve'(v) {
    const a = v.s ? (v.v * v.v - v.v0 * v.v0) / (2 * v.s) : 0
    const sum = v.v0 + v.v
    return [
      { label: '加速度 a', value: a, unit: 'm/s²' },
      { label: '时间 t', value: sum ? (2 * v.s) / sum : 0, unit: 's' },
      { label: '平均速度', value: sum / 2, unit: 'm/s' }
    ]
  }
}

export default kinematicsCalcs
