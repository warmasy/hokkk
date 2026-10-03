<template>
  <header class="app-header">
    <div class="logo">
      <i class="fa-solid fa-compass"></i><span>{{ title }}</span>
    </div>

    <div class="menu-items">
      <span
        v-for="item in MENU_ITEMS"
        :key="item.key"
        @click="onMenuClick(item)"
      >
        {{ item.label }}
      </span>
    </div>

    <div class="header-actions">
      <a class="doc-link" :href="docUrl" target="_blank" rel="noopener" title="查看文档">
        <i class="fa-regular fa-file-lines"></i>
      </a>
      <div class="theme-toggle" :title="`切换主题（当前：${themeStore.label}）`" @click="themeStore.toggleTheme()">
        <i :class="themeStore.icon"></i>
      </div>
    </div>
  </header>
</template>

<script setup>
import { MENU_ITEMS } from '@/config/ribbon'
import { useWorkbenchStore } from '@/store/modules/workbench'
import { useThemeStore } from '@/store/modules/theme'
import { useModelViewStore } from '@/store/modules/modelView'
import modal from '@/plugins/modal'

const workbench = useWorkbenchStore()
const themeStore = useThemeStore()
const modelView = useModelViewStore()

const title = import.meta.env.VITE_APP_TITLE || '清玄侍'
const docUrl = import.meta.env.VITE_APP_DOC_URL || 'https://element-plus.org'

/** 已经实现的一级菜单（点击后功能区会切换到对应内容） */
const READY_MENUS = ['math', 'basic-calc', 'model-view']

function onMenuClick(item) {
  workbench.setActiveMenu(item.key)
  if (READY_MENUS.includes(item.key)) {
    const tips = {
      math: '数学计算：点击功能区中的函数即可打开函数图像',
      'basic-calc': '基本计算：单位换算 / 惯量 / 力学 / 运动学',
      'model-view': '模型查看：拖入模型或用功能区打开，视角/显示/环境都在功能区'
    }
    workbench.setStatus(tips[item.key] || '当前模块：' + item.label, 0)
    if (item.key === 'model-view') modelView.setMessage('3D 查看器：把模型拖进中栏，或用功能区「打开模型」')
    return
  }
  modal.msg({ message: `「${item.label}」模块规划中，可在 views/ 下新增页面后接入`, type: 'info' })
}
</script>
