// 实体颜色修改 Composable
// 右侧"模型显示"面板的"背景颜色"下面，常驻显示"实体颜色"选项：
//   - 未选中实体：颜色作用于所有实体（材质）
//   - 选中某个实体/组件：颜色只作用于该实体
//   - 点击"Reset to default"：实体颜色恢复初始状态
// 取色器用与背景颜色相同的 Pickr（动态加载，UI/功能一致）。

const MESH_SELECTION_TYPE = 2 // SelectionType.Mesh
// Pickr 取色器：本地文件（与 O3DV 内置同源），离线可用、弹窗与背景颜色完全一致
const PICKR_SRC = '/o3dv-site/pickr.min.js'

let colorRow = null      // 实体颜色行（ov_sidebar_parameter）
let colorHost = null     // Pickr 挂载容器
let colorInput = null    // 降级用的隐藏 color input
let pickr = null         // Pickr 实例
let selectedMaterial = null // 当前选中实体的材质（null = 作用于所有）
let initialColors = null    // 初始材质颜色快照（Map index -> {r,g,b}）
let lastSelectionKey = null
let pollTimer = null
let syncingPicker = false   // 程序同步取色器颜色中（避免触发 applyColor 覆盖高亮）
let selectedNodeId = null   // 当前选中的部件（树节点）id，null = 未选中部件
let nodeSubtreeIds = null   // 选中部件子树的所有节点 id 集合（Set）
// Ctrl 多选实体集合：meshInstanceKey（"nodeId:meshIndex"）集合
const multiSelectedKeys = new Set()
// 实体级颜色覆盖表：meshUuid -> { base: [原始 three 材质], hadSaved: bool }
// O3DV 材质按索引共享，改共享材质会波及所有实体，因此选中实体改色必须克隆材质到该实体自身。
const meshOverrides = new Map()

// 预设色（与"背景颜色"取色器完全一致，见 O3DV X_ helper 的 swatches）
const PREDEFINED_COLORS = ['#ffffffff', '#e3e3e3ff', '#c9c9c9ff', '#898989ff', '#5f5f5fff', '#494949ff', '#383838ff', '#0f0f0fff']

// ---------- 工具 ----------

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

// 取实体的材质（meshInstanceId 或 null=默认第一个）
function getMeshMaterialById(meshInstanceId) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return null
  let meshInstance = null
  try {
    meshInstance = meshInstanceId ? ws.model.GetMeshInstance(meshInstanceId) : null
  } catch (e) { meshInstance = null }
  if (!meshInstance) return null
  const mesh = meshInstance.GetMesh ? meshInstance.GetMesh() : null
  if (!mesh) return null
  const tri = mesh.GetTriangle ? mesh.GetTriangle(0) : null
  const matIndex = tri ? tri.mat : null
  if (matIndex === null || matIndex === undefined) return null
  return ws.model.GetMaterial(matIndex)
}

// 当前选中实体的材质（null = 未选中）
function getSelectedMaterial() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.navigator || !ws.navigator.selection) return null
  const sel = ws.navigator.selection
  if (sel.type !== MESH_SELECTION_TYPE || !sel.meshInstanceId) return null
  return getMeshMaterialById(sel.meshInstanceId)
}

// 应用颜色到渲染层（three 材质）——这才是模型显示真正读取的材质。
// 每个 three mesh 的 material 数组与 userData.originalMaterials（OV 材质索引）一一对应；
// 选中高亮时 userData.threeMaterials 保存原始材质数组，需一并更新（取消选中后恢复时颜色仍在）。
function applyColorToThreeMeshes(r, g, b, matIndex) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return
  const applyTo = (m) => {
    if (m && m.isMaterial && typeof m.color !== 'undefined' && typeof m.color.setRGB === 'function') {
      m.color.setRGB(r / 255, g / 255, b / 255)
      m.needsUpdate = true
    }
  }
  ws.viewer.scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return
    const orig = obj.userData ? obj.userData.originalMaterials : null
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : [])
    const saved = obj.userData && obj.userData.threeMaterials
    const savedMats = Array.isArray(saved) ? saved : (saved ? [saved] : null)
    for (let i = 0; i < mats.length; i++) {
      const slotIndex = orig ? orig[i] : i
      // 指定材质索引时只改对应槽位（未指定=改全部）
      if (matIndex !== null && matIndex !== undefined && slotIndex !== matIndex) continue
      applyTo(mats[i])
      if (savedMats && savedMats[i]) applyTo(savedMats[i])
    }
  })
}

