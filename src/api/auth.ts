/**
 * 登录相关接口
 *
 * 后端尚未就绪，当前通过 USE_MOCK 走本地模拟数据；
 * 后端就绪后将 USE_MOCK 置为 false，并补全 BASE_URL 即可无缝切换。
 */
import type { UserInfo } from '@/utils/auth'

/** 是否使用 mock 数据（后端就绪后改为 false） */
const USE_MOCK = true

const BASE_URL = 'https://api.example.com'

/** 一键登录入参 */
export interface PhoneLoginParams {
  /** uni.login 获取的临时登录凭证，后端用于换取 openid/session_key */
  loginCode: string
  /** 手机号授权弹窗返回的加密 code，后端用于解密手机号 */
  phoneCode: string
  /** 锁定在本地缓存的推荐人 ID，后端绑定推荐关系；无推荐人传 null */
  pid: string | null
}

/** 一键登录返回值（后端同时完成：解密手机号 + 绑定 pid + 发放 token） */
export interface PhoneLoginResult {
  token: string
  user: UserInfo
}

/**
 * 客户/商户微信手机号一键登录
 */
export function loginByPhone(params: PhoneLoginParams): Promise<PhoneLoginResult> {
  if (USE_MOCK)
    return mockLoginByPhone(params)

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}/auth/phone-login`,
      method: 'POST',
      data: params,
      success: (res) => {
        const body = res.data as { code: number, message: string, data: PhoneLoginResult }
        if (body.code === 0)
          resolve(body.data)
        else
          reject(new Error(body.message || '登录失败'))
      },
      fail: () => reject(new Error('网络异常，请稍后重试')),
    })
  })
}

// ---------------- mock 实现 ----------------

/**
 * 模拟后端登录：解密手机号 + 绑定 pid + 发放 token
 */
function mockLoginByPhone(params: PhoneLoginParams): Promise<PhoneLoginResult> {
  console.warn('[mock] loginByPhone 入参：', params)

  return new Promise((resolve) => {
    // 模拟网络耗时
    setTimeout(() => {
      resolve({
        token: `mock-token-${Date.now()}`,
        user: {
          id: 'u_10001',
          // mock 固定返回客户身份，真实身份由后端根据账号判定
          role: 'customer',
          nickname: '微信用户_8888',
          // 模拟后端解密 phoneCode 得到的手机号
          phone: '138****8888',
          // 模拟后端完成 pid 推荐关系绑定
          pid: params.pid,
        },
      })
    }, 800)
  })
}
