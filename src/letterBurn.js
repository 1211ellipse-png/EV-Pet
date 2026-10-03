/* 像素信件燃烧模块（Canvas 2D 移植自用户的 p5.js/GLSL 逻辑）
 * 暴露 window.letterBurn = { render(canvas, text), burn(canvas, onComplete) }
 */
(() => {
  'use strict';

  // ---------- 噪声（对应 GLSL 的 hash/noise/fbm） ----------
  function fract(x) { return x - Math.floor(x); }
  function hash2(x, y) { return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123); }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    let val = 0, amp = 0.5;
    for (let i = 0; i < 4; i++) { val += amp * vnoise(x, y); x *= 2; y *= 2; amp *= 0.5; }
    return val;
  }

  // ---------- 调色板（对应用户的 BURN_COLOR_PALETTE / ASH_COLOR） ----------
  const PALETTE = [[20, 15, 30], [70, 30, 20], [180, 60, 20], [255, 130, 40], [255, 230, 150]];
  const ASH = [15, 20, 35];
  function mixCol(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---------- 把信件文字渲染到画布 ----------
  function wrapText(ctx, text, maxW) {
    const out = []; let cur = '';
    for (const ch of text) {
      if (ch === '\n') { out.push(cur); cur = ''; continue; }
      if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  function render(canvas, text) {
    const ctx = canvas.getContext('2d');
    const cssW = window.innerWidth || canvas.clientWidth || 800;
    const cssH = window.innerHeight || canvas.clientHeight || 600;
    const scale = Math.min(1, 800 / Math.max(cssW, cssH));
    const W = canvas.width = Math.max(1, Math.round(cssW * scale));
    const H = canvas.height = Math.max(1, Math.round(cssH * scale));

    // 整页深色背景 + 细噪点（让燃烧更有内容）
    ctx.fillStyle = '#0b1218'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = 'rgba(160,200,220,' + (Math.random() * 0.05).toFixed(3) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }

    // 居中信纸
    const paperW = Math.round(W * 0.56), paperH = Math.round(H * 0.82);
    const px = Math.round((W - paperW) / 2), py = Math.round((H - paperH) / 2);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(px + 6, py + 8, paperW, paperH);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(px, py, paperW, paperH);
    ctx.strokeStyle = '#d8cfb8'; ctx.lineWidth = 1; ctx.strokeRect(px + 12, py + 12, paperW - 24, paperH - 24);

    ctx.fillStyle = '#8a7f6a'; ctx.font = Math.round(12 * scale) + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillText('FROM · P.', px + 26, py + 34);
    ctx.fillText('SUBJECT · 给你', px + 26, py + 52);
    ctx.strokeStyle = '#d8cfb8'; ctx.beginPath(); ctx.moveTo(px + 26, py + 64); ctx.lineTo(px + paperW - 26, py + 64); ctx.stroke();

    ctx.fillStyle = '#3a342a'; ctx.font = Math.round(15 * scale) + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    let y = py + 94;
    const maxW = paperW - 52;
    for (const line of (text || '').split('\n')) {
      for (const seg of wrapText(ctx, line, maxW)) {
        ctx.fillText(seg, px + 26, y);
        y += Math.round(24 * scale);
        if (y > py + paperH - 26) break;
      }
      if (y > py + paperH - 26) break;
    }
  }

  // ---------- 主燃烧（对应 shader 的分区逻辑） ----------
  function burn(canvas, onComplete) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const img = ctx.getImageData(0, 0, W, H);
    const src = img.data;
    const imageData = ctx.createImageData(W, H);
    const out = imageData.data;

    // 预计算噪声场（静态，只算一次）
    const noiseField = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      noiseField[y * W + x] = fbm(u * 10, v * 10) * 0.7 + fbm(u * 25 + 8, v * 25 + 8) * 0.3;
    }

    const DURATION = 4500, start = performance.now();

    function frame(now) {
      const t = now - start;
      const linear = Math.min(t / DURATION, 1);
      const radius = linear; // 0 → 1（约 4.5 秒覆盖整封信，对应 burnRadius 增长）

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const dx = (x / W - 0.5) * 1.0, dy = (y / H - 0.5) * 1.2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const bp = dist - noiseField[y * W + x] * 0.22;
          if (bp < radius) {
            // 已烧成灰烬
            out[i] = ASH[0]; out[i + 1] = ASH[1]; out[i + 2] = ASH[2]; out[i + 3] = 255;
          } else if (bp < radius + 0.15) {
            // 火焰边缘（5 色阶梯）
            const f = (bp - radius) / 0.15, m = 1 - f;
            let c;
            if (m < 0.25) c = mixCol(PALETTE[0], PALETTE[1], m / 0.25);
            else if (m < 0.5) c = mixCol(PALETTE[1], PALETTE[2], (m - 0.25) / 0.25);
            else if (m < 0.75) c = mixCol(PALETTE[2], PALETTE[3], (m - 0.5) / 0.25);
            else c = mixCol(PALETTE[3], PALETTE[4], (m - 0.75) / 0.25);
            // 轻微混入底层像素，模拟文字被火炙透
            out[i] = c[0] * 0.8 + src[i] * 0.2;
            out[i + 1] = c[1] * 0.8 + src[i + 1] * 0.2;
            out[i + 2] = c[2] * 0.8 + src[i + 2] * 0.2;
            out[i + 3] = 255;
          } else {
            // 未烧到，保留原样
            out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = src[i + 3];
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);

      if (linear < 1) requestAnimationFrame(frame);
      else if (onComplete) onComplete();
    }
    requestAnimationFrame(frame);
  }

  // ---------- "向前看" 数字雨效果（黑客帝国风格，E.V. 青） ----------
  function forwardLook(canvas) {
    const ctx = canvas.getContext('2d');
    const cssW = window.innerWidth || 800, cssH = window.innerHeight || 600;
    const scale = Math.min(1, 800 / Math.max(cssW, cssH));
    const W = canvas.width = Math.max(1, Math.round(cssW * scale));
    const H = canvas.height = Math.max(1, Math.round(cssH * scale));
    const colW = Math.round(16 * scale) + 1;
    const cols = Math.ceil(W / colW);
    const drops = new Array(cols).fill(0).map(() => Math.floor(Math.random() * -H));
    const speeds = new Array(cols).fill(0).map(() => (3 + Math.random() * 5) * scale);
    const DURATION = 3200, start = performance.now();

    function frame(now) {
      const t = now - start;
      const p = Math.min(t / DURATION, 1);
      const fadeIn = Math.min(p / 0.18, 1);
      const fadeOut = p > 0.72 ? Math.max(0, (1 - p) / 0.28) : 1;
      const alpha = Math.min(fadeIn, fadeOut);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(8,12,18,' + (0.55 * alpha).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);

      ctx.font = Math.round(15 * scale) + 'px monospace';
      for (let i = 0; i < cols; i++) {
        const x = i * colW, y = drops[i];
        ctx.fillStyle = 'rgba(190,255,255,' + alpha.toFixed(3) + ')';
        ctx.fillText(Math.random() < 0.5 ? '0' : '1', x, y);
        for (let k = 1; k <= 9; k++) {
          const a = alpha * (1 - k / 10) * 0.75;
          if (a > 0.01) {
            ctx.fillStyle = 'rgba(53,224,255,' + a.toFixed(3) + ')';
            ctx.fillText(Math.random() < 0.5 ? '0' : '1', x, y - k * colW);
          }
        }
        drops[i] += speeds[i];
        if (drops[i] > H + 20) drops[i] = Math.floor(Math.random() * -40);
      }

      const tp = Math.max(0, (p - 0.16) / 0.42);
      const tA = alpha * Math.min(tp, 1);
      if (tA > 0.01) {
        const blur = Math.max(0, (1 - tp) * 14);
        ctx.save();
        ctx.globalAlpha = tA;
        ctx.filter = 'blur(' + blur.toFixed(1) + 'px)';
        ctx.font = '600 ' + Math.round(50 * scale) + 'px "Segoe UI","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e8fbff';
        ctx.shadowColor = '#35e0ff'; ctx.shadowBlur = 26;
        ctx.fillText('向前看', W / 2, H / 2);
        ctx.restore();
      }

      if (p < 1) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }

  window.letterBurn = { render, burn, forwardLook };
})();