// 取 OV 材质在模型中的索引（用于定位 three 材质槽位）
function getMaterialIndex(mat) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model || !mat) return null
  const count = ws.model.MaterialCount ? ws.model.MaterialCount() : 0
  for (let i = 0; i < count; i++) {
    if (ws.model.GetMaterial(i) === mat) return i
  }
  return null
}

// 当前选中实体的 meshInstanceKey（"nodeId:meshIndex"），未选中返回 null
function getSelectedInstanceKey() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.navigator || !ws.navigator.selection) return null
  const sel = ws.navigator.selection
  if (sel.type !== MESH_SELECTION_TYPE || !sel.meshInstanceId) return null
  const id = sel.meshInstanceId
  return id.nodeId.toString() + ':' + id.meshIndex.toString()
}

// 找到匹配选中实体的 three mesh（按 userData.originalMeshInstance.id 判断）
function findMeshesForInstanceKey(key) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return []
  const out = []
  ws.viewer.scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return
    const ud = obj.userData
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return
    const id = ud.originalMeshInstance.id
    if (id.nodeId.toString() + ':' + id.meshIndex.toString() === key) out.push(obj)
  })
  return out
}

// ---------- 部件（树节点）选择 ----------

// 收集某节点及其子孙节点的所有节点 id（Set）
function collectSubtreeNodeIds(node, set) {
  set.add(node.GetId())
  if (typeof node.GetChildNodes === 'function') {
    const children = node.GetChildNodes()
    for (const c of children) collectSubtreeNodeIds(c, set)
  }
}

// 按 id 在模型节点树中查找节点
function findNodeById(node, id) {
  if (node.GetId() === id) return node
  if (typeof node.GetChildNodes === 'function') {
    const children = node.GetChildNodes()
    for (const c of children) {
      const r = findNodeById(c, id)
      if (r) return r
    }
  }
  return null
}

// 设置选中部件：高亮该部件下所有实体
function selectNode(nodeId) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return
  const root = ws.model.GetRootNode()
  const node = findNodeById(root, nodeId)
  if (!node) return
  selectedNodeId = nodeId
  nodeSubtreeIds = new Set()
  collectSubtreeNodeIds(node, nodeSubtreeIds)
  // 高亮该部件下所有 mesh（用 O3DV 自己的高亮机制，颜色与选中实体一致）
  if (ws.viewer && typeof ws.viewer.SetMeshesHighlight === 'function' && ws.highlightColor) {
    ws.viewer.SetMeshesHighlight(ws.highlightColor, (ud) => {
      if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return false
      return nodeSubtreeIds.has(ud.originalMeshInstance.id.nodeId)
    })
  }
  // 目录树：该部件下所有 mesh 项显示选中态
  syncNodeTreeSelection()
  // 同步取色器：显示部件下第一个实体的真实颜色
  const c = getNodeRenderColor(nodeSubtreeIds)
  if (c) syncPicker(rgbToHex(c.r, c.g, c.b))
}

// 同步目录树选中样式：部件模式下，该部件子树内所有 mesh 项都显示选中态
function syncNodeTreeSelection() {
  const ws = window.o3dvWebsite
  const mp = ws && ws.navigator && ws.navigator.meshesPanel
  if (!mp || !mp.meshInstanceIdToItem || !nodeSubtreeIds) return
  mp.meshInstanceIdToItem.forEach((item, key) => {
    if (!item || typeof item.SetSelected !== 'function') return
    const selected = nodeSubtreeIds.has(parseInt(key.split(':')[0], 10))
    if (item.selected !== selected) item.SetSelected(selected)
  })
}

