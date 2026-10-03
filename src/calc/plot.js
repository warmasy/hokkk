/**
 * 计算绘图辅助（纯 JS，不依赖框架）
 *   buildFunctionPoints：函数采样成绘图点
 *   functionStats：函数特性（最大值 / 最小值 + 自定义统计）
 */
const SAMPLES = 400

export function buildFunctionPoints(item, values) {
  if (!item || typeof item.fn !== 'function') return null
  const from = Number(values.xFrom)
  const to = Number(values.xTo)
  if (!isFinite(from) || !isFinite(to) || to <= from) return null
  const points = []
  for (let i = 0; i < SAMPLES; i++) {
    const x = from + ((to - from) * i) / (SAMPLES - 1)
    const y = item.fn(x, values)
    if (isFinite(y)) points.push({ x, y })
  }
  if (points.length < 2) return null
  return { label: item.expr || item.label, unit: '', points }
}

/** 三分法精修极值（函数类按钮传入了 fn 时使用，避免采样点带来的误差） */
function refineExtreme(fn, values, p, step, dir) {
  if (typeof fn !== 'function' || !step) return null
  let lo = p.x - step
  let hi = p.x + step
  for (let i = 0; i < 60; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    const f1 = dir * fn(m1, values)
    const f2 = dir * fn(m2, values)
    if (!isFinite(f1)) {
      lo = m1
      continue
    }
    if (!isFinite(f2)) {
      hi = m2
      continue
    }
    if (f1 < f2) lo = m1
    else hi = m2
  }
  const x = (lo + hi) / 2
  const y = fn(x, values)
  return isFinite(y) ? { x, y } : null
}

export function functionStats(item, values) {
  const series = buildFunctionPoints(item, values)
  if (!series) return []
  const pts = series.points
  const ys = pts.map((p) => p.y)
  let maxV = Math.max(...ys)
  let minV = Math.min(...ys)
  // 有解析函数时精修极值，保证显示的是精确的 1 / -1 而不是 0.99999
  if (typeof item.fn === 'function' && pts.length > 2) {
    const step = Math.abs(pts[1].x - pts[0].x)
    const coarseMax = pts.reduce((a, b) => (b.y > a.y ? b : a))
    const coarseMin = pts.reduce((a, b) => (b.y < a.y ? b : a))
    const rMax = refineExtreme(item.fn, values, coarseMax, step, 1)
    const rMin = refineExtreme(item.fn, values, coarseMin, step, -1)
    if (rMax) maxV = rMax.y
    if (rMin) minV = rMin.y
  }
  const rows = [
    { label: '最大值', value: maxV, unit: '' },
    { label: '最小值', value: minV, unit: '' }
  ]
  if (typeof item.stats === 'function') {
    try {
      rows.push(...(item.stats(values) || []))
    } catch (e) {
      /* 忽略统计异常 */
    }
  }
  return rows
}

/**
 * 公式类按钮的关系曲线：按 item.sweep 指定的字段扫描，取指定结果行作为纵轴
 * @returns {null|{ label, unit, points: [{x, y}] }}
 */
export function buildSeries(item, values) {
  const sweep = item?.sweep
  if (!sweep || typeof item?.calc !== 'function') return null
  const points = sweep.points || 25
  const from = Number(sweep.from)
  const to = Number(sweep.to)
  if (!isFinite(from) || !isFinite(to) || to === from) return null
  const data = []
  let unit = ''
  for (let i = 0; i < points; i++) {
    const x = from + ((to - from) * i) / (points - 1)
    const rows = item.calc({ ...values, [sweep.field]: x })
    const row = rows?.[sweep.output ?? 0]
    const y = Number(row?.value)
    if (row?.unit) unit = row.unit
    if (isFinite(y)) data.push({ x, y })
  }
  if (!data.length) return null
  return { label: `${item.label} · ${sweep.label}`, unit, points: data }
}
