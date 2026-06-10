'use strict';

// Reserve remind template
const TEMPLATE_ID = 'SknVOGNb64ncj1mntK3PyIyZVfEfXh9Btfwvxc3WpvY';

const formatYmdHm = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const buildRemindAtForDate = (dateStr) => {
  const s = String(dateStr || '').trim();
  if (!s) return 0;
  const ms = new Date(`${s} 18:00:00`).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

exports.main = async (event = {}, context) => {
  const db = uniCloud.database();
  const cmd = db.command;

  const cusTable = db.collection('spa-cus');
  const msgTable = db.collection('message');

  const now = Date.now();

  // allow dry run
  const dryRun = Boolean(event.dryRun);
  const onlyUid = String(event.uid || '');
  const limit = Math.min(500, Math.max(1, Number(event.limit || 200)));

  const where = cmd.and([
    { reserveStatus: 'scheduled' },
    cmd.or([
      { reserveRemindAt: cmd.lte(now) },
      cmd.and([{ reserveRemindAt: cmd.exists(false) }, { reserveDate: cmd.exists(true) }]),
      cmd.and([{ reserveRemindAt: cmd.eq(null) }, { reserveDate: cmd.exists(true) }])
    ])
  ]);

  const finalWhere = onlyUid ? cmd.and([where, { create_by: onlyUid }]) : where;

  const { data: dueList } = await cusTable
    .where(finalWhere)
    .field({ _id: true, name: true, type: true, status: true, create_by: true, reserveDate: true, reserveRemindAt: true })
    .orderBy('reserveRemindAt', 'asc')
    .limit(limit)
    .get();

  let list = Array.isArray(dueList) ? dueList : [];

  // 兼容：如果旧数据没有 reserveRemindAt，则用 reserveDate 计算 18:00
  list = list
    .map((it) => {
      if (it && !it.reserveRemindAt && it.reserveDate) {
        const ms = buildRemindAtForDate(it.reserveDate);
        return ms ? { ...it, reserveRemindAt: ms } : it;
      }
      return it;
    })
    .filter((it) => {
      const ms = it?.reserveRemindAt ? new Date(it.reserveRemindAt).getTime() : 0;
      return ms && ms <= now;
    });
  if (!list.length) {
    return { ok: true, dryRun, scanned: 0, sent: 0, now };
  }

  const results = [];
  let sent = 0;

  // subscribe message client-side permission is one-time; only try server send if user has openid
  const userCollection = db.collection('uni-id-users');
  const openidMap = {};
  if (!dryRun) {
    const uids = Array.from(new Set(list.map((it) => String(it.create_by || '')).filter(Boolean)));
    if (uids.length) {
      const { data: userList } = await userCollection
        .where({ _id: cmd.in(uids) })
        .field({ _id: true, wx_openid: true })
        .limit(uids.length)
        .get();

      (Array.isArray(userList) ? userList : []).forEach((u) => {
        const uid = String(u?._id || '');
        const mpOpenid = u?.wx_openid?.mp;
        if (uid && mpOpenid) openidMap[uid] = String(mpOpenid);
      });
    }
  }

  let uniSubscribemsg;
  if (!dryRun) {
    try {
      const UniSubscribemsg = require('uni-subscribemsg');
      uniSubscribemsg = new UniSubscribemsg({ dcloudAppid: '__UNI__AAC7819', provider: 'weixin-mp' });
    } catch (e) {
      uniSubscribemsg = null;
    }
  }

  for (const item of list) {
    const uid = String(item.create_by || '');
    if (!uid) continue;

    const remindAtMs = new Date(item.reserveRemindAt).getTime();
    const timeText = remindAtMs ? formatYmdHm(remindAtMs) : (item.reserveDate ? `${item.reserveDate} 18:00` : '');

    const title = '预约提醒';
    const content = `进程预约需要跟进\n预约时间：${timeText}\n客户：${String(item.name || '')}`;
    const linkUrl = `/pages/agent/process/detail?id=${encodeURIComponent(String(item._id || ''))}&kind=${item.type === '增员' ? 'recruit' : 'sales'}`;

    if (!dryRun) {
      // 站内消息：必达
      try {
        await msgTable.add({
          userId: uid,
          type: 'system',
          title,
          content,
          linkUrl,
          relatedData: {},
          isRead: false,
          createTime: now,
          updateTime: now
        });
      } catch (e) {
        // keep going
      }

      // 标记已发送
      try {
        await cusTable.doc(item._id).update({ reserveStatus: 'sent', reserveSentAt: now, updateTime: now });
      } catch (e) {}

      // 订阅消息：用户同意订阅才会成功发送（一次性）。失败不影响站内消息必达。
      try {
        const openid = openidMap[uid];
        if (uniSubscribemsg && openid) {
          const page = `pages/agent/process/detail?id=${String(item._id || '')}&kind=${item.type === '增员' ? 'recruit' : 'sales'}`;
          await uniSubscribemsg.sendSubscribeMessage({
            touser: openid,
            template_id: TEMPLATE_ID,
            page,
            miniprogram_state: 'developer',
            lang: 'zh_CN',
            data: {
              short_thing1: { value: '进程预约' },
              time3: { value: timeText },
              thing5: { value: String(item.name || '') }
            }
          });
        } else {
          try {
            console.log('[spa-reserve-remind] skip subscribe message:', {
              uid,
              hasUniSub: !!uniSubscribemsg,
              hasOpenid: !!openid
            });
          } catch (_) {}
        }
      } catch (e) {
        try {
          console.error('[spa-reserve-remind] sendSubscribeMessage failed:', {
            uid,
            templateId: TEMPLATE_ID,
            err: e
          });
        } catch (_) {}
      }
    }

    sent += 1;
    results.push({ cus_id: item._id, uid, timeText });
  }

  return { ok: true, dryRun, scanned: list.length, sent, now, results };
};
