/**
 * 力学计算按钮
 *
 * 说明：这些公式目前是前端 JS 计算（src/calc/mechanics.js）。
 * 想改成后端计算时，把按钮改成：
 *   { ...同下, mode: 'api', api: { url: '/calc/mechanics/newton2' } }   // 去掉 calc 字段
 * 计算框会自动改为请求接口（api/calc.js -> executeCalc），无需改界面。
 */
import { mechanicsCalcs } from '@/calc/mechanics'

export const MECHANICS_GROUP = {
  key: 'mechanics',
  label: '力学计算',
  items: [
    {
      key: 'mech-newton2',
      label: '牛顿第二定律',
      icon: 'fa-solid fa-weight-hanging',
      kind: 'formula',
      mode: 'local', // 改成 'api' 即走后端接口
      api: { url: '/calc/mechanics/newton2', method: 'post' }, // 示例：mode 换成 api 后生效
      tip: 'F = m·a',
      desc: 'a = F / m',
      fields: [
        { key: 'F', label: '合力 F', unit: 'N', def: 100 },
        { key: 'm', label: '质量 m', unit: 'kg', def: 10 },
        { key: 't', label: '作用时间 t', unit: 's', def: 2 }
      ],
      calc: mechanicsCalcs['mech-newton2'],
      sweep: { field: 'F', from: 0, to: 500, label: '合力 F (N)', output: 0 }
    },
    {
      key: 'mech-momentum',
      label: '动量',
      icon: 'fa-solid fa-arrow-right',
      kind: 'formula',
      mode: 'local',
      tip: 'p = m·v ，I = F·t ，Δv = I / m',
      desc: '动量与冲量',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 10 },
        { key: 'v', label: '初速度 v', unit: 'm/s', def: 5 },
        { key: 'F', label: '冲力 F', unit: 'N', def: 50 },
        { key: 't', label: '时间 t', unit: 's', def: 2 }
      ],
      calc: mechanicsCalcs['mech-momentum'],
      sweep: { field: 'F', from: 0, to: 200, label: '冲力 F (N)', output: 2 }
    },
    {
      key: 'mech-collision',
      label: '碰撞',
      icon: 'fa-solid fa-burst',
      kind: 'formula',
      mode: 'local',
      tip: '一维碰撞：完全非弹性 / 完全弹性',
      desc: '动量守恒 + 能量守恒',
      fields: [
        { key: 'm1', label: '质量 m₁', unit: 'kg', def: 10 },
        { key: 'v1', label: '速度 v₁', unit: 'm/s', def: 5 },
        { key: 'm2', label: '质量 m₂', unit: 'kg', def: 5 },
        { key: 'v2', label: '速度 v₂', unit: 'm/s', def: 0 }
      ],
      calc: mechanicsCalcs['mech-collision'],
      sweep: { field: 'v1', from: 0, to: 10, label: '速度 v₁ (m/s)', output: 3 }
    },
    {
      key: 'mech-friction',
      label: '滑动摩擦',
      icon: 'fa-solid fa-arrows-left-right',
      kind: 'formula',
      mode: 'local',
      tip: 'f = μ·N',
      desc: '摩擦力与净加速',
      fields: [
        { key: 'mu', label: '摩擦因数 μ', unit: '', def: 0.15 },
        { key: 'N', label: '正压力 N', unit: 'N', def: 500 },
        { key: 'F', label: '驱动力 F', unit: 'N', def: 200 },
        { key: 'm', label: '质量 m', unit: 'kg', def: 50 }
      ],
      calc: mechanicsCalcs['mech-friction'],
      sweep: { field: 'F', from: 0, to: 600, label: '驱动力 F (N)', output: 2 }
    },
    {
      key: 'mech-work',
      label: '力学计算',
      icon: 'fa-solid fa-play',
      kind: 'formula',
      mode: 'local',
      tip: '功、功率与效率',
      desc: 'W = F·s ，P = W / t ，η = P / P入',
      fields: [
        { key: 'F', label: '力 F', unit: 'N', def: 200 },
        { key: 's', label: '位移 s', unit: 'm', def: 2 },
        { key: 't', label: '时间 t', unit: 's', def: 4 },
        { key: 'Pin', label: '输入功率 P入', unit: 'kW', def: 0.5 }
      ],
      calc: mechanicsCalcs['mech-work'],
      sweep: { field: 'F', from: 0, to: 1000, label: '力 F (N)', output: 1 }
    }
  ]
}

export default MECHANICS_GROUP
