'use strict';

/**
 * Auto suspend spa-cus records that haven't been updated for 14 days.
 * - Sets status to '挂起'
 * - Writes spa-log entry for audit
 */
exports.main = async (event = {}, context) => {
  const db = uniCloud.database();
  const cmd = db.command;

  const cusTable = db.collection('spa-cus');
  const logTable = db.collection('spa-log');

  const now = Date.now();

  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  const threshold = now - twoWeeksMs;

  const dryRun = Boolean(event.dryRun);

  // updateTime 在业务侧有两种写入方式：
  // - schema 的 timestamp（可能存成 Date）
  // - 前端用 Date.now()（存成 number）
  // 因此这里同时兼容 Date 与 number 两种比较。
  const staleUpdateTime = cmd.or([
    { updateTime: cmd.lte(new Date(threshold)) },
    { updateTime: cmd.lte(threshold) }
  ]);

  const whereStaleActive = cmd.and([{ status: '活跃' }, staleUpdateTime]);

  const pageSize = 200;
  let updated = 0;
  let scanned = 0;
  let page = 0;

  while (true) {
    const { data } = await cusTable
      .where(whereStaleActive)
      .field({ _id: true, status: true, updateTime: true, currentNode: true, currentSubNode: true })
      .skip(page * pageSize)
      .limit(pageSize)
      .get();

    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) break;

    scanned += list.length;

    if (!dryRun) {
      const ids = list.map(d => d._id);
      const res = await cusTable.where({ _id: cmd.in(ids) }).update({ status: '挂起' });
      updated += Number(res.updated || 0);

      const logs = list.map(d => ({
        cus_id: d._id,
        previousNodeStatus: '活跃',
        currentNodeStatus: '挂起',
        nodeRemark: '两周未更新自动挂起'
      }));

      if (logs.length) {
        await logTable.add(logs);
      }
    }

    page += 1;
  }

  return {
    ok: true,
    dryRun,
    scanned,
    updated,
    threshold,
    now
  };
};
