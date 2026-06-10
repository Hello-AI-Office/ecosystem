'use strict';

// 跟进提醒订阅消息模板（与预约提醒复用同一模板）
const TEMPLATE_ID = 'SknVOGNb64ncj1mntK3PyIyZVfEfXh9Btfwvxc3WpvY';

const pad2 = (n) => String(n).padStart(2, '0');

const formatYmd = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatYmdHm = (ms) => {
  const d = new Date(ms);
  return `${formatYmd(ms)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const getTodayRange = (now) => {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
};

exports.main = async (event = {}, context) => {
  const db = uniCloud.database();
  const cmd = db.command;

  const cusTable = db.collection('spa-cus');
  const msgTable = db.collection('message');
  const userCollection = db.collection('uni-id-users');

  const now = Date.now();

  const dryRun = Boolean(event.dryRun);
  const onlyUid = String(event.uid || '').trim();
  const limit = Math.min(500, Math.max(1, Number(event.limit || 200)));

  // 需要跟进的“挂起”数据：预约日期是今天（且未 sent）
  const { start: todayStart, end: todayEnd } = getTodayRange(now);
  const todayStr = formatYmd(now);

  const where = cmd.and([
    { status: '挂起' },
    cmd.and([{ reserveDate: todayStr }, { reserveStatus: cmd.neq('sent') }])
  ]);

  const finalWhere = onlyUid ? cmd.and([where, { create_by: onlyUid }]) : where;

  const { data } = await cusTable
    .where(finalWhere)
    .field({ _id: true, name: true, type: true, status: true, create_by: true, reserveDate: true, reserveRemindAt: true, updateTime: true })
    .orderBy('updateTime', 'desc')
    .limit(limit)
    .get();

  const list = Array.isArray(data) ? data : [];
  if (!list.length) {
    return { ok: true, dryRun, scanned: 0, sent: 0, now, today: todayStr };
  }

  // build openid map
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

  let sent = 0;
  const results = [];

  for (const item of list) {
    const uid = String(item.create_by || '');
    if (!uid) continue;

    const cusId = String(item._id || '');
    const linkUrl = `/pages/agent/process/detail?id=${encodeURIComponent(cusId)}&kind=${item.type === '增员' ? 'recruit' : 'sales'}`;

    const reserveAt = item.reserveRemindAt ? new Date(item.reserveRemindAt).getTime() : 0;
    const timeText = reserveAt ? formatYmdHm(reserveAt) : (item.reserveDate ? `${item.reserveDate} 18:00` : formatYmdHm(now));

    const title = '跟进提醒';
    const content = `进程已挂起，请及时跟进\n时间：${timeText}\n客户：${String(item.name || '')}`;

    if (!dryRun) {
      try {
        await msgTable.add({
          userId: uid,
          type: 'system',
          title,
          content,
          linkUrl,
          relatedData: { biz: 'spa-suspend-remind', cusId },
          isRead: false,
          createTime: now,
          updateTime: now
        });
      } catch (e) {
        try {
          console.error('[spa-suspend-remind] add message failed:', { uid, cusId, err: e });
        } catch (_) {}
      }

      try {
        const openid = openidMap[uid];
        if (uniSubscribemsg && openid) {
          const page = `pages/agent/process/detail?id=${cusId}&kind=${item.type === '增员' ? 'recruit' : 'sales'}`;
          await uniSubscribemsg.sendSubscribeMessage({
            touser: openid,
            template_id: TEMPLATE_ID,
            page,
            miniprogram_state: 'developer',
            lang: 'zh_CN',
            data: {
              short_thing1: { value: '挂起跟进' },
              time3: { value: timeText },
              thing5: { value: String(item.name || '') }
            }
          });
        } else {
          try {
            console.log('[spa-suspend-remind] skip subscribe message:', {
              uid,
              hasUniSub: !!uniSubscribemsg,
              hasOpenid: !!openid
            });
          } catch (_) {}
        }
      } catch (e) {
        try {
          console.error('[spa-suspend-remind] sendSubscribeMessage failed:', { uid, cusId, templateId: TEMPLATE_ID, err: e });
        } catch (_) {}
      }
    }

    sent += 1;
    results.push({ cus_id: cusId, uid, timeText });
  }

  return { ok: true, dryRun, scanned: list.length, sent, now, today: todayStr, results };
};
