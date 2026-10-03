/**
 * 运动学按钮（公式见 src/calc/kinematics.js；改后端计算方式同力学计算）
 */
import { kinematicsCalcs } from '@/calc/kinematics'

export const KINEMATICS_GROUP = {
  key: 'kinematics',
  label: '运动学',
  items: [
    {
      key: 'kin-uniform',
      label: '匀速直线运动',
      icon: 'fa-solid fa-arrow-right',
      kind: 'formula',
      mode: 'local',
      tip: '速度恒定的直线运动',
      desc: 's = v·t',
      fields: [
        { key: 'v', label: '速度 v', unit: 'm/s', def: 2 },
        { key: 't', label: '时间 t', unit: 's', def: 5 }
      ],
      calc: kinematicsCalcs['kin-uniform'],
      sweep: { field: 't', from: 0, to: 20, label: '时间 t (s)', output: 0 }
    },
    {
      key: 'kin-accel',
      label: '匀加速直线运动',
      icon: 'fa-solid fa-arrow-trend-up',
      kind: 'formula',
      mode: 'local',
      tip: '加速度恒定的直线运动',
      desc: 'v = v₀ + a·t ，s = v₀t + ½at²',
      fields: [
        { key: 'v0', label: '初速度 v₀', unit: 'm/s', def: 0 },
        { key: 'a', label: '加速度 a', unit: 'm/s²', def: 2 },
        { key: 't', label: '时间 t', unit: 's', def: 5 }
      ],
      calc: kinematicsCalcs['kin-accel'],
      sweep: { field: 't', from: 0, to: 10, label: '时间 t (s)', output: 1 }
    },
    {
      key: 'kin-circular',
      label: '圆周运动',
      icon: 'fa-solid fa-circle-notch',
      kind: 'formula',
      mode: 'local',
      tip: '匀速圆周运动',
      desc: 'ω = v / r ，a = v² / r',
      fields: [
        { key: 'r', label: '半径 r', unit: 'mm', def: 200 },
        { key: 'v', label: '线速度 v', unit: 'm/s', def: 3 }
      ],
      calc: kinematicsCalcs['kin-circular'],
      sweep: { field: 'v', from: 0, to: 10, label: '线速度 v (m/s)', output: 1 }
    },
    {
      key: 'kin-jerk',
      label: '变加速运动',
      icon: 'fa-solid fa-wave-square',
      kind: 'formula',
      mode: 'local',
      tip: '加速度按恒定变化率（跃度 j）变化',
      desc: 'v = v₀ + a₀t + ½jt² ，s = v₀t + ½a₀t² + jt³/6',
      fields: [
        { key: 'v0', label: '初速度 v₀', unit: 'm/s', def: 0 },
        { key: 'a0', label: '初加速度 a₀', unit: 'm/s²', def: 1 },
        { key: 'j', label: '跃度 j', unit: 'm/s³', def: 0.5 },
        { key: 't', label: '时间 t', unit: 's', def: 4 }
      ],
      calc: kinematicsCalcs['kin-jerk'],
      sweep: { field: 't', from: 0, to: 10, label: '时间 t (s)', output: 1 }
    },
    {
      key: 'kin-angular',
      label: '圆周运动角速度',
      icon: 'fa-solid fa-rotate-right',
      kind: 'formula',
      mode: 'local',
      tip: '由转速推算角速度与线速度',
      desc: 'ω = 2πn / 60 ，v = ω·r',
      fields: [
        { key: 'n', label: '转速 n', unit: 'r/min', def: 1450 },
        { key: 'r', label: '半径 r', unit: 'mm', def: 100 }
      ],
      calc: kinematicsCalcs['kin-angular'],
      sweep: { field: 'n', from: 0, to: 3000, label: '转速 n (r/min)', output: 0 }
    },
    {
      key: 'kin-solve',
      label: '运动学求解',
      icon: 'fa-solid fa-play',
      kind: 'formula',
      mode: 'local',
      tip: '由初末速度与位移反求加速度与时间',
      desc: 'a = (v² − v₀²) / 2s ，t = 2s / (v₀ + v)',
      fields: [
        { key: 'v0', label: '初速度 v₀', unit: 'm/s', def: 0 },
        { key: 'v', label: '末速度 v', unit: 'm/s', def: 10 },
        { key: 's', label: '位移 s', unit: 'm', def: 25 }
      ],
      calc: kinematicsCalcs['kin-solve'],
      sweep: { field: 's', from: 1, to: 100, label: '位移 s (m)', output: 0 }
    }
  ]
}

export default KINEMATICS_GROUP
