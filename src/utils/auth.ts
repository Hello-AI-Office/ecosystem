/**
 * 认证相关的本地缓存管理
 *
 * - pid（推荐人 ID）：首次进入小程序时写入后即「锁定」，后续任何渠道进入都不再覆盖，
 *   保证推荐关系归属第一个推荐人
 * - token / 用户信息：登录成功后写入，退出登录时清除
 */

/** 用户身份：商户 / 客户 / 代理人 */
export type UserRole = 'merchant' | 'customer' | 'agent'

export interface UserInfo {
  id: string
  role: UserRole
  nickname: string
  phone: string
  /** 绑定的推荐人 ID，无推荐人时为 null */
  pid: string | null
}

const TOKEN_KEY = 'auth:token'
const USER_KEY = 'auth:user'
const PID_KEY = 'auth:locked-pid'

// ---------------- pid 推荐关系 ----------------

/**
 * 锁定推荐人 pid：仅当本地尚未存在 pid 时写入，已锁定则忽略后续值
 */
export function lockPid(pid?: string | null) {
  if (!pid)
    return
  if (getLockedPid())
    return
  uni.setStorageSync(PID_KEY, pid)
}

/** 读取已锁定的 pid，没有则返回 null */
export function getLockedPid(): string | null {
  return uni.getStorageSync(PID_KEY) || null
}

// ---------------- token / 用户信息 ----------------

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return uni.getStorageSync(TOKEN_KEY) || null
}

export function setUserInfo(user: UserInfo) {
  uni.setStorageSync(USER_KEY, user)
}

export function getUserInfo(): UserInfo | null {
  return uni.getStorageSync(USER_KEY) || null
}

/** 是否已登录 */
export function isLoggedIn(): boolean {
  return Boolean(getToken())
}

/** 退出登录：清除 token 与用户信息（pid 锁保留） */
export function clearAuth() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}
