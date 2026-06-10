<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { usePhoneLogin } from '@/composables/usePhoneLogin'
import { lockPid } from '@/utils/auth'

/**
 * 登录页：独立登录入口（如 token 过期后重定向至此）
 * 登录流程见 usePhoneLogin
 */

const { logging, onGetPhoneNumber } = usePhoneLogin({
  // 登录成功后直达首页（tabBar 页）
  onSuccess: () => uni.switchTab({ url: '/pages/home/index' }),
})

onLoad((query) => {
  // 分享链接可能携带 pid，进入登录页时再次尝试锁定（已锁定则忽略）
  lockPid(query?.pid)
})
</script>

<template>
  <view class="login-page">
    <view class="brand">
      <text class="brand__name">U拓宝</text>
      <text class="brand__slogan">团队拓客平台</text>
    </view>

    <button
      class="login-btn"
      open-type="getPhoneNumber"
      :disabled="logging"
      @getphonenumber="onGetPhoneNumber"
    >
      微信一键登录
    </button>

    <view class="tips">
      <text>登录即代表同意微信授权手机号用于账号注册与登录</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding-top: 36vh;
  box-sizing: border-box;
  background: linear-gradient(180deg, #e8f7ef 0%, #f7fcf9 40%, #ffffff 100%);
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

.login-btn {
  width: 670rpx;
  height: 112rpx;
  margin-top: 120rpx;
  line-height: 112rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #ffffff;
  background: #16b777;
  border-radius: 56rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
    color: #ffffff;
    background: #16b777;
  }
}

.tips {
  margin-top: 40rpx;
  padding: 0 80rpx;
  font-size: 24rpx;
  color: #9ca3af;
  text-align: center;
}
</style>
