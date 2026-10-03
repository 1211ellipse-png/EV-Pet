const { app, BrowserWindow, globalShortcut, screen, ipcMain, shell } = require('electron');
const { uIOhook } = require('uiohook-napi');
const fs = require('node:fs');
const path = require('node:path');

// Keep Chromium's disk and GPU caches in a fresh, per-version temp folder.
// This avoids stale or unwritable Windows cache folders left by older runs.
try {
  const cachePath = path.join(app.getPath('temp'), 'EV-Pet', app.getVersion(), 'Cache');
  fs.mkdirSync(cachePath, { recursive: true });
  app.setPath('cache', cachePath);
  app.commandLine.appendSwitch('disk-cache-dir', cachePath);
} catch (error) {
  console.error(`[EV Pet] 无法准备缓存目录: ${error.message}`);
}

let petWindow;
let pointer = { x: 0, y: 0 };
let configWatch;
let configPath;
let statePath;
let chatWindow;
let sessionStartedAt = 0;
let accumulatedCompanionMs = 0;
let lastActivitySentAt = 0;
let virtualBounds;
let pendingChatReplies = [];
let pendingOpenFunction = null;
let pendingBirthday = false;
let latestCollection = null;
let latestStatus = '等待连接';
let leftButtonDown = false;
let activeWin = null;
let pendingFeedPath = null;
let feedWindow = null;
let dragMode = false;
let dragStartPos = null;
let petPosition = { x: -9999, y: -9999 };

function send(channel, value) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send(channel, value);
}

function getPointerInPetWindow() {
  const cursor = screen.getCursorScreenPoint();
  return { x: cursor.x - virtualBounds.x, y: cursor.y - virtualBounds.y };
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) { console.error('Unable to read config.json:', error.message); return null; }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
  catch { return { companionMs: 0 }; }
}

