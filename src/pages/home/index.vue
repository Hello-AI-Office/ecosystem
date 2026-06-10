<script setup lang="ts">
import type { UserInfo, UserRole } from '@/utils/auth'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { usePhoneLogin } from '@/composables/usePhoneLogin'
import { getUserInfo, isLoggedIn, lockPid } from '@/utils/auth'

/**
 * 首页根据登录态切换展示模块
 * - 未登录：品牌引导模块，点击「微信一键登录」直接弹出手机号授权弹窗
 * - 已登录：用户信息模块
 */

const loggedIn = ref(false)
const user = ref<UserInfo | null>(null)

const ROLE_LABEL: Record<UserRole, string> = {
  merchant: '商户',
  customer: '客户',
  agent: '代理人',
}

const { logging, onGetPhoneNumber } = usePhoneLogin({
  onSuccess: refreshAuthState,
})

onLoad((query) => {
  // 分享进入时携带 pid（推荐人 ID），首次写入后锁定，之后不再覆盖
  lockPid(query?.pid)
})

onShow(() => {
  refreshAuthState()
})

function refreshAuthState() {
  loggedIn.value = isLoggedIn()
  user.value = getUserInfo()
}
</script>

<template>
  <view class="home-page">
    <!-- 未登录：品牌引导模块 -->
    <view v-if="!loggedIn" class="guest">
      <view class="brand">
        <text class="brand__name">U拓宝</text>
        <text class="brand__slogan">团队拓客平台</text>
      </view>
      <button
        class="primary-btn"
        open-type="getPhoneNumber"
        :disabled="logging"
        @getphonenumber="onGetPhoneNumber"
      >
        微信一键登录
      </button>
    </view>

    <!-- 已登录：用户信息模块 -->
    <view v-else class="member">
      <view class="member__card">
        <view class="member__avatar">
          <text>{{ user?.nickname?.slice(0, 1) ?? 'U' }}</text>
        </view>
        <view class="member__info">
          <view class="member__name-row">
            <text class="member__name">{{ user?.nickname }}</text>
            <text class="member__role">{{ user ? ROLE_LABEL[user.role] : '' }}</text>
          </view>
          <text class="member__phone">{{ user?.phone }}</text>
        </view>
      </view>

      <view class="member__welcome">
        <text class="member__welcome-title">欢迎回来</text>
        <text class="member__welcome-desc">
          {{ user?.pid ? `已绑定推荐人（ID：${user.pid}）` : '当前暂无推荐人' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
$primary: #16b777;

.home-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: linear-gradient(180deg, #e8f7ef 0%, #f7fcf9 40%, #ffffff 100%);
}

// ---------------- 未登录模块 ----------------

.guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 36vh;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;

  &__name {
    font-size: 88rpx;
    font-weight: 700;
    color: #1f2937;
  }

  &__slogan {
    margin-top: 32rpx;
    font-size: 32rpx;
    color: #4b5563;
  }
}

.primary-btn {
  width: 670rpx;
  height: 112rpx;
  margin-top: 120rpx;
  line-height: 112rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #ffffff;
  background: $primary;
  border-radius: 56rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
    color: #ffffff;
    background: $primary;
  }
}

// ---------------- 已登录模块 ----------------

.member {
  padding: 120rpx 40rpx 0;

  &__card {
    display: flex;
    align-items: center;
    padding: 40rpx;
    background: #ffffff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(22, 183, 119, 0.12);
  }

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 112rpx;
    height: 112rpx;
    font-size: 48rpx;
    font-weight: 600;
    color: #ffffff;
    background: $primary;
    border-radius: 50%;
  }

  &__info {
    display: flex;
    flex-direction: column;
    margin-left: 28rpx;
  }

  &__name-row {
    display: flex;
    align-items: center;
  }

  &__name {
    font-size: 36rpx;
    font-weight: 600;
    color: #1f2937;
  }

  &__role {
    margin-left: 16rpx;
    padding: 4rpx 16rpx;
    font-size: 22rpx;
    color: $primary;
    background: rgba(22, 183, 119, 0.1);
    border-radius: 8rpx;
  }

  &__phone {
    margin-top: 12rpx;
    font-size: 28rpx;
    color: #6b7280;
  }

  &__welcome {
    display: flex;
    flex-direction: column;
    margin-top: 32rpx;
    padding: 40rpx;
    background: #ffffff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(31, 41, 55, 0.06);
  }

  &__welcome-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #1f2937;
  }

  &__welcome-desc {
    margin-top: 16rpx;
    font-size: 26rpx;
    color: #6b7280;
  }
}
</style>
