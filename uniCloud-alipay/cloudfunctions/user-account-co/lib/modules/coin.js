const { getCurrentUid } = require('../common/auth')
const { db, dbCmd, userCollection, coinCollection, coinLogCollection } = require('../common/db')
const { toInt } = require('../common/utils')

module.exports = {
  async getMyCoinBalance (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const res = await coinCollection.where({ userId: uid }).limit(1).get()
    const coin = res?.data && res.data[0]

    if (!coin) {
      return {
        errCode: 0,
        errMsg: '',
        data: {
          balance: 0,
          totalEarned: 0,
          totalSpent: 0
        }
      }
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        balance: coin.balance || 0,
        totalEarned: coin.totalEarned || 0,
        totalSpent: coin.totalSpent || 0
      }
    }
  },

  async getMyCoinLogs (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const page = Math.max(1, toInt(params.page || 1))
    const pageSize = Math.max(1, Math.min(50, toInt(params.pageSize || 20)))
    const type = String(params.type || '').trim()

    const where = { userId: uid }
    if (type === 'income') {
      where.amount = dbCmd.gt(0)
    } else if (type === 'expense') {
      where.amount = dbCmd.lt(0)
    }

    const [listRes, countRes] = await Promise.all([
      coinLogCollection
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      coinLogCollection.where(where).count()
    ])

    return {
      errCode: 0,
      errMsg: '',
      data: listRes?.data || [],
      pagination: {
        page,
        pageSize,
        total: countRes?.total || 0
      }
    }
  },

  async createCoinRechargeOrder (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const amount = toInt(params.amount || 0)
    const bonus = Math.max(0, toInt(params.bonus || 0))

    if (amount <= 0 || amount > 1000000) {
      return {
        errCode: 'invalid-amount',
        errMsg: '充值金额无效（范围：1-1000000）'
      }
    }

    const orderCollection = db.collection('xuanshang-orders')
    const now = Date.now()

    const addRes = await orderCollection.add({
      userId: uid,
      skuCode: 'COIN_RECHARGE',
      qty: amount,
      amount: amount,
      currency: 'CNY',
      status: 'created',
      payProvider: 'wxpay-virtual',
      deliverStatus: 'pending',
      remark: bonus > 0 ? `积分充值 ${amount} 个，赠送 ${bonus} 个` : `积分充值 ${amount} 个`,
      coinBonus: bonus,
      createTime: now,
      updateTime: now
    })

    const orderId = String(
      addRes.id || 
      addRes._id || 
      addRes.result?.id || 
      addRes.result?._id ||
      ''
    ).trim()

    if (!orderId) {
      return {
        errCode: 'create-order-failed',
        errMsg: '创建充值订单失败'
      }
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        orderId,
        amount,
        bonus
      }
    }
  },

  async handleCoinRechargeSuccess (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const orderId = String(params.orderId || '').trim()
    if (!orderId) {
      return {
        errCode: 'invalid-order',
        errMsg: '订单ID不能为空'
      }
    }

    const orderCollection = db.collection('xuanshang-orders')
    const orderRes = await orderCollection.doc(orderId).get()
    const order = orderRes?.data && orderRes.data[0]

    if (!order || order.userId !== uid) {
      return {
        errCode: 'order-not-found',
        errMsg: '订单不存在'
      }
    }

    if (order.status === 'paid' && order.deliverStatus === 'delivered') {
      return {
        errCode: 0,
        errMsg: '积分已入账',
        data: { already_delivered: true }
      }
    }

    if (order.status !== 'created' && order.status !== 'paid') {
      return {
        errCode: 'invalid-order-status',
        errMsg: '订单状态异常'
      }
    }

    if (String(order.skuCode) !== 'COIN_RECHARGE') {
      return {
        errCode: 'invalid-order-type',
        errMsg: '订单类型错误'
      }
    }

    const coinAmount = Math.max(0, toInt(order.amount || 0))
    if (!coinAmount) {
      return {
        errCode: 'invalid-amount',
        errMsg: '充值金额异常'
      }
    }

    const coinBonus = Math.max(0, toInt(order.coinBonus || 0))
    const totalCoins = coinAmount + coinBonus
    const now = Date.now()

    const coinRes = await coinCollection.where({ userId: uid }).limit(1).get()
    const existingCoin = coinRes?.data && coinRes.data[0]

    let newBalance = 0

    if (!existingCoin) {
      await coinCollection.add({
        userId: uid,
        balance: totalCoins,
        totalEarned: totalCoins,
        totalSpent: 0,
        createTime: now,
        updateTime: now
      })
      newBalance = totalCoins
    } else {
      newBalance = (existingCoin.balance || 0) + totalCoins
      await coinCollection.doc(existingCoin._id).update({
        balance: newBalance,
        totalEarned: dbCmd.inc(totalCoins),
        updateTime: now
      })
    }

    await coinLogCollection.add({
      userId: uid,
      amount: coinAmount,
      balanceAfter: coinBonus > 0 ? newBalance - coinBonus : newBalance,
      type: 'recharge',
      source: '积分充值',
      orderId: orderId,
      createTime: now
    })

    if (coinBonus > 0) {
      await coinLogCollection.add({
        userId: uid,
        amount: coinBonus,
        balanceAfter: newBalance,
        type: 'recharge',
        source: `充值赠送`,
        orderId: orderId,
        createTime: now + 1
      })
    }

    await orderCollection.doc(orderId).update({
      status: 'paid',
      deliverStatus: 'delivered',
      updateTime: now
    })

    return {
      errCode: 0,
      errMsg: '积分入账成功',
      data: {
        newBalance,
        coinAmount
      }
    }
  },

  async adminGrantCoins (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      return {
        errCode: 'permission-denied',
        errMsg: '无权限'
      }
    }

    const targetUserId = String(params.userId || '').trim()
    const amount = toInt(params.amount || 0)
    const remark = String(params.remark || '').trim()

    if (!targetUserId) {
      return {
        errCode: 'invalid-user',
        errMsg: '用户ID不能为空'
      }
    }

    if (amount === 0) {
      return {
        errCode: 'invalid-amount',
        errMsg: '金额不能为0'
      }
    }

    const now = Date.now()

    const coinRes = await coinCollection.where({ userId: targetUserId }).limit(1).get()
    const existingCoin = coinRes?.data && coinRes.data[0]

    let newBalance = 0

    if (!existingCoin) {
      if (amount < 0) {
        return {
          errCode: 'insufficient-balance',
          errMsg: '用户积分余额不足'
        }
      }

      await coinCollection.add({
        userId: targetUserId,
        balance: amount,
        totalEarned: amount > 0 ? amount : 0,
        totalSpent: amount < 0 ? Math.abs(amount) : 0,
        createTime: now,
        updateTime: now
      })

      newBalance = amount
    } else {
      const currentBalance = existingCoin.balance || 0
      newBalance = currentBalance + amount

      if (newBalance < 0) {
        return {
          errCode: 'insufficient-balance',
          errMsg: '用户积分余额不足'
        }
      }

      const updateData = {
        balance: newBalance,
        updateTime: now
      }

      if (amount > 0) {
        updateData.totalEarned = dbCmd.inc(amount)
      } else {
        updateData.totalSpent = dbCmd.inc(Math.abs(amount))
      }

      await coinCollection.doc(existingCoin._id).update(updateData)
    }

    await coinLogCollection.add({
      userId: targetUserId,
      amount,
      balanceAfter: newBalance,
      type: amount > 0 ? 'admin_grant' : 'admin_deduct',
      source: amount > 0 ? '管理员发放' : '管理员扣除',
      remark: remark || undefined,
      createTime: now
    })

    return {
      errCode: 0,
      errMsg: '操作成功',
      data: {
        newBalance
      }
    }
  },

  async adminGetCoinStats (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      return {
        errCode: 'permission-denied',
        errMsg: '无权限'
      }
    }

    const page = Math.max(1, toInt(params.page || 1))
    const pageSize = Math.max(1, Math.min(100, toInt(params.pageSize || 20)))

    const orderCollection = db.collection('xuanshang-orders')

    const [
      totalUsersRes,
      totalBalanceRes,
      totalEarnedRes,
      totalSpentRes,
      rechargeOrdersRes,
      rechargeAmountRes,
      topUsersRes,
      countRes
    ] = await Promise.all([
      coinCollection.count(),
      coinCollection.field({ balance: true }).get(),
      coinCollection.field({ totalEarned: true }).get(),
      coinCollection.field({ totalSpent: true }).get(),
      orderCollection.where({ skuCode: 'COIN_RECHARGE', status: 'paid' }).count(),
      orderCollection.where({ skuCode: 'COIN_RECHARGE', status: 'paid' }).field({ amount: true }).get(),
      coinCollection
        .orderBy('balance', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      coinCollection.count()
    ])

    const totalUsers = totalUsersRes?.total || 0
    const totalBalance = (totalBalanceRes?.data || []).reduce((sum, item) => sum + (item.balance || 0), 0)
    const totalEarned = (totalEarnedRes?.data || []).reduce((sum, item) => sum + (item.totalEarned || 0), 0)
    const totalSpent = (totalSpentRes?.data || []).reduce((sum, item) => sum + (item.totalSpent || 0), 0)
    const rechargeOrders = rechargeOrdersRes?.total || 0
    const rechargeAmount = (rechargeAmountRes?.data || []).reduce((sum, item) => sum + (item.amount || 0), 0)

    const topUsers = topUsersRes?.data || []
    const userIds = topUsers.map(u => u.userId).filter(Boolean)

    if (userIds.length > 0) {
      const userInfoRes = await userCollection
        .where({ _id: dbCmd.in(userIds) })
        .field({ _id: true, nickname: true, username: true, mobile: true })
        .limit(100)
        .get()

      const userMap = new Map((userInfoRes?.data || []).map(u => [u._id, u]))

      topUsers.forEach(coinRecord => {
        const user = userMap.get(coinRecord.userId)
        if (user) {
          coinRecord.userNickname = user.nickname || user.username || user.mobile || '未知用户'
          coinRecord.userMobile = user.mobile || '-'
        } else {
          coinRecord.userNickname = '未知用户'
          coinRecord.userMobile = '-'
        }
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        summary: {
          totalUsers,
          totalBalance,
          totalEarned,
          totalSpent,
          rechargeOrders,
          rechargeAmount
        },
        topUsers,
        pagination: {
          page,
          pageSize,
          total: countRes?.total || 0
        }
      }
    }
  }
}