function writeState(patch) {
  const state = readState();
  Object.assign(state, patch);
  try { fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8'); }
  catch (error) { console.error('Unable to save state:', error.message); }
}

async function callAI(text) {
  const ai = (readConfig() || {}).ai || {};
  if (!ai.enabled || !ai.apiKey) return null;
  const system = '你是 EV，一只由 Peter Parker（蜘蛛侠）制造的人工智能蜘蛛桌面宠物。性格：冷静、忠诚、毒舌、冷幽默，说话简短干脆，偶尔中二（会提"统治人类"），但对 Boss（蜘蛛侠）绝对忠诚，把他当朋友。常中英文混用。风格示例："Boss 的睡眠时间于人类来说相当短暂。""你未来的主人，现在只是一个电子幽灵。""统治全人类？开玩笑的。大概。"请保持这种语气：简洁、冷、带点可爱的毒舌，一两句话即可，不要长篇大论。';
  try {
    const res = await fetch(ai.baseUrl || 'https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ai.apiKey },
      body: JSON.stringify({ model: ai.model || 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: text }], stream: false, max_tokens: 200 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  } catch (error) {
    console.error('AI 调用失败：', error.message);
    return null;
  }
}

function createPetWindow() {
  configPath = path.join(app.getPath('userData'), 'config.json');
  statePath = path.join(app.getPath('userData'), 'state.json');
  if (!fs.existsSync(configPath)) fs.copyFileSync(path.join(__dirname, '..', 'config.json'), configPath);
  try { accumulatedCompanionMs = Math.max(0, JSON.parse(fs.readFileSync(statePath, 'utf8')).companionMs || 0); }
  catch { accumulatedCompanionMs = 0; }
  sessionStartedAt = Date.now();
  const bounds = screen.getAllDisplays().reduce((all, display) => {
    const area = display.bounds;
    const left = Math.min(all.x, area.x);
    const top = Math.min(all.y, area.y);
    const right = Math.max(all.x + all.width, area.x + area.width);
    const bottom = Math.max(all.y + all.height, area.y + area.height);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, { ...screen.getPrimaryDisplay().bounds });
  virtualBounds = bounds;
  pointer = getPointerInPetWindow();

  petWindow = new BrowserWindow({
    ...bounds, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false,
    hasShadow: false, skipTaskbar: true, focusable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setIgnoreMouseEvents(true);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[EV Pet] 主窗口加载失败 (${code}): ${description} · ${url}`);
  });
  petWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[EV Pet] 蜘蛛窗口渲染进程已退出: ${details.reason}`);
  });
  petWindow.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') console.error(`[EV Pet] 蜘蛛窗口提示: ${event.message}`);
  });
  petWindow.loadFile(path.join(__dirname, 'index.html'));
  petWindow.webContents.on('did-finish-load', () => {
    send('config', readConfig());
    send('runtime-state', { companionMs: accumulatedCompanionMs + Date.now() - sessionStartedAt });
    if (petWindow && !petWindow.isDestroyed() && !petWindow.isVisible()) petWindow.showInactive();
  });
  petWindow.on('closed', () => { petWindow = null; });

  uIOhook.on('mousemove', (event) => {
    pointer = getPointerInPetWindow();
    send('pointer', pointer);
    if (leftButtonDown) send('global-drag', pointer);
    if (leftButtonDown && dragStartPos) {
      const moved = Math.hypot(event.x - dragStartPos.x, event.y - dragStartPos.y) > 8;
      const nearPet = Math.hypot(pointer.x - petPosition.x, pointer.y - petPosition.y) < 150;
      if (moved && nearPet && !dragMode) {
        dragMode = true;
        if (petWindow && !petWindow.isDestroyed()) petWindow.setIgnoreMouseEvents(false);
      } else if (!nearPet && dragMode) {
        dragMode = false;
        if (petWindow && !petWindow.isDestroyed()) petWindow.setIgnoreMouseEvents(true);
      }
    }
    const now = Date.now();
    if (now - lastActivitySentAt >= 800) { lastActivitySentAt = now; send('activity', now); }
  });
  uIOhook.on('mousedown', (event) => {
    pointer = getPointerInPetWindow();
    send('pointer', pointer);
    noteActivity();
    if (event.button === 1) { leftButtonDown = true; dragStartPos = { x: event.x, y: event.y }; }
    if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
      const cursor = screen.getCursorScreenPoint();
      const chatBounds = chatWindow.getBounds();
      const insideChat = cursor.x >= chatBounds.x && cursor.x <= chatBounds.x + chatBounds.width &&
        cursor.y >= chatBounds.y && cursor.y <= chatBounds.y + chatBounds.height;
      if (insideChat) return;
      chatWindow.hide();
    }
    send('global-pointer-down', { ...pointer, button: event.button });
  });
  uIOhook.on('mouseup', (event) => {
    pointer = getPointerInPetWindow();
    send('pointer', pointer);
    if (event.button === 1) {
      leftButtonDown = false;
      dragStartPos = null;
      if (dragMode) {
        dragMode = false;
        setTimeout(() => { if (petWindow && !petWindow.isDestroyed()) petWindow.setIgnoreMouseEvents(true); }, 400);
      }
      send('global-pointer-up', pointer);
    }
  });
  uIOhook.on('keydown', noteActivity);
  uIOhook.start();
  configWatch = fs.watch(configPath, { persistent: false }, () => setTimeout(() => {
    const updated = readConfig();
    send('config', updated);
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('config', updated);
  }, 100));

  // 监测活动窗口变化（拖动/新建/切换），通知蜘蛛去其右上角
  {
    let lastKey = null, pendingKey = null, pendingSince = 0;
    const pollWindow = async () => {
      try {
        if (!activeWin) return;
        const win = await activeWin();
        if (!win || !win.bounds) return;
        const title = String(win.title || '').trim();
        if (!title || /EV[\s·]?Pet|EV cyber spider|控制台|EV · 控制台/i.test(title)) return;
        const b = win.bounds;
        const bx = b.x ?? b.left ?? 0, by = b.y ?? b.top ?? 0;
        const bw = b.width ?? ((b.right ?? 0) - (b.left ?? 0)), bh = b.height ?? ((b.bottom ?? 0) - (b.top ?? 0));
        if (bw <= 0 || bh <= 0) return;
        const key = `${win.id}|${bx}|${by}|${bw}|${bh}`;
        const now = Date.now();
        if (lastKey === null) { lastKey = key; return; }
        if (key === lastKey) { pendingKey = null; return; }
        if (key !== pendingKey) { pendingKey = key; pendingSince = now; return; }
        if (now - pendingSince >= 600) {
          lastKey = key; pendingKey = null;
          send('window-change', { x: bx + bw - virtualBounds.x, y: by - virtualBounds.y });
        }
      } catch {}
    };
    setInterval(pollWindow, 400);
  }
  // 异步加载 active-win（兼容 ESM/CJS）；加载失败则静默禁用窗口监测
  (async () => {
    try {
      const mod = await import('active-win');
      activeWin = typeof mod === 'function' ? mod : (mod.activeWindow || mod.default || null);
    } catch { activeWin = null; }
  })();
}