// 取消部件选择：恢复所有实体颜色（调用 O3DV 重新应用当前 selection 高亮）
function clearNodeSelection() {
  const ws = window.o3dvWebsite
  selectedNodeId = null
  nodeSubtreeIds = null
  // 目录树：移除所有树项选中态（O3DV 会按当前 selection 重新设置单选）
  const mp = ws && ws.navigator && ws.navigator.meshesPanel
  if (mp && mp.meshInstanceIdToItem) {
    mp.meshInstanceIdToItem.forEach((item) => {
      if (item && typeof item.SetSelected === 'function' && item.selected) item.SetSelected(false)
    })
  }
  if (ws && ws.viewer && typeof ws.viewer.SetMeshesHighlight === 'function' && ws.highlightColor) {
    // 清掉所有高亮
    ws.viewer.SetMeshesHighlight(ws.highlightColor, () => false)
    // 若当前还有 mesh 选中，重新应用它的高亮
    if (typeof ws.UpdateMeshesSelection === 'function') {
      try { ws.UpdateMeshesSelection() } catch (e) { /* ignore */ }
    }
  }
}

// 部件下第一个实体的真实渲染色
function getNodeRenderColor(nodeIdSet) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return null
  let result = null
  ws.viewer.scene.traverse((obj) => {
    if (result || !obj || !obj.isMesh) return
    const ud = obj.userData
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return
    if (nodeIdSet.has(ud.originalMeshInstance.id.nodeId)) {
      result = getMeshRealColor(obj)
    }
  })
  return result
}

// 当前是否处于"部件"选择模式（选中了树节点）
function isNodeSelected() {
  return selectedNodeId !== null
}

// ---------- Ctrl 多选 ----------

// 切换某个实体到多选集合（Ctrl+点击树中 mesh 项 或 3D 视口实体）
function toggleMultiSelect(key) {
  if (multiSelectedKeys.has(key)) multiSelectedKeys.delete(key)
  else multiSelectedKeys.add(key)
  updateMultiSelectHighlight()
  const c = getMultiSelectRenderColor()
  if (c) syncPicker(rgbToHex(c.r, c.g, c.b))
}

// 清空多选集合并取消多选高亮（普通点击实体/取消选择时调用）
function clearMultiSelect() {
  const hadMulti = multiSelectedKeys.size > 0
  multiSelectedKeys.clear()
  if (hadMulti) {
    // 还原目录树选中样式（不选中的项移除 .selected）
    const ws = window.o3dvWebsite
    const mp = ws && ws.navigator && ws.navigator.meshesPanel
    if (mp && mp.meshInstanceIdToItem) {
      mp.meshInstanceIdToItem.forEach((item) => {
        if (item && typeof item.SetSelected === 'function' && item.selected) item.SetSelected(false)
      })
    }
  }
  const ws = window.o3dvWebsite
  if (ws && ws.viewer && typeof ws.viewer.SetMeshesHighlight === 'function' && ws.highlightColor) {
    ws.viewer.SetMeshesHighlight(ws.highlightColor, () => false)
    if (typeof ws.UpdateMeshesSelection === 'function') {
      try { ws.UpdateMeshesSelection() } catch (e) { /* ignore */ }
    }
  }
}

// 同步目录树选中样式：多选/部件选择时，树中所有选中的 mesh 项都显示加粗选中态。
// O3DV 的 SetSelected 会给树项添加 .selected（背景色 + 加粗），单选时只调用一次；
// 多选需要手动为集合内每个实体项调用。
function syncTreeSelection() {
  const ws = window.o3dvWebsite
  const mp = ws && ws.navigator && ws.navigator.meshesPanel
  if (!mp || !mp.meshInstanceIdToItem) return
  mp.meshInstanceIdToItem.forEach((item, key) => {
    if (!item || typeof item.SetSelected !== 'function') return
    const selected = multiSelectedKeys.size > 0 && multiSelectedKeys.has(key)
    if (item.selected !== selected) item.SetSelected(selected)
  })
}

// 高亮多选集合内的所有实体（O3DV 高亮机制，与单选一致），并同步目录树选中样式
function updateMultiSelectHighlight() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || typeof ws.viewer.SetMeshesHighlight !== 'function' || !ws.highlightColor) return
  ws.viewer.SetMeshesHighlight(ws.highlightColor, (ud) => {
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return false
    const id = ud.originalMeshInstance.id
    return multiSelectedKeys.has(id.nodeId.toString() + ':' + id.meshIndex.toString())
  })
  syncTreeSelection()
}

// 多选集合内第一个实体的真实渲染色
function getMultiSelectRenderColor() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return null
  for (const key of multiSelectedKeys) {
    const meshes = findMeshesForInstanceKey(key)
    for (const mesh of meshes) {
      const c = getMeshRealColor(mesh)
      if (c) return c
    }
  }
  return null
}

