<template>
  <aside class="left-panel">
    <!-- ---------------- 浏览树 ---------------- -->
    <div class="panel-header"><i class="fa-solid fa-folder-tree" style="margin-right: 8px"></i> 浏览</div>

    <div ref="treeRef" class="project-tree">
      <!-- ============ 模型查看：零件树 ============ -->
      <template v-if="isModelMenu">
        <div class="tree-node tree-folder" @click="partsOpen = !partsOpen">
          <i class="fa-solid" :class="partsOpen ? 'fa-folder-open' : 'fa-folder'"></i>
          <span class="tree-label">模型零件</span>
          <span class="tree-count">{{ modelView.parts.length }}</span>
        </div>
        <template v-if="partsOpen">
          <div
            v-for="part in modelView.parts"
            :key="part.index"
            class="tree-node tree-indent tree-item"
            :class="{ selected: selectedPartIndex === part.index, 'is-hidden-part': !part.visible }"
            :title="part.triangleCount ? `${part.name}（${part.triangleCount} 面）` : part.name"
            @click="onPartClick(part)"
            @contextmenu.prevent.stop="openPartMenu($event, part)"
          >
            <i class="fa-solid fa-cube"></i>
            <span class="tree-label">{{ part.name }}</span>
            <span class="node-actions">
              <i
                class="fa-solid"
                :class="part.visible ? 'fa-eye' : 'fa-eye-slash'"
                :title="part.visible ? '隐藏该零件' : '显示该零件'"
                @pointerdown.stop
                @click.stop="togglePart(part)"
              ></i>
            </span>
          </div>
        </template>
        <div v-if="!modelView.parts.length" class="tree-tip">
          还没有零件<br />把模型拖到中栏，或用功能区「打开模型」
        </div>
      </template>

      <!-- ============ 计算工作台：方案树 ============ -->
      <template v-else>
        <template v-for="folder in workbench.folders" :key="folder.key">
        <!-- 文件夹行：只有点前面的文件夹图标才折叠/展开；点名字只把它设为默认落点 -->
        <div
          class="tree-node tree-folder"
          :class="{
            'drop-target': workbench.dragTarget.folderKey === folder.key && !workbench.dragTarget.nodeId,
            'is-active-folder': workbench.activeFolderKey === folder.key
          }"
          :data-folder="folder.key"
          @click="onFolderLabelClick(folder)"
          @contextmenu.prevent.stop="openFolderMenu($event, folder)"
        >
          <i
            class="fa-solid folder-toggle"
            :class="folder.expanded ? 'fa-folder-open' : 'fa-folder'"
            :title="folder.expanded ? '点击折叠' : '点击展开'"
            @click.stop="workbench.toggleFolder(folder.key)"
          ></i>
          <span
            class="tree-label"
            :title="`点名字 = 把新功能默认加到这个文件夹（当前${workbench.activeFolderKey === folder.key ? '就是它' : '不是它'}）`"
            >{{ folder.label }}</span
          >
        </div>

        <!-- 功能节点：指针拖动排序，双击改名 -->
        <template v-if="folder.expanded">
          <div
            v-for="(node, index) in folder.children"
            :key="node.id"
            class="tree-node tree-indent tree-item"
            :class="{
              selected: isActiveNode(node),
              'is-marked': isMarkedNode(node),
              dragging: draggingId === node.id,
              'drag-over-top': workbench.dragTarget.nodeId === node.id && workbench.dragTarget.pos === 'before',
              'drag-over-bottom': workbench.dragTarget.nodeId === node.id && workbench.dragTarget.pos === 'after'
            }"
            :data-node="node.id"
            :data-folder="folder.key"
            @pointerdown="onNodePointerDown($event, node)"
            @click="onNodeClick(node, $event)"
            @dblclick.stop="startRename(node)"
            @contextmenu.prevent.stop="openContextMenu($event, node)"
          >
            <i :class="node.icon"></i>
            <input
              v-if="editingId === node.id"
              :ref="setRenameInput"
              v-model="editingLabel"
              class="rename-input"
              @pointerdown.stop
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="cancelRename"
              @blur="commitRename"
            />
            <span v-else class="tree-label" :title="node.label">{{ node.label }}</span>
            <!-- 标签数量上限弹窗打开时：被勾选"要删除"的标签在这里也打勾，一一对应 -->
            <i
              v-if="workbench.tagLimit.open && isMarkedNode(node)"
              class="fa-solid fa-circle-check mark-icon"
              title="已勾选删除"
            ></i>
            <span class="node-actions">
              <i class="fa-solid fa-xmark" title="删除" @pointerdown.stop @click.stop="workbench.removeNode(node.id)"></i>
            </span>
          </div>
        </template>
        </template>
      </template>
    </div>

    <!-- ---------------- 属性面板（按要求保持为空） ---------------- -->
    <div class="panel-header" style="margin-top: auto">
      <i class="fa-solid fa-list" style="margin-right: 8px"></i> 属性面板
    </div>
    <div class="property-panel"></div>

    <!-- ---------------- 右键菜单 ---------------- -->
    <div
      v-if="ctxMenu.visible"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <div class="ctx-menu__title">{{ ctxMenu.title }}</div>
      <template v-if="ctxMenu.mode === 'part'">
        <div class="ctx-menu__item" @click="ctxIsolatePart"><i class="fa-solid fa-eye"></i> 仅显示该零件</div>
        <div class="ctx-menu__item" @click="ctxShowAllParts"><i class="fa-solid fa-eye-low-vision"></i> 显示全部零件</div>
      </template>
      <template v-else-if="ctxMenu.mode === 'node'">
        <div class="ctx-menu__item" @click="ctxRename"><i class="fa-solid fa-pen"></i> 重命名</div>
        <div class="ctx-menu__item" @click="ctxDuplicate"><i class="fa-solid fa-copy"></i> 复制节点</div>
        <div class="ctx-menu__item" @click="ctxOpen"><i class="fa-solid fa-up-right-from-square"></i> 打开计算框</div>
        <div class="ctx-menu__sep"></div>
        <div class="ctx-menu__item danger" @click="ctxDelete"><i class="fa-solid fa-trash"></i> 删除</div>
      </template>
      <template v-else>
        <div class="ctx-menu__item" @click="ctxToggleFolder">
          <i :class="ctxFolderExpanded ? 'fa-solid fa-folder-minus' : 'fa-solid fa-folder-plus'"></i>
          {{ ctxFolderExpanded ? '折叠文件夹' : '展开文件夹' }}
        </div>
        <div class="ctx-menu__item" @click="ctxCloseAll"><i class="fa-solid fa-minus"></i> 关闭所有标签</div>
        <div class="ctx-menu__sep"></div>
        <div class="ctx-menu__item danger" @click="ctxClearFolder"><i class="fa-solid fa-trash"></i> 删除所有标签</div>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { useModelViewStore } from '@/store/modules/modelView'
