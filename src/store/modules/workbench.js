import { defineStore } from 'pinia'
import { findItem, DEFAULT_ITEM_KEY } from '@/config/ribbon'
import { FOLDERS, INITIAL_NODES } from '@/config/tree'
import { buildSeries, buildFunctionPoints, functionStats } from '@/calc/plot'
import { getLocalRunner } from '@/calc'
import { executeCalc } from '@/api/calc'
import { defaultUnits, UNIT_TYPES, isValidUnit, buildUnitRows } from '@/utils/units'

/**
 * 本地存储键：
 *   mc-calc-history  只存"最近三次计算记录"（刷新页面后用来一键调出）
 * 说明：计算工作台本身**不做刷新恢复** —— 刷新后就像新打开页面一样干净，
 * 只有"计算记录"会留 3 条，点一下即可还原当时的标签与参数。
 */
const HISTORY_KEY = 'mc-calc-history'

let seq = 0
const nextId = (prefix) => `${prefix}-${++seq}`

/** 函数绘图类按钮的初始参数（含横轴范围） */
function initFunctionValues(item) {
  const values = {}
  ;(item.params || []).forEach((p) => {
    values[p.key] = p.def
  })
  values.xFrom = item.domain?.from ?? -10
  values.xTo = item.domain?.to ?? 10
  return values
}

/** 按按钮配置初始化输入值 */
function initValues(item) {
  if (item?.kind === 'function') return initFunctionValues(item)
  const values = {}
  if (item?.fields) item.fields.forEach((f) => { values[f.key] = f.def })
  return values
}

/** 计算实例：一个实例 = 一份独立的参数 + 结果（计算框 / 浏览树节点都对应一个实例） */
function createInstanceState(itemKey, nodeId = null) {
  const item = findItem(itemKey)
  const inst = {
    id: nextId('inst'),
    itemKey,
    nodeId,
    values: initValues(item),
    unitValue: 1,
    unitFrom: '',
    unitTo: '',
    results: [],
    /** 后端计算状态（mode: 'api' 时使用） */
    loading: false,
    error: '',
    reqToken: 0
  }
  if (item?.kind === 'unit') {
    const u = defaultUnits(item.unitType)
    inst.unitFrom = u.from
    inst.unitTo = u.to
  }
  return inst
}

/** 统一处理后端返回的计算结果：支持 { data: [...] } / { rows: [...] } / 直接数组 */
function normalizeRows(res) {
  const list = Array.isArray(res) ? res : res?.data || res?.rows || res?.result || []
  if (!Array.isArray(list)) return []
  return list.map((r) => ({
    label: r.label ?? r.name ?? r.title ?? '',
    value: r.value ?? r.val ?? 0,
    unit: r.unit ?? r.unitText ?? ''
  }))
}

const WINDOW_W = 700
const WINDOW_H = 344

/** 每个文件夹（计算浏览 / 计算稿）最多放多少个标签 */
export const MAX_FOLDER_TAGS = 15

/** 被"标签已满"拦下的动作，等用户删完标签后继续（不参与持久化） */
let pendingTagAction = null

/** 为了"预览"而临时打开的计算框（用户取消时还原） */
let previewOpenedWindowIds = []

/** 新窗口的级联落点：从左上角开始每次错开一点，直到找到不与已有窗口重叠的位置 */
const CASCADE_STEP_X = 26
const CASCADE_STEP_Y = 22
const CASCADE_MAX = 12

/** 两个矩形是否重叠（留一点容差，避免"擦边"也算重叠） */
function rectsOverlap(a, b, tol = 6) {
  return !(
    a.x + a.w <= b.x + tol ||
    b.x + b.w <= a.x + tol ||
    a.y + a.h <= b.y + tol ||
    b.y + b.h <= a.y + tol
  )
}