// 多选集合内的所有 three mesh
function findMeshesForMultiSelect() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return []
  const out = []
  ws.viewer.scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return
    const ud = obj.userData
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return
    const id = ud.originalMeshInstance.id
    if (multiSelectedKeys.has(id.nodeId.toString() + ':' + id.meshIndex.toString())) out.push(obj)
  })
  return out
}

// 包装 O3DV 的 3D 视口点击：Ctrl+点击实体 → 多选/取消多选；Ctrl+点击空白 → 清空多选；
// 普通点击 → 交给 O3DV 原有逻辑（单选/取消选择）。
// 通过覆盖 SetMouseClickHandler 实现：保存原 handler，非 Ctrl 时直接调用原逻辑。
function bindViewportCtrlSelect() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || typeof ws.viewer.SetMouseClickHandler !== 'function') return
  if (ws.__meshColorViewportBound) return
  ws.__meshColorViewportBound = true

  // 跟踪 Ctrl/Meta 键状态（浏览器 click handler 拿不到原始 event，用 keydown/keyup 维护标志）
  if (!window.__meshColorCtrlTracked) {
    window.__meshColorCtrlTracked = true
    window.__meshColorCtrlDown = false
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') window.__meshColorCtrlDown = true
    })
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') window.__meshColorCtrlDown = false
    })
    window.addEventListener('blur', () => { window.__meshColorCtrlDown = false })
  }

  // O3DV 原生点击处理（OnModelClicked）：存在 viewer.navigation.onMouseClick 上
  const original = ws.viewer.navigation && ws.viewer.navigation.onMouseClick
    ? ws.viewer.navigation.onMouseClick
    : null

  ws.viewer.SetMouseClickHandler((button, pos) => {
    if (button !== 1) return // 仅左键
    if (!window.__meshColorCtrlDown) {
      // 普通点击：清空多选，走 O3DV 原有单选/取消选择逻辑
      clearMultiSelect()
      if (typeof original === 'function') original(button, pos)
      else if (typeof ws.OnModelClicked === 'function') ws.OnModelClicked(button, pos)
      return
    }
    // Ctrl 点击：命中检测（仅 mesh）
    const ud = ws.viewer.GetMeshUserDataUnderMouse(1, pos) // Is.MeshOnly = 1
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) {
      // Ctrl+点击空白：清空多选
      clearMultiSelect()
      return
    }
    const id = ud.originalMeshInstance.id
    const key = id.nodeId.toString() + ':' + id.meshIndex.toString()
    // 若处于部件选择模式，先退出
    if (isNodeSelected()) {
      selectedNodeId = null
      nodeSubtreeIds = null
    }
    toggleMultiSelect(key)
  })
}

// 绑定目录树点击：点击部件（qu 节点项）→ 选中该部件；Ctrl+点击 mesh 项 → 多选/取消多选；
// 普通点击 mesh 项 → O3DV 单选（不拦截）。
// 必须绑定到 meshes 面板的树容器（treeDiv）——页面有多个 .ov_navigator_tree_panel
// （files/materials/meshes 各一个），querySelector 会选错。用捕获阶段委托，树重建后依然有效。
function bindNodeSelection() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.navigator || !ws.navigator.meshesPanel) return
  const panel = ws.navigator.meshesPanel.treeDiv
  if (!panel || panel.__meshColorNodeBound) return
  panel.__meshColorNodeBound = true
  panel.addEventListener('click', (e) => {
    const itemEl = e.target && e.target.closest ? e.target.closest('.ov_tree_item') : null
    if (!itemEl) return
    // 按钮/箭头点击不当作选择
    if (e.target.closest('.ov_tree_item_button_container') || e.target.closest('.ov_tree_item_icon')) return
    const mp = ws.navigator.meshesPanel
    // 判断是否 mesh 项（meshInstanceIdToItem 的 mainElement 匹配）
    let meshKey = null
    if (mp.meshInstanceIdToItem) {
      mp.meshInstanceIdToItem.forEach((item, key) => {
        if (item && item.mainElement === itemEl) meshKey = key
      })
    }
    if (meshKey !== null) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+点击：多选切换；先阻止 O3DV 默认单选逻辑（在捕获阶段阻止事件继续传播）
        e.preventDefault()
        e.stopPropagation()
        // 若处于部件选择模式，先退出
        if (isNodeSelected()) {
          selectedNodeId = null
          nodeSubtreeIds = null
        }
        toggleMultiSelect(meshKey)
        return
      }
      // 普通点击 mesh 项：清空多选，交给 O3DV 单选
      clearMultiSelect()
      return
    }
    // 节点项（qu）
    let nodeId = null
    if (mp.nodeIdToItem) {
      mp.nodeIdToItem.forEach((item, id) => {
        if (item && item.mainElement === itemEl) nodeId = id
      })
    }
    if (nodeId === null) return
    // 点击部件节点：清空多选，进入部件模式
    clearMultiSelect()
    selectNode(nodeId)
  }, true)
}