import { modelViewer } from '@/viewer/modelController'
import { beginPointerDrag, treeDropTarget } from '@/utils/pointerDrag'
import modal from '@/plugins/modal'

const workbench = useWorkbenchStore()
const modelView = useModelViewStore()

/** 当前是否处于模型查看菜单 */
const isModelMenu = computed(() => workbench.activeMenuKey === 'model-view')
const partsOpen = ref(true)
const selectedPartIndex = ref(-1)

function onPartClick(part) {
  selectedPartIndex.value = part.index
  modelViewer.selectPart(part.index)
  workbench.setStatus(`已选中零件：${part.name}`, 0)
}

function togglePart(part) {
  modelViewer.setPartVisible(part.index, !part.visible)
  workbench.setStatus(`${part.visible ? '已隐藏' : '已显示'}零件：${part.name}`, 0)
}

function openPartMenu(e, part) {
  ctxMenu.value = {
    visible: true,
    mode: 'part',
    x: Math.min(e.clientX, window.innerWidth - 200),
    y: Math.min(e.clientY, window.innerHeight - 90),
    nodeId: '',
    folderKey: '',
    partIndex: part.index,
    title: part.name
  }
}

function ctxIsolatePart() {
  const index = ctxMenu.value.partIndex
  closeContextMenu()
  modelViewer.isolatePart(index)
  modelView.setMessage('已只显示该零件')
}

