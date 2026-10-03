(() => {
  const form=document.querySelector('#chat'),input=document.querySelector('#message'),list=document.querySelector('#message-list');
  const config={motion:{},legs:{},chase:{},behavior:{},persona:{userTitle:''},interaction:{}};
  const pageNames={dialogue:'对话',pomodoro:'番茄钟',settings:'设置',stats:'状态统计',gallery:'图鉴',todo:'待办',play:'一起玩'};
  function setPage(target){
    document.querySelectorAll('[data-page-target]').forEach(item=>item.classList.toggle('active',item.dataset.pageTarget===target));
    document.querySelectorAll('[data-page]').forEach(item=>item.classList.toggle('active',item.dataset.page===target));
    const title=document.querySelector('#chat-page-title');title.textContent=pageNames[target]||'对话';title.dataset.text=title.textContent;
  }
  document.querySelectorAll('[data-page-target]').forEach(item=>item.addEventListener('click',()=>setPage(item.dataset.pageTarget)));
  function appendMessage(text,who){
    const message=document.createElement('div');message.className=`message ${who==='user'?'user-message':'ev-message'}`;message.textContent=text;list.append(message);list.scrollTop=list.scrollHeight;
  }
  function sendCommand(text){if(!text.trim())return;appendMessage(text.trim(),'user');window.evPet?.submitCommand(text.trim());setPage('dialogue');}
  form.addEventListener('submit',event=>{event.preventDefault();sendCommand(input.value);input.value='';input.focus();});
  for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>sendCommand(button.dataset.command));
  function paintSettings(){
    const titleInput=document.querySelector('#chat-user-title');
    if(document.activeElement!==titleInput)titleInput.value=config.persona?.userTitle||'';
    document.querySelector('#chat-work-minutes').value=config.interaction?.pomodoroWorkMinutes??25;
    document.querySelector('#chat-break-minutes').value=config.interaction?.pomodoroBreakMinutes??5;
    document.querySelectorAll('[data-interaction-toggle]').forEach(el=>el.checked=Boolean(config.interaction?.[el.dataset.interactionToggle]));
    document.querySelector('#chat-birthday-month').value=config.persona?.birthday?.month||'';
    document.querySelector('#chat-birthday-day').value=config.persona?.birthday?.day||'';
    document.querySelector('[data-ai-toggle]').checked=Boolean(config.ai?.enabled);
    document.querySelector('#chat-ai-key').value=config.ai?.apiKey||'';
  }
  function applySettings(){window.evPet?.applySettings({persona:config.persona,interaction:config.interaction,ai:{enabled:Boolean(config.ai?.enabled)}});}
  function loadConfig(value){
    if(!value)return;
    Object.assign(config,value);
    config.persona={...(value.persona||{})};config.interaction={...(value.interaction||{})};paintSettings();
  }
  window.evPet?.onConfig(loadConfig);
  window.evPet?.onSettingsChange(value=>{if(value.persona)config.persona={...config.persona,...value.persona};if(value.interaction)config.interaction={...config.interaction,...value.interaction};paintSettings();});
  document.querySelector('#chat-user-title').addEventListener('input',event=>{config.persona.userTitle=event.target.value;applySettings();});
  document.querySelector('#chat-birthday-month').addEventListener('change',event=>{config.persona.birthday={...config.persona.birthday,month:Math.max(0,Math.min(12,Number(event.target.value)||0))};applySettings();});
  document.querySelector('#chat-birthday-day').addEventListener('change',event=>{config.persona.birthday={...config.persona.birthday,day:Math.max(0,Math.min(31,Number(event.target.value)||0))};applySettings();});
  document.querySelector('[data-ai-toggle]').addEventListener('change',e=>{config.ai={...config.ai,enabled:e.target.checked};applySettings();});
  document.querySelector('#chat-ai-key').addEventListener('input',e=>{config.ai={...config.ai,apiKey:e.target.value.trim()};});
  document.querySelector('#chat-work-minutes').addEventListener('change',event=>{config.interaction.pomodoroWorkMinutes=Math.max(5,Math.min(90,Number(event.target.value)||25));paintSettings();applySettings();});
  document.querySelector('#chat-break-minutes').addEventListener('change',event=>{config.interaction.pomodoroBreakMinutes=Math.max(1,Math.min(30,Number(event.target.value)||5));paintSettings();applySettings();});
  document.querySelectorAll('[data-interaction-toggle]').forEach(el=>el.addEventListener('change',()=>{config.interaction[el.dataset.interactionToggle]=el.checked;applySettings();}));
  document.querySelector('#save-chat-settings').addEventListener('click',async()=>{
    await window.evPet?.saveConfig(config);applySettings();document.querySelector('#chat-saved').textContent='已保存，下次启动生效。';
    setTimeout(()=>document.querySelector('#chat-saved').textContent='修改即时生效。',2200);
  });
  window.evPet?.onDialogueReply(value=>{if(value?.reply)appendMessage(value.reply,'ev');});
  function updateStatus(value){
    document.querySelector('#chat-status').textContent=value;
    document.querySelector('#chat-stats-status').textContent=value;
    const mode=value.includes('POMODORO')?'专注中':value.includes('BREAK')?'休息中':value.includes('NAP')?'打盹':value.includes('NEARBY')?'靠近光标':value.includes('CHASE')?'跟随光标':value.includes('STARTLE')?'受惊':'待机';
    const pe=document.querySelector('#chat-pomo-status');if(pe)pe.textContent=mode;document.querySelector('#chat-stats-pomo').textContent=mode;
  }
  window.evPet?.onStatus(updateStatus);
  function updateCompanionTime(){window.evPet?.getCompanionMs().then(ms=>{const mins=Math.floor(ms/60000),days=Math.floor(mins/1440),hours=Math.floor(mins/60)%24;document.querySelector('#chat-companion-time').textContent=`${days?`${days} 天 `:''}${hours} 小时 ${mins%60} 分钟`;}).catch(()=>{});}
  updateCompanionTime();setInterval(updateCompanionTime,60000);
  function close(){window.evPet?.closeChat();}
  document.querySelector('#close').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  window.evPet?.onChatFocus(()=>{setPage('dialogue');input.focus();});
  window.evPet?.onOpenFunction(page=>{setPage(page);if(page==='dialogue')input.focus();});
  const CAT_NAMES={peterDaily:'日常习惯',peterMood:'心情',peterFriends:'朋友',peterHumor:'冷幽默'};
  const LETTER_FALLBACK='嘿。\n\nE.V. 让我写这封信。我是蜘蛛侠，anyway，你怎么叫我都行。我也确实有很多话想对你说，未曾蒙面的朋友，感谢你的支持与关心。\n\n过去的日子里发生了不少事啊？对吧？\n\nE.V. 老说我该多休息，其实她自己也是个工作狂。你们俩大概挺合得来。\n\n忙碌与美丽仍然是纽约的声音，我仍然无法比此刻更爱这座城市了。祝你一切都好，未曾蒙面的朋友。\n\n谢谢你陪她。\n\n—— P.\n\n（P.S. 她要是又提什么"统治全人类"，别当真。她开玩笑的。大概。）';
  let collection=null,letterBurned=false,burning=false,forwardShown=false;
  function paintGallery(){
    const el=document.querySelector('#gallery');if(!el)return;
    if(!collection){el.innerHTML='<p class="interaction-help">还没收集到彼得的碎片。去和她聊聊 Boss 吧。</p>';document.getElementById('letter-envelope').hidden=true;return;}
    const arch=collection.archive||[];
    let html='<div class="archive-grid">';
    for(let i=0;i<9;i++){
      const a=arch[i];
      if(a&&a.unlocked)html+=`<button class="archive-slot unlocked" data-idx="${i}">${a.title}</button>`;
      else html+=`<button class="archive-slot locked" disabled>🔒 DATA ENCRYPTED</button>`;
    }
    html+='</div>';
    const all=[];
    for(const key of ['peterDaily','peterMood','peterFriends','peterHumor']){
      const c=collection.categories?.[key];if(!c)continue;
      for(const t of (c.collected||[]))all.push(t);
    }
    html+='<div class="archive-slips">';
    for(const t of all)html+=`<div class="slip">${t}</div>`;
    for(const tease of (collection.teases||[]))html+=`<div class="slip tease">💬 ${tease}</div>`;
    html+='</div>';
    html+=`<div class="archive-progress">ARCHIVE PROGRESS: ${collection.slotsUnlocked||0}/9</div>`;
    const gifts=collection.gifts||[];
    if(gifts.length){
      html+='<div class="group-title" style="margin-top:10px">EV 的礼物</div><div class="archive-grid">';
      gifts.forEach((g,gi)=>html+=`<button class="archive-slot unlocked gift" data-gift="${gi}">🎁 ${g.title}</button>`);
      html+='</div>';
    }
    el.innerHTML=html;
    el.querySelectorAll('.archive-slot.unlocked').forEach(b=>b.addEventListener('click',()=>openArchive(Number(b.dataset.idx))));
    el.querySelectorAll('.archive-slot.gift').forEach(b=>b.addEventListener('click',()=>{
      const g=collection.gifts?.[Number(b.dataset.gift)];if(!g)return;
      document.getElementById('archive-detail-title').textContent=g.title;
      document.getElementById('archive-detail-note').textContent=g.note;
      document.getElementById('archive-detail-ev').textContent='E.V.：'+g.ev;
      document.getElementById('archive-detail').hidden=false;
    }));
    document.getElementById('letter-envelope').hidden=!(collection.letterUnlocked&&!letterBurned);
  }
  function openArchive(idx){
    const a=collection?.archive?.[idx];if(!a)return;
    document.getElementById('archive-detail-title').textContent=a.title;
    document.getElementById('archive-detail-note').textContent=a.note;
    document.getElementById('archive-detail-ev').textContent='E.V.：'+a.ev;
    document.getElementById('archive-detail').hidden=false;
  }
  document.getElementById('archive-detail-close').addEventListener('click',()=>{document.getElementById('archive-detail').hidden=true;});
  function openLetter(){
    const canvas=document.getElementById('letter-canvas');
    window.letterBurn.render(canvas, collection?.letter||LETTER_FALLBACK);
    document.getElementById('letter-read').hidden=false;
    document.getElementById('letter-modal').hidden=false;
  }
  function showForwardLook(){
    if(forwardShown)return;forwardShown=true;
    window.letterBurn.forwardLook(document.getElementById('forward-canvas'));
  }
  function readLetter(){
    document.getElementById('letter-read').hidden=true;
    burning=true;
    window.letterBurn.burn(document.getElementById('letter-canvas'), ()=>{
      burning=false;
      letterBurned=true;
      document.getElementById('letter-modal').hidden=true;
      document.getElementById('letter-envelope').hidden=true;
      document.getElementById('brand-new-day').hidden=false;
    });
  }
  document.getElementById('letter-open').addEventListener('click',openLetter);
  document.getElementById('letter-read').addEventListener('click',readLetter);
  document.getElementById('letter-modal').addEventListener('pointerdown',()=>{if(burning)showForwardLook();});
  window.evPet?.onCollectionUpdate(v=>{collection=v;paintGallery();});
  // 一起玩
  for(const b of document.querySelectorAll('[data-play]'))b.addEventListener('click',()=>{
    const p=b.dataset.play;
    if(p==='laser')window.evPet?.submitCommand('激光');
    else if(p==='spin')window.evPet?.submitCommand('转个圈');
    else if(p==='web')window.evPet?.submitCommand('织个网');
    else if(p==='turtle')window.evPet?.submitCommand('海龟汤');
    else if(p==='swing')window.evPet?.submitCommand('荡丝');
    setPage('dialogue');
  });
  // 待办
  let todos=[];
  function persistTodos(){window.evPet?.saveState({todos});}
  function paintTodos(){
    const el=document.getElementById('todo-list');if(!el)return;
    el.innerHTML=todos.map((t,i)=>{
      const rl=t.remindAt&&!t.fired?`<span class="todo-time">⏰ ${new Date(t.remindAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`:'';
      return `<div class="todo-item${t.done?' done':''}"><input type="checkbox" data-tc="${i}" ${t.done?'checked':''}><span>${t.text}</span>${rl}<button data-td="${i}">×</button></div>`;
    }).join('')||'<p class="interaction-help">还没有待办。输入内容，可设"分钟后提醒"。</p>';
    el.querySelectorAll('[data-tc]').forEach(c=>c.addEventListener('change',()=>{todos[Number(c.dataset.tc)].done=c.checked;paintTodos();persistTodos();}));
    el.querySelectorAll('[data-td]').forEach(b=>b.addEventListener('click',()=>{todos.splice(Number(b.dataset.td),1);paintTodos();persistTodos();}));
  }
  function addTodo(){
    const v=document.getElementById('todo-input').value.trim();if(!v)return;
    const m=Number(document.getElementById('todo-minutes').value)||0;
    todos.push({text:v,done:false,remindAt:m>0?Date.now()+m*60000:0,fired:false});
    document.getElementById('todo-input').value='';document.getElementById('todo-minutes').value='';
    paintTodos();persistTodos();
  }
  document.getElementById('todo-add').addEventListener('click',addTodo);
  document.getElementById('todo-input').addEventListener('keydown',e=>{if(e.key==='Enter')addTodo();});
  setInterval(()=>{
    const now=Date.now();
    for(const t of todos){
      if(t.remindAt&&!t.done&&!t.fired&&now>=t.remindAt){
        t.fired=true;
        appendMessage('⏰ 提醒：'+t.text,'ev');
        window.evPet?.remind('提醒：'+t.text);
        persistTodos();
      }
    }
  },1000);
  window.evPet?.loadState().then(s=>{if(s&&Array.isArray(s.todos)){todos=s.todos;paintTodos();}});
  paintTodos();
  // 生日信
  const BIRTHDAY_LETTER='嘿，生日快乐。\n\n我没什么能送你的，就借 E.V. 转达一句：生日快乐。\n\n希望你今天过得不错。\n\n—— P.';
  window.evPet?.onBirthday(()=>{document.getElementById('birthday-body').textContent=BIRTHDAY_LETTER;document.getElementById('birthday-modal').hidden=false;});
  document.getElementById('birthday-close').addEventListener('click',()=>{document.getElementById('birthday-modal').hidden=true;});
  // 磁带舱番茄钟
  const tapeCanvas=document.querySelector('#tape-canvas');
  if(tapeCanvas&&window.tapeDeck){
    let pomo={mode:'idle',remainingMs:0,totalMs:0},prevMode='idle';
    function tapeButton(){
      const b=document.getElementById('tape-play');
      b.textContent=pomo.mode==='work'||pomo.mode==='break'?'▮▮ 暂停':pomo.mode==='paused'?'▶ 继续':'▶ 开始';
    }
    window.evPet?.onPomodoroState(v=>{
      prevMode=pomo.mode;
      pomo=v||{mode:'idle',remainingMs:0,totalMs:0};
      window.tapeDeck.setPomo(pomo);
      if(prevMode!==pomo.mode&&(pomo.mode==='break'||pomo.mode==='idle'))window.tapeDeck.rewind();
      tapeButton();
    });
    document.getElementById('tape-play').addEventListener('click',()=>{
      if(pomo.mode==='work'||pomo.mode==='break')window.evPet?.submitCommand('暂停计时');
      else if(pomo.mode==='paused')window.evPet?.submitCommand('继续计时');
      else window.evPet?.submitCommand('开始番茄钟');
    });
    document.getElementById('tape-rewind').addEventListener('click',()=>{
      window.tapeDeck.rewind();window.evPet?.submitCommand('停止番茄钟');
    });
    (function loop(now){window.tapeDeck.draw(tapeCanvas,now||performance.now());requestAnimationFrame(loop);})(performance.now());
    tapeButton();
  }
})();