// 选中实体改色：克隆该实体自己的 three 材质（不动共享材质，避免波及其它实体）
function applyColorToMeshList(meshes, r, g, b) {
  for (const mesh of meshes) {
    const ud = mesh.userData || {}
    // 原始材质：高亮中取 threeMaterials（保存的共享原材质），否则取 mesh.material
    let base = null
    if (ud.threeMaterials) {
      base = Array.isArray(ud.threeMaterials) ? ud.threeMaterials : [ud.threeMaterials]
    } else {
      base = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    }
    if (!meshOverrides.has(mesh.uuid)) {
      meshOverrides.set(mesh.uuid, { base: base.slice(), hadSaved: !!ud.threeMaterials })
    }
    // 克隆原始材质并设色（只作用于该实体）
    const clones = base.map((mat) => {
      if (!mat) return mat
      const clone = mat.clone ? mat.clone() : mat
      if (clone.color && typeof clone.color.setRGB === 'function') {
        clone.color.setRGB(r / 255, g / 255, b / 255)
        clone.needsUpdate = true
      }
      return clone
    })
    mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
    // 高亮中：让取消选中后颜色仍然保留 —— threeMaterials 指向克隆材质
    if (ud.threeMaterials) {
      ud.threeMaterials = clones
    }
  }
}

function applyColorToSelectedMesh(key, r, g, b) {
  applyColorToMeshList(findMeshesForInstanceKey(key), r, g, b)
}

// 部件（节点）子树内的所有 three mesh
function findMeshesForNodeSubtree(nodeIdSet) {
  const ws = window.o3dvWebsite
  if (!ws || !ws.viewer || !ws.viewer.scene) return []
  const out = []
  ws.viewer.scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return
    const ud = obj.userData
    if (!ud || !ud.originalMeshInstance || !ud.originalMeshInstance.id) return
    if (nodeIdSet.has(ud.originalMeshInstance.id.nodeId)) out.push(obj)
  })
  return out
}

// 应用颜色：多选实体改多选内所有实体；选中部件改部件内所有实体；选中单个实体只改该实体；未选中改所有实体
function applyColor(hex) {
  if (syncingPicker) return // 程序同步取色器时不要覆盖高亮/颜色
  const c = hexToRgb(hex)
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return
  const Engine = window.OV.Engine || window.OV
  if (!Engine || typeof Engine.RGBColor !== 'function') return

  if (multiSelectedKeys.size > 0) {
    // 多选模式：改多选集合内所有实体（克隆各自材质，不波及其它实体）
    applyColorToMeshList(findMeshesForMultiSelect(), c.r, c.g, c.b)
  } else if (isNodeSelected() && nodeSubtreeIds) {
    // 部件模式：改该部件下所有实体（克隆各自材质，不波及其它部件）
    applyColorToMeshList(findMeshesForNodeSubtree(nodeSubtreeIds), c.r, c.g, c.b)
  } else {
    const instanceKey = getSelectedInstanceKey()
    if (instanceKey) {
      // 只改当前选中实体（克隆材质到该实体，不动共享材质）
      applyColorToSelectedMesh(instanceKey, c.r, c.g, c.b)
    } else {
      // 改所有实体的材质颜色
      ws.model.EnumerateMeshes((mesh) => {
        const tri = mesh.GetTriangle ? mesh.GetTriangle(0) : null
        const matIndex = tri ? tri.mat : null
        if (matIndex === null || matIndex === undefined) return
        const mat = ws.model.GetMaterial(matIndex)
        if (mat) mat.color = new Engine.RGBColor(c.r, c.g, c.b)
      })
      applyColorToThreeMeshes(c.r, c.g, c.b, null)
    }
  }
  if (ws.viewer && typeof ws.viewer.Render === 'function') ws.viewer.Render()
}