function ctxShowAllParts() {
  closeContextMenu()
  modelViewer.showAllMeshes()
  modelView.setMessage('已显示全部零件')
}

const treeRef = ref(null)
/** 改名输入框（v-for 内用函数 ref 取到当前那一个元素） */
let renameInputEl = null
function setRenameInput(el) {
  renameInputEl = el
}
/** 指针拖动（树内排序）状态 */
const draggingId = ref('')
const suppressClick = ref(false)
const editingId = ref('')
const editingLabel = ref('')
let pointerDrag = null
/** 右键菜单：mode = node（节点） | folder（文件夹） */
const ctxMenu = ref({ visible: false, x: 0, y: 0, mode: 'node', nodeId: '', folderKey: '', partIndex: -1, title: '' })

function openContextMenu(e, node) {
  const MENU_W = 168
  const MENU_H = 156
  ctxMenu.value = {
    visible: true,
    mode: 'node',
    x: Math.min(e.clientX, window.innerWidth - MENU_W - 4),
    y: Math.min(e.clientY, window.innerHeight - MENU_H - 4),
    nodeId: node.id,
    folderKey: '',
    title: node.label
  }
}

function openFolderMenu(e, folder) {
  const MENU_W = 168
  const MENU_H = 132
  ctxMenu.value = {
    visible: true,
    mode: 'folder',
    x: Math.min(e.clientX, window.innerWidth - MENU_W - 4),
    y: Math.min(e.clientY, window.innerHeight - MENU_H - 4),
    nodeId: '',
    folderKey: folder.key,
    title: folder.label
  }
}

const ctxFolderExpanded = computed(() => {
  const folder = workbench.folders.find((f) => f.key === ctxMenu.value.folderKey)
  return !!folder?.expanded
})

function closeContextMenu() {
  ctxMenu.value.visible = false
}

function ctxRename() {
  const node = workbench.findNode(ctxMenu.value.nodeId)
  closeContextMenu()
  if (node) startRename(node)
}
function ctxDuplicate() {
  workbench.duplicateNode(ctxMenu.value.nodeId)
  closeContextMenu()
}
function ctxOpen() {
  workbench.openNode(ctxMenu.value.nodeId)
  closeContextMenu()
}
function ctxDelete() {
  workbench.removeNode(ctxMenu.value.nodeId)
  closeContextMenu()
}

// ---------------- 文件夹菜单 ----------------
function ctxToggleFolder() {
  workbench.toggleFolder(ctxMenu.value.folderKey)
  closeContextMenu()
}

function ctxCloseAll() {
  const folderKey = ctxMenu.value.folderKey
  closeContextMenu()
  workbench.closeFolder(folderKey)
}

