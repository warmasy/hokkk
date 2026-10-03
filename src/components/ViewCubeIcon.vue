<template>
  <svg class="mc-cube" viewBox="0 0 24 24" width="16" height="14" aria-hidden="true">
    <path
      v-for="p in polygons"
      :key="p.key"
      :d="p.d"
      :fill="p.filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>

<script setup>
/**
 * 视角按钮的立方体图标（轴测立方体 + 「看哪一面就把哪一面涂黑」）。
 *
 * 做法：把 ±1 的立方体按给定相机方向做正交投影，只画朝向镜头的 3 个面
 * （远的先画、近的后画），其中 **正对镜头的目标面用 currentColor 实心填充**。
 * 颜色完全交给父级（功能区按钮的 --icon-color / --accent），三套主题自动跟随。
 *
 * face 取值：iso（等轴测，不涂黑）/ front / back / left / right / top / bottom
 */
import { computed } from 'vue'

const props = defineProps({
  face: { type: String, default: 'iso' }
})

/** 相机方向（从原点指向相机）：目标面正对镜头，另两个轴稍偏一点，才能看出是立方体 */
const EYES = {
  iso: [1, -1, 0.8],
  front: [0.55, -1, 0.42],
  back: [-0.55, 1, 0.42],
  left: [-1, -0.55, 0.42],
  right: [1, -0.55, 0.42],
  top: [0.55, -0.55, 1],
  bottom: [0.55, -0.55, -1]
}

/** 立方体 6 个面：外法向 + 4 个顶点（顶点按绕面一周排列） */
const FACES = [
  { key: 'front', n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { key: 'back', n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { key: 'left', n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { key: 'right', n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { key: 'top', n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { key: 'bottom', n: [0, 0, -1], v: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] }
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
  const eye = norm(EYES[props.face] || EYES.iso)
  const right = norm(cross([0, 0, 1], eye)) // 屏幕向右
  const up = cross(eye, right) // 屏幕向上（SVG 的 y 向下，投影时取负）
  const project = (v) => [dot(v, right), -dot(v, up)]

  const visible = FACES
    .filter((f) => dot(f.n, eye) > 1e-6) // 只画朝向镜头的面
    .map((f) => ({
      key: f.key,
      pts: f.v.map(project),
      depth: f.v.reduce((s, v) => s + dot(v, eye), 0) / 4
    }))
    .sort((a, b) => a.depth - b.depth) // 远的先画，近的盖上去

  const all = visible.flatMap((f) => f.pts)
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
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

  return visible.map((f) => ({ key: f.key, d: toPath(f.pts), filled: f.key === props.face }))
})
</script>
