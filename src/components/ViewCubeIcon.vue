<template>
  <svg class="mc-cube" viewBox="0 0 24 24" width="16" height="14" aria-hidden="true">
    <path
      v-for="p in polygons"
      :key="p.key"
      :data-face="p.face || p.key"
      :d="p.d"
      :fill="p.fill === 'none' ? 'none' : 'currentColor'"
      :fill-opacity="p.fillOpacity"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
      stroke-linecap="round"
      :stroke-dasharray="p.dashed ? '2.4 1.7' : undefined"
    />
  </svg>
</template>

<script setup>
/**
 * 视角按钮的立方体图标。
 *
 * 约定（非常重要）：**所有视角共用同一个等轴测立方体，形状与朝向永远不变**，
 * 只把「你要看的那个面」涂黑：
 *   - 该面在等轴测下本来就看得见（前面 / 右面 / 上面）→ 实心涂黑；
 *   - 该面在这个朝向下被挡住（左面 / 后面 / 下面）→ 画在立方体内部，
 *     用**虚线边 + 半透明填充**表示「这是看不到的那一面」。
 * 这样 7 个图标的轮廓完全一致，只有涂黑的位置不同，扫一眼就能对上。
 *
 * face 取值：iso（等轴测，不涂黑）/ front / back / left / right / top / bottom
 */
import { computed } from 'vue'

const props = defineProps({
  face: { type: String, default: 'iso' }
})

/** 固定相机方向 = 等轴测，和「等轴测」按钮完全一致（Y 向上、+Z 是正前方，从"前-右-上"看） */
const EYE = [1.8, 1, 1]

/** 立方体 6 个面（外法向 + 4 个顶点，顶点按绕面一周排列）。
 *  约定与 modelController.js 的 VIEW_PRESETS 一致：Y 向上、+Z 正视、+X 右视 */
const FACES = [
  { key: 'front', n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { key: 'back', n: [0, 0, -1], v: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] },
  { key: 'left', n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { key: 'right', n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { key: 'top', n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { key: 'bottom', n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
]

const SIZE = 24
const PAD = 2.2

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const polygons = computed(() => {
  const eye = norm(EYE)
  const right = norm(cross([0, 0, 1], eye)) // 屏幕向右
  const up = cross(eye, right) // 屏幕向上（SVG 的 y 向下，投影时取负）
  const project = (v) => [dot(v, right), -dot(v, up)]

  const visible = FACES.filter((f) => dot(f.n, eye) > 1e-6)
    .map((f) => ({
      ...f,
      pts: f.v.map(project),
      depth: f.v.reduce((s, v) => s + dot(v, eye), 0) / 4
    }))
    .sort((a, b) => a.depth - b.depth) // 远的先画，近的盖上去

  // 归一化只用「看得见的三个面」组成的轮廓 → 每个图标的立方体大小、位置完全一致
  const outline = visible.flatMap((f) => f.pts)
  const xs = outline.map((p) => p[0])
  const ys = outline.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  const scale = Math.min((SIZE - PAD * 2) / w, (SIZE - PAD * 2) / h)
  const ox = (SIZE - w * scale) / 2 - minX * scale
  const oy = (SIZE - h * scale) / 2 - minY * scale
  const toPath = (pts) =>
    'M' + pts.map(([x, y]) => `${(x * scale + ox).toFixed(2)} ${(y * scale + oy).toFixed(2)}`).join('L') + 'Z'

  const target = props.face === 'iso' ? null : FACES.find((f) => f.key === props.face) || null
  const targetVisible = !!target && dot(target.n, eye) > 1e-6
  const out = []

  // 看不见的目标面：先画（这样立方体的轮廓线压在它上面），虚线 + 半透明
  if (target && !targetVisible) {
    out.push({
      key: 'hidden-' + target.key,
      face: target.key,
      d: toPath(target.v.map(project)),
      fill: '#fill',
      fillOpacity: 0.42,
      dashed: true
    })
  }
  // 三个可见面：轮廓线；如果目标面就在其中，则实心涂黑
  for (const f of visible) {
    const isTarget = !!target && f.key === target.key
    out.push({
      key: f.key,
      d: toPath(f.pts),
      fill: isTarget ? '#fill' : 'none',
      fillOpacity: isTarget ? 1 : 0,
      dashed: false
    })
  }
  return out
})
</script>