async function ctxClearFolder() {
  const folder = workbench.folders.find((f) => f.key === ctxMenu.value.folderKey)
  closeContextMenu()
  if (!folder || !folder.children.length) return
  try {
    await modal.confirm(`确定删除「${folder.label}」里的 ${folder.children.length} 个标签吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    workbench.clearFolder(folder.key)
  } catch (e) {
    /* 取消 */
  }
}

function onGlobalPointerDown(e) {
  if (!ctxMenu.value.visible) return
  if (e.target.closest?.('.ctx-menu')) return
  closeContextMenu()
}
function onGlobalKeydown(e) {
  if (e.key === 'Escape') closeContextMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onGlobalPointerDown, true)
  document.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onGlobalPointerDown, true)
  document.removeEventListener('keydown', onGlobalKeydown)
})

function isActiveNode(node) {
  const win = workbench.windows.find((w) => w.id === workbench.activeWindowId)
  return win ? win.instanceId === node.instanceId : false
}

// ============================================================ 点击 / 改名
function onNodeClick(node, e) {
  if (suppressClick.value || editingId.value) return
  // 「标签数量上限」弹窗打开时：点目录树的标签 = 勾选/取消勾选要删除的标签（与弹窗双向同步）
  if (workbench.tagLimit.open) {
    workbench.setTagMarked(node.id)
    return
  }
  // 传入点击位置（layer 坐标系）→ 计算框从被点的节点位置"长出来"，不会突然出现
  workbench.openNode(node.id, layerOrigin(e))
}

/** 是否已在删除弹窗里被勾选（目录树高亮 + 打勾图标） */
function isMarkedNode(node) {
  return workbench.tagLimit.selectedNodeIds.includes(node.id)
}

/** 点文件夹名字：只把它设为"新功能的默认落点"，不折叠（折叠要点前面的文件夹图标） */
function onFolderLabelClick(folder) {
  workbench.setActiveFolder(folder.key)
}

/** 把事件目标（或鼠标）位置换算成 .window-layer 内的坐标 */
function layerOrigin(e) {
  const layer = document.querySelector('.window-layer')
  if (!layer) return null
  const lr = layer.getBoundingClientRect()
  const el = e?.currentTarget
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null
  const cx = r ? r.left + r.width / 2 : e?.clientX
  const cy = r ? r.top + r.height / 2 : e?.clientY
  if (cx === undefined || cy === undefined) return null
  return { x: cx - lr.left, y: cy - lr.top }
}

function startRename(node) {
  editingId.value = node.id
  editingLabel.value = node.label
  nextTick(() => {
    renameInputEl?.focus()
    renameInputEl?.select()
  })
}

function commitRename() {
  if (!editingId.value) return
  workbench.renameNode(editingId.value, editingLabel.value)
  editingId.value = ''
  editingLabel.value = ''
}

function cancelRename() {
  editingId.value = ''
  editingLabel.value = ''
}

// ============================================================ 树内指针拖动
function onNodePointerDown(e, node) {
  if (e.button !== 0 || editingId.value) return
  if (e.target.closest?.('.node-actions') || e.target.closest?.('.rename-input')) return
  beginPointerDrag(e, {
    label: node.label,
    onStart: () => {
      draggingId.value = node.id
    },
    onMove: (ev, el) => {
      const target = treeDropTarget(ev, el)
      // 不能拖到自己身上
      if (target.nodeId === node.id) {
        workbench.setDragTarget({ folderKey: target.folderKey })
        return
      }
      workbench.setDragTarget(target)
    },
    onDrop: (ev, el) => {
      // 拖拽结束必须清掉 draggingId，否则这一行会一直保持在 .dragging（opacity:.45）→ 看起来发灰
      draggingId.value = ''
      const target = treeDropTarget(ev, el)
      workbench.clearDragTarget()
      // 拖动结束后的那次 click 不要触发打开节点
      suppressClick.value = true
      setTimeout(() => (suppressClick.value = false), 60)
      if (target.nodeId && target.nodeId !== node.id) {
        const loc = workbench.nodeLocation(target.nodeId)
        if (loc) {
          const insertAt = target.pos === 'after' ? loc.index + 1 : loc.index
          workbench.moveNode(node.id, loc.folderKey, insertAt)
        }
      } else if (target.folderKey) {
        workbench.moveNode(node.id, target.folderKey, null)
      }
    },
    onCancel: () => {
      draggingId.value = ''
      workbench.clearDragTarget()
    }
  })
}
</script>
