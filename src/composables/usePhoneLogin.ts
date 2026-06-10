import { ref } from 'vue'
import { loginByPhone } from '@/api/auth'
import { getLockedPid, setToken, setUserInfo } from '@/utils/auth'

/**
 * 微信手机号一键登录
 *
 * 配合 open-type="getPhoneNumber" 的按钮使用：
 * 1. 点击按钮，微信直接弹窗提示授权手机号
 * 2. 用户点击「允许」，回调拿到加密的 phoneCode
 * 3. 配合 uni.login 的 loginCode 与缓存中锁定的 pid 一起提交后端
 * 4. 后端同时完成：解密手机号 + 绑定 pid 推荐关系 + 发放登录 Token
 * 5. 缓存 token / 用户信息，触发 onSuccess（由调用方决定后续跳转/刷新）
 */
export function usePhoneLogin(options: { onSuccess?: () => void } = {}) {
  const logging = ref(false)

  function getLoginCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: res => resolve(res.code),
        fail: () => reject(new Error('获取微信登录凭证失败')),
      })
    })
  }

  /** 手机号授权回调：用户点击「允许」后开始登录 */
  async function onGetPhoneNumber(e: UniHelper.ButtonOnGetphonenumberEvent) {
    const phoneCode = e.detail.code
    // 用户点击「拒绝」时没有 code，静默返回
    if (!phoneCode)
      return

    if (logging.value)
      return
    logging.value = true
    uni.showLoading({ title: '登录中...', mask: true })

    try {
      const loginCode = await getLoginCode()
      const { token, user } = await loginByPhone({
        loginCode,
        phoneCode,
        pid: getLockedPid(),
      })

      setToken(token)
      setUserInfo(user)
      options.onSuccess?.()
    }
    catch (err) {
      uni.showToast({
        title: err instanceof Error ? err.message : '登录失败，请重试',
        icon: 'none',
      })
    }
    finally {
      uni.hideLoading()
      logging.value = false
    }
  }

  return { logging, onGetPhoneNumber }
}