// ---------- Pickr ----------

// 动态加载 Pickr（与背景颜色同款取色器）；失败时降级为原生 color input
function ensurePickr(cb) {
  if (window.Pickr) { cb(); return }
  const s = document.createElement('script')
  s.src = PICKR_SRC
  s.onload = () => cb()
  s.onerror = () => cb()
  document.head.appendChild(s)
}

function createPickr(defaultColor) {
  if (pickr) { pickr.destroy(); pickr = null }
  if (!window.Pickr || !colorHost) return
  try {
    pickr = Pickr.create({
      el: colorHost,
      theme: 'monolith',
      position: 'left-start',
      swatches: PREDEFINED_COLORS,
      comparison: false,
      default: defaultColor,
      components: {
        preview: false,
        opacity: true,
        hue: true,
        interaction: {
          hex: false, rgba: false, hsla: false, hsva: false, cmyk: false,
          input: true, clear: false, save: false
        }
      }
    })
    pickr.on('change', (color) => applyColor(color.toHEXA().toString()))
    pickr.on('save', (color) => applyColor(color.toHEXA().toString()))
  } catch (e) {
    pickr = null
  }
}

// 更新取色器当前颜色（程序同步，不应触发 applyColor 覆盖高亮/颜色）
function syncPicker(hex) {
  syncingPicker = true
  try {
    if (pickr && typeof pickr.setColor === 'function') {
      try { pickr.setColor(hex, true) } catch (e) { /* ignore */ }
    }
    if (colorInput) colorInput.value = hex
  } finally {
    syncingPicker = false
  }
}

// ---------- 行创建 ----------

// 找到"背景颜色"行（实体颜色行插到它后面）
function findBackgroundColorRow() {
  const params = Array.from(document.querySelectorAll('.ov_sidebar_parameter'))
  for (const p of params) {
    const t = (p.textContent || '').trim()
    if (t.includes('背景颜色') || t.includes('Background Color')) return p
  }
  return null
}

function ensureColorRow() {
  if (colorRow) return true
  const refRow = findBackgroundColorRow()
  if (!refRow) return false

  colorRow = document.createElement('div')
  colorRow.className = 'ov_sidebar_parameter mesh-color-row'

  colorHost = document.createElement('div')
  colorHost.className = 'ov_color_picker mesh-color-pickr'

  const label = document.createElement('div')
  label.textContent = '实体颜色'

  // 降级：原生取色器（Pickr 加载失败时用）；点击色块触发原生取色器
  colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;border:0;padding:0;'
  colorInput.addEventListener('input', () => applyColor(colorInput.value))
  colorHost.addEventListener('click', () => {
    if (!pickr) colorInput.click()
  })

  colorRow.appendChild(colorHost)
  colorRow.appendChild(label)
  colorRow.appendChild(colorInput)
  refRow.insertAdjacentElement('afterend', colorRow)

  // 创建 Pickr（等加载完成）
  ensurePickr(() => {
    createPickr('#ffffff')
    // 初始化同步当前颜色
    syncFromCurrentState()
  })
  return true
}

// 同步取色器颜色到当前状态（未选中=第一个材质色，选中=选中实体色）
function syncFromCurrentState() {
  const ws = window.o3dvWebsite
  if (!ws) return
  const mat = selectedMaterial || getDefaultMaterial()
  if (mat) {
    syncPicker(rgbToHex(mat.color.r, mat.color.g, mat.color.b))
  }
}

function getDefaultMaterial() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return null
  let mesh = null
  ws.model.EnumerateMeshes(m => { if (!mesh) mesh = m })
  if (!mesh) return null
  const tri = mesh.GetTriangle ? mesh.GetTriangle(0) : null
  const matIndex = tri ? tri.mat : null
  if (matIndex === null || matIndex === undefined) return null
  return ws.model.GetMaterial(matIndex)
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