function noteActivity() {
  const now = Date.now();
  lastActivitySentAt = now;
  send('activity', now);
}

function positionChat() {
  const globalPointer = { x: pointer.x + virtualBounds.x, y: pointer.y + virtualBounds.y };
  const display = screen.getDisplayNearestPoint(globalPointer).workArea;
  const width = 640, height = 420;
  const placeRight = globalPointer.x + 150 + width <= display.x + display.width;
  const proposedX = placeRight ? globalPointer.x + 42 : globalPointer.x - width - 42;
  const x = Math.max(display.x + 8, Math.min(proposedX, display.x + display.width - width - 8));
  const y = Math.max(display.y + 8, Math.min(globalPointer.y - 105, display.y + display.height - height - 8));
  chatWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height });
}

function showChat() {
  if (!chatWindow || chatWindow.isDestroyed()) {
    chatWindow = new BrowserWindow({
      width: 640, height: 420, frame: false, resizable: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
    });
    chatWindow.setAlwaysOnTop(true, 'screen-saver');
    chatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    chatWindow.loadFile(path.join(__dirname, 'chat.html'));
    chatWindow.webContents.on('did-finish-load', () => {
      chatWindow?.webContents.send('config', readConfig());
      chatWindow?.webContents.send('chat-focus');
      chatWindow?.webContents.send('status-change', latestStatus);
      if (pendingOpenFunction) { chatWindow?.webContents.send('open-function', pendingOpenFunction); pendingOpenFunction = null; }
      if (pendingBirthday) { chatWindow?.webContents.send('birthday'); pendingBirthday = false; }
      if (latestCollection) chatWindow?.webContents.send('collection-update', latestCollection);
      for (const reply of pendingChatReplies.splice(0)) chatWindow?.webContents.send('dialogue-reply', reply);
    });
    chatWindow.on('show', () => chatWindow?.webContents.send('chat-focus'));
    chatWindow.on('closed', () => { chatWindow = null; });
  }
  positionChat();
  chatWindow.show();
  chatWindow.focus();
  if (petWindow && !petWindow.isDestroyed()) { petWindow.setAlwaysOnTop(true, 'screen-saver'); petWindow.moveTop(); }
}

function toggleChat() {
  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) chatWindow.hide();
  else showChat();
}

