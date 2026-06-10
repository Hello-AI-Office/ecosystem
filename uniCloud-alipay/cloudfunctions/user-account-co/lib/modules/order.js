const { getCurrentUid } = require('../common/auth')
const { db, dbCmd, skuCollection, orderCollection, activationCodeCollection } = require('../common/db')
const { toInt, generateActivationCode } = require('../common/utils')

module.exports = {
  async listEnabledSkus (context) {
    const res = await skuCollection
      .where({ status: 'enabled' })
      .orderBy('sortOrder', 'asc')
      .orderBy('createTime', 'desc')
      .limit(200)
      .get()

    return {
      errCode: 0,
      errMsg: '',
      data: res?.data || []
    }
  },

  async createSkuOrder (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const skuCode = String(params.skuCode || '').trim()
    const qty = Math.max(1, Math.min(999, toInt(params.qty || 1)))

    if (!skuCode) {
      return {
        errCode: 'user-account-co-invalid-sku',
        errMsg: '请选择商品'
      }
    }

    const skuRes = await skuCollection
      .where({ code: skuCode, status: 'enabled' })
      .limit(1)
      .get()

    const sku = skuRes?.data && skuRes.data[0]
    if (!sku) {
      return {
        errCode: 'user-account-co-sku-not-found',
        errMsg: '商品不存在或已下架'
      }
    }

    let price = Math.max(0, toInt(sku.price || 0))
    let wxProductId = sku.wxProductId || undefined
    let teamId = undefined

    const teamModule = require('./team')
    const teamInfoRes = await teamModule.getMyTeamInfo(context)
    
    if (teamInfoRes?.errCode === 0 && teamInfoRes?.data?.team) {
      const team = teamInfoRes.data.team
      teamId = team._id
      
      const featurePricing = team.featurePricing || {}
      const featureCodes = Array.isArray(sku.featureCodes) ? sku.featureCodes : []
      
      if (featureCodes.length > 0) {
        const firstFeatureCode = featureCodes[0]
        const teamPricingEntry = featurePricing[firstFeatureCode]
        
        if (teamPricingEntry !== undefined && teamPricingEntry !== null) {
          if (typeof teamPricingEntry === 'object') {
            const teamPrice = toInt(teamPricingEntry.price || 0)
            if (teamPrice > 0) {
              price = teamPrice
            }
            if (teamPricingEntry.wxProductId) {
              wxProductId = teamPricingEntry.wxProductId
            }
          } else {
            const teamPriceInt = toInt(teamPricingEntry)
            if (teamPriceInt > 0) {
              price = teamPriceInt
            }
          }
        }
      }
    }

    const amount = price * qty

    const now = Date.now()
    const addRes = await orderCollection.add({
      userId: uid,
      skuCode,
      qty,
      amount,
      currency: 'CNY',
      status: 'created',
      payProvider: 'mock',
      deliverStatus: 'pending',
      teamId,
      wxProductId: wxProductId || undefined,
      remark: undefined,
      createTime: now,
      updateTime: now
    })

    return {
      errCode: 0,
      errMsg: '',
      data: {
        orderId: addRes?.id,
        amount,
        qty,
        skuCode
      }
    }
  },

  async requestVirtualPay (context, params = {}) {
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
        errCode: 'user-account-co-invalid-order',
        errMsg: '订单不存在'
      }
    }

    const res = await orderCollection.doc(orderId).get()
    const order = res?.data && res.data[0]

    if (!order || order.userId !== uid) {
      return {
        errCode: 'user-account-co-order-not-found',
        errMsg: '订单不存在'
      }
    }

    if (String(order.status) !== 'created') {
      return {
        errCode: 'user-account-co-order-status-invalid',
        errMsg: '订单状态不可支付'
      }
    }

    const totalFee = Math.max(0, toInt(order.amount || 0))
    if (!totalFee) {
      return {
        errCode: 'user-account-co-order-amount-invalid',
        errMsg: '订单金额异常'
      }
    }

    const skuRes = await skuCollection
      .where({ code: String(order.skuCode || '').trim() })
      .limit(1)
      .get()
    const sku = skuRes?.data && skuRes.data[0]

    const description = sku?.name
      ? `${sku.name} x ${Math.max(1, toInt(order.qty || 1))}`
      : `技能包 x ${Math.max(1, toInt(order.qty || 1))}`

    const buyQuantity = totalFee

    const orderWxProductId = String(order.wxProductId || '').trim()
    if (!orderWxProductId) {
      return {
        errCode: 'user-account-co-missing-product-id',
        errMsg: '该商品未配置微信道具ID，请联系管理员'
      }
    }

    await orderCollection.doc(orderId).update({
      payProvider: 'wxpay-virtual',
      updateTime: Date.now()
    })

    const uniPayCo = uniCloud.importObject('uni-pay-co', {
      customUI: true
    })

    const payRes = await uniPayCo.createOrder({
      provider: 'wxpay-virtual',
      order_no: orderId,
      description: description,
      type: 'xuanshang-orders',
      wxpay_virtual: {
        mode: 'short_series_goods',
        buy_quantity: buyQuantity,
        product_id: orderWxProductId,
        env: 'develop'
      },
      openid: context.OPENID,
      user_id: uid,
      clientInfo: context.CLIENTINFO,
      cloudInfo: context.CLOUDINFO
    })

    if (payRes?.errCode && payRes.errCode !== 0) {
      return {
        errCode: payRes.errCode,
        errMsg: payRes.errMsg || '创建支付失败'
      }
    }

    const orderInfo = payRes.order || {}
    
    return {
      errCode: 0,
      errMsg: 'ok',
      data: {
        orderId,
        buyQuantity,
        description,
        order: orderInfo,
        paySig: orderInfo.paySig,
        signData: orderInfo.signData,
        out_trade_no: payRes.out_trade_no
      }
    }
  },

  async listMyOrders (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const page = Math.max(1, toInt(params.page || 1))
    const pageSize = Math.max(1, Math.min(50, toInt(params.pageSize || 20)))
    const status = String(params.status || '').trim()

    const where = {
      userId: uid
    }
    if (status) {
      where.status = status
    }

    const [listRes, countRes] = await Promise.all([
      orderCollection
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      orderCollection.where(where).count()
    ])

    const orders = listRes?.data || []
    
    const skuCodes = [...new Set(orders.map(o => String(o.skuCode || '')).filter(Boolean))]
    
    if (skuCodes.length > 0) {
      const skuRes = await skuCollection.where({
        code: dbCmd.in(skuCodes)
      }).field({
        code: true,
        name: true,
        entitlementDays: true
      }).limit(200).get()
      
      const skuMap = new Map((skuRes?.data || []).map(sku => [sku.code, sku]))
      
      orders.forEach(order => {
        const sku = skuMap.get(order.skuCode)
        if (sku) {
          order.skuName = sku.name
          order.skuEntitlementDays = sku.entitlementDays
        }
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      data: orders,
      pagination: {
        page,
        pageSize,
        total: countRes?.total || countRes?.result?.total || 0
      }
    }
  },

  async getOrderDetail (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const orderId = String(params.orderId || params.id || '').trim()
    if (!orderId) {
      return {
        errCode: 'user-account-co-invalid-order',
        errMsg: '订单不存在'
      }
    }

    const res = await orderCollection.doc(orderId).get()
    const order = res?.data && res.data[0]

    if (!order || order.userId !== uid) {
      return {
        errCode: 'user-account-co-order-not-found',
        errMsg: '订单不存在'
      }
    }

    if (order.skuCode) {
      const skuRes = await skuCollection.where({
        code: order.skuCode
      }).field({
        code: true,
        name: true,
        entitlementDays: true
      }).limit(1).get()
      
      const sku = skuRes?.data && skuRes.data[0]
      if (sku) {
        order.skuName = sku.name
        order.skuEntitlementDays = sku.entitlementDays
      }
    }

    return {
      errCode: 0,
      errMsg: '',
      data: order
    }
  },

  async cancelOrder (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const orderId = String(params.orderId || params.id || '').trim()
    if (!orderId) {
      return {
        errCode: 'user-account-co-invalid-order',
        errMsg: '订单不存在'
      }
    }

    const now = Date.now()
    const upRes = await orderCollection.where({
      _id: orderId,
      userId: uid,
      status: 'created'
    }).update({
      status: 'cancelled',
      cancelTime: now,
      updateTime: now
    })

    const updated = Number(upRes?.updated || upRes?.result?.updated || 0) || 0
    if (updated <= 0) {
      return {
        errCode: 'user-account-co-order-cancel-failed',
        errMsg: '订单状态不可取消'
      }
    }

    return {
      errCode: 0,
      errMsg: '已取消'
    }
  },

  async adminListOrders (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const userCollection = db.collection('uni-id-users')
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
    const status = String(params.status || '').trim()

    const where = {}
    if (status) {
      where.status = status
    }

    const [listRes, countRes] = await Promise.all([
      orderCollection
        .where(where)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get(),
      orderCollection.where(where).count()
    ])

    const orders = listRes?.data || []
    
    const skuCodes = [...new Set(orders.map(o => String(o.skuCode || '')).filter(Boolean))]
    
    if (skuCodes.length > 0) {
      const skuRes = await skuCollection.where({
        code: dbCmd.in(skuCodes)
      }).field({
        code: true,
        name: true,
        entitlementDays: true
      }).limit(200).get()
      
      const skuMap = new Map((skuRes?.data || []).map(sku => [sku.code, sku]))
      
      orders.forEach(order => {
        const sku = skuMap.get(order.skuCode)
        if (sku) {
          order.skuName = sku.name
          order.skuEntitlementDays = sku.entitlementDays
        }
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      data: orders,
      pagination: {
        page,
        pageSize,
        total: countRes?.total || countRes?.result?.total || 0
      }
    }
  },

  async adminGetOrderStats (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const userCollection = db.collection('uni-id-users')
    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      return {
        errCode: 'permission-denied',
        errMsg: '无权限'
      }
    }

    const [allRes, createdRes, paidRes, cancelledRes, refundedRes] = await Promise.all([
      orderCollection.count(),
      orderCollection.where({ status: 'created' }).count(),
      orderCollection.where({ status: 'paid' }).count(),
      orderCollection.where({ status: 'cancelled' }).count(),
      orderCollection.where({ status: 'refunded' }).count()
    ])

    const total = allRes?.total || 0
    const created = createdRes?.total || 0
    const paid = paidRes?.total || 0
    const cancelled = cancelledRes?.total || 0
    const refunded = refundedRes?.total || 0

    return {
      errCode: 0,
      errMsg: '',
      data: {
        total,
        byStatus: {
          created,
          paid,
          cancelled,
          refunded
        },
        percentages: {
          created: total > 0 ? ((created / total) * 100).toFixed(1) : '0.0',
          paid: total > 0 ? ((paid / total) * 100).toFixed(1) : '0.0',
          cancelled: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0',
          refunded: total > 0 ? ((refunded / total) * 100).toFixed(1) : '0.0'
        }
      }
    }
  }

}
