/**
 * 惯量计算按钮
 *
 * 计算函数放在 src/calc/inertia.js（纯 JS）。
 * 若某个公式以后要改成后端计算：
 *   1) 删掉下面的 calc
 *   2) 加上 mode: 'api', api: { url: '/calc/inertia/rod-center', method: 'post' }
 * 计算框会自动走 api/calc.js 的 executeCalc 请求，界面无需改动（详见 README 第六节）。
 */
import { inertiaCalcs } from '@/calc/inertia'

export const INERTIA_GROUP = {
  key: 'inertia',
  label: '惯量计算',
  items: [
    {
      key: 'inertia-rod-center',
      label: '直杆1',
      icon: 'fa-solid fa-slash',
      kind: 'formula',
      mode: 'local',
      tip: '均质细直杆绕垂直于杆且过中心的轴',
      desc: 'J = m·L² / 12',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 10 },
        { key: 'L', label: '杆长 L', unit: 'mm', def: 500 }
      ],
      calc: inertiaCalcs['inertia-rod-center'],
      sweep: { field: 'L', from: 50, to: 1000, label: '杆长 L (mm)', output: 0 }
    },
    {
      key: 'inertia-rod-end',
      label: '直杆2',
      icon: 'fa-solid fa-slash fa-rotate-90',
      kind: 'formula',
      mode: 'local',
      tip: '均质细直杆绕垂直于杆且过一端的轴',
      desc: 'J = m·L² / 3',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 10 },
        { key: 'L', label: '杆长 L', unit: 'mm', def: 500 }
      ],
      calc: inertiaCalcs['inertia-rod-end'],
      sweep: { field: 'L', from: 50, to: 1000, label: '杆长 L (mm)', output: 0 }
    },
    {
      key: 'inertia-arc',
      label: '圆弧杆',
      icon: 'fa-solid fa-circle-notch',
      kind: 'formula',
      mode: 'local',
      tip: '均质细圆弧杆绕圆心轴（垂直于弧面）',
      desc: 'J = m·R²',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 5 },
        { key: 'R', label: '半径 R', unit: 'mm', def: 300 },
        { key: 'angle', label: '圆心角 θ', unit: '°', def: 90 }
      ],
      calc: inertiaCalcs['inertia-arc'],
      sweep: { field: 'R', from: 50, to: 800, label: '半径 R (mm)', output: 0 }
    },
    {
      key: 'inertia-u',
      label: 'U型杆',
      icon: 'fa-solid fa-rotate',
      kind: 'formula',
      mode: 'local',
      tip: 'U 形（半圆环）均质杆绕直径轴',
      desc: 'J = m·R² / 2',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 5 },
        { key: 'R', label: '半径 R', unit: 'mm', def: 300 }
      ],
      calc: inertiaCalcs['inertia-u'],
      sweep: { field: 'R', from: 50, to: 800, label: '半径 R (mm)', output: 0 }
    },
    {
      key: 'inertia-rect',
      label: '矩形杆',
      icon: 'fa-regular fa-square',
      kind: 'formula',
      mode: 'local',
      tip: '均质矩形（薄板）绕过中心且垂直于板面的轴',
      desc: 'J = m·(a² + b²) / 12',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 8 },
        { key: 'a', label: '边长 a', unit: 'mm', def: 400 },
        { key: 'b', label: '边长 b', unit: 'mm', def: 200 }
      ],
      calc: inertiaCalcs['inertia-rect'],
      sweep: { field: 'a', from: 50, to: 800, label: '边长 a (mm)', output: 0 }
    },
    {
      key: 'inertia-ellipse',
      label: '椭圆杆',
      icon: 'fa-regular fa-circle',
      kind: 'formula',
      mode: 'local',
      tip: '均质椭圆板绕过中心且垂直于板面的轴',
      desc: 'J = m·(a² + b²) / 4',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 8 },
        { key: 'a', label: '半轴 a', unit: 'mm', def: 300 },
        { key: 'b', label: '半轴 b', unit: 'mm', def: 150 }
      ],
      calc: inertiaCalcs['inertia-ellipse'],
      sweep: { field: 'a', from: 50, to: 600, label: '半轴 a (mm)', output: 0 }
    },
    {
      key: 'inertia-ring',
      label: '圆环杆',
      icon: 'fa-regular fa-circle-dot',
      kind: 'formula',
      mode: 'local',
      tip: '细圆环绕过中心且垂直于环面的轴',
      desc: 'J = m·R²',
      fields: [
        { key: 'm', label: '质量 m', unit: 'kg', def: 6 },
        { key: 'R', label: '半径 R', unit: 'mm', def: 250 }
      ],
      calc: inertiaCalcs['inertia-ring'],
      sweep: { field: 'R', from: 50, to: 800, label: '半径 R (mm)', output: 0 }
    },
    {
      key: 'inertia-composite',
      label: '惯量计算',
      icon: 'fa-solid fa-calculator',
      kind: 'formula',
      mode: 'local',
      tip: '平行轴定理合成，并估算所需驱动转矩',
      desc: 'J = J₀ + m·d² ，T = J·α',
      fields: [
        { key: 'J0', label: '本体惯量 J₀', unit: 'kg·m²', def: 0.5 },
        { key: 'm', label: '附加质量 m', unit: 'kg', def: 20 },
        { key: 'd', label: '偏心距 d', unit: 'mm', def: 200 },
        { key: 'alpha', label: '角加速度 α', unit: 'rad/s²', def: 10 }
      ],
      calc: inertiaCalcs['inertia-composite'],
      sweep: { field: 'd', from: 0, to: 500, label: '偏心距 d (mm)', output: 0 }
    }
  ]
}

export default INERTIA_GROUP
