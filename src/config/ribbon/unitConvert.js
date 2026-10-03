/**
 * 单位换算按钮（mode: 'builtin'，由 store 用 utils/units.js 的单位表处理）
 */
function unitItem(key, label, icon, unitType) {
  return { key, label, icon, kind: 'unit', mode: 'builtin', unitType }
}

export const UNIT_GROUP = {
  key: 'unit',
  label: '单位换算',
  items: [
    unitItem('unit-force', '力', 'fa-solid fa-arrow-down', 'force'),
    unitItem('unit-pressure', '压力', 'fa-solid fa-compress', 'pressure'),
    unitItem('unit-stress', '应力', 'fa-solid fa-arrows-up-down', 'stress'),
    unitItem('unit-torque', '转矩', 'fa-solid fa-rotate', 'torque'),
    unitItem('unit-length', '长度', 'fa-solid fa-ruler', 'length'),
    unitItem('unit-speed', '速度', 'fa-solid fa-gauge-high', 'speed'),
    unitItem('unit-mass', '质量', 'fa-solid fa-weight-scale', 'mass'),
    unitItem('unit-density', '密度', 'fa-solid fa-water', 'density'),
    unitItem('unit-time', '时间', 'fa-regular fa-clock', 'time'),
    unitItem('unit-angular', '转速', 'fa-solid fa-gauge', 'angularVelocity'),
    unitItem('unit-accel', '加速度', 'fa-solid fa-rocket', 'acceleration'),
    unitItem('unit-power', '功率', 'fa-solid fa-bolt', 'power')
  ]
}

export default UNIT_GROUP