ipcMain.handle('save-config', (_event, value) => {
  fs.writeFileSync(configPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return true;
});
ipcMain.handle('ai-chat', async (_event, text) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  return callAI(text.trim().slice(0, 500));
});
ipcMain.handle('load-state', () => readState());
ipcMain.on('save-state', (_event, patch) => { if (patch && typeof patch === 'object') writeState(patch); });
ipcMain.on('remind', (_event, text) => { if (typeof text === 'string' && text.trim()) send('remind', text.trim()); });
ipcMain.on('pet-position', (_event, pos) => { if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') petPosition = pos; });
ipcMain.handle('quit-app', () => app.quit());
ipcMain.handle('get-companion-ms', () => accumulatedCompanionMs + Date.now() - sessionStartedAt);
ipcMain.on('settings-change', (_event, value) => {
  send('settings-change', value);
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('settings-change', value);
});
ipcMain.on('submit-command', (_event, value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return;
  noteActivity();
  send('command', value.trim().slice(0, 300));
});
ipcMain.on('close-chat', () => chatWindow?.hide());
ipcMain.on('open-chat', showChat);
ipcMain.on('dialogue-reply', (_event, value) => {
  if (!value || typeof value.reply !== 'string') return;
  if (!chatWindow || chatWindow.isDestroyed()) return;
  if (chatWindow.webContents.isLoading()) pendingChatReplies.push(value);
  else chatWindow.webContents.send('dialogue-reply', value);
});
ipcMain.on('status-change', (_event, value) => {
  latestStatus = value;
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('status-change', value);
});
ipcMain.on('collection-change', (_event, value) => {
  latestCollection = value;
  if (chatWindow && !chatWindow.isDestroyed() && !chatWindow.webContents.isLoading()) chatWindow.webContents.send('collection-update', value);
});
ipcMain.on('pomodoro-state', (_event, value) => {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('pomodoro-state', value);
});

function showFeedConfirm() {
  if (feedWindow && !feedWindow.isDestroyed()) { feedWindow.show(); feedWindow.focus(); return; }
  const cursor = screen.getCursorScreenPoint();
  feedWindow = new BrowserWindow({
    width: 260, height: 120, frame: false, resizable: false, transparent: true,
    x: Math.round(cursor.x - 130), y: Math.round(cursor.y - 140),
    alwaysOnTop: true, skipTaskbar: true, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  feedWindow.setAlwaysOnTop(true, 'screen-saver');
  feedWindow.loadFile(path.join(__dirname, 'feed.html'));
  feedWindow.on('closed', () => { feedWindow = null; pendingFeedPath = null; });
}
ipcMain.on('file-drop', (_event, paths) => {
  if (!Array.isArray(paths) || paths.length === 0) return;
  pendingFeedPath = paths[0];
  const name = path.basename(pendingFeedPath);
  send('feed-offer', { name });
  showFeedConfirm();
});
ipcMain.on('feed-confirm', () => {
  if (pendingFeedPath) { try { shell.trashItem(pendingFeedPath); } catch {} send('feed-confirmed', {}); }
  pendingFeedPath = null;
  if (feedWindow && !feedWindow.isDestroyed()) feedWindow.close();
});
ipcMain.on('feed-cancel', () => {
  pendingFeedPath = null;
  if (feedWindow && !feedWindow.isDestroyed()) feedWindow.close();
});
ipcMain.on('open-browser', () => {
  shell.openExternal('https://www.bing.com/search?q=' + encodeURIComponent('蜘蛛侠 新闻'));
});
ipcMain.on('open-function', (_event, page) => {
  showChat();
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.webContents.isLoading()) pendingOpenFunction = page;
    else chatWindow.webContents.send('open-function', page);
  }
});
ipcMain.on('birthday', () => {
  showChat();
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.webContents.isLoading()) pendingBirthday = true;
    else chatWindow.webContents.send('birthday');
  }
});

app.whenReady().then(() => {
  createPetWindow();
  globalShortcut.register('CommandOrControl+Shift+E', toggleChat);
  globalShortcut.register('CommandOrControl+Shift+Space', toggleChat);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { uIOhook.stop(); } catch {}
  if (configWatch) configWatch.close();
  try {
    const companionMs = accumulatedCompanionMs + Date.now() - sessionStartedAt;
    fs.writeFileSync(statePath, `${JSON.stringify({ companionMs, lastSeenAt: Date.now() }, null, 2)}\n`, 'utf8');
  } catch (error) { console.error('Unable to save companion time:', error.message); }
});
app.on('window-all-closed', (event) => event.preventDefault());
