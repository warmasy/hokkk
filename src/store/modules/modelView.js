import { defineStore } from 'pinia'
import { modelViewer } from '@/viewer/modelController'

/**
 * 模型查看状态（查看器内核 -> UI 的桥梁）
 * 所有状态由 modelController 的事件驱动，界面只读不改。
 */
export const useModelViewStore = defineStore('modelView', {
  state: () => ({
    ready: false,
    loading: false,
    hasModel: false,
    modelName: '',
    error: '',
    /** 零件列表 [{ index, name, visible, vertexCount, triangleCount }] */
    parts: [],
    /** 当前视角 / 投影 / 背景（用于功能区按钮高亮） */
    activeView: 'iso',
    projection: 'perspective',
    background: 'light',
    /** 正在使用的工具（测量等） */
    activeTool: '',
    /** 提示信息（供状态栏显示最后一次操作结果） */
    message: ''
  }),
  getters: {
    stats: (state) => {
      const triangles = state.parts.reduce((n, p) => n + (p.triangleCount || 0), 0)
      const vertices = state.parts.reduce((n, p) => n + (p.vertexCount || 0), 0)
      return { partCount: state.parts.length, triangles, vertices }
    },
    visibleParts: (state) => state.parts.filter((p) => p.visible).length
  },
  actions: {
    /** 把内核事件接到 store 上（组件挂载时调用一次） */
    bindController() {
      modelViewer.on({
        loading: ({ name }) => {
          this.loading = true
          this.error = ''
          this.modelName = name || ''
        },
        modelLoaded: () => {
          this.loading = false
          this.hasModel = true
          this.parts = modelViewer.getParts()
          this.message = `已加载模型：${this.modelName || '未命名'}`
        },
        partsChanged: (parts) => {
          this.parts = parts
        },
        cleared: () => {
          this.hasModel = false
          this.modelName = ''
          this.parts = []
          this.message = '已清空模型'
        },
        error: (msg) => {
          this.error = msg
          this.loading = false
        },
        viewChanged: (key) => {
          this.activeView = key
          this.message = `视角：${key}`
        },
        projectionChanged: (mode) => {
          this.projection = mode
          this.message = mode === 'orthographic' ? '已切换为正交投影' : '已切换为透视投影'
        },
        backgroundChanged: (key) => {
          this.background = key
        },
        fitted: () => {
          this.message = '已适应屏幕'
        }
      })
      this.ready = modelViewer.state.ready
    },
    setMessage(text) {
      this.message = text
    },
    setActiveTool(tool) {
      this.activeTool = tool
    }
  }
})