export const useWorkbenchStore = defineStore('workbench', {
  state: () => ({
    /** 默认进入数学计算功能区（首屏展示 sin 函数），但不做任何高亮 */
    activeMenuKey: 'math',
    /** 最近点击 / 拖动的功能区按钮（空 = 无高亮） */
    activeItemKey: DEFAULT_ITEM_KEY || '',
    /** 点击功能区时，新节点默认加入的文件夹 */
    activeFolderKey: FOLDERS[0].key,
    /** 浏览树文件夹： [{ ...folder, expanded, children: [{ id, label, itemKey, instanceId }] }] */
    folders: FOLDERS.map((f) => ({ ...f, expanded: true, children: [] })),
    /** 实例表：{ [id]: instance } */
    instances: {},
    /** 中间区域的计算框： [{ id, instanceId, x, y, w, h, z }] */
    windows: [],
    /**
     * 各实例上次的窗口位置/尺寸：{ [instanceId]: { x, y, w, h, fitted, maximized, restoreRect } }
     * 打开页面时**不自动打开任何计算框**（中栏留空），但之后从树里打开某个节点时沿用它的位置尺寸
     */
    windowRects: {},
    activeWindowId: null,
    zTop: 10,
    /** 状态栏 */
    statusText: '就绪',
    statusSeconds: 0,
    /** 拖拽中的落点提示（功能区按钮拖到浏览树时用） */
    dragTarget: { folderKey: '', nodeId: '', pos: '' },
    /**
     * 标签达到上限时的"选择要删除的标签"对话框
     * （每个文件夹最多 MAX_FOLDER_TAGS 个标签，超了就让用户先删）
     */
    tagLimit: {
      open: false,
      folderKey: '',
      folderLabel: '',
      incomingLabel: '',
      /** 已勾选"要删除"的标签 id：弹窗与左侧目录树双向同步用同一份数据 */
      selectedNodeIds: []
    },
    /** 最近三次计算记录（刷新后保留，点一下可调出原来的标签与参数） */
    calcHistory: []
  }),

  getters: {
    activeItem(state) {
      return findItem(state.activeItemKey)
    },
    /** 弹窗里可选的标签（= 该文件夹当前的标签列表） */
    tagLimitTags: (state) => {
      const folder = state.folders.find((f) => f.key === state.tagLimit.folderKey)
      return folder
        ? folder.children.map((c) => ({ id: c.id, label: c.label, icon: c.icon, itemKey: c.itemKey }))
        : []
    },
    /** 某个实例对应的功能区配置 */
    itemOf: () => (itemKey) => findItem(itemKey),
    /** 实例的单位换算可选单位 */
    unitOptionsOf: (state) => (instanceId) => {
      const inst = state.instances[instanceId]
      if (!inst) return []
      const item = findItem(inst.itemKey)
      if (!item || item.kind !== 'unit') return []
      return UNIT_TYPES[item.unitType]?.units || []
    },
    /** 实例的计算结果 */
    resultsOf: (state) => (instanceId) => {
      const inst = state.instances[instanceId]
      if (!inst) return []
      const item = findItem(inst.itemKey)
      if (!item) return []
      if (item.kind === 'unit') return buildUnitRows(item, inst.unitValue, inst.unitFrom)
      return inst.results
    },
    /** 实例的关系曲线 */
    seriesOf: (state) => (instanceId) => {
      const inst = state.instances[instanceId]
      if (!inst) return null
      const item = findItem(inst.itemKey)
      if (!item) return null
      if (item.kind === 'function') return buildFunctionPoints(item, inst.values)
      if (item.kind !== 'formula') return null
      return buildSeries(item, inst.values)
    },
    /** 某实例的计算框（用于判断是否已打开） */
    windowOfInstance: (state) => (instanceId) => state.windows.find((w) => w.instanceId === instanceId) || null
  },

  actions: {
    // ------------------------------------------------------------ 顶部菜单
    setActiveMenu(key) {
      this.activeMenuKey = key
    },

    // ------------------------------------------------------------ 实例与计算
    createInstance(itemKey, nodeId = null) {
      const inst = createInstanceState(itemKey, nodeId)
      this.instances[inst.id] = inst
      this.compute(inst.id)
      return inst.id
    },

    /**
     * 执行计算
     * - item.mode === 'local'   ：前端 JS（calc/ 目录）
     * - item.mode === 'api'     ：后端接口（api/calc.js 的 executeCalc，异步，带竞态保护）
     * - item.mode === 'builtin' ：单位换算（utils/units.js 的单位表）
     */
    compute(instanceId) {
      const inst = this.instances[instanceId]
      if (!inst) return
      const started = performance.now()
      const item = findItem(inst.itemKey)
      if (!item) return
      const numeric = {}
      Object.entries(inst.values).forEach(([k, v]) => { numeric[k] = Number(v) })

      // 后端计算：异步请求，不阻塞输入
      if (item.kind === 'formula' && item.mode === 'api') {
        this.computeByApi(instanceId, item, numeric)
        return
      }

      try {
        inst.error = ''
        if (item.kind === 'formula') {
          const runner = item.calc || getLocalRunner(item.key)
          inst.results = runner ? runner(numeric) || [] : []
        } else if (item.kind === 'function') {
          inst.results = functionStats(item, numeric) || []
        } else if (item.kind === 'unit') {
          inst.results = buildUnitRows(item, inst.unitValue, inst.unitFrom)
        } else {
          inst.results = []
        }
      } catch (e) {
        console.error('[compute] 计算失败', e)
        inst.results = []
        inst.error = e?.message || String(e)
        this.setStatus('计算出错：' + inst.error, 0)
        return
      }
      this.setStatus(`${item.label} 计算完成`, Math.max((performance.now() - started) / 1000, 0.001))
    },

    /** 走后端接口计算（示例实现，切换某按钮为 mode: 'api' 即生效） */
    async computeByApi(instanceId, item, values) {
      const inst = this.instances[instanceId]
      if (!inst) return
      const token = (inst.reqToken = (inst.reqToken || 0) + 1)
      inst.loading = true
      inst.error = ''
      const started = performance.now()
      try {
        const res = await executeCalc({ itemKey: item.key, values }, item.api || {})
        if (inst.reqToken !== token) return // 期间又改了参数，丢弃过期响应
        inst.results = normalizeRows(res)
        this.setStatus(`${item.label} 计算完成（后端）`, (performance.now() - started) / 1000)
      } catch (e) {
        if (inst.reqToken !== token) return
        inst.results = []
        inst.error = e?.message || '后端计算失败'
        this.setStatus(`${item.label} 后端计算失败`, 0)
      } finally {
        if (inst.reqToken === token) inst.loading = false
      }
    },

    setInstanceValue(instanceId, fieldKey, value) {
      const inst = this.instances[instanceId]
      if (!inst) return
      inst.values[fieldKey] = value
      this.compute(instanceId)
    },

    setUnitValue(instanceId, value) {
      const inst = this.instances[instanceId]
      if (!inst) return
      inst.unitValue = value
      this.compute(instanceId)
    },

    setUnitFrom(instanceId, key) {
      const inst = this.instances[instanceId]
      if (!inst) return
      inst.unitFrom = key
      this.compute(instanceId)
    },

    setUnitTo(instanceId, key) {
      const inst = this.instances[instanceId]
      if (!inst) return
      inst.unitTo = key
      this.compute(instanceId)
    },

    /** 交换源/目标单位（带反馈：同单位时给出提示，否则提示交换结果） */
    swapUnits(instanceId) {
      const inst = this.instances[instanceId]
      if (!inst) return
      if (inst.unitFrom === inst.unitTo) {
        this.setStatus('源单位与目标单位相同，交换后没有变化', 0)
        return
      }
      const from = inst.unitFrom
      const to = inst.unitTo
      inst.unitFrom = to
      inst.unitTo = from
      this.compute(instanceId)
      this.setStatus(`已交换单位：${to} → ${from}`, 0)
    },

    /** 复位到默认参数（单位换算同时复位源/目标单位与数值） */
    resetInstance(instanceId) {
      const inst = this.instances[instanceId]
      if (!inst) return
      const item = findItem(inst.itemKey)
      if (!item) return
      if (item.kind === 'unit') {
        const u = defaultUnits(item.unitType)
        inst.unitValue = 1
        inst.unitFrom = u.from
        inst.unitTo = u.to
      } else {
        // 公式计算 / 函数绘图：恢复全部默认输入（含函数的横轴范围）
        inst.values = initValues(item)
      }
      this.compute(instanceId)
      this.setStatus(`${item.label} 已复位为默认参数`, 0)
    },

    // ------------------------------------------------------------ 标签数量上限（每个文件夹最多 15 个）
    /** 文件夹是否还能再放标签 */
    folderHasRoom(folderKey) {
      const folder = this.folders.find((f) => f.key === folderKey)
      return !folder || folder.children.length < MAX_FOLDER_TAGS
    },

    /**
     * 标签已满：弹窗让用户先删掉一些标签（可多选），删完自动继续被拦下的动作
     * @param {String} folderKey 目标文件夹
     * @param {Function} action 清理完成后要继续执行的动作
     * @param {String} incomingLabel 准备添加的功能名（仅用于提示文案）
     */
    requestTagCleanup(folderKey, action, incomingLabel = '') {
      const folder = this.folders.find((f) => f.key === folderKey)
      pendingTagAction = typeof action === 'function' ? action : null
      this.tagLimit = {
        open: true,
        folderKey,
        folderLabel: folder ? folder.label : '',
        incomingLabel,
        selectedNodeIds: []
      }
      this.setStatus(`「${folder ? folder.label : ''}」最多 ${MAX_FOLDER_TAGS} 个标签，请先删除一些`, 0)
    },

    /** 某个标签是否已被勾选"要删除"（弹窗 + 左侧目录树共用） */
    isTagMarked(nodeId) {
      return this.tagLimit.selectedNodeIds.includes(nodeId)
    },

    /**
     * 勾选 / 取消勾选一个标签（弹窗里点复选框、或直接点左侧目录树的标签都会走这里）
     * @param {String} nodeId
     * @param {Boolean|undefined} checked 不传则取反
     */
    setTagMarked(nodeId, checked) {
      if (!this.findNode(nodeId)) return
      const marked = this.tagLimit.selectedNodeIds
      const isOn = checked === undefined ? !marked.includes(nodeId) : !!checked
      if (isOn) {
        if (!marked.includes(nodeId)) this.tagLimit.selectedNodeIds = [...marked, nodeId]
        // 勾选时把它的计算框提到最前（弹窗始终在最上层，所以窗口排在弹窗下面）
        this.previewTagWindow(nodeId)
      } else {
        this.tagLimit.selectedNodeIds = marked.filter((id) => id !== nodeId)
      }
    },

    /** 全选 / 取消全选（全选时只把最后一个标签的窗口提到前面，避免同时开十几个） */
    setAllTagsMarked(marked) {
      if (!marked) {
        this.tagLimit.selectedNodeIds = []
        return
      }
      const tags = this.tagLimitTags
      this.tagLimit.selectedNodeIds = tags.map((t) => t.id)
      const last = tags[tags.length - 1]
      if (last) this.previewTagWindow(last.id)
    },

    /**
     * 弹窗里勾选某个标签时调用：把它的计算框提到最前（弹窗仍在最上层，所以窗口就排在弹窗下面）；
     * 该标签的计算框还没打开时会先打开它，方便看清要删的是哪一个
     */
    previewTagWindow(nodeId) {
      const node = this.findNode(nodeId)
      if (!node) return null
      const win = this.windows.find((w) => w.instanceId === node.instanceId)
      if (win) {
        this.focusWindow(win.id)
        win.flashAt = Date.now()
        return win.id
      }
      const opened = this.openNode(nodeId)
      if (opened) previewOpenedWindowIds.push(opened)
      return opened
    },

    /** 关掉"为了预览才打开"的计算框（用户取消删除时还原原状） */
    closePreviewWindows() {
      previewOpenedWindowIds.forEach((id) => {
        if (this.windows.some((w) => w.id === id)) this.closeWindow(id)
      })
      previewOpenedWindowIds = []
    },

    /** 取消删除，放弃这次添加 */
    cancelTagCleanup() {
      pendingTagAction = null
      this.closePreviewWindows()
      this.tagLimit = { open: false, folderKey: '', folderLabel: '', incomingLabel: '', selectedNodeIds: [] }
      this.setStatus('已取消添加', 0)
    },

    /** 确认删除选中的标签（可多选），随后继续被拦下的添加动作 */
    confirmTagCleanup(nodeIds = []) {
      const ids = [...nodeIds].filter((id) => this.findNode(id))
      ids.forEach((id) => this.removeNode(id))
      const action = pendingTagAction
      pendingTagAction = null
      previewOpenedWindowIds = []
      this.tagLimit = { open: false, folderKey: '', folderLabel: '', incomingLabel: '', selectedNodeIds: [] }
      if (action) action()
      return ids.length
    },

    // ------------------------------------------------------------ 计算框（窗口）
    /**
     * 打开计算框
     * - 从功能区点击 / AI 助手调用：自动把功能加入「浏览」树的当前文件夹，再打开它的计算框
     * - 传 nodeId：直接打开该树节点对应的计算框（不新建节点）
     */
    openWindow(itemKey, options = {}) {
      const item = findItem(itemKey)
      if (!item) return null
      this.activeItemKey = itemKey

      let instanceId = null
      if (options.nodeId) {
        const node = this.findNode(options.nodeId)
        if (node) instanceId = node.instanceId
      }
      if (!instanceId) {
        const folderKey = options.folderKey || this.activeFolderKey
        // 该文件夹标签已满 → 先让用户删掉一些
        if (!this.folderHasRoom(folderKey)) {
          this.requestTagCleanup(folderKey, () => this.openWindow(itemKey, options), item.label)
          return null
        }
        const nodeId = this.dropItem(folderKey, itemKey, null, 'click')
        instanceId = this.findNode(nodeId)?.instanceId || this.createInstance(itemKey)
      }

      if (options.patch) {
        const inst = this.instances[instanceId]
        if (inst) {
          Object.assign(inst.values, options.patch)
          this.compute(instanceId)
        }
      }
      const win = this.createWindow(instanceId, options.origin)
      return { instanceId, windowId: win.id }
    },

    /**
     * 新建计算框
     * @param {String} instanceId
     * @param {{x:Number,y:Number}|null} origin 打开来源在 .window-layer 里的坐标
     *        （功能区按钮 / 引导卡片的位置）：窗口入场动画从它"长出来"，就不再突兀
     */
    createWindow(instanceId, origin = null) {
      const inst = this.instances[instanceId]
      const item = inst ? findItem(inst.itemKey) : null
      const isUnit = item?.kind === 'unit'
      const w0 = isUnit ? 520 : WINDOW_W
      const h0 = isUnit ? 200 : WINDOW_H
      // 该标签所在文件夹决定"打开时是否默认最大化"：
      // 计算浏览（复杂计算）默认最大化；计算稿（辅助/实时计算）默认小窗口
      const owner = inst && inst.nodeId ? this.folderOfNode(inst.nodeId) : null
      const maxOnOpen = owner ? owner.defaultMaximize !== false : true
      const pinOnOpen = owner ? owner.defaultPinned === true : false
      // 上次这个节点的窗口位置/尺寸（本次启动不自动打开窗口，但打开时要还原它）
      const saved = instanceId ? this.windowRects[instanceId] : null
      let x = saved ? saved.x : 24
      let y = saved ? saved.y : 18
      const w = saved ? saved.w : w0
      const h = saved ? saved.h : h0
      if (!saved) {
        // 级联落点：找第一个不与已打开窗口重叠的位置
        for (let i = 0; i < CASCADE_MAX; i++) {
          const cx = 24 + i * CASCADE_STEP_X
          const cy = 18 + i * CASCADE_STEP_Y
          const overlaps = this.windows.some((o) => rectsOverlap({ x: cx, y: cy, w, h }, o))
          if (!overlaps) {
            x = cx
            y = cy
            break
          }
          x = cx
          y = cy
        }
      }
      const win = {
        id: nextId('win'),
        instanceId,
        x,
        y,
        w,
        h,
        z: ++this.zTop,
        fitted: saved ? saved.fitted : true,
        maximized: saved ? !!saved.maximized : false,
        restoreRect: saved ? saved.restoreRect || null : null,
        /** 固定在最上层（一直显示、可实时操作）；由标题栏图钉按钮切换，按文件夹默认值初始化 */
        pinned: saved ? !!saved.pinned : pinOnOpen,
        /** 新开窗口按所在文件夹的默认策略决定是否最大化（由 CalcWindow 挂载时执行，它才知道中栏实际尺寸） */
        pendingMaximize: saved ? false : maxOnOpen,
        /** 入场动画起点（layer 坐标系），仅本次挂载用 */
        origin: origin && typeof origin === 'object' ? { x: Number(origin.x) || 0, y: Number(origin.y) || 0 } : null
      }
      this.windows.push(win)
      this.activeWindowId = win.id
      return win
    },

    /** 标记"默认最大化"已执行（避免窗口重建时重复最大化） */
    clearPendingMaximize(windowId) {
      const win = this.windows.find((w) => w.id === windowId)
      if (win) win.pendingMaximize = false
    },

    /**
     * 固定 / 取消固定到最上层
     * 固定后这个窗口永远显示在其它计算框之上（可正常拖动、缩放、改参数），
     * 适合"计算稿"里放一个辅助计算窗，一边看一边在"计算浏览"里做复杂计算。
     * 若当前是最大化状态，先还原成小窗口再固定（否则铺满中栏就失去意义）。
     */
    togglePin(windowId) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return false
      win.pinned = !win.pinned
      if (win.pinned) {
        if (win.maximized) {
          const back = win.restoreRect || {}
          win.x = Number.isFinite(back.x) ? back.x : win.x
          win.y = Number.isFinite(back.y) ? back.y : win.y
          win.w = Number.isFinite(back.w) ? back.w : win.w
          win.h = Number.isFinite(back.h) ? back.h : win.h
          win.maximized = false
          win.restoreRect = null
        }
        win.z = ++this.zTop
        this.activeWindowId = win.id
        this.setStatus('已固定在最上层（一直显示，可实时操作）', 2600)
      } else {
        this.setStatus('已取消固定', 2000)
      }
      // 固定状态记进"上次位置"，关掉再打开时保持
      if (win.instanceId) {
        const prev = this.windowRects[win.instanceId] || {}
        this.windowRects[win.instanceId] = {
          x: win.x,
          y: win.y,
          w: win.w,
          h: win.h,
          fitted: win.fitted !== false,
          maximized: !!win.maximized,
          pinned: !!win.pinned,
          restoreRect: win.restoreRect || null,
          ...prev,
          pinned: !!win.pinned
        }
      }
      return win.pinned
    },

    focusWindow(windowId) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return
      win.z = ++this.zTop
      this.activeWindowId = windowId
      const inst = this.instances[win.instanceId]
      if (inst) this.activeItemKey = inst.itemKey
    },

    moveWindow(windowId, x, y) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return
      win.x = x
      win.y = y
    },

    /**
     * 调整计算框尺寸
     * @param {Boolean} byUser 是否用户手动拖动（手动调整后不再按内容自动适配）
     */
    resizeWindow(windowId, w, h, byUser = true) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return
      win.w = w
      win.h = h
      if (byUser) win.fitted = false
    },

    /**
     * 最大化 / 还原（像 Windows 窗口一样，可来回切换）
     * @param {Object} rect 最大化时使用的区域 { x, y, w, h }，由组件按中栏实际尺寸传入
     */
    toggleMaximize(windowId, rect = {}) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return false
      if (win.maximized) {
        const back = win.restoreRect || {}
        win.x = Number.isFinite(back.x) ? back.x : win.x
        win.y = Number.isFinite(back.y) ? back.y : win.y
        win.w = Number.isFinite(back.w) ? back.w : win.w
        win.h = Number.isFinite(back.h) ? back.h : win.h
        win.maximized = false
        win.restoreRect = null
      } else {
        win.restoreRect = { x: win.x, y: win.y, w: win.w, h: win.h }
        win.x = rect.x ?? 0
        win.y = rect.y ?? 0
        if (rect.w) win.w = rect.w
        if (rect.h) win.h = rect.h
        win.maximized = true
        win.fitted = false
      }
      this.focusWindow(windowId)
      this.setStatus(win.maximized ? '窗口已最大化' : '窗口已还原', 0)
      return win.maximized
    },

    /** 最小化：窗口收起，标签保留在浏览树里（点节点可再次打开） */
    minimizeWindow(windowId) {
      const win = this.windows.find((w) => w.id === windowId)
      this.closeWindow(windowId)
      if (win) this.setStatus('窗口已最小化到左侧浏览树', 0)
    },

    /** 关闭并从浏览树里一并删除对应标签 */
    closeAndRemove(windowId) {
      const win = this.windows.find((w) => w.id === windowId)
      if (!win) return
      const node = this.findNodeByInstance(win.instanceId)
      if (node) {
        this.removeNode(node.id)
        return
      }
      this.closeWindow(windowId)
    },

    closeWindow(windowId) {
      const idx = this.windows.findIndex((w) => w.id === windowId)
      if (idx < 0) return
      const win = this.windows[idx]
      const inst = this.instances[win.instanceId]
      this.windows.splice(idx, 1)
      // 临时实例（未保存到浏览树）随窗口一起销毁
      if (inst && !inst.nodeId) delete this.instances[inst.id]
      if (this.activeWindowId === windowId) {
        const last = this.windows[this.windows.length - 1]
        this.activeWindowId = last ? last.id : null
        if (last) this.focusWindow(last.id)
      }
      this.setStatus('已关闭计算框', 0)
    },

    closeAllWindows() {
      [...this.windows].forEach((w) => this.closeWindow(w.id))
    },

    // ------------------------------------------------------------ 浏览树（拖放）
    /** 求某个节点的父文件夹 */
    folderOfNode(nodeId) {
      return this.folders.find((f) => f.children.some((c) => c.id === nodeId)) || null
    },

    findNode(nodeId) {
      for (const f of this.folders) {
        const node = f.children.find((c) => c.id === nodeId)
        if (node) return node
      }
      return null
    },

    findNodeByInstance(instanceId) {
      for (const f of this.folders) {
        const node = f.children.find((c) => c.instanceId === instanceId)
        if (node) return node
      }
      return null
    },

    toggleFolder(folderKey) {
      const folder = this.folders.find((f) => f.key === folderKey)
      if (!folder) return
      folder.expanded = !folder.expanded
      // 点文件夹图标时也把它设为“新功能的默认落点”
      this.activeFolderKey = folderKey
    },

    /** 只把某个文件夹设为“新功能的默认落点”（点文件夹名字时用，不动折叠状态） */
    setActiveFolder(folderKey) {
      const folder = this.folders.find((f) => f.key === folderKey)
      if (!folder) return
      const changed = this.activeFolderKey !== folder.key
      this.activeFolderKey = folder.key
      if (changed) this.setStatus(`「${folder.label}」已设为新功能的默认落点`, 2600)
    },

    /** 把功能区按钮加入文件夹：生成节点 + 实例（mode: click 点击自动加入 / drag 拖入） */
    dropItem(folderKey, itemKey, index = null, mode = 'drag', bypassTagLimit = false) {
      const folder = this.folders.find((f) => f.key === folderKey) || this.folders[0]
      const item = findItem(itemKey)
      if (!folder || !item) return null
      // 标签已满 → 先删再继续（拖拽等路径也走同一个弹窗）
      if (!bypassTagLimit && folder.children.length >= MAX_FOLDER_TAGS) {
        this.requestTagCleanup(folder.key, () => this.dropItem(folder.key, itemKey, index, mode, true), item.label)
        return null
      }
      this.activeFolderKey = folder.key
      const instanceId = this.createInstance(itemKey)
      // 同名节点自动加序号
      const sameName = folder.children.filter((c) => c.label === item.label || c.label.startsWith(item.label + ' ')).length
      const node = {
        id: nextId('node'),
        label: sameName ? `${item.label} ${sameName + 1}` : item.label,
        icon: item.icon,
        itemKey,
        instanceId
      }
      this.instances[instanceId].nodeId = node.id
      const at = index === null || index === undefined ? folder.children.length : Math.max(0, Math.min(index, folder.children.length))
      folder.children.splice(at, 0, node)
      folder.expanded = true
      this.setStatus(mode === 'click' ? `已添加到「${folder.label}」：${node.label}` : `已拖入「${node.label}」到 ${folder.label}`, 0)
      return node.id
    },

    /** 树内拖动：跨文件夹移动或同文件夹排序 */
    moveNode(nodeId, targetFolderKey, targetIndex = null) {
      const target = this.folders.find((f) => f.key === targetFolderKey)
      const node = this.findNode(nodeId)
      if (!target || !node) return
      const source = this.folderOfNode(nodeId)
      // 跨文件夹移动也要受"最多 15 个"限制：满了先删再继续
      if (source !== target && target.children.length >= MAX_FOLDER_TAGS) {
        this.requestTagCleanup(target.key, () => this.moveNode(nodeId, targetFolderKey, targetIndex), node.label)
        return
      }
      let index = targetIndex === null || targetIndex === undefined ? target.children.length : targetIndex
      if (source === target) {
        const from = source.children.indexOf(node)
        if (from < index) index -= 1
        if (from === index) return
        source.children.splice(from, 1)
      } else {
        source.children.splice(source.children.indexOf(node), 1)
      }
      index = Math.max(0, Math.min(index, target.children.length))
      target.children.splice(index, 0, node)
      // 跨文件夹移动时，窗口的"固定在最上层 / 最大化"都跟随目标文件夹的默认值：
      //   计算稿   = 不最大化 + 固定在最上层（辅助实时计算）
      //   计算浏览 = 最大化 + 不固定（做复杂计算）
      const synced = source !== target ? this.syncWindowWithFolder(node.instanceId, target) : null
      this.setStatus(
        `「${node.label}」已移动到 ${target.label}` + (synced ? `（${synced}）` : ''),
        0
      )
    },

    /**
     * 让某个实例的计算框跟随所在文件夹的默认形态
     * @returns {String|null} 调整说明（用于状态栏）；没有打开的窗口时返回 null
     */
    syncWindowWithFolder(instanceId, folder) {
      if (!instanceId || !folder) return null
      const shouldPin = folder.defaultPinned === true
      const shouldMax = folder.defaultMaximize === true
      // 记进"上次位置"，这样关掉再打开也按新文件夹的默认值
      const rect = this.windowRects[instanceId]
      if (rect) rect.pinned = shouldPin
      const win = this.windows.find((w) => w.instanceId === instanceId)
      if (!win) return null
      const notes = []
      if (win.pinned !== shouldPin) {
        win.pinned = shouldPin
        if (shouldPin) {
          win.z = ++this.zTop // 固定后提到最前
          this.activeWindowId = win.id
        }
        notes.push(shouldPin ? '已固定在最上层' : '已取消固定')
      }
      if (shouldMax && !win.maximized) {
        // 实际最大化需要中栏尺寸，交给 CalcWindow 执行（它挂载/监听这个标记）
        win.pendingMaximize = true
        notes.push('已最大化')
      } else if (!shouldMax && win.maximized) {
        const back = win.restoreRect || {}
        win.x = Number.isFinite(back.x) ? back.x : win.x
        win.y = Number.isFinite(back.y) ? back.y : win.y
        win.w = Number.isFinite(back.w) ? back.w : win.w
        win.h = Number.isFinite(back.h) ? back.h : win.h
        win.maximized = false
        win.restoreRect = null
        notes.push('已还原成小窗口')
      }
      return notes.length ? notes.join('、') : null
    },

    /** 复制节点：同文件夹、原节点之后生成一份独立参数的副本 */
    duplicateNode(nodeId) {
      const source = this.findNode(nodeId)
      const folder = source ? this.folderOfNode(nodeId) : null
      if (!source || !folder) return null
      // 标签已满 → 先让用户删掉一些再复制
      if (folder.children.length >= MAX_FOLDER_TAGS) {
        this.requestTagCleanup(folder.key, () => this.duplicateNode(nodeId), `${source.label} 副本`)
        return null
      }
      const srcInst = this.instances[source.instanceId]
      const newItemKey = source.itemKey
      const item = findItem(newItemKey)
      const instanceId = this.createInstance(newItemKey)
      // 复制源节点的参数
      if (srcInst) {
        const inst = this.instances[instanceId]
        inst.values = JSON.parse(JSON.stringify(srcInst.values || {}))
        inst.unitValue = srcInst.unitValue
        inst.unitFrom = srcInst.unitFrom
        inst.unitTo = srcInst.unitTo
        this.compute(instanceId)
      }
      const node = {
        id: nextId('node'),
        label: `${source.label} 副本`,
        icon: item?.icon || source.icon,
        itemKey: newItemKey,
        instanceId
      }
      this.instances[instanceId].nodeId = node.id
      const at = folder.children.indexOf(source) + 1
      folder.children.splice(at, 0, node)
      folder.expanded = true
      this.setStatus(`已复制「${source.label}」`, 0)
      return node.id
    },

    /** 重命名节点（双击浏览树节点） */
    renameNode(nodeId, label) {
      const node = this.findNode(nodeId)
      if (!node) return
      const name = String(label ?? '').trim()
      if (!name || name === node.label) return
      node.label = name
      this.setStatus(`已重命名为「${name}」`, 0)
    },

    /** 删除节点：连同其计算框与实例一起清理 */
    removeNode(nodeId) {
      const node = this.findNode(nodeId)
      if (!node) return
      const source = this.folderOfNode(nodeId)
      const win = this.windows.find((w) => w.instanceId === node.instanceId)
      if (win) this.closeWindow(win.id)
      delete this.instances[node.instanceId]
      source.children.splice(source.children.indexOf(node), 1)
      // 同步清掉"待删除勾选"里的这一项（弹窗与目录树共用这份数据）
      if (this.tagLimit.selectedNodeIds.includes(nodeId)) {
        this.tagLimit.selectedNodeIds = this.tagLimit.selectedNodeIds.filter((id) => id !== nodeId)
      }
      this.setStatus(`已删除「${node.label}」`, 0)
    },

    /** 关闭文件夹里所有标签的计算框（标签保留，可再次打开） */
    closeFolder(folderKey) {
      const folder = this.folders.find((f) => f.key === folderKey)
      if (!folder || !folder.children.length) return 0
      const ids = folder.children.map((c) => c.instanceId)
      const wins = this.windows.filter((w) => ids.includes(w.instanceId))
      wins.forEach((w) => this.closeWindow(w.id))
      this.setStatus(`已关闭 ${folder.label} 里的 ${wins.length} 个计算框`, 0)
      return wins.length
    },

    /** 删除文件夹里的所有标签（右键文件夹 -> 删除所有标签） */
    clearFolder(folderKey) {
      const folder = this.folders.find((f) => f.key === folderKey)
      if (!folder || !folder.children.length) return 0
      const count = folder.children.length
      const ids = folder.children.map((c) => c.id)
      ids.forEach((id) => this.removeNode(id))
      this.setStatus(`已删除 ${folder.label} 里的 ${count} 个标签`, 0)
      return count
    },

    /** 点击树节点：打开（或前置）它对应的计算框 */
    openNode(nodeId, origin = null) {
      const node = this.findNode(nodeId)
      if (!node) return
      // 打开某个标签时，把它所在的文件夹设为“新功能的默认落点”，
      // 这样目录树里高亮的文件夹（蓝色名字）始终跟你当前操作的文件夹一致，不会让人误会
      const owner = this.folderOfNode(nodeId)
      if (owner) this.activeFolderKey = owner.key
      if (!this.instances[node.instanceId]) {
        // 实例丢失时自愈
        node.instanceId = this.createInstance(node.itemKey, node.id)
      }
      const exist = this.windows.find((w) => w.instanceId === node.instanceId)
      if (exist) {
        this.focusWindow(exist.id)
        // 从目录树点标签时让对应窗口闪一下，方便在多个窗口里一眼找到它
        exist.flashAt = Date.now()
        this.setStatus(`「${node.label}」计算框已前置`, 0)
        return exist.id
      }
      const win = this.createWindow(node.instanceId, origin)
      this.setStatus(`已打开「${node.label}」`, 0)
      return win.id
    },

    /** 初始化默认浏览树节点（默认是空的；打开页面时树里不放任何标签） */
    initTree() {
      if (this.folders.some((f) => f.children.length)) return null
      let firstNodeId = null
      INITIAL_NODES.forEach((n) => {
        const nodeId = this.dropItem(n.folderKey, n.itemKey)
        const node = this.findNode(nodeId)
        if (node) node.label = n.label
        if (!firstNodeId) firstNodeId = nodeId
      })
      // 默认节点不影响“新功能默认落点”，仍为第一个文件夹
      this.activeFolderKey = this.folders[0].key
      this.statusText = '就绪'
      return firstNodeId
    },

    setStatus(text, seconds = 0) {
      this.statusText = text
      this.statusSeconds = Number(Number(seconds).toFixed(3))
    },

    // ------------------------------------------------------------ 拖拽落点
    setDragTarget(target = {}) {
      this.dragTarget = { folderKey: '', nodeId: '', pos: '', ...target }
    },
    clearDragTarget() {
      this.dragTarget = { folderKey: '', nodeId: '', pos: '' }
    },

    /** 求节点在树里的位置：{ folderKey, index } */
    nodeLocation(nodeId) {
      for (const folder of this.folders) {
        const index = folder.children.findIndex((c) => c.id === nodeId)
        if (index >= 0) return { folderKey: folder.key, index }
      }
      return null
    },

    /** 把功能区按钮拖到某个节点前/后（插入到指定位置） */
    dropItemAtNode(itemKey, nodeId, pos = 'after') {
      const loc = this.nodeLocation(nodeId)
      if (!loc) return null
      const insertAt = pos === 'after' ? loc.index + 1 : loc.index
      return this.dropItem(loc.folderKey, itemKey, insertAt)
    },

    // ------------------------------------------------------------ 本地持久化（刷新不丢）
    /** 把整棵树、各节点参数、各计算框位置写入 localStorage */
    // ------------------------------------------------------------ 计算记录（最近三次）
    /**
     * 把"当前打开的计算框 + 它们的参数"做成一条记录
     * 记录内容：每个标签的文件夹 / 功能 / 名称 / 参数（公式参数、单位换算设置）
     */
    snapshotForHistory() {
      const nodes = this.windows
        .slice()
        .sort((a, b) => (a.z || 0) - (b.z || 0))
        .map((w) => {
          const inst = this.instances[w.instanceId]
          if (!inst) return null
          const node = inst.nodeId ? this.findNode(inst.nodeId) : null
          const folder = inst.nodeId ? this.folderOfNode(inst.nodeId) : null
          return {
            folderKey: folder ? folder.key : this.activeFolderKey,
            itemKey: inst.itemKey,
            label: node ? node.label : findItem(inst.itemKey)?.label || '',
            values: JSON.parse(JSON.stringify(inst.values || {})),
            unitValue: inst.unitValue,
            unitFrom: inst.unitFrom,
            unitTo: inst.unitTo
          }
        })
        .filter(Boolean)
      if (!nodes.length) return null
      return { at: Date.now(), nodes }
    },

    /**
     * 写入计算记录（最多留最近 3 条，最新的在最前）
     *
     * 判定规则（这样可以稳定地记录"最近三次计算"，又不会因为改参数刷出一堆重复）：
     *   - 与最新一条**是同一批计算**（标签集合、所属文件夹、名称都一样）→ 只**原地刷新参数**，不新增记录；
     *   - 换了一批计算（新开了别的功能 / 关掉又开了别的）→ **新增一条记录**；
     *   - 内容完全没变 → 什么都不写。
     */
    saveHistory() {
      const snap = this.snapshotForHistory()
      if (!snap) return false // 一个计算框都没开：不记录（保留上一条有效记录）
      const list = this.calcHistory.slice()
      const shape = (e) => JSON.stringify(e.nodes.map((n) => [n.itemKey, n.folderKey, n.label]))
      const detail = (e) =>
        JSON.stringify(e.nodes.map((n) => [n.itemKey, n.label, n.values, n.unitValue, n.unitFrom, n.unitTo]))
      const now = Date.now()
      const latest = list[0]
      if (latest && shape(latest) === shape(snap)) {
        if (detail(latest) === detail(snap)) return false // 参数也没变 → 不用写
        list[0] = { ...snap, at: latest.at || snap.at, updatedAt: now }
      } else {
        list.unshift({ ...snap, updatedAt: now })
      }
      this.calcHistory = list.slice(0, 3)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(this.calcHistory))
      } catch (e) {
        console.warn('[workbench] 保存计算记录失败', e)
      }
      return true
    },

    /** 读取本地保存的计算记录（最近三次） */
    loadHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY)
        const list = raw ? JSON.parse(raw) : []
        this.calcHistory = Array.isArray(list) ? list.filter((x) => x && Array.isArray(x.nodes)).slice(0, 3) : []
      } catch (e) {
        this.calcHistory = []
      }
      return this.calcHistory
    },

    /** 清空计算记录 */
    clearHistory() {
      this.calcHistory = []
      try {
        localStorage.removeItem(HISTORY_KEY)
      } catch (e) {
        /* 忽略 */
      }
    },

    /**
     * 打开一条计算记录：按记录里的文件夹/功能重建标签与实例（参数一并还原），并打开它们的计算框
     * @returns {Number} 打开的计算框数量
     */
    restoreHistory(entry) {
      if (!entry || !Array.isArray(entry.nodes)) return 0
      let opened = 0
      entry.nodes.forEach((n) => {
        const item = findItem(n.itemKey)
        if (!item) return
        const folder = this.folders.find((f) => f.key === n.folderKey) || this.folders[0]
        if (!folder) return
        const nodeId = this.dropItem(folder.key, n.itemKey)
        const node = this.findNode(nodeId)
        if (!node) return
        if (n.label) node.label = n.label
        const inst = this.instances[node.instanceId]
        if (inst) {
          if (n.values && typeof n.values === 'object') inst.values = { ...inst.values, ...n.values }
          if (item.kind === 'unit') {
            if (n.unitValue !== undefined) inst.unitValue = n.unitValue
            if (isValidUnit(item.unitType, n.unitFrom)) inst.unitFrom = n.unitFrom
            if (isValidUnit(item.unitType, n.unitTo)) inst.unitTo = n.unitTo
          }
          this.compute(inst.id)
        }
        this.openNode(node.id)
        opened++
      })
      if (opened) this.setStatus(`已调出计算记录（${opened} 个标签）`, 2600)
      return opened
    }
  }
})
