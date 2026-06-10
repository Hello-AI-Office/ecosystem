<script setup lang="ts">
import { ref } from 'vue'

const title = ref('ecosystem')
</script>

<template>
  <view class="page">
    <image class="logo" src="/static/logo.svg" mode="aspectFit" />
    <text class="title">
      {{ title }}
    </text>
    <text class="desc">
      这是测试同步
    </text>
  </view>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 48rpx;
  box-sizing: border-box;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 48rpx;
}

.title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 24rpx;
}

.desc {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  line-height: 1.6;
}
</style>
