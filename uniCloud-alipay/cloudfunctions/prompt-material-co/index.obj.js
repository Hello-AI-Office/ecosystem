const uniID = require('uni-id-common')
const db = uniCloud.database()

const materialsTable = db.collection('xuanshang-materials')

async function getCurrentUid (context) {
  try {
    const clientInfo = context.getClientInfo()
    const token = context.getUniIdToken()
    if (!token) return ''
    const uniIdIns = uniID.createInstance({ clientInfo })
    const tokenRes = await uniIdIns.checkToken(token)
    return tokenRes && tokenRes.uid ? tokenRes.uid : ''
  } catch (e) {
    return ''
  }
}

function fail (errCode, errMsg) {
  return { errCode, errMsg }
}

function ok (data) {
  return { errCode: 0, data }
}

function buildListWhere (uid, payload = {}) {
  const where = { userId: uid }
  const originalFileId = String(payload.originalFileId || '').trim()
  if (originalFileId) {
    where.originalFileId = originalFileId
    return where
  }

  const pickerSlot = String(payload.pickerSlotType || '').trim()
  const filter = pickerSlot === 'scene' || pickerSlot === 'image'
    ? pickerSlot
    : String(payload.filter || 'all').trim()

  if (filter === 'scene') where.type = 'scene'
  else if (filter === 'image' || filter === 'other') where.type = 'image'
  return where
}

async function assertOwnMaterial (uid, id) {
  const materialId = String(id || '').trim()
  if (!materialId) return { ok: false, res: fail('INVALID_PARAM', '素材 ID 无效') }

  const { data } = await materialsTable.doc(materialId).get()
  const doc = data && data[0]
  if (!doc) return { ok: false, res: fail('NOT_FOUND', '素材不存在') }
  if (String(doc.userId || '') !== uid) {
    return { ok: false, res: fail('PERMISSION_ERROR', '无权操作该素材') }
  }
  return { ok: true, doc }
}

module.exports = {
  /** 分页列表（服务端鉴权，不依赖客户端 DB Schema） */
  async listMaterials (payload = {}) {
    const uid = await getCurrentUid(this)
    if (!uid) return fail('uni-id-check-token-failed', '请先登录')

    const where = buildListWhere(uid, payload)
    const originalFileId = String(payload.originalFileId || '').trim()
    const skip = Math.max(0, Number(payload.skip) || 0)
    const limit = Math.min(50, Math.max(1, Number(payload.limit) || 10))

    let query = materialsTable.where(where).orderBy('createTime', 'desc')
    if (originalFileId) {
      query = query.limit(1)
    } else {
      query = query.skip(skip).limit(limit)
    }

    const { data } = await query.get()
    return ok(data || [])
  },

  async getMaterial (payload = {}) {
    const uid = await getCurrentUid(this)
    if (!uid) return fail('uni-id-check-token-failed', '请先登录')

    const check = await assertOwnMaterial(uid, payload.id)
    if (!check.ok) return check.res
    return ok(check.doc)
  },

  async addMaterial (payload = {}) {
    const uid = await getCurrentUid(this)
    if (!uid) return fail('uni-id-check-token-failed', '请先登录')

    const type = String(payload.type || '').trim()
    const originalFileId = String(payload.originalFileId || '').trim()
    const originalFileName = String(payload.originalFileName || '').trim()
    if (!type || !originalFileId) {
      return fail('INVALID_PARAM', 'type / originalFileId 不能为空')
    }
    if (!['image', 'scene'].includes(type)) {
      return fail('INVALID_PARAM', 'type 仅支持 image / scene')
    }

    const now = Date.now()
    const addRes = await materialsTable.add({
      userId: uid,
      type,
      originalFileId,
      originalFileName,
      status: String(payload.status || 'pending').trim() || 'pending',
      createTime: now,
      updateTime: now
    })

    const id = addRes.id || addRes._id
    if (!id) return fail('DB_ERROR', '素材入库失败')
    return ok({ id: String(id) })
  },

  async updateMaterial (payload = {}) {
    const uid = await getCurrentUid(this)
    if (!uid) return fail('uni-id-check-token-failed', '请先登录')

    const check = await assertOwnMaterial(uid, payload.id)
    if (!check.ok) return check.res

    const patch = { updateTime: Date.now() }
    if (payload.prompt !== undefined) patch.prompt = String(payload.prompt || '')
    if (payload.status !== undefined) patch.status = String(payload.status || '').trim()

    await materialsTable.doc(String(payload.id)).update(patch)
    return ok({ id: String(payload.id) })
  },

  async removeMaterial (payload = {}) {
    const uid = await getCurrentUid(this)
    if (!uid) return fail('uni-id-check-token-failed', '请先登录')

    const check = await assertOwnMaterial(uid, payload.id)
    if (!check.ok) return check.res

    await materialsTable.doc(String(payload.id)).remove()
    return ok({ id: String(payload.id) })
  }
}
