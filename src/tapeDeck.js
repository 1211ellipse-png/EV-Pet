/* 磁带舱番茄钟组件（工业音频仪表风，Canvas） */
(() => {
  'use strict';
  const S = { mode: 'idle', remainingMs: 0, totalMs: 0, angle: 0, rewinding: 0, rewStart: 0, rewFrom: 0 };
  const REWIND_MS = 1500;
  function setPomo(p) { if (S.rewinding) return; S.mode = p.mode || 'idle'; S.remainingMs = p.remainingMs || 0; S.totalMs = p.totalMs || 0; }
  function rewind() { if (S.rewinding) return; S.rewinding = 1; S.rewStart = performance.now(); S.rewFrom = S.totalMs > 0 ? S.remainingMs / S.totalMs : 0; }
  function fmt(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function reel(ctx, x, y, R, ratio, angle) {
    const hub = 11, tapeR = hub + Math.max(3, ratio * 34);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(0, 0, tapeR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,42,42,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, tapeR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, 0, hub + i * (tapeR - hub) / 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1;
    const d = tapeR + 6;
    [[-d, -d], [d, -d], [d, d], [-d, d]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy); ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4); ctx.stroke(); });
    ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const a = angle + k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (tapeR - 2), Math.sin(a) * (tapeR - 2)); ctx.stroke(); }
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(0, 0, hub, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.arc(0, 0, hub * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function squareWave(ctx, x, y) {
    ctx.strokeStyle = '#66666e'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x, y + 8); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x + 4, y); ctx.lineTo(x + 9, y); ctx.lineTo(x + 9, y + 8); ctx.lineTo(x + 14, y + 8); ctx.lineTo(x + 14, y); ctx.lineTo(x + 19, y);
    ctx.stroke();
  }
  function statusSlider(ctx, x, y, h, ratio) {
    ctx.strokeStyle = '#26262e'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 6, h);
    const dy = y + h - ratio * h;
    ctx.fillStyle = '#ff2a2a'; ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x + 3, dy, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function tapePath(ctx, lx, rx, cy, R) {
    const gy = cy + R + 16;
    const g1x = lx - 10, g2x = lx + 2, g3x = rx - 2, g4x = rx + 10;
    const mx = (lx + rx) / 2, my = gy;
    ctx.fillStyle = '#1a1a1e'; ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1;
    ctx.fillRect(mx - 16, my - 7, 32, 14); ctx.strokeRect(mx - 16, my - 7, 32, 14);
    ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(lx, cy + R * 0.7); ctx.lineTo(g1x, gy); ctx.lineTo(g2x, gy); ctx.lineTo(mx - 16, my); ctx.lineTo(mx + 16, my); ctx.lineTo(g3x, gy); ctx.lineTo(g4x, gy); ctx.lineTo(rx, cy + R * 0.7);
    ctx.stroke();
    [[g1x, gy], [g2x, gy], [g3x, gy], [g4x, gy]].forEach(([gx, gyy]) => { ctx.strokeStyle = '#66666e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(gx, gyy, 4, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#0a0a0c'; ctx.fill(); });
  }
  function transfer(ctx, lx, rx, cy, ratio) {
    const mx = (lx + rx) / 2, my = cy;
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1; ctx.fillStyle = '#66666e';
    ctx.beginPath(); ctx.moveTo(mx - 22, my); ctx.lineTo(mx + 22, my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + 22, my); ctx.lineTo(mx + 15, my - 4); ctx.lineTo(mx + 15, my + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mx - 22, my); ctx.lineTo(mx - 15, my - 4); ctx.lineTo(mx - 15, my + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0e0e0'; ctx.font = '10px Consolas,monospace'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(ratio * 100) + '%', mx, my + 18);
  }
  function bottomScale(ctx, W, y) {
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = 24 + i * ((W - 48) / 10); const hh = i % 5 === 0 ? 7 : 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + hh); ctx.stroke(); }
  }
  function progressBar(ctx, W, y, ratio) {
    const x0 = 24, w = W - 48, h = 10;
    // 上层白灰长条
    ctx.fillStyle = '#d8d8dc'; rr(ctx, x0, y + 10, w, h, 2); ctx.fill();
    // 下层：暗蓝底 + 鲜红容量
    ctx.fillStyle = '#1a2a3a'; rr(ctx, x0, y + 24, w, h, 2); ctx.fill();
    ctx.fillStyle = '#ff2a2a'; rr(ctx, x0, y + 24, w * ratio, h, 2); ctx.fill();
    // 游标白竖线
    const cx = x0 + w * ratio;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y + 6); ctx.lineTo(cx, y + 38); ctx.stroke();
  }

  function draw(canvas, now) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const ratio = S.totalMs > 0 ? Math.max(0, Math.min(1, S.remainingMs / S.totalMs)) : 0;
    if ((S.mode === 'work' || S.mode === 'break') && !S.rewinding) S.angle += 0.015 + (1 - ratio) * 0.05;
    if (S.rewinding) {
      const p = Math.min(1, (now - S.rewStart) / REWIND_MS);
      S.remainingMs = (S.rewFrom + (1 - S.rewFrom) * p) * S.totalMs;
      S.angle -= 0.5 * (1 - p);
      if (p >= 1) { S.rewinding = 0; S.remainingMs = S.totalMs; }
    }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, W, H);
    rr(ctx, 3, 3, W - 6, H - 6, 10); ctx.fillStyle = '#121215'; ctx.fill();
    rr(ctx, 3, 3, W - 6, H - 6, 10); ctx.strokeStyle = '#26262e'; ctx.lineWidth = 1; ctx.stroke();

    const active = S.mode === 'work' || S.mode === 'break' || S.mode === 'paused';
    const lowPower = S.mode === 'break';

    // 顶部：方波图标（左）+ 时间码（中）+ 状态滑条（右）
    squareWave(ctx, 16, 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0e0e0'; ctx.font = '600 28px "Segoe UI",sans-serif'; ctx.letterSpacing = '1px';
    ctx.fillText(active ? fmt(S.remainingMs) : '--:--', W / 2, 40);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#66666e'; ctx.font = '8px Consolas,monospace';
    ctx.fillText(S.mode === 'work' ? 'FOCUS' : S.mode === 'break' ? 'BREAK' : S.mode === 'paused' ? 'PAUSED' : 'STANDBY', W / 2, 54);
    // 时间码下方微型刻度
    ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 12; i++) { const x = W / 2 - 40 + i * (80 / 12); ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 60 + (i % 3 === 0 ? 4 : 2)); ctx.stroke(); }
    statusSlider(ctx, W - 20, 14, 52, ratio);

    // 中心：双轮盘 + 磁带路径 + 传输箭头
    const cy = H * 0.56;
    const lx = W * 0.30, rx = W * 0.70;
    const R = Math.min(W * 0.135, 44);
    tapePath(ctx, lx, rx, cy, R);
    reel(ctx, lx, cy, R, ratio, S.angle);
    reel(ctx, rx, cy, R, 1 - ratio, -S.angle);
    transfer(ctx, lx, rx, cy, ratio);

    // 底部：多节点刻度 + 双层进度条
    const by = H - 50;
    bottomScale(ctx, W, by);
    progressBar(ctx, W, by, ratio);
    ctx.textAlign = 'left';
  }

  window.tapeDeck = { setPomo, rewind, draw };
})();