// 当前选中实体的渲染色（取真实颜色，非高亮色）。
// 高亮时 mesh.material 是高亮材质（蓝），真实颜色保存在 userData.threeMaterials（原始/覆盖后的克隆材质）。
function getMeshRealColor(mesh) {
  const ud = mesh.userData || {}
  const mats = ud.threeMaterials
    ? (Array.isArray(ud.threeMaterials) ? ud.threeMaterials : [ud.threeMaterials])
    : (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
  const c = mats[0] && mats[0].color
  if (!c) return null
  return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255) }
}

// 当前选中实体/部件/多选的真实渲染色
function getSelectedRenderColor() {
  if (multiSelectedKeys.size > 0) {
    const c = getMultiSelectRenderColor()
    if (c) return c
  }
  const key = getSelectedInstanceKey()
  if (key) {
    const meshes = findMeshesForInstanceKey(key)
    for (const mesh of meshes) {
      const c = getMeshRealColor(mesh)
      if (c) return c
    }
  }
  const mat = selectedMaterial || getDefaultMaterial()
  if (mat) return { r: mat.color.r, g: mat.color.g, b: mat.color.b }
  return null
}

// ---------- 选中轮询 ----------

function pollSelection() {
  const ws = window.o3dvWebsite
  if (!ws) return
  if (!ensureColorRow()) return

  const sel = ws.navigator && ws.navigator.selection
  let key = ''
  if (sel && sel.meshInstanceId) {
    key = sel.type + ':' + sel.meshInstanceId.nodeId + '_' + sel.meshInstanceId.meshIndex
  }
  if (key !== lastSelectionKey) {
    lastSelectionKey = key
    selectedMaterial = key ? getSelectedMaterial() : null
    // 点空白/切换单个实体时，退出"部件"与"多选"模式（高亮由 O3DV 自行处理）
    if (isNodeSelected() || multiSelectedKeys.size > 0) {
      const wasNode = selectedNodeId
      selectedNodeId = null
      nodeSubtreeIds = null
      multiSelectedKeys.clear()
      // 还原目录树选中样式（O3DV 会按当前 selection 重新设置单选）
      const ws3 = window.o3dvWebsite
      const mp3 = ws3 && ws3.navigator && ws3.navigator.meshesPanel
      if (mp3 && mp3.meshInstanceIdToItem) {
        mp3.meshInstanceIdToItem.forEach((item) => {
          if (item && typeof item.SetSelected === 'function' && item.selected) item.SetSelected(false)
        })
      }
      // 若已无任何选中，清掉高亮；若选中了实体，重新应用该实体高亮
      const ws2 = window.o3dvWebsite
      if (ws2 && ws2.viewer && typeof ws2.viewer.SetMeshesHighlight === 'function' && ws2.highlightColor) {
        ws2.viewer.SetMeshesHighlight(ws2.highlightColor, () => false)
        if (typeof ws2.UpdateMeshesSelection === 'function') {
          try { ws2.UpdateMeshesSelection() } catch (e) { /* ignore */ }
        }
      }
      void wasNode
    }
    // 选中/取消后同步取色器颜色（取渲染层实际颜色）
    const c = getSelectedRenderColor()
    if (c) syncPicker(rgbToHex(c.r, c.g, c.b))
  }
}

// ---------- 对外接口 ----------

// 记录初始材质颜色快照（Reset to default 恢复用）
export function recordInitialColors() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return
  initialColors = new Map()
  ws.model.EnumerateMeshes((mesh) => {
    const tri = mesh.GetTriangle ? mesh.GetTriangle(0) : null
    const matIndex = tri ? tri.mat : null
    if (matIndex === null || matIndex === undefined) return
    if (initialColors.has(matIndex)) return
    const mat = ws.model.GetMaterial(matIndex)
    if (mat) {
      initialColors.set(matIndex, { r: mat.color.r, g: mat.color.g, b: mat.color.b })
    }
  })
}

