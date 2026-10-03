/**
 * 轻量消息提示（不依赖 Element Plus）
 * 提供 msg / msgError / msgSuccess / msgWarning / confirm / notify 等与 Element Plus 同名的方法，
 * 便于后期无缝替换或迁移。
 */

let container = null

function getContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div')
    container.className = 'mc-message-container'
    document.body.appendChild(container)
  }
  return container
}

function showMessage(message, type = 'info', duration = 3000) {
  const box = getContainer()
  const el = document.createElement('div')
  el.className = `mc-message mc-message--${type}`
  el.textContent = message
  box.appendChild(el)
  // 进场
  requestAnimationFrame(() => el.classList.add('is-visible'))
  setTimeout(() => {
    el.classList.remove('is-visible')
    setTimeout(() => el.remove(), 200)
  }, duration)
}

/**
 * 消息提示
 * @param {String|Object} options 文本或配置
 */
export function msg(content, type = 'info') {
  if (typeof content === 'object' && content !== null) {
    showMessage(content.message, content.type || 'info', content.duration || 3000)
  } else {
    showMessage(content, type)
  }
}

export function msgError(content) {
  msg(content, 'error')
}

export function msgSuccess(content) {
  msg(content, 'success')
}

export function msgWarning(content) {
  msg(content, 'warning')
}

/**
 * 通知（右上角，与 message 视觉一致，便于沿用调用方式）
 */
export function notify(options = {}) {
  const { title, message, type = 'info' } = options
  msg(`${title ? title + '：' : ''}${message || ''}`, type)
}

export function notifyError(options = {}) {
  notify({ ...options, type: 'error' })
}

export function notifySuccess(options = {}) {
  notify({ ...options, type: 'success' })
}

/**
 * 确认框（Promise）
 * @returns {Promise<void>} 确认 resolve，取消 reject
 */
export function confirm(content, title = '系统提示', options = {}) {
  return new Promise((resolve, reject) => {
    const mask = document.createElement('div')
    mask.className = 'mc-modal-mask'
    mask.innerHTML = `
      <div class="mc-modal">
        <div class="mc-modal__header">${title}</div>
        <div class="mc-modal__body">${content}</div>
        <div class="mc-modal__footer">
          <button class="mc-btn mc-btn--default" data-act="cancel">${options.cancelButtonText || '取消'}</button>
          <button class="mc-btn mc-btn--primary" data-act="ok">${options.confirmButtonText || '确定'}</button>
        </div>
      </div>`
    document.body.appendChild(mask)
    requestAnimationFrame(() => mask.classList.add('is-visible'))
    const close = () => {
      mask.classList.remove('is-visible')
      setTimeout(() => mask.remove(), 150)
    }
    mask.addEventListener('click', (e) => {
      const act = e.target?.dataset?.act
      if (act === 'ok') { close(); resolve() }
      else if (act === 'cancel' || e.target === mask) { close(); reject(new Error('cancel')) }
    })
  })
}

/**
 * 加载中遮罩
 */
export function loading(text = '加载中...') {
  const mask = document.createElement('div')
  mask.className = 'mc-loading-mask'
  mask.innerHTML = `<div class="mc-loading"><span class="mc-spinner"></span><span>${text}</span></div>`
  document.body.appendChild(mask)
  requestAnimationFrame(() => mask.classList.add('is-visible'))
  return {
    close() {
      mask.classList.remove('is-visible')
      setTimeout(() => mask.remove(), 150)
    }
  }
}

export default { msg, msgError, msgSuccess, msgWarning, notify, notifyError, notifySuccess, confirm, loading }
