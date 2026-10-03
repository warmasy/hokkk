import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite 配置：端口 81（避免与原项目 80 冲突），@ 指向 src
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 81,
      host: true,
      open: false,
      // 3D 查看器的静态资源很大（30MB+），不纳入文件监视，避免复制/解压时把 dev server 拖崩
      // 临时/探测文件（.tmpdir、probe-*.cjs、截图、编辑器临时文件）也不监视：
      // 这些文件写入时会被占用，监视它们会抛 EBUSY 直接把 dev server 打挂
      watch: {
        ignored: [
          '**/public/o3dv/**',
          '**/public/o3dv-site/**',
          '**/public/models/**',
          '**/.probe*/**',
          '**/*.tmpdir/**',
          '**/probe-*.cjs',
          '**/probe-*.png',
          '**/dist/**',
          // 编辑器/系统产生的临时文件（如 xxx.js~RF1234.TMP、.swp），被占用时会 EBUSY
          '**/*.TMP',
          '**/*.tmp',
          '**/*.swp',
          '**/*.swx',
          '**/*~'
        ]
      },
      // 代理：后期对接后端时改这里（原项目是 VITE_APP_BASE_API）
      proxy: {
        '/dev-api': {
          target: env.VITE_APP_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/dev-api/, '')
        }
      }
    },
    // 大资源目录不做 publicDir 拷贝优化（保持原样输出）
    publicDir: 'public',
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1500
    }
  }
})