// 恢复初始实体颜色（Reset to default 调用）
export function restoreMeshColors() {
  const ws = window.o3dvWebsite
  if (!ws || !ws.model) return
  const Engine = window.OV.Engine || window.OV

  // 1) 恢复实体级覆盖（克隆材质还原为原始材质）
  if (meshOverrides.size > 0) {
    meshOverrides.forEach((rec, uuid) => {
      let mesh = null
      if (ws.viewer && ws.viewer.scene) {
        ws.viewer.scene.traverse((o) => { if (o && o.isMesh && o.uuid === uuid && !mesh) mesh = o })
      }
      if (mesh) {
        // 还原原始材质（数组或单材质按原样）
        mesh.material = rec.base.length === 1 && !Array.isArray(mesh.material) ? rec.base[0] : rec.base.slice()
        // 清除高亮暂存，交由 UpdateMeshesSelection 依据当前选中状态重新建立
        if (mesh.userData) mesh.userData.threeMaterials = null
      }
    })
    meshOverrides.clear()
    // 重新应用高亮（如果当前仍有选中实体）
    if (typeof ws.UpdateMeshesSelection === 'function') {
      try { ws.UpdateMeshesSelection() } catch (e) { /* ignore */ }
    }
  }

  // 2) 恢复共享材质（数据层 + 渲染层）
  if (!initialColors || !Engine || typeof Engine.RGBColor !== 'function') {
    if (ws.viewer && typeof ws.viewer.Render === 'function') ws.viewer.Render()
    return
  }
  initialColors.forEach((c, matIndex) => {
    const mat = ws.model.GetMaterial(matIndex)
    if (mat) mat.color = new Engine.RGBColor(c.r, c.g, c.b)
  })
  // 恢复渲染层 three 材质颜色（按材质索引槽位逐一还原）
  if (ws.viewer && ws.viewer.scene) {
    ws.viewer.scene.traverse((obj) => {
      if (!obj || !obj.isMesh) return
      const orig = obj.userData ? obj.userData.originalMaterials : null
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : [])
      const saved = obj.userData && obj.userData.threeMaterials
      const savedMats = Array.isArray(saved) ? saved : (saved ? [saved] : null)
      for (let i = 0; i < mats.length; i++) {
        const slotIndex = orig ? orig[i] : i
        const c = initialColors.get(slotIndex)
        if (!c) continue
        // 高亮中的网格：当前 material 是高亮材质，只还原底层原始材质（savedMats），避免覆盖高亮色
        if (savedMats && savedMats[i]) {
          if (savedMats[i].color && typeof savedMats[i].color.setRGB === 'function') {
            savedMats[i].color.setRGB(c.r / 255, c.g / 255, c.b / 255)
            savedMats[i].needsUpdate = true
          }
        } else if (mats[i] && mats[i].color && typeof mats[i].color.setRGB === 'function') {
          mats[i].color.setRGB(c.r / 255, c.g / 255, c.b / 255)
          mats[i].needsUpdate = true
        }
      }
    })
  }
  if (ws.viewer && typeof ws.viewer.Render === 'function') ws.viewer.Render()
  // 同步取色器
  const mat = selectedMaterial || getDefaultMaterial()
  if (mat) syncPicker(rgbToHex(mat.color.r, mat.color.g, mat.color.b))
}

export function initMeshColor() {
  if (pollTimer) return
  ensureColorRow()
  bindNodeSelection()
  bindViewportCtrlSelect()
  pollTimer = setInterval(pollSelection, 300)
}

export function disposeMeshColor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (pickr) { pickr.destroy(); pickr = null }
  if (colorRow && colorRow.parentNode) {
    colorRow.parentNode.removeChild(colorRow)
  }
  meshOverrides.clear()
  multiSelectedKeys.clear()
  colorRow = null
  colorHost = null
  colorInput = null
  selectedMaterial = null
  lastSelectionKey = null
  syncingPicker = false
  selectedNodeId = null
  nodeSubtreeIds = null
  const ws0 = window.o3dvWebsite
  const panel0 = ws0 && ws0.navigator && ws0.navigator.meshesPanel ? ws0.navigator.meshesPanel.treeDiv : null
  if (panel0) panel0.__meshColorNodeBound = false
  // 还原视口点击处理：重新注册 O3DV 原生 handler（如果它还存在）
  if (ws0 && ws0.viewer && typeof ws0.viewer.SetMouseClickHandler === 'function' && ws0.OnModelClicked) {
    try { ws0.viewer.SetMouseClickHandler(ws0.OnModelClicked.bind(ws0)) } catch (e) { /* ignore */ }
  }
  if (ws0) ws0.__meshColorViewportBound = false
}
