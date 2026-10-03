<template>
  <!-- 标签数量达到上限：让用户先选要删掉的标签（可多选），删完自动继续刚才的添加 -->
  <!-- 标签数量达到上限：让用户先选要删掉的标签（可多选），删完自动继续刚才的添加。
       注意：遮罩**不拦截鼠标**（pointer-events:none）—— 弹窗打开时左侧目录树照样能操作，
       只是弹窗始终盖在最上层（z-index 比计算框/面板都高） -->
  <div v-if="workbench.tagLimit.open" class="tag-limit-mask">
    <div class="tag-limit" @keydown.esc="workbench.cancelTagCleanup()">
      <div class="tag-limit__head">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>标签数量已达上限</span>
        <span class="tag-limit__spacer"></span>
        <button class="tag-limit__btn close" title="取消" @click="workbench.cancelTagCleanup()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="tag-limit__body">
        <p class="tag-limit__text">
          每个文件夹最多 <b>{{ maxTags }}</b> 个标签，「{{ workbench.tagLimit.folderLabel }}」现在已经有
          <b>{{ tags.length }}</b> 个。请选择要删除的标签（<b>可多选</b>），删除后会自动继续<template
            v-if="workbench.tagLimit.incomingLabel"
          >添加「{{ workbench.tagLimit.incomingLabel }}」</template><template v-else>刚才的操作</template>。
          <span class="tag-limit__tip">也可以直接在左侧目录树里删（这里会同步勾选项消失）。</span>
        </p>

        <label class="tag-limit__all">
          <input type="checkbox" :checked="allSelected" @change="toggleAll($event)" />
          <span>全选（已选 {{ selected.length }} / {{ tags.length }}）</span>
        </label>

        <div class="tag-limit__list">
          <label
            v-for="tag in tags"
            :key="tag.id"
            class="tag-limit__item"
            :class="{ 'is-selected': selected.includes(tag.id) }"
          >
            <input type="checkbox" :checked="selected.includes(tag.id)" @change="toggleTag(tag, $event.target.checked)" />
            <i :class="tag.icon"></i>
            <span class="tag-limit__name">{{ tag.label }}</span>
          </label>
        </div>
      </div>

      <div class="tag-limit__foot">
        <span class="tag-limit__hint">删除标签会同时关闭它的计算框</span>
        <button @click="workbench.cancelTagCleanup()">取消</button>
        <button class="primary" :disabled="confirmDisabled" @click="confirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWorkbenchStore, MAX_FOLDER_TAGS } from '@/store/modules/workbench'

const workbench = useWorkbenchStore()
const maxTags = MAX_FOLDER_TAGS

const selected = computed(() => workbench.tagLimit.selectedNodeIds)
const tags = computed(() => workbench.tagLimitTags)
const allSelected = computed(() => tags.value.length > 0 && selected.value.length === tags.value.length)
/** 左侧目录树里删过之后可能已经腾出位置了：这时不用再勾选也能直接继续 */
const hasRoom = computed(() => tags.value.length < maxTags)
const confirmDisabled = computed(() => !selected.value.length && !hasRoom.value)
const confirmText = computed(() => {
  if (selected.value.length) return `删除所选（${selected.value.length}）并继续`
  return hasRoom.value ? '继续添加' : '删除所选并继续'
})

/** 每次打开弹窗都清空选择 */
watch(
  () => workbench.tagLimit.open,
  (open) => {
    if (open) workbench.tagLimit.selectedNodeIds = []
  }
)

function toggleAll(e) {
  workbench.setAllTagsMarked(e.target.checked)
}

/**
 * 勾选 / 取消勾选单个标签：
 * 勾选时把它的计算框提到最前（弹窗始终在最上层，所以窗口就排在弹窗下面 / 即"倒数第二层"），
 * 再勾选别的标签，那个标签的窗口继续排上去，这样一眼能看清要删的是哪个。
 * 选择状态存在 store 里，与左侧目录树的双选完全一一对应。
 */
function toggleTag(tag, checked) {
  workbench.setTagMarked(tag.id, checked)
}

/** 有勾选就删除所选；没有勾选但已经腾出位置，就直接继续被拦下的动作 */
function confirm() {
  if (confirmDisabled.value) return
  workbench.confirmTagCleanup(selected.value)
}

function onKeydown(e) {
  if (e.key === 'Escape' && workbench.tagLimit.open) workbench.cancelTagCleanup()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* 遮罩只负责居中，不拦截鼠标：左侧目录树在弹窗打开时依然可操作 */
.tag-limit-mask {
  position: fixed;
  inset: 0;
  z-index: 12000; /* 始终在最顶层（高于计算框与各种面板） */
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.tag-limit {
  pointer-events: auto;
  width: min(520px, calc(100vw - 40px));
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
  overflow: hidden;
  animation: tag-limit-in 170ms cubic-bezier(0.16, 0.84, 0.24, 1);
}
@keyframes tag-limit-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.tag-limit__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 6px 0 10px;
  background-color: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
}
.tag-limit__head > i {
  color: var(--marker);
  font-size: 13px;
}
.tag-limit__spacer {
  flex: 1;
}
.tag-limit__btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius);
  color: var(--icon-color);
  cursor: pointer;
  font-size: 11px;
}
.tag-limit__btn:hover {
  background-color: var(--bg-toolbar-hover);
  color: var(--text-primary);
}
.tag-limit__btn.close:hover {
  background-color: #f56c6c;
  color: #fff;
}
.tag-limit__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
}
.tag-limit__text {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}
.tag-limit__text b {
  color: var(--text-primary);
}
.tag-limit__tip {
  display: block;
  margin-top: 2px;
  color: var(--text-secondary);
  opacity: 0.85;
}
.tag-limit__all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  background-color: var(--bg-toolbar);
  border: 1px solid var(--border-color);
  border-radius: var(--field-radius);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}
.tag-limit__list {
  /* 标签排成两列（数量多时一屏能看完，最多 15 个 → 8 行） */
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 8px;
  max-height: 264px;
  overflow: auto;
}
.tag-limit__item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--field-h);
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--field-radius);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}
.tag-limit__item:hover {
  background-color: var(--bg-hover);
}
.tag-limit__item.is-selected {
  background-color: var(--tree-selected-bg);
  border-color: var(--tree-selected-border);
}
.tag-limit__item i {
  color: var(--accent);
  font-size: 12px;
}
.tag-limit__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-limit__foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-body);
}
.tag-limit__hint {
  flex: 1;
  font-size: 11px;
  color: var(--text-secondary);
}
.tag-limit__foot button {
  height: var(--field-h);
  min-width: 64px;
  padding: 0 12px;
  border-radius: var(--field-radius);
  border: 1px solid var(--border-color);
  background-color: var(--bg-panel);
  color: var(--text-primary);
  font-size: var(--field-font);
  font-family: inherit;
  cursor: pointer;
}
.tag-limit__foot button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tag-limit__foot button.primary {
  min-width: 132px;
  background-color: var(--accent-fill);
  border-color: var(--accent-fill);
  color: var(--on-accent-fill);
}
.tag-limit__foot button.primary:hover {
  background-color: var(--accent-fill-hover);
  border-color: var(--accent-fill-hover);
  color: var(--on-accent-fill);
}
.tag-limit__foot button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--bg-panel);
  border-color: var(--border-color);
  color: var(--text-secondary);
}
</style>
