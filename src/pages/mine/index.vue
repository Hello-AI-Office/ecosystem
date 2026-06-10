<script setup lang="ts">
import type { UserInfo, UserRole } from '@/utils/auth'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { usePhoneLogin } from '@/composables/usePhoneLogin'
import { clearAuth, getUserInfo, isLoggedIn } from '@/utils/auth'

/**
 * 我的（tabBar 页）
 * - 未登录：引导微信一键登录
 * - 已登录：用户信息 + 退出登录
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

onShow(() => {
  refreshAuthState()
})

function refreshAuthState() {
  loggedIn.value = isLoggedIn()
  user.value = getUserInfo()
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        clearAuth()
        refreshAuthState()
      }
    },
  })
}
</script>

<template>
  <view class="mine-page">
    <!-- 未登录：引导登录 -->
    <view v-if="!loggedIn" class="guest">
      <view class="guest__avatar">
        <text>U</text>
      </view>
      <text class="guest__tip">登录后查看我的信息</text>
      <button
        class="primary-btn"
        open-type="getPhoneNumber"
        :disabled="logging"
        @getphonenumber="onGetPhoneNumber"
      >
        微信一键登录
      </button>
    </view>

    <!-- 已登录：用户信息 -->
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

      <button class="logout-btn" @click="handleLogout">
        退出登录
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
$primary: #16b777;

.mine-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: calc(env(safe-area-inset-top) + 160rpx) 40rpx 0;
  background: linear-gradient(180deg, #e8f7ef 0%, #f7fcf9 40%, #ffffff 100%);
}

// ---------------- 未登录 ----------------

.guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 144rpx;
    height: 144rpx;
    font-size: 56rpx;
    font-weight: 600;
    color: #ffffff;
    background: #d1d5db;
    border-radius: 50%;
  }

  &__tip {
    margin-top: 32rpx;
    font-size: 28rpx;
    color: #6b7280;
  }
}

.primary-btn {
  width: 670rpx;
  height: 112rpx;
  margin-top: 80rpx;
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

// ---------------- 已登录 ----------------

.member {
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
}

.logout-btn {
  width: 670rpx;
  height: 96rpx;
  margin-top: 80rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 48rpx;

  &::after {
    border: none;
  }
}
</style>
