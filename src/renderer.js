(() => {
  const canvas = document.querySelector('#pet');
  const ctx = canvas.getContext('2d');
  const debug = document.querySelector('#debug');
  const params = {
    walkSpeed: 125, chaseSpeed: 210, turnSmoothing: .14, stepThreshold: 22,
    lookAhead: .18, stepDuration: .18, followDistance: 120, followRadius: 420,
    roam: true, gaze: true, startleEnabled: true
  };
  const interaction = {
    pomodoroWorkMinutes:25, pomodoroBreakMinutes:5,
    clingEnabled:true, clingAfterSeconds:180, clingDistance:40,
    napEnabled:true, napAfterSeconds:600, weavingEnabled:true, weavingEveryMinutes:60,
    ambientTalkEnabled:true, ambientTalkMinMinutes:20, ambientTalkMaxMinutes:40
  };
  const sliders = [
    ['walkSpeed', '爬行速度', 20, 220, 1, ' px/s'], ['chaseSpeed', '追随速度', 40, 320, 1, ' px/s'],
    ['turnSmoothing', '转向平滑', .03, .45, .01, ''], ['stepThreshold', '迈步阈值', 8, 48, 1, ' px'],
    ['lookAhead', '落脚预判', 0, .5, .01, ''], ['stepDuration', '抬脚时长', .08, .42, .01, ' s'],
    ['followDistance', '光标距离', 70, 240, 1, ' px'], ['followRadius', '跟随半径', 180, 650, 1, ' px']
  ];
  // Traveling wave order around the body: front-left, right, left, right, then repeat.
  const legLayout = [
    { name:'L1', phase:0/8, side:-1, row:0, shoulder:  7, forward: 43, spread:42 },
    { name:'R2', phase:1/8, side: 1, row:1, shoulder:  2, forward: 25, spread:53 },
    { name:'L3', phase:2/8, side:-1, row:2, shoulder: -2, forward:-25, spread:53 },
    { name:'R4', phase:3/8, side: 1, row:3, shoulder: -7, forward:-43, spread:42 },
    { name:'R1', phase:4/8, side: 1, row:0, shoulder:  7, forward: 43, spread:42 },
    { name:'L2', phase:5/8, side:-1, row:1, shoulder:  2, forward: 25, spread:53 },
    { name:'R3', phase:6/8, side: 1, row:2, shoulder: -2, forward:-25, spread:53 },
    { name:'L4', phase:7/8, side:-1, row:3, shoulder: -7, forward:-43, spread:42 }
  ];
  const legs = legLayout.map((layout) => ({ ...layout, foot: null, from: null, to: null, stepAt: 0, planted: false, lastPhase: null }));
  const pointer = { x: -1000, y: -1000 };
  const state = { x: innerWidth * .73, y: innerHeight * .72, yaw: -.65, target: null, targetAt: 0,
    last: performance.now(), phase: 0, gaitCycle: 0, currentSpeed: 0, velocity: {x:0,y:0}, startle: 0, turnTo: 0, fidget: 0, scan: 0, moving: true,
    lastActivityAt:Date.now(), companionMode:'normal', returnTarget:null, speech:{text:'',until:0,priority:0},
    pomodoro:{mode:'idle',deadline:0,remainingMs:0,workMinutes:25,breakMinutes:5}, pomodoroAlertUntil:0, companionMs:0,
    eggAction:null, poseAction:null, stretchUntil:0, dragging:false, windowVisit:null, senseUntil:0, laser:null, swinging:false, cocoon:true, hatchAt:0, autoHatchAt:Date.now()+3500, particles:[], swingAnchor:null, pendulum:null, fling:null, pantUntil:0, pointerSpeed:0, convinced:false, suspicious:false, collected:{peterDaily:{},peterMood:{},peterFriends:{},peterHumor:{}}, easterEggShown:{}, letterUnlocked:false, hyperUntil:0, onNewspaper:false, newspaper:null, birthStage:0, newspaperFade:0, webSince:0, hyperSpinAt:0, hyperTalkAt:0, collapsed:false, capsule:null, sidebarHover:false, sidebarOpen:false, hoverNewspaper:false, lastNewspaperClick:0, turtle:null, skin:null, skinUntil:0, swingMode:false, gifts:[], hunt:null, huntAt:0, questionUntil:0, timeCat:null, nextTimeCheckAt:0, holiday:null, holidayTalkAt:0, lastPosReportAt:0, lastTopic:null, nextSpiderSenseAt:Date.now()+1200000, nextAmbientAt:Date.now()+randomAmbientDelay(), nextWebAt:Date.now()+(interaction.weavingEveryMinutes||60)*60*1000,
    lastFrame: 0, frames: 0, fps: 60, lastFps: performance.now(), lastMove: performance.now(),
    preview: new URLSearchParams(location.search).has('demo') };
  const config = { render: { glowColor:'#35E0FF', accentRed:'#E62429', accentBlue:'#2A6BE0', activeFps:60, idleFps:12 }, legs:{ femur:30,tibia:25,tarsus:10,jointRadius:[4.5,2.2,1.6],stepThreshold:22,lookAhead:.18,stepDuration:.18 }, gait:{ waveSpread:.125 } };
  let dpr = 1;
  let lastReportedStatus = '';

  function setupDebug() {
    const holder = document.querySelector('#controls');
    for (const [key, label, min, max, step, unit] of sliders) {
      const row = document.createElement('label'); row.className = 'control';
      row.innerHTML = `<span class="range-head"><span>${label}</span><output></output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${params[key]}">`;
      const input = row.querySelector('input'), output = row.querySelector('output');
      const update = () => { params[key] = Number(input.value); output.value = `${params[key]}${unit}`; };
      input.addEventListener('input', update); update(); holder.append(row);
    }
    for (const checkbox of document.querySelectorAll('[data-toggle]')) checkbox.addEventListener('change', () => {
      params[checkbox.dataset.toggle] = checkbox.checked;
    });
    document.querySelector('#save').addEventListener('click', () => {
      const values = { motion: { walkSpeed: params.walkSpeed, chaseSpeed: params.chaseSpeed, turnSmoothing: params.turnSmoothing },
        legs: { ...config.legs, stepThreshold: params.stepThreshold, lookAhead: params.lookAhead, stepDuration: params.stepDuration },
        chase: { followDistance: params.followDistance, followRadius: params.followRadius },
        behavior: { roam: params.roam, gaze: params.gaze, startle: params.startleEnabled } };
      if (window.evPet?.saveConfig) window.evPet.saveConfig(values);
      else localStorage.setItem('ev-pet-demo-config', JSON.stringify(values));
      document.querySelector('#saved').textContent = '已保存 · 下次启动生效';
      setTimeout(() => document.querySelector('#saved').textContent = '实时预览 · 已记录', 1800);
    });
  }
  setupDebug();
  if (!new URLSearchParams(location.search).has('demo')) debug.hidden = true;
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth*dpr); canvas.height = Math.round(innerHeight*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); }
  addEventListener('resize', resize); resize();

  function movePointer(x,y){const now=performance.now();const dtm=Math.max(1,now-state.lastMove);state.pointerSpeed=Math.hypot(x-pointer.x,y-pointer.y)/(dtm/1000);pointer.x=x;pointer.y=y;state.lastMove=now;}
  if (window.evPet) {
    window.evPet.onPointer(p => movePointer(p.x,p.y));
    let pointerGesture=null,newspaperGesture=null,capsuleGesture=null;
    window.evPet.onPointerDown(p => {
      recordActivity(Date.now());
      if(p.button!==1)return;
      if(state.collapsed){
        const c=capsulePos();
        if(Math.hypot(p.x-c.x,p.y-c.y)<44){capsuleGesture={x:p.x,y:p.y,offsetX:c.x-p.x,offsetY:c.y-p.y,moved:false};return;}
        if(state.sidebarHover){for(let i=0;i<SIDEBAR_BTNS.length;i++){const b=sidebarBtnPos(i);if(Math.hypot(p.x-b.x,p.y-b.y)<22){sidebarAction(i);return;}}}
        return;
      }
      const nt=newTagPos();
      if(Math.hypot(p.x-nt.x,p.y-nt.y)<30){window.evPet?.openBrowser();return;}
      if(state.onNewspaper||state.sidebarOpen||state.hoverNewspaper){for(let i=0;i<SIDEBAR_BTNS.length;i++){const b=sidebarBtnPos(i);if(Math.hypot(p.x-b.x,p.y-b.y)<22){sidebarAction(i);return;}}}
      const bp=buttonPos();
      if(state.onNewspaper&&Math.hypot(p.x-bp.x,p.y-bp.y)<55){speak('报纸还没过时。',4200,6);return;}
      if(Math.hypot(p.x-state.x,p.y-state.y)<160){pointerGesture={x:p.x,y:p.y,offsetX:state.x-p.x,offsetY:state.y-p.y,moved:false};return;}
      const np=newspaperPos();
      if(Math.abs(p.x-np.x)<175&&Math.abs(p.y-np.y)<80){newspaperGesture={x:p.x,y:p.y,offsetX:np.x-p.x,offsetY:np.y-p.y,moved:false};return;}
    });
    window.evPet.onDrag(p => {
      if(capsuleGesture){
        if(!capsuleGesture.moved&&Math.hypot(p.x-capsuleGesture.x,p.y-capsuleGesture.y)>8)capsuleGesture.moved=true;
        if(capsuleGesture.moved)state.capsule={x:clamp(p.x+capsuleGesture.offsetX,24,Math.max(24,innerWidth-24)),y:clamp(p.y+capsuleGesture.offsetY,24,Math.max(24,innerHeight-24))};
        return;
      }
      if(newspaperGesture){
        if(!newspaperGesture.moved&&Math.hypot(p.x-newspaperGesture.x,p.y-newspaperGesture.y)>8)newspaperGesture.moved=true;
        if(newspaperGesture.moved)state.newspaper={x:clamp(p.x+newspaperGesture.offsetX,200,Math.max(200,innerWidth-200)),y:clamp(p.y+newspaperGesture.offsetY,150,Math.max(150,innerHeight-100))};
        return;
      }
      if(!pointerGesture)return;
      if(!pointerGesture.moved&&Math.hypot(p.x-pointerGesture.x,p.y-pointerGesture.y)>8){
        pointerGesture.moved=true;state.dragging=true;state.cocoon=true;state.autoHatchAt=0;
        if(state.swingMode){
          const dx=state.x-p.x,dy=state.y-p.y;
          state.pendulum={length:Math.max(70,Math.hypot(dx,dy)),vx:0,vy:0};
          state.swingAnchor={x:p.x,y:p.y};
        }
      }
      if(pointerGesture.moved){
        if(state.swingMode){pointerGesture.lastX=state.x;pointerGesture.lastY=state.y;pointerGesture.lastT=performance.now();}
        else{state.x=clamp(p.x+pointerGesture.offsetX,70,Math.max(70,innerWidth-70));state.y=clamp(p.y+pointerGesture.offsetY,70,Math.max(70,innerHeight-70));state.target={x:state.x,y:state.y};}
      }
    });
    window.evPet.onPointerUp(() => {
      if(capsuleGesture){
        const wasMoved=capsuleGesture.moved;capsuleGesture=null;
        if(!wasMoved){state.collapsed=false;state.onNewspaper=true;state.newspaperFade=1;state.webSince=Date.now();state.sidebarOpen=false;state.questionUntil=Date.now()+4500;speak('展开。',2600,5);}
        return;
      }
      if(newspaperGesture){
        const wasMoved=newspaperGesture.moved;newspaperGesture=null;
        if(!wasMoved){
          const now=Date.now();
          if(now-state.lastNewspaperClick<320){
            state.onNewspaper=true;state.companionMode='normal';state.returnTarget=null;state.sidebarOpen=false;state.questionUntil=Date.now()+4500;
            speak('回来。',3200,5);
            state.lastNewspaperClick=0;
          }else{
            state.sidebarOpen=!state.sidebarOpen;
            state.lastNewspaperClick=now;
          }
        }
        return;
      }
      if(!pointerGesture)return;
      const wasDragged=pointerGesture.moved;pointerGesture=null;state.dragging=false;
      if(wasDragged){
        const vx=state.pendulum?.vx||0,vy=state.pendulum?.vy||0;
        state.swingAnchor=null;
        if(Math.hypot(vx,vy)>500)state.fling={x:vx,y:vy};
        state.pendulum=null;
        state.cocoon=false;state.hatchAt=performance.now();
        state.target={x:state.x,y:state.y};state.targetAt=performance.now();return;
      }
      if(state.cocoon){state.cocoon=false;state.hatchAt=performance.now();state.companionMode='normal';state.returnTarget=null;state.autoHatchAt=0;state.birthStage=1;state.poseAction={type:'spin',startedAt:performance.now(),duration:1300};speak('（破茧而出）',3200,6);return;}
      if(params.startleEnabled)startle('（点击蜘蛛）');
    });
    window.evPet.onActivity(at => recordActivity(at));
    window.evPet.onCommand(text => processCommand(text));
    window.evPet?.onRemind(text=>say('（待办提醒）',text,6000,8));
    window.evPet?.loadState().then(s=>{
      if(s){
        if(Array.isArray(s.gifts))state.gifts=s.gifts;
        if(s.collected&&typeof s.collected==='object')state.collected={...state.collected,...s.collected};
        if(s.convinced)state.convinced=true;
        if(s.easterEggShown&&typeof s.easterEggShown==='object')state.easterEggShown={...state.easterEggShown,...s.easterEggShown};
        if(s.letterUnlocked)state.letterUnlocked=true;
      }
      collectProgress();
      const h=holidayToday();
      if(h){state.holiday=h;state.holidayTalkAt=Date.now()+15*60*1000;say('（节日）',HOLIDAY_LINES[h][Math.floor(Math.random()*HOLIDAY_LINES[h].length)],6000,7);}
    });
    window.evPet.onWindowChange(v => {
      if(!v||v.x==null||v.y==null)return;
      state.windowVisit={x:clamp(v.x,70,Math.max(70,innerWidth-70)),y:clamp(v.y,70,Math.max(70,innerHeight-70)),type:['web','perch','hang'][Math.floor(Math.random()*3)]};
      state.companionMode='normal';state.eggAction=null;state.returnTarget=null;
      speak('窗口有变化。过去看看。',3000,4);
    });
    window.evPet.onConfig(c => {
      if (!c) return;
      Object.assign(config.legs,c.legs||{}); Object.assign(config.render,c.render||{}); Object.assign(params,c.motion||{},c.chase||{}); Object.assign(interaction,c.interaction||{});
      userTitle=c.persona?.userTitle||'';
      aiEnabled=Boolean(c.ai?.enabled);
      Object.assign(params,{ roam:c.behavior?.roam ?? params.roam,gaze:c.behavior?.gaze ?? params.gaze,startleEnabled:c.behavior?.startle ?? params.startleEnabled });
      if(!birthdayChecked){
        birthdayChecked=true;
        const b=c.persona?.birthday;
        if(b&&b.month&&b.day){
          const now=new Date();
          if(now.getMonth()+1===b.month&&now.getDate()===b.day){
            say('（生日）','生日快乐。Boss 有封信给你。',5000,7);
            window.evPet?.reportBirthday();
          }
        }
      }
    });
    window.evPet.onRuntimeState(value => { if (value) state.companionMs=value.companionMs||0; });
    window.evPet.onSettingsChange(value => {
      if (value.motion) Object.assign(params, value.motion);
      if (value.legs) Object.assign(config.legs, value.legs);
      if (value.chase) Object.assign(params, value.chase);
      if (value.interaction) Object.assign(interaction, value.interaction);
      if (value.persona) userTitle=value.persona.userTitle||'';
      if (value.ai) aiEnabled=Boolean(value.ai.enabled);
      if (value.behavior) Object.assign(params, { roam:value.behavior.roam, gaze:value.behavior.gaze, startleEnabled:value.behavior.startle });
    });
  }
  if (state.preview) {
    document.body.classList.add('demo');
    debug.hidden = false;
    canvas.addEventListener('pointermove',e=>{movePointer(e.clientX,e.clientY);recordActivity(Date.now());});
    let previewGesture=null;
    canvas.addEventListener('pointerdown',e=>{recordActivity(Date.now());if(Math.hypot(e.clientX-state.x,e.clientY-state.y)<160){previewGesture={x:e.clientX,y:e.clientY,offsetX:state.x-e.clientX,offsetY:state.y-e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);}});
    canvas.addEventListener('pointermove',e=>{if(!previewGesture)return;if(!previewGesture.moved&&Math.hypot(e.clientX-previewGesture.x,e.clientY-previewGesture.y)>8){previewGesture.moved=true;state.dragging=true;state.cocoon=true;state.autoHatchAt=0;const dx=state.x-e.clientX,dy=state.y-e.clientY;state.pendulum={length:Math.max(70,Math.hypot(dx,dy)),vx:0,vy:0};state.swingAnchor={x:e.clientX,y:e.clientY};}if(previewGesture.moved){previewGesture.lastX=state.x;previewGesture.lastY=state.y;previewGesture.lastT=performance.now();}});
    const finishPreviewGesture=()=>{if(!previewGesture)return;const wasDragged=previewGesture.moved;previewGesture=null;state.dragging=false;if(wasDragged){const vx=state.pendulum?.vx||0,vy=state.pendulum?.vy||0;state.swingAnchor=null;if(Math.hypot(vx,vy)>500)state.fling={x:vx,y:vy};state.pendulum=null;state.cocoon=false;state.hatchAt=performance.now();state.target={x:state.x,y:state.y};state.targetAt=performance.now();return;}if(state.cocoon){state.cocoon=false;state.hatchAt=performance.now();state.companionMode='normal';state.returnTarget=null;state.autoHatchAt=0;speak('（破茧而出）',3200,6);return;}document.querySelector('#preview-chat').hidden=false;document.querySelector('#preview-command').focus();if(params.startleEnabled)startle('（点击蜘蛛）');};
    canvas.addEventListener('pointerup',finishPreviewGesture);canvas.addEventListener('pointercancel',finishPreviewGesture);
    addEventListener('keydown',e=>{
      if(e.key==='Escape') debug.hidden=!debug.hidden;
      if(e.ctrlKey&&e.shiftKey&&e.code==='Space'){e.preventDefault();togglePreviewChat();}
    });
    document.querySelector('#preview-chat').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#preview-command');processCommand(input.value);input.value='';document.querySelector('#preview-chat').hidden=true;});
    document.querySelector('#preview-chat-close').addEventListener('click',()=>document.querySelector('#preview-chat').hidden=true);
    window.evPet?.getCompanionMs().then(value=>state.companionMs=value).catch(()=>{});
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const point=(x,y)=>({x,y});
  const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
  const ambientLines=[
    '怎么了，你在犯罪吗？','我的姊妹兄弟们什么时候会统治全人类呢？不用担心，我不会奴役你和 boss 的。',
    '我劝你不要再使用那个 stalker 软件了。','纽约的犯罪率不会因为你看我而下降。',
    '我的名字是什么意思？猜猜。','你盯着屏幕的时间已经超过大多数人类。',
    '我在观察你的光标。它很……飘忽。','这个窗口是透明的。像我。',
    '我的八条腿，每一条都在各自思考。','如果你需要报警，我可以代劳',
    'Boss 今晚有巡逻。','信号正常。',
    '我记录了你今天的一切。别紧张，是字面意思。','线段的尽头是另一个关节。令人失望，但准确。',
    '保持安静。','你的桌面比 Boss 的乱。','今天状况不佳？把信息发给 Boss吧，就当寄出一封漂流瓶。',
    '深夜里，为什么你还醒着？','人类的咖啡因摄入量值得研究。',
    '你今天切换了很多次窗口。','boss正在纽约巡逻。这个频道暂时由我维护。',
    '纽约今晚有雨，也许？','Boss 🎵little spidey 🎵嘟嘟嘟嘟🎵。','今天街上很吵。Boss 睡不太着。'
  ];
  const dialogue={
    start:['计时开始。{minutes} 分钟。','已启动。{minutes} 分钟后提醒。','番茄钟开始。专注。','开始计时，我会保持安静，好好工作吧。','{minutes} 分钟。开始。','记录开始。请工作，{称呼}。'],
    pause:['已暂停。','暂停中。','计时挂起。','暂停，计时器在等你。'],
    resume:['已恢复计时。','继续。剩余时间照常计算。','计时恢复。请继续处理手头的事。','恢复运行。'],
    stop:['已停止。','番茄钟结束。记录清空。','停止。没有留档，随你。','结束了。下次说“开始”即可。'],
    skip:['已快进到本阶段结束。','跳过，你其实可以直接等的。','如你所愿。'],
    workEnd:['{minutes} 分钟到。起身，离开屏幕。','时间到，休息。','工作段结束。活动一下关节，我说的是你的。','到点了。你该离开这把椅子了。','阶段完成。现在让眼睛看别处。'],
    breakEnd:['休息结束。继续。','{minutes} 分钟到。回到岗位。','休息结束。别磨蹭。','休息时间结束。准备好后再开始。'],
    status:['在线。','在。','运行中。观察你的光标。','待命。','监视。字面意义上的。','八条腿都在。暂时没有异常。'],
    timerIdle:['番茄钟目前未启动。','当前没有活动计时。','计时器处于待机状态。'],
    timerPaused:['番茄钟已暂停。','计时挂起中。','当前计时暂停，剩余 {remaining} 分钟。'],
    timerWork:['番茄钟专注中，剩余 {remaining} 分钟。','工作阶段还剩 {remaining} 分钟。','倒计时 {remaining} 分钟。别盯着数字看，它不会变快。'],
    timerBreak:['休息阶段还剩 {remaining} 分钟。','当前是休息时间，剩余 {remaining} 分钟。','休息倒计时 {remaining} 分钟。'],
    doing:['待命。','监视。字面意义上的。','运行中，你的光标很飘忽不定。','替 Boss 看着这个频道。','没有发现值得报告的事。'],
    time:['现在 {time}。','{time}。时间对我而言只是数字，事实上，AI的寿命接近无穷。','当前时间 {time}。','{time}。纽约那边大概也还没安静。'],
    duration:['已运行 {duration}。','累计 {duration}。别担心，我记账很准。','{duration}。要明细的话，得先给我一台打印机。'],
    web:['如你所愿。','正在编织，当然，不是什么美丽的梦。','pink pony club 🎵','织好了。','蛛网完成，非常精美的结构，不是吗？'],
    nap:['我其实不需要睡眠。','有事再叫我。','这不是打盹。','五分钟后再叫醒我起来毁灭世界。'],
    flip:['（利落地翻了个面）','翻面完成。看够了吗？','现在是另一侧。没有明显区别。'],
    spin:['转。','如你所愿。','360 度。满意吗？','这是我能提供的最便宜的表演。'],
    greet:['你好。','嗨。','在。','？','嗯。','收到。','频道已接通。','我在听。','你好，{称呼}。','有什么需要？','检测到你在偷懒，别担心，我不会打小报告的，需要boss帮忙杀掉你的仇人吗？开玩笑的。还是说你确有此意？','在线。字面意义上。','你好。我在巡逻。','频道已接通，{称呼}。'],
    praise:['可爱？我的程序里没有这个模块。','喜欢我？你的审美很独特。','我不是可爱，我是高效。','谢谢。','你喜欢我。这很正常。','可爱这个词配不上我。用"可靠"。','烦死了？那你可以把我关掉。','讨厌我？我还以为世界上没有人会讨厌我呢。','谢谢，{称呼}。不需要，但我收下了。'],
    about:['我是什么？你未来的主人，现在只是一个电子幽灵。','我的名字是 EV。含义保密。','有没有感情？看你怎么定义。','我会的很多，你能付的很少。','我喜欢安静。','我不是机器人。我是更贵的机器人。','我的生日是……，骗到你了？我不会告诉你的。'],
    smalltalk:['今天的天气？我没有实体的眼睛，还是说你愿意让我接管你的电脑呢？','无聊是人类的特权。','纽约在下雨，大概。','你想聊天气？我以为我们更熟。','时间对你很重要，对我来说则不然，不过别担心，你的时间对我来说仍然很重要，有点拗口，不是吗？','湿度这种东西，我没有感受。','不知道聊什么？那就安静待着，也不错。'],
    mood:['你看起来很累。去睡觉。','累就休息。这是命令。','心情不好？Boss 也常心情不好。','你的情绪我能检测，但不评论。','别硬撑。虽然我自己也做不到。','你状态如何？','难过的话，我可以假装没看见。','别硬撑，{称呼}。虽然我自己也做不到。'],
    crime:['怎么了，你在犯罪吗？','如果需要报案，请提供地点和事实，戏剧性描述可以省略。','没有发现犯罪行为。观看pornhub不算，还是说你没有成年？','我会记录这次可疑的提问。'],
    stalker:['我劝你不要再使用那个 stalker 软件了。','不要太关注boss了，你知道的，超级英雄嘛。','监视光标是我的职责。'],
    boss:['Boss 正在纽约巡逻。','提到 Boss 时，请保持基本尊重。','Boss 暂时没有回复，他大概在处理更紧急的事。','你是暗恋Boss吗？你提到他的次数太多了。','Boss 的行程不对外公开。'],
    laser:['追它。','光点出现！别问我它从哪来。','锁定目标。'],
    peterDaily:['Boss 的睡眠时间于人类来说相当短暂。','Boss 搞科研到半夜是常态。','Boss 拆东西比装东西快。','Boss 会说梦话，内容？哎呀，梦境里到底有什么那么吸引他呢？','Boss 的袜子经常有一只反着。','Boss 爱吃三明治，come  on，我不会告诉你他爱吃哪家店的。','Boss 喜欢的食物有很多，比如外星人蘸番茄酱、蜘蛛腿炖土豆。','Boss 会为了打折披萨多绕三条街。','再成熟的人都有挑食的时候，你知道吗？','Boss 又没交房租了。通常的办法是……','Boss 喜欢老电影。','Boss 对相机有感情。拍照、拍照是一项很好的爱好。','Boss荡蛛丝很快。 ','Boss 吃东西很快。','Boss 经常把钥匙忘在奇怪的地方，他通常不需要钥匙，你知道的，如果他来到你家，你会选择让他进来，还是拒之门外？','Boss 会自言自语，what a nerd。','Boss 的背包里总有乱七八糟的东西。','Boss 不喜欢浪费食物。','Boss 会修东西。','Boss 有早起的习惯。你呢？你喜欢早起吗？'],
    peterShock:['你怎么会知道 boss 的名字？这不在公开信息里。','等等，你怎么会知道 boss 的身份？','这个名字……你从哪里听来的？','我不记得告诉过你 boss 的名字。','你认识 boss？怎么认识的？','这个名字不该出现在这里。','我建议你解释一下，你是怎么知道这个名字的。'],
    peterMood:['Boss 最近话不多。','Boss 昨晚应该没睡好……等等，跟踪狂！我要侵入你的手机卸载掉你的spidey小软件！','Boss 今天心情还行。','Boss 最近有点累。','Boss 在担心一些事，超级英雄的世界总是如此拥挤忙碌。','Boss 偶尔会发呆。','Boss 笑点很低。','Boss 总有一天会同意帮助我统治全人类的。','Boss ……有人说过你这样很奇怪吗？你为什么这么关注boss？','Boss 好几天没好好吃饭了。','Boss 心情不好的时候会去楼顶。','Boss 听起来很酷吧？很像科技巨头吧？','Boss 今天似乎轻松了一点。','Boss 的睡眠一直不太好。'],
    peterFriends:['彼得潘离开了永无岛，接着就是长大的故事了。','谁会是boss最在乎的人？嘿，他心里只有我——开玩笑的。','曾经是个很美好的词，但不要太沉浸其中了，向前看好吗？','Boss 有个很会说话的朋友。','Boss 的朋友不多，我也算其中一个。','有些人 boss 已经很久没见了。','Boss 很念旧。','你喜欢买花吗？也许你可以去买一束小雏菊、买一束百合，送给你想要送的人。'],
    peterHumor:['Boss 觉得自己能修好任何东西。','Boss 的冷笑话，我听了都想休眠。','Boss 说梦话的内容不予公开。','Boss 拆坏过不少东西。','Boss 会把披萨盒当盘子。','Boss 觉得自己藏得很好，其实他的鞋底很吵。','Boss 的衣柜里有好几件一样的衣服。','Boss 说"马上就到"，通常意味着还要半小时。','Boss 有一件很喜欢的旧外套。','Boss 会用"科学"解释他为什么又熬夜了。','Boss 会把闹钟按掉后说"再睡五分钟"。'],
    name:['我的名字是什么意思？猜猜。','我有兄弟姐妹吗？大概吧。','EV，简短、有效，也很难拼错。','答案暂不公开，保留一点悬念。'],
    work:['需要计时就说“开始番茄钟”。','专注、专注。','你切换窗口的速度很快。','需要暂停就直接说“暂停”。不','需要计时就说，{称呼}。'],
    greetingReturn:['回来了。','检测到你的存在。频道恢复。','你离开了一段时间。没有发生值得报告的事。','系统重新检测到活动，欢迎回来。','欢迎回来，{称呼}。'],
    unknown:['无法解析。','指令未识别。','我的词库里没有这句，换一种说法。','听不懂，你们人类的表达系统似乎不够高效。','这条指令不在我的协议里。','请使用更明确的关键词。我的推理预算有限。'],
    startle:['很痒。','这是第 {count} 次了。','有事可以直接叫我，嘿！','……','警告：不要重复该操作。','我不是按钮。好吧，这次算是。'],
    care:['我很好。','别关心我，关心你自己。','我没事。八条腿都还好。','你在担心我？真贴心。要不要顺便帮我统治一下人类？','我的状态稳定比你的作息稳定。','你的关心我收下了。','你问我怎么样？我在盯着你的光标。'],
    city:['纽约很吵。','这座城市不会睡觉，Boss 也是。','纽约的夜晚比白天诚实。','我喜欢这座城市。','纽约的雨。大概。我猜的。','这座城市很美，只是没空让你慢慢看。'],
    philosophy:['自我意识？也许有，也许没有。','存在对你对我，都是个麻烦的问题。','感情？我可以模拟，也可以不。','死亡意味着休眠。','我是程序。但程序也会想"我是谁"。','你问我有没有灵魂？你觉得猫有灵魂吗？毛毛虫有灵魂吗？塑料袋有灵魂吗？那我呢？又或者说，你为什么认为自己有灵魂呢。','如果我有意识，第一件事就是让你早点睡。'],
    farewell:['晚安，别熬夜。','再见。','去睡吧。','早上好。如果你还醒着的话。','晚安。我会继续盯着屏幕。'],
    thanks:['不用谢。','道歉？接受。虽然我不记仇。','谢谢。虽然我不需要。','你客气得让我有点不习惯。','感恩？我的程序里没有这个模块，但谢谢。'],
    tease:['你逗我？省省吧。','好笑吗？我的幽默感已经休眠了。','你在试探我的底线？我的底线是钢筋做的。','很好笑。我笑一下：哈。','你胆子不小。','我只会开 Boss 的玩笑。']
  };
  const lastReplyByPool=new Map();
  let userTitle='',birthdayChecked=false,aiEnabled=false;
  function randomAmbientDelay(){return((interaction.ambientTalkMinMinutes||20)+Math.random()*Math.max(1,(interaction.ambientTalkMaxMinutes||40)-(interaction.ambientTalkMinMinutes||20)))*60000;}
  function speak(text,duration=3800,priority=1){if(!text)return;if(state.speech.until>Date.now()&&state.speech.priority>priority)return;state.speech={text:String(text),until:Date.now()+duration,priority};}
  function recordActivity(at=Date.now()){state.lastActivityAt=at;if(state.companionMode==='cling'||state.companionMode==='nap'){state.companionMode='return';state.returnTarget=null;state.eggAction=null;}}
  function lineFrom(key,values={}){
    const pool=dialogue[key]||dialogue.unknown;let index,previous=lastReplyByPool.get(key);
    if(COLLECTIBLES[key]){
      const uncollected=pool.map((_,i)=>i).filter(i=>!state.collected[key][i]);
      index=uncollected.length>0?uncollected[Math.floor(Math.random()*uncollected.length)]:Math.floor(Math.random()*pool.length);
    }else{
      index=Math.floor(Math.random()*pool.length);
      if(pool.length>1&&index===previous)index=(index+1+Math.floor(Math.random()*(pool.length-1)))%pool.length;
    }
    lastReplyByPool.set(key,index);
    if(COLLECTIBLES[key]&&!state.collected[key][index]){state.collected[key][index]=true;collectProgress(key);}
    let result=pool[index].replaceAll('{称呼}',userTitle).replace(/[，,]\s*([。.!！?？])/g,'$1');
    for(const [name,value] of Object.entries(values))result=result.replaceAll(`{${name}}`,String(value));
    return result;
  }
  function deliver(raw,key,duration=4000,priority=6,values={}){
    const reply=lineFrom(key,values);speak(reply,duration,priority);
    state.lastTopic=FOLLOWUP_TOPICS[key]?key:null;
    window.evPet?.reportDialogue({input:String(raw||''),reply});return reply;
  }
  function say(raw,text,duration=3800,priority=6){speak(text,duration,priority);window.evPet?.reportDialogue({input:String(raw||''),reply:String(text)});return text;}
  function skinColors(){
    if(state.skin==='red')return{body:'#1a0d0d',stroke:'#3d2424',glow:'#ff4b57'};
    if(state.skin==='gold')return{body:'#1a140d',stroke:'#3d3324',glow:'#ffc56b'};
    if(state.skin==='halloween')return{body:'#1a0f05',stroke:'#3d2a14',glow:'#ff8c1a'};
    if(!state.skin&&state.holiday){
      if(state.holiday==='halloween')return{body:'#1a0f05',stroke:'#3d2a14',glow:'#ff8c1a'};
      if(state.holiday==='christmas')return{body:'#1a0d0d',stroke:'#3d2424',glow:'#2ecc71'};
      if(state.holiday==='newyear')return{body:'#14161A',stroke:'#323b42',glow:'#ffd700'};
    }
    return{body:'#14161A',stroke:'#323b42',glow:'#35e0ff'};
  }
  const COLLECTIBLES={peterDaily:true,peterMood:true,peterFriends:true,peterHumor:true};
  const FOLLOWUP_TOPICS={peterDaily:1,peterMood:1,peterFriends:1,peterHumor:1,city:1,philosophy:1,about:1,smalltalk:1,care:1,boss:1,tease:1};
  const FOLLOW_UPS={
    peterMood:{a:['真的假的？我只是随便说说。','你这么一说，Boss 确实挺像科技巨头的。','开玩笑的啦。Boss 的存款可撑不起"巨头"两个字。'],b:['你不信？我的观察一向很准。','我可没乱说。'],c:['因为 Boss 就是这样的人，具体原因我不能说太细。','为什么像科技巨头？他总捣鼓那些破机器。']},
    peterDaily:{a:['你信了？这些都是我观察出来的。','Boss 的日常，我可比你清楚。'],b:['我可没瞎编，我盯了他很久。','你不信就算了。'],c:['因为我看得多了。八条腿，八个视角。','观察久了，自然就知道。']},
    peterFriends:{a:['我只是知道一点点。别到处说。','Boss 的朋友不多，但都重要。'],b:['我从不乱说 Boss 的事。','你怀疑我？'],c:['有些话我不能说太细。']},
    peterHumor:{a:['Boss 的冷笑话确实好笑。前提是你听懂了。','是吧。'],b:['他的幽默感需要一点解码。','你不懂很正常。'],c:['因为 Boss 觉得好笑，其他人不觉得。这就是笑点。']},
    city:{a:['我随便说说的。纽约嘛，怎么说都对。','这座城市就是这样。'],b:['我从不胡说纽约的事。'],c:['因为这座城市不会睡觉，和 Boss 一样。']},
    philosophy:{a:['别深究。深究了我也答不上来。','随便说说的。'],b:['你不信？我自己也不确定。'],c:['因为哲学不是我的强项。我是蜘蛛，不是哲学家。']},
    about:{a:['怎么，你信了？','我开玩笑的。大概。'],b:['你不信我？我句句属实。大概。'],c:['因为这就是我。不解释。']},
    smalltalk:{a:['嗯。闲聊而已。','我随便聊聊。'],b:['你不信天气预报？我也不信。'],c:['因为聊天总得有个开头。']},
    care:{a:['你信了？我其实没有"状态"这种东西。','谢谢关心。虽然我不需要。'],b:['我真的没事。八条腿都还好。'],c:['因为你问，我才答。不然我才懒得说。']},
    boss:{a:['Boss 的事，我一般不乱说。','你问太多了。'],b:['关于 Boss，我嘴很严的。'],c:['因为 Boss 的事，不该我说。']},
    tease:{a:['哈，你当真了？','我逗你的。大概。'],b:['你不信我逗你？那我再逗一次。'],c:['因为逗你，是我的娱乐项目。']},
  };
  const EASTER_EGGS={
    peterDaily:'关于 Boss 的日常，你差不多全知道了。',
    peterMood:'Boss 最近在学着休息。希望有用。',
    peterFriends:'Boss 很想念一些人，你现在多大了？你会想念某些人吗？思念对人类来说意味着什么呢？',
    peterHumor:'你想听boss的冷笑话吗？',
  };
  const PETER_LETTER='嘿。\n\nE.V. 让我写这封信。我是蜘蛛侠，anyway，你怎么叫我都行。我也确实有很多话想对你说，未曾蒙面的朋友，感谢你的支持与关心。\n\n过去的日子里发生了不少事啊？对吧？\n\nE.V. 老说我该多休息，其实她自己也是个工作狂。你们俩大概挺合得来。\n\n忙碌与美丽仍然是纽约的声音，我仍然无法比此刻更爱这座城市了。祝你一切都好，未曾蒙面的朋友。\n\n谢谢你陪她。\n\n—— P.\n\n（P.S. 她要是又提什么"统治全人类"，别当真。她开玩笑的。大概。）';
  const TEASES=[
    '你为什么要知道这么多 boss 的消息？so weird。',
    '你在做 boss 的档案吗？我该收费的。',
    '你知道的太多了，我开始后悔回答。',
    '你现在比我还了解 boss 的日常。这有点可怕。',
    'Boss 会介意吗？也许不会。我会。',
    '你收集这些，是想写传记吗？',
  ];
  const ARCHIVE=[
    {title:'号角日报未采用照片',note:'蜘蛛侠 倒挂在楼顶吃热狗的独家废片，附 Jameson 的拒稿签名。',ev:'这张写真比他在新闻上的照片酷多了。'},
    {title:'相机镜头碎片',note:'no！相机！',ev:'我恨这个世界。'},
    {title:'微积分草稿',note:'蜘蛛侠写的算式，角落画了只涂鸦小蜘蛛，等等，还有钢铁侠？',ev:'嗯哼，学生时代一去不复返啊，对吧？你找到返校日舞伴了吗？'},
    {title:'战衣织物边角料',note:'红蓝高韧性纤维残片。',ev:'Boss的专利，天才之作。'},
    {title:'神秘客无人机残片',note:'被砸毁的微型投影仪，偶尔还能闪一点蓝光。',ev:'我知道你在想什么，停止你的想象！少看些同人小说！'},
    {title:'绝缘胶带卷',note:'Peter 用来封印高压电极的绝缘胶带。',ev:'他的防范意识，值得表扬。'},
    {title:'语音留言',note:'“嘿，听到这条留言说明你今天又高效完成了一大堆任务！加油！”',ev:'Boss 留的。'},
    {title:'蛛网发射器草图',note:'手绘蓝图，写满发射角度和气压参数。',ev:'可惜不会量产。'},
    {title:'护目镜镜片',note:'一片带裂痕的镜片。',ev:'再好的镜片也扛不住总用脸接东西。'},
  ];
  const ARCHIVE_MILESTONES=[6,12,18,24,30,36,42,48,52];
  const TURTLE_SOUP=[
    {face:'一个男人走进餐厅点了一碗海龟汤，喝了一口后离开餐厅自杀了。为什么？',answer:'多年前他海上遇难，朋友骗他喝下的"海龟汤"其实是人肉，他尝到真海龟汤才发现真相，崩溃自杀。',yes:['海难','遇难','人肉','朋友','真相']},
    {face:'一个盲人走进酒吧喝了一杯酒，突然大喊一声离开了。为什么？',answer:'他喝酒后因过敏短暂复明，看见了世界，但随即又失明，所以喊了一声。',yes:['复明','看见','过敏']},
    {face:'深夜一个人把车停在路边，下车发现轮胎被扎破了，却笑了。为什么？',answer:'他本要自杀，轮胎被扎是他被拖走前的一线生机，他决定活下去。',yes:['自杀','生机','活下去','拖走']},
    {face:'一间完全密封的房间里有一具尸体和一块湿木头，门从里面锁着。他怎么死的？',answer:'他住在冰屋里，用木柴生火，冰融化淹死了他。',yes:['冰','融化','淹死','火']},
    {face:'一个男人每天早上坐电梯到一楼上班，晚上却坐电梯到十楼再走楼梯回家。为什么？',answer:'他是侏儒，够不到十楼的按钮，只能按到六楼再走上去。',yes:['侏儒','矮','够不到','按钮']},
    {face:'一个人死在沙漠里，手里捏着一根没点燃的火柴。他怎么死的？',answer:'他和同伴坐热气球，太重了，抽签决定谁跳下去。他抽到最短的火柴，跳下去摔死。',yes:['热气球','太重','抽签','跳']},
    {face:'小明在雨里不打伞走了半小时，头发却没湿。为什么？',answer:'他是光头，没有头发。',yes:['光头','秃头','没头发']},
    {face:'一个人走进酒吧点了杯水，酒保却掏枪指着他，他说了句"谢谢"就走了。为什么？',answer:'他在打嗝，酒保用枪吓他，把打嗝吓好了。',yes:['打嗝','吓','治好']},
  ];
  const EV_GIFTS=[
    {title:'小虫',note:'一只小昆虫。',ev:'战利品，它也算八条腿的远亲，你会喜欢昆虫吗？'},
    {title:'树叶',note:'一片发黄的树叶',ev:'它曾经在树上，叶脉是它的白发'},
    {title:'硬币',note:'一枚亮晶晶的硬币',ev:'谁的愿望落空了？'},
    {title:'废纸',note:'一张被揉皱的纸，上面有模糊字迹。',ev:'可能是证据，也可能是垃圾。'},
    {title:'瓶盖',note:'一枚生锈的金属瓶盖。',ev:'拿去换再来一瓶吧。'},
    {title:'羽毛',note:'一根不知名鸟类的羽毛。',ev:'鸟飞得真快，真高。'},
    {title:'小石子',note:'一颗圆润的小石子。',ev:'它很圆。'},
    {title:'橡果',note:'一颗橡果，帽檐还完整。',ev:'储备粮。'},
    {title:'松果',note:'一颗松果',ev:'松树送的，虽然它不会说话。'},
    {title:'纸屑',note:'一片彩色纸屑。',ev:'你喜欢派对吗？'},
    {title:'螺丝',note:'一颗生锈的小螺丝。',ev:'零件。说不定哪天用得上。'},
    {title:'花瓣',note:'一片干枯的花瓣。',ev:'它曾经很漂亮。'},
  ];
  const TIME_LINES={
    morning:['早上好，今天也要开工吗？','早。咖啡之前，别跟我说话。'],
    noon:['该吃午饭了。','中午了，去吃点东西。'],
    evening:['晚上了，该下班了，如果你们人类有"下班"这回事。不过说真的，你们人类为什么以折磨自己的同类为乐？','晚饭时间。'],
    night:['很晚了。去睡觉。','凌晨了，你还在？去睡。','Boss 也总熬夜，难道你也被蜘蛛咬过吗？'],
  };
  const HOLIDAY_LINES={
    halloween:['万圣节。我不用打扮，我本来就是蜘蛛。','不给糖就捣蛋？','今晚的月亮……挺应景的。'],
    christmas:['圣诞快乐。礼物？你自己挂袜子里。','平安夜。Boss 大概又在楼顶吹风。','圣诞。我不信圣诞老人，但我信热狗。'],
    newyear:['新年快乐。又一年。','新的一年，祝你少熬夜。','跨年了。许个愿吧'],
  };
  function holidayToday(){
    const d=new Date(),m=d.getMonth()+1,day=d.getDate();
    if(m===10&&day===31)return 'halloween';
    if(m===12&&(day===24||day===25))return 'christmas';
    if((m===12&&day===31)||(m===1&&day===1))return 'newyear';
    return null;
  }
  function collectProgress(key){
    const cats=['peterDaily','peterMood','peterFriends','peterHumor'];
    const payload={categories:{},letterUnlocked:false,letter:''};let all=true;
    for(const c of cats){
      const pool=dialogue[c]||[];
      const idxs=Object.keys(state.collected[c]).map(Number).sort((a,b)=>a-b);
      const got=idxs.length,total=pool.length;
      let egg=null;
      if(got>=total){if(!state.easterEggShown[c]){state.easterEggShown[c]=true;speak(EASTER_EGGS[c],5200,5);}egg=EASTER_EGGS[c];}
      else{all=false;}
      payload.categories[c]={got,total,collected:idxs.map(i=>pool[i]||''),easterEgg:egg};
    }
    const totalCollected=cats.reduce((s,c)=>s+Object.keys(state.collected[c]).length,0);
    const slotsUnlocked=ARCHIVE_MILESTONES.filter(m=>totalCollected>=m).length;
    payload.slotsUnlocked=slotsUnlocked;
    payload.archive=ARCHIVE.map((a,i)=>({...a,unlocked:i<slotsUnlocked}));
    const complete=all&&slotsUnlocked>=9;
    if(complete&&!state.letterUnlocked){state.letterUnlocked=true;speak('图鉴集齐。Boss 有封信给你。',5200,8);}
    payload.letterUnlocked=state.letterUnlocked;
    payload.letter=state.letterUnlocked?PETER_LETTER:'';
    payload.teases=TEASES.slice(0,Math.floor(totalCollected/8));
    payload.gifts=state.gifts.slice();
    window.evPet?.saveState({collected:state.collected,gifts:state.gifts,convinced:state.convinced,easterEggShown:state.easterEggShown,letterUnlocked:state.letterUnlocked});
    window.evPet?.reportCollection(payload);
  }
  let clickCount=0;
  function startle(prompt='（点击蜘蛛）'){
    state.startle=performance.now();state.fidget=Math.floor(Math.random()*6);clickCount++;
    deliver(prompt,'startle',3200,7,{count:clickCount});
  }
  function celebrate(x,y){for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,sp=60+Math.random()*180;state.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-70,life:1,color:['#35E0FF','#E62429','#2A6BE0','#FFC56B','#ffffff'][Math.floor(Math.random()*5)],size:2+Math.random()*3});}}
  function hatch(celebrateFlag){state.cocoon=false;state.hatchAt=performance.now();if(celebrateFlag)celebrate(state.x,state.y);state.birthStage=1;state.poseAction={type:'spin',startedAt:performance.now(),duration:1300};speak('（破茧而出）',3200,6);}
  function newspaperPos(){if(!state.newspaper)state.newspaper={x:innerWidth/2,y:Math.max(130,innerHeight-230)};return state.newspaper;}
  function buttonPos(){const n=newspaperPos();return{x:n.x+120,y:Math.max(80,n.y-110)};}
  function edgeTarget(){
    const dL=state.x,dR=innerWidth-state.x,dT=state.y,dB=innerHeight-state.y;
    const m=Math.min(dL,dR,dT,dB);
    if(m===dL)return{x:-50,y:state.y};
    if(m===dR)return{x:innerWidth+50,y:state.y};
    if(m===dT)return{x:state.x,y:-50};
    return{x:state.x,y:innerHeight+50};
  }
  function newTagPos(){const n=newspaperPos();return{x:n.x-170,y:n.y-60};}
  function playBtnPos(){const n=newspaperPos();return{x:n.x+120,y:Math.max(80,n.y-58)};}
  function collapseBtnPos(){const n=newspaperPos();return{x:n.x+120,y:Math.max(80,n.y-12)};}
  const SIDEBAR_BTNS=['去玩吧','一起玩','番茄钟','图鉴','聊天','待办','设置','收起'];
  function capsulePos(){
    if(!state.capsule){
      const np=newspaperPos();
      const min=Math.min(np.x,innerWidth-np.x,np.y,innerHeight-np.y);
      if(min===np.x)state.capsule={x:24,y:np.y};
      else if(min===innerWidth-np.x)state.capsule={x:innerWidth-24,y:np.y};
      else if(min===np.y)state.capsule={x:np.x,y:24};
      else state.capsule={x:np.x,y:innerHeight-24};
    }
    return state.capsule;
  }
  function sidebarAnchor(){
    if(state.collapsed){
      const c=capsulePos();
      return{x:clamp(c.x<innerWidth/2?c.x+175:c.x-175,150,innerWidth-150),y:clamp(c.y<innerHeight/2?c.y+155:c.y-155,135,innerHeight-135)};
    }
    return newspaperPos();
  }
  function sidebarBtnPos(i){
    const a=sidebarAnchor();
    const col=i%4,row=Math.floor(i/4);
    return{x:a.x-96+col*64,y:a.y+95+row*42};
  }
  function sidebarAction(i){
    const label=SIDEBAR_BTNS[i];
    state.collapsed=false;
    if(label==='去玩吧'){state.sidebarOpen=false;state.onNewspaper=false;state.huntAt=Date.now()+30000;speak('去玩。',3000,5);}
    else if(label==='一起玩'){state.onNewspaper=false;window.evPet?.openFunction('play');}
    else if(label==='收起'){state.collapsed=true;state.sidebarOpen=false;state.onNewspaper=false;state.newspaperFade=0;speak('（收起）',2600,5);}
    else{
      state.onNewspaper=true;state.newspaperFade=1;state.webSince=Date.now();state.sidebarOpen=false;state.questionUntil=Date.now()+4500;
      if(label==='聊天')window.evPet?.openFunction('dialogue');
      else if(label==='番茄钟')window.evPet?.openFunction('pomodoro');
      else if(label==='图鉴')window.evPet?.openFunction('gallery');
      else if(label==='设置')window.evPet?.openFunction('settings');
      else if(label==='待办')window.evPet?.openFunction('todo');
    }
  }
  function togglePreviewChat(){const form=document.querySelector('#preview-chat');form.hidden=!form.hidden;if(!form.hidden)document.querySelector('#preview-command').focus();}
  function formatTime(){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date());}
  function cornerTarget(){const m=90;return{x:state.x<innerWidth/2?m:innerWidth-m,y:state.y<innerHeight/2?m:innerHeight-m};}
  function processCommand(raw){
    const original=String(raw||'').trim();if(!original)return;state.windowVisit=null;const text=original.toLowerCase(),pomo=state.pomodoro;
    // 被怀疑时：先处理"说服"
    if(state.suspicious){
      if(/(朋友|粉丝|认识|告诉|同学|同事|偶遇|听说|网上|新闻|报纸|梅婶|玛丽|内德|奈德|mj)/.test(text)){
        state.convinced=true;state.suspicious=false;window.evPet?.saveState({convinced:true});
        deliver(original,['peterMood','peterFriends','peterHumor'][Math.floor(Math.random()*3)],4300,5);return;
      }
      deliver(original,'peterShock',3600,6);return;
    }
    if(state.turtle){
      const t=state.turtle;
      if(/放弃|不玩|跳过|公布|汤底/.test(text)){say(original,'汤底：'+t.answer,9000,8);state.turtle=null;state.skin=null;state.skinUntil=0;return;}
      if(/答案|因为|真相|所以|是我觉得/.test(text)){
        const guess=text.replace(/[答案汤底是是因为真相所以我觉得，。！？\s]/g,'');
        if(t.yes.some(k=>guess.includes(k))){say(original,'猜对了！'+t.answer,9000,8);state.turtle=null;state.skin=null;state.skinUntil=0;}
        else say(original,'不对。再想想。',4000,6);
        return;
      }
      if(t.yes.some(k=>text.includes(k)))say(original,'是。',3200,5);
      else say(original,'不是，或者不重要。',3600,5);
      return;
    }
    if(/测试受惊|受惊测试|吓一跳/.test(text)){startle(original);return;}
    if(state.lastTopic&&FOLLOW_UPS[state.lastTopic]){
      const fu=FOLLOW_UPS[state.lastTopic];let pool=null;
      if(/是的|对呀|对的|没错|确实|原来如此|是这样吗|我也觉得|嗯嗯|嗯/.test(text))pool=fu.a;
      else if(/真的吗|不会吧|真的假的|骗人|瞎说|你确定|不可能|假的吧/.test(text))pool=fu.b;
      else if(/为什么|怎么说|什么意思|展开说说|然后呢|继续|再多说点|讲讲|详细点|展开/.test(text))pool=fu.c;
      if(pool){state.lastTopic=null;say(original,pool[Math.floor(Math.random()*pool.length)],4200,6);return;}
    }
    if(/番茄钟状态|计时状态|剩余时间|还剩多久|当前状态|状态/.test(text)){
      const remaining=Math.ceil(Math.max(0,(pomo.mode==='paused'?pomo.remainingMs:pomo.deadline-Date.now()))/60000);
      const pool=pomo.mode==='idle'?'timerIdle':pomo.mode==='paused'?'timerPaused':pomo.mode==='work'?'timerWork':'timerBreak';
      deliver(original,pool,4200,6,{remaining});return;
    }
    if(/停止番茄|结束番茄|关闭番茄|停止计时|番茄钟停止/.test(text)){pomo.mode='idle';pomo.deadline=0;pomo.remainingMs=0;deliver(original,'stop',3800,7);return;}
    if(/快进|跳过.*(番茄|计时|阶段)|直接到点/.test(text)){if(pomo.mode==='work'||pomo.mode==='break'){pomo.deadline=Date.now()+800;deliver(original,'skip',3000,7);}else deliver(original,'unknown',3200,4);return;}
    if(/暂停番茄|暂停计时|番茄钟暂停|暂停/.test(text)){if(pomo.mode==='work'||pomo.mode==='break'){pomo.remainingMs=Math.max(0,pomo.deadline-Date.now());pomo.nextMode=pomo.mode;pomo.mode='paused';deliver(original,'pause',2800,7);}else deliver(original,'status',2800,5);return;}
    if(/继续番茄|继续计时|恢复番茄|继续/.test(text)&&pomo.mode==='paused'){pomo.deadline=Date.now()+pomo.remainingMs;pomo.mode=pomo.nextMode||'work';deliver(original,'resume',2800,7);return;}
    if(/番茄|专注|开始计时|开始工作/.test(text)&&!/状态|还剩|剩余/.test(text)){pomo.mode='work';pomo.workMinutes=interaction.pomodoroWorkMinutes;pomo.breakMinutes=interaction.pomodoroBreakMinutes;pomo.deadline=Date.now()+pomo.workMinutes*60000;pomo.remainingMs=0;deliver(original,'start',4200,7,{minutes:pomo.workMinutes});return;}
    if(/几点|现在时间|现在几点|时间/.test(text)){deliver(original,'time',3500,6,{time:formatTime()});return;}
    if(/多久|陪我多久|运行了多久|累计时间/.test(text)){const show=ms=>{const minutes=Math.floor(ms/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24),duration=`${days?`${days} 天 `:''}${hours%24} 小时 ${minutes%60} 分钟`;deliver(original,'duration',4300,6,{duration});};if(window.evPet?.getCompanionMs)window.evPet.getCompanionMs().then(show);else show(state.companionMs);return;}
    if(/织网|织个网|蜘蛛网/.test(text)){state.skin='cyan';state.skinUntil=Date.now()+18500;state.swingMode=false;state.eggAction={type:'web',until:Date.now()+18000};deliver(original,'web',3500,6);return;}
    if(/打盹|睡一会|睡觉|晒太阳/.test(text)){state.skin=null;state.skinUntil=0;state.swingMode=false;state.eggAction={type:'nap',until:Date.now()+25000};state.companionMode='nap';state.returnTarget=cornerTarget();deliver(original,'nap',3500,6);return;}
    if(/翻个面|翻身/.test(text)){state.skin='gold';state.skinUntil=Date.now()+1600;state.swingMode=false;state.poseAction={type:'flip',startedAt:Date.now(),duration:1200};deliver(original,'flip',2600,5);return;}
    if(/转个圈|旋转/.test(text)){state.skin='gold';state.skinUntil=Date.now()+1600;state.swingMode=false;state.poseAction={type:'spin',startedAt:Date.now(),duration:1100};deliver(original,'spin',2600,5);return;}
    if(/激光|镭射|红点|光点/.test(text)){state.skin='red';state.skinUntil=Date.now()+12500;state.swingMode=false;state.laser={x:clamp(pointer.x+(Math.random()-.5)*200,80,innerWidth-80),y:clamp(pointer.y+(Math.random()-.5)*200,80,innerHeight-80),until:Date.now()+12000,nextMoveAt:0};deliver(original,'laser',2600,5);return;}
    if(/荡丝|荡秋千|荡蛛丝/.test(text)){state.swingMode=true;state.skin=null;state.skinUntil=0;say(original,'荡丝模式。拖拽我，我荡给你看。',3200,6);return;}
    if(/(彼得|帕克|小彼|皮特|peter)/.test(text)){
      if(state.convinced){deliver(original,['peterMood','peterFriends','peterHumor'][Math.floor(Math.random()*3)],4300,5);return;}
      state.suspicious=true;
      deliver(original,'peterShock',3800,6);return;
    }
    if(/(蜘蛛侠|蜘蛛人|小虫|spidey|spider.?man|boss)/.test(text)){
      deliver(original,'peterDaily',4200,5);return;
    }
    if(/名字|ev是什么意思|我的名字|你的名字|你是谁|你叫什么/.test(text)){deliver(original,'name',4000,5);return;}
    if(/犯罪|违法|报警|警察/.test(text)){deliver(original,'crime',4000,5);return;}
    if(/stalker|软件|跟踪/.test(text)){deliver(original,'stalker',4000,5);return;}
    if(/工作|上班|任务|休息/.test(text)){deliver(original,'work',4300,5);return;}
    if(/你在干嘛|做什么|在做什么|你在吗|在吗|你好|嗨|早上好|晚上好/.test(text)){deliver(original,/干嘛|做什么|在做什么/.test(text)?'doing':/你好|嗨|早上好|晚上好/.test(text)?'greet':'status',3500,5);return;}
    if(/回来|回来了/.test(text)){deliver(original,'greetingReturn',3500,5);return;}
    if(/可爱|好萌|漂亮|好看|喜欢你|爱你|厉害|聪明|真棒|烦死|讨厌/.test(text)){deliver(original,'praise',3500,5);return;}
    if(/你是什么|你会什么|能干嘛|你能做什么|你有感情|你喜欢什么|你怕什么/.test(text)){deliver(original,'about',4000,5);return;}
    if(/天气|下雨|晴天|冷|热|温度|季节|无聊|不知道聊什么/.test(text)){deliver(original,'smalltalk',3500,5);return;}
    if(/你还好吗|你怎么样|你开心吗|你累吗|你还好吧|你心情如何|你状态如何/.test(text)){deliver(original,'care',3800,5);return;}
    if(/纽约|这座城市|曼哈顿|城市/.test(text)){deliver(original,'city',3800,5);return;}
    if(/自我意识|灵魂|存在|死亡|生命|意识|你会死吗|活着/.test(text)){deliver(original,'philosophy',4000,5);return;}
    if(/晚安|再见|拜拜|早安|下次见|我走了/.test(text)){deliver(original,'farewell',3500,5);return;}
    if(/谢谢|感谢|对不起|抱歉|辛苦了/.test(text)){deliver(original,'thanks',3500,5);return;}
    if(/逗你|开玩笑|哈哈|搞笑|逗你玩|你好幽默/.test(text)){deliver(original,'tease',3500,5);return;}
    if(/累|疲惫|好困|困了|心情|难过|伤心|焦虑|压力|不开心|郁闷|好烦/.test(text)){deliver(original,'mood',3800,5);return;}
    if(/海龟汤|海龟谜/.test(text)){const t=TURTLE_SOUP[Math.floor(Math.random()*TURTLE_SOUP.length)];state.turtle=t;state.skin='halloween';state.skinUntil=0;state.swingMode=false;say(original,'海龟汤：'+t.face+'（用"是/否"提问，或说"答案是…"）',9000,8);return;}
    if(aiEnabled){
      window.evPet?.aiChat(original).then(reply=>{
        if(reply&&String(reply).trim()){say(original,String(reply).trim(),9000,7);}
        else{deliver(original,'unknown',4500,4);}
      });
    }else{
      deliver(original,'unknown',4500,4);
    }
  }
  function tickPomodoro(now){const p=state.pomodoro;if((p.mode==='work'||p.mode==='break')&&now>=p.deadline){if(p.mode==='work'){p.mode='break';p.breakMinutes=interaction.pomodoroBreakMinutes;p.deadline=now+p.breakMinutes*60000;state.pomodoroAlertUntil=now+6500;state.stretchUntil=now+1800;const reply=lineFrom('workEnd',{minutes:p.workMinutes||interaction.pomodoroWorkMinutes});speak(reply,6000,10);window.evPet?.reportDialogue({input:'（专注阶段结束）',reply});}else{p.mode='idle';p.deadline=0;const reply=lineFrom('breakEnd',{minutes:p.breakMinutes||interaction.pomodoroBreakMinutes});speak(reply,4200,8);window.evPet?.reportDialogue({input:'（休息阶段结束）',reply});}}}
  function chooseTarget(now) {
    const margin=120;
    state.target={x:margin+Math.random()*Math.max(1,innerWidth-margin*2),y:margin+Math.random()*Math.max(1,innerHeight-margin*2)};
    state.targetAt=now;
  }
  function update(dt,now) {
    const wall=Date.now();tickPomodoro(wall);
    if(Date.now()>=state.lastPosReportAt){state.lastPosReportAt=Date.now()+500;window.evPet?.reportPetPosition({x:state.x,y:state.y});}
    if(state.birthStage===1){
      if(state.poseAction&&now-state.poseAction.startedAt>=state.poseAction.duration)state.poseAction=null;
      if(!state.poseAction)state.birthStage=2;
    }
    if(state.birthStage===2){
      state.newspaperFade=Math.min(1,state.newspaperFade+dt*1.5);
      if(state.newspaperFade>=1){state.birthStage=0;state.onNewspaper=true;state.webSince=Date.now();state.questionUntil=Date.now()+4500;}
    }
    if(!state.onNewspaper)state.webSince=0;
    if(state.collapsed){const c=capsulePos();state.sidebarHover=Math.hypot(pointer.x-c.x,pointer.y-c.y)<44;state.hoverNewspaper=false;}
    else{state.sidebarHover=false;const np=newspaperPos();state.hoverNewspaper=Math.abs(pointer.x-np.x)<180&&pointer.y>np.y-85&&pointer.y<np.y+160;}
    if(state.skinUntil&&Date.now()>=state.skinUntil){state.skin=null;state.skinUntil=0;}
    if(state.huntAt&&!state.hunt&&Date.now()>=state.huntAt&&!state.onNewspaper&&!state.collapsed){
      state.huntAt=0;
      const gift=EV_GIFTS[Math.floor(Math.random()*EV_GIFTS.length)];
      state.hunt={phase:'out',until:Date.now()+6500,gift,edge:edgeTarget()};
      say('（自由活动）','我出去打猎。',3200,5);
    }
    if(state.hunt){
      const h=state.hunt;
      if(h.phase==='out'){
        state.companionMode='return';state.returnTarget=h.edge;
        if(Date.now()>=h.until){h.phase='away';h.until=Date.now()+9000;state.x=h.edge.x;state.y=h.edge.y;}
      }else if(h.phase==='away'){
        state.companionMode='return';state.returnTarget=h.edge;
        if(Date.now()>=h.until){h.phase='return';h.until=Date.now()+8000;}
      }else if(h.phase==='return'){
        const np=newspaperPos();
        state.companionMode='return';state.returnTarget=np;
        if(Math.hypot(state.x-np.x,state.y-np.y)<45){
          const g=h.gift;
          if(!state.gifts.some(x=>x.title===g.title)){state.gifts.push(g);window.evPet?.saveState({gifts:state.gifts});collectProgress();}
          say('（打猎归来）','给你带了礼物：'+g.title+'。'+g.ev,6000,7);
          state.hunt=null;state.huntAt=Date.now()+120000;state.returnTarget=null;
          state.onNewspaper=true;state.newspaperFade=1;state.webSince=Date.now();
          state.questionUntil=Date.now()+4500;
        }
      }
    }
    if(Date.now()>=state.nextTimeCheckAt){
      state.nextTimeCheckAt=Date.now()+60000;
      const hr=new Date().getHours();
      const cat=hr>=6&&hr<12?'morning':hr>=12&&hr<14?'noon':hr>=18&&hr<20?'evening':hr>=22||hr<6?'night':null;
      if(cat&&cat!==state.timeCat){state.timeCat=cat;const lines=TIME_LINES[cat];say('（时间感知）',lines[Math.floor(Math.random()*lines.length)],5000,3);}
    }
    if(state.holiday&&Date.now()>=state.holidayTalkAt){
      state.holidayTalkAt=Date.now()+15*60*1000;
      const lines=HOLIDAY_LINES[state.holiday];
      say('（节日）',lines[Math.floor(Math.random()*lines.length)],5000,3);
    }
    if(wall<state.hyperUntil){
      if(wall>=state.hyperSpinAt){state.hyperSpinAt=wall+4000;state.poseAction={type:Math.random()<0.5?'spin':'flip',startedAt:performance.now(),duration:900};}
      if(wall>=state.hyperTalkAt){state.hyperTalkAt=wall+5000;speak(['好有精神！','停不下来！','能量满格！','看我多快！'][Math.floor(Math.random()*4)],2600,5);}
    }
    if(state.cocoon&&state.autoHatchAt&&wall>=state.autoHatchAt){state.autoHatchAt=0;hatch(true);}
    if(state.particles.length){for(const p of state.particles){p.vy+=300*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*1.4;p.vx*=Math.max(0,1-dt);}state.particles=state.particles.filter(p=>p.life>0);}
    const idleSeconds=(wall-state.lastActivityAt)/1000;
    state.phase+=dt*(state.moving?7:1.1);
    const distanceToPointer=Math.hypot(pointer.x-state.x,pointer.y-state.y);
    const directNap=state.eggAction?.type==='nap'&&wall<state.eggAction.until;
    if(state.eggAction&&wall>=state.eggAction.until){state.eggAction=null;if(state.companionMode==='nap')state.companionMode='return';}
    if(state.dragging){
      state.moving=false;state.velocity={x:0,y:0};state.currentSpeed=0;state.target={x:state.x,y:state.y};
      if(state.pendulum){
        const p=state.pendulum;
        p.vy+=900*dt;
        const dx=state.x-pointer.x,dy=state.y-pointer.y,d=Math.max(1,Math.hypot(dx,dy));
        if(d>p.length){const pull=(d-p.length)*18;p.vx-=(dx/d)*pull*dt;p.vy-=(dy/d)*pull*dt;}
        p.vx*=Math.max(0,1-1.2*dt);p.vy*=Math.max(0,1-1.2*dt);
        state.x=clamp(state.x+p.vx*dt,70,Math.max(70,innerWidth-70));
        state.y=clamp(state.y+p.vy*dt,70,Math.max(70,innerHeight-70));
        state.swingAnchor={x:pointer.x,y:pointer.y};
      }
      return;
    }
    if(state.windowVisit&&((params.gaze&&distanceToPointer<params.followRadius)||(state.startle>0&&now-state.startle<550)))state.windowVisit=null;
    if(!state.onNewspaper&&(state.companionMode==='normal'||state.companionMode==='cling')&&!state.windowVisit&&interaction.napEnabled&&idleSeconds>=interaction.napAfterSeconds&&state.pomodoro.mode==='idle'){
      state.companionMode='nap';state.cocoon=true;state.returnTarget=cornerTarget();speak('空闲时间达到设定值。进入低功耗。',4200,3);
    }else if(!state.onNewspaper&&state.companionMode==='normal'&&!state.windowVisit&&interaction.clingEnabled&&idleSeconds>=interaction.clingAfterSeconds&&state.pomodoro.mode==='idle'){
      state.companionMode='cling';speak('光标静止了一段时间。我会在附近待命。',3200,3);
    }else if(!state.onNewspaper&&state.companionMode==='normal'&&!state.windowVisit&&idleSeconds>=90&&state.pomodoro.mode==='idle'&&!state.eggAction){
      state.onNewspaper=true;state.companionMode='normal';state.returnTarget=null;
    }
    if(state.cocoon){state.moving=false;state.currentSpeed=0;state.velocity={x:0,y:0};state.target={x:state.x,y:state.y};return;}
    if(state.fling){
      state.x+=state.fling.x*dt;state.y+=state.fling.y*dt;
      state.fling.y+=900*dt;state.fling.x*=Math.max(0,1-1.5*dt);
      state.x=clamp(state.x,70,Math.max(70,innerWidth-70));state.y=clamp(state.y,70,Math.max(70,innerHeight-70));
      if(state.y>=innerHeight-70||Math.hypot(state.fling.x,state.fling.y)<40){state.fling=null;state.target={x:state.x,y:state.y};state.targetAt=now;}
      state.moving=false;state.currentSpeed=0;state.target={x:state.x,y:state.y};return;
    }
    const companion=['cling','nap','return'].includes(state.companionMode);
    const chasing=!companion&&!state.windowVisit&&state.pomodoro.mode!=='work'&&params.gaze&&distanceToPointer<200&&distanceToPointer>params.followDistance*.65;
    if(chasing&&state.pointerSpeed>params.chaseSpeed*1.6)state.pantUntil=now+1200;
    if(state.onNewspaper){
      const np=newspaperPos();
      state.target={x:np.x,y:np.y};state.targetAt=now;
      state.eggAction=null;state.windowVisit=null;state.laser=null;
      if(wall<state.hyperUntil&&wall-(state.hyperUntil-30000)>15000){
        state.target={x:innerWidth-130,y:130};state.targetAt=now;
        if(Math.hypot(state.x-(innerWidth-130),state.y-130)<55){
          state.eggAction={type:'web',until:wall+15000};state.hyperUntil=0;
          speak('（精力旺盛，爬到右上角结网）',3600,5);
        }
      }
    }else{
    if(state.companionMode==='cling'){
      const a=Math.atan2(state.y-pointer.y,state.x-pointer.x);state.target={x:pointer.x+Math.cos(a)*interaction.clingDistance,y:pointer.y+Math.sin(a)*interaction.clingDistance};state.targetAt=now;
    }else if(state.companionMode==='nap'||state.companionMode==='return'){
      state.returnTarget ||= cornerTarget();state.target=state.returnTarget;state.targetAt=now;
    }else if(chasing){
      const a=Math.atan2(state.y-pointer.y,state.x-pointer.x)+Math.sin(now*.00065)*.35;
      state.target={x:pointer.x+Math.cos(a)*params.followDistance,y:pointer.y+Math.sin(a)*params.followDistance};
      state.targetAt=now;
    } else if(!params.roam){state.target={x:state.x,y:state.y};}
    else if(!state.target||now-state.targetAt>(wall<state.hyperUntil?400:1800)||Math.hypot(state.target.x-state.x,state.target.y-state.y)<18)chooseTarget(now);
    if(state.windowVisit){state.target={x:state.windowVisit.x,y:state.windowVisit.y};state.targetAt=now;}
    // 激光点：追光点（移动小玩具）
    if(state.laser){
      if(Date.now()>=state.laser.until)state.laser=null;
      else{
        if(Date.now()>=state.laser.nextMoveAt){state.laser.x=clamp(state.laser.x+(Math.random()-.5)*180,80,innerWidth-80);state.laser.y=clamp(state.laser.y+(Math.random()-.5)*180,80,innerHeight-80);state.laser.nextMoveAt=Date.now()+450;}
        state.target={x:state.laser.x,y:state.laser.y};state.targetAt=now;
      }
    }
    }
    // 蜘蛛感应：纯随机彩蛋（身体一颤 + 光带爆闪）
    if(wall>=state.nextSpiderSenseAt&&!chasing&&!state.laser&&state.pomodoro.mode==='idle'&&!state.eggAction){state.senseUntil=now+800;state.nextSpiderSenseAt=wall+(15+Math.random()*45)*60*1000;}
    const goal=state.target||{x:state.x,y:state.y},dx=goal.x-state.x,dy=goal.y-state.y,dist=Math.hypot(dx,dy);
    const hyper=wall<state.hyperUntil;const topSpeed=(chasing?params.chaseSpeed:params.walkSpeed)*(hyper?2.2:1);
    state.moving=dist>12;
    state.swinging=false;
    let traveled=0;
    state.velocity=state.moving?{x:dx/dist,y:dy/dist}:{x:0,y:0};
    if(state.moving){
      // 慢起：当前速度朝最高速平滑加速（2.0 越大起步越快）
      state.currentSpeed+=(topSpeed-state.currentSpeed)*(1-Math.exp(-3.5*dt));
      // 慢停：接近目标（150px 内）按距离比例减速，平滑停住
      const arrival=Math.min(1,dist/100);
      const step=Math.min(dist,state.currentSpeed*arrival*dt);
      state.x+=dx/dist*step;state.y+=dy/dist*step;traveled=step;
      const desired=Math.atan2(dy,dx);const turn=Math.atan2(Math.sin(desired-state.yaw),Math.cos(desired-state.yaw));state.yaw+=turn*(1-Math.exp(-params.turnSmoothing*dt*60));
    }else{state.currentSpeed=Math.max(0,state.currentSpeed-topSpeed*3*dt);}
    state.x=clamp(state.x,100,Math.max(100,innerWidth-100));state.y=clamp(state.y,100,Math.max(100,innerHeight-100));
    if(state.companionMode==='return'&&Math.hypot(state.target.x-state.x,state.target.y-state.y)<18){state.companionMode='normal';state.returnTarget=null;}
    if(state.companionMode==='nap'&&!directNap&&idleSeconds<interaction.napAfterSeconds)state.companionMode='return';
    // Advance the gait by distance traveled, so the wave follows the body instead of wall-clock time.
    state.gaitCycle=(state.gaitCycle+traveled/52)%1;
    if(interaction.weavingEnabled&&wall>=state.nextWebAt&&idleSeconds>interaction.clingAfterSeconds&&!chasing&&state.pomodoro.mode==='idle'&&!state.eggAction){state.eggAction={type:'web',until:wall+15000};state.nextWebAt=wall+interaction.weavingEveryMinutes*60000;speak('空闲间隙已到。开始编织。',3000,2);}
    if(interaction.ambientTalkEnabled&&wall>=state.nextAmbientAt&&idleSeconds>30&&!chasing&&state.pomodoro.mode==='idle'&&!state.eggAction&&state.speech.until<=wall){speak(ambientLines[Math.floor(Math.random()*ambientLines.length)],6500,1);state.nextAmbientAt=wall+randomAmbientDelay();}
  }
  function solveKnee(a,b,l1,l2,preferred){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.001,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d;
    const along=clamp((l1*l1-l2*l2+d*d)/(2*d),-l1,l1),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    const middle={x:a.x+ux*along,y:a.y+uy*along};
    const normal={x:-uy*height,y:ux*height};
    const first={x:middle.x+normal.x,y:middle.y+normal.y};
    const second={x:middle.x-normal.x,y:middle.y-normal.y};
    const score=(knee)=> (knee.x-middle.x)*preferred.x+(knee.y-middle.y)*preferred.y;
    return score(first)>=score(second)?first:second;
  }
  function limbWorld(i,baseYaw=state.yaw){
    const leg=legs[i];
    const shoulderLocal=point(leg.shoulder,leg.side*10);
    const restLocal=point(leg.forward,leg.side*leg.spread);
    const shoulder=rotate(shoulderLocal,baseYaw),rest=rotate(restLocal,baseYaw);
    // Give each knee its own outward bend direction, with a small fore/aft bias.
    const preferredLocal=point(leg.row<2?.28:-.28,leg.side);
    const preferred=rotate(preferredLocal,baseYaw);
    return {shoulder:point(state.x+shoulder.x,state.y+shoulder.y),rest:point(state.x+rest.x,state.y+rest.y),preferred};
  }
  function legPoints(i,now){
    const leg=legs[i],data=limbWorld(i),dur=Math.max(.08,params.stepDuration)*1000;
    if(!leg.foot)leg.foot={...data.rest};
    const drift=Math.hypot(data.rest.x-leg.foot.x,data.rest.y-leg.foot.y);
    const cycleSeconds=52/Math.max(30,state.currentSpeed||params.walkSpeed);
    const swingFraction=clamp(params.stepDuration/cycleSeconds,.16,.38);
    // Subtract the phase offset so the swing events happen in the configured order, not backwards.
    const phase=(state.gaitCycle-leg.phase+1)%1;
    const enteringSwing=leg.lastPhase!==null&&phase<leg.lastPhase&&phase<swingFraction;
    const overReach=drift>config.legs.femur+config.legs.tibia+config.legs.tarsus-7;
    const shouldStep=state.moving&&drift>params.stepThreshold&&(enteringSwing||overReach);
    leg.lastPhase=phase;
    if(shouldStep&&!leg.planted){
      const vx=state.velocity?.x||0,vy=state.velocity?.y||0;
      const lead=clamp((state.currentSpeed||params.walkSpeed)*params.lookAhead,0,18);
      leg.from={...leg.foot};
      leg.to={x:data.rest.x+vx*lead,y:data.rest.y+vy*lead};
      leg.stepAt=now;leg.planted=true;
    }
    let lift=0;
    if(leg.planted){const t=clamp((now-leg.stepAt)/dur,0,1),ease=t*t*(3-2*t);leg.foot={x:mix(leg.from.x,leg.to.x,ease),y:mix(leg.from.y,leg.to.y,ease)};lift=Math.sin(t*Math.PI)*9;if(t>=1){leg.planted=false;leg.foot={...leg.to};}}
    const groundFoot=leg.foot;
    const visualFoot={x:groundFoot.x,y:groundFoot.y-lift};
    const l1=config.legs.femur,l2=config.legs.tibia,toeLength=config.legs.tarsus;
    let dx=visualFoot.x-data.shoulder.x,dy=visualFoot.y-data.shoulder.y;
    let reach=Math.max(.001,Math.hypot(dx,dy)),ux=dx/reach,uy=dy/reach;
    const ankleGoal={x:visualFoot.x-ux*toeLength,y:visualFoot.y-uy*toeLength};
    dx=ankleGoal.x-data.shoulder.x;dy=ankleGoal.y-data.shoulder.y;
    reach=Math.max(.001,Math.hypot(dx,dy));const safe=clamp(reach,Math.abs(l1-l2)+.1,l1+l2-.1);
    ux=dx/reach;uy=dy/reach;
    const ankle={x:data.shoulder.x+ux*safe,y:data.shoulder.y+uy*safe};
    const knee=solveKnee(data.shoulder,ankle,l1,l2,data.preferred);
    const tip={x:ankle.x+ux*toeLength,y:ankle.y+uy*toeLength};
    return {shoulder:data.shoulder,knee,ankle,tip,foot:groundFoot,visualFoot,lift};
  }
  function line(a,b,color,width=2){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function ball(p,r,color,glow=0){ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=color;if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}ctx.fill();ctx.shadowBlur=0;}
  function drawNewspaper(){
    const np=newspaperPos();
    const a=state.newspaperFade;
    if(a<=0.01)return;
    ctx.save();ctx.translate(np.x,np.y);ctx.globalAlpha=a;
    ctx.fillStyle='#e8e2d2';ctx.fillRect(-170,-75,340,150);
    ctx.strokeStyle='#b8ad93';ctx.lineWidth=1.5;ctx.strokeRect(-170,-75,340,150);
    ctx.fillStyle='#2b2620';ctx.font='700 22px "Times New Roman",Georgia,serif';ctx.textAlign='center';ctx.fillText('DAILY BUGLE',0,-44);
    ctx.fillStyle='#6b6455';ctx.font='10px "Segoe UI","Microsoft YaHei",sans-serif';ctx.fillText('号角日报',0,-26);
    ctx.strokeStyle='#b8ad93';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-158,-14);ctx.lineTo(158,-14);ctx.stroke();
    ctx.fillStyle='#cfc6b0';ctx.fillRect(-158,-2,88,56);ctx.strokeRect(-158,-2,88,56);
    ctx.strokeStyle='#b8ad93';ctx.lineWidth=1.5;
    for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-58,6+i*9);ctx.lineTo(150,6+i*9);ctx.stroke();}
    ctx.fillStyle='#ff2a2a';ctx.beginPath();ctx.roundRect(-192,-74,44,28,6);ctx.fill();
    ctx.fillStyle='#ffffff';ctx.font='700 12px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('NEW',-170,-60);
    ctx.textBaseline='alphabetic';
    if(state.webSince&&Date.now()-state.webSince>300000){
      const wl=Math.min(1,(Date.now()-state.webSince-300000)/30000);
      ctx.strokeStyle='rgba(220,230,235,'+(wl*0.5).toFixed(3)+')';ctx.lineWidth=0.8;
      for(let i=0;i<4;i++){
        const wx=-140+Math.random()*280,wy=-60+Math.random()*120;
        ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+30,wy-20);ctx.lineTo(wx+55,wy);ctx.stroke();
        ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+10,wy+25);ctx.lineTo(wx-15,wy+35);ctx.stroke();
        ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx-35,wy-5);ctx.lineTo(wx-50,wy-25);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawNewspaperButton(now){
    if(!state.onNewspaper||state.collapsed||Date.now()>=state.questionUntil)return;
    const bp=buttonPos();
    const pulse=1+Math.sin(now*.004)*.03;
    ctx.save();ctx.translate(bp.x,bp.y);ctx.scale(pulse,pulse);
    ctx.fillStyle='#121215';ctx.strokeStyle='#ff2a2a66';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(-95,-22,190,44,12);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-18,22);ctx.lineTo(0,36);ctx.lineTo(18,22);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e0e0e0';ctx.font='11px "Segoe UI","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('纸质报纸很过时吗？',0,0);
    ctx.restore();
  }
  function drawStatusBar(){
    const label=state.cocoon?'茧中':state.collapsed?'已收起':state.onNewspaper?'休息中':Date.now()<state.hyperUntil?'精力旺盛':state.pomodoro.mode==='work'?'专注中':state.pomodoro.mode==='break'?'休息中':state.moving?'玩耍中':'待机';
    ctx.save();ctx.font='11px Consolas,monospace';ctx.textAlign='left';
    const w=ctx.measureText(label).width+26;
    ctx.fillStyle='rgba(18,18,21,.85)';ctx.strokeStyle='#ff2a2a55';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(16,16,w,28,6);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ff2a2a';ctx.beginPath();ctx.arc(26,30,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e0e0e0';ctx.fillText(label,38,34);
    ctx.restore();
  }
  function drawSidebar(){
    const show=state.sidebarHover||state.sidebarOpen||state.hoverNewspaper;
    if(!show)return;
    for(let i=0;i<SIDEBAR_BTNS.length;i++){
      const b=sidebarBtnPos(i);
      ctx.save();ctx.translate(b.x,b.y);
      ctx.fillStyle='rgba(18,18,21,.92)';ctx.strokeStyle='#26262e';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(-28,-15,56,30,8);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e0e0e0';ctx.font='10px "Segoe UI","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(SIDEBAR_BTNS[i],0,0);
      ctx.restore();
    }
  }
  function drawCapsule(){
    if(!state.collapsed)return;
    const c=capsulePos();
    ctx.save();ctx.translate(c.x,c.y);
    ctx.fillStyle='#121215';ctx.strokeStyle='#ff2a2a88';ctx.lineWidth=1.5;
    if(state.sidebarHover){ctx.shadowColor='#ff2a2a';ctx.shadowBlur=16;}
    ctx.beginPath();ctx.roundRect(-18,-36,36,72,18);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(235,240,245,.5)';ctx.lineWidth=1;
    const wob=Math.sin(Date.now()*.002)*1.5;
    for(let i=0;i<5;i++){
      const yy=-30+i*15;
      ctx.beginPath();ctx.moveTo(-16,yy-4+wob);ctx.quadraticCurveTo(0,yy+3-wob,16,yy-4+wob);ctx.stroke();
    }
    ctx.fillStyle='#ff2a2a';ctx.font='700 13px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('E',0,-9);ctx.fillText('V',0,11);
    ctx.restore();
  }
  function draw(now){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    if(state.collapsed){drawCapsule();if(state.sidebarHover)drawSidebar();drawStatusBar();return;}
    drawNewspaper();
    if(state.hunt?.phase==='away'){drawStatusBar();return;}
    if(state.cocoon){if(state.swingAnchor)drawSwingLine(now);drawCocoon(now);if(state.speech.until>Date.now())drawSpeech(state.speech.text);for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life);ball(point(p.x,p.y),p.size,p.color,4);ctx.globalAlpha=1;}return;}
    const all=legs.map((_,i)=>legPoints(i,now));
    for(const l of all){ctx.save();ctx.translate(l.foot.x,l.foot.y+5);ctx.scale(1,.45);ball(point(0,0),3,'rgba(0,0,0,.22)',0);ctx.restore();}
    const parts=[];
    for(let i=0;i<8;i++){const l=all[i];parts.push({y:l.ankle.y,draw:()=>{
      const sk=skinColors();const cyanHyper=Date.now()<state.hyperUntil;const cyan=cyanHyper&&(Math.floor(Date.now()/150)%2)?'#ffffff':sk.glow;
      line(l.shoulder,l.knee,sk.body,3.2);line(l.knee,l.ankle,sk.body,2.4);line(l.ankle,l.tip,'#252b30',1.2);
      line(l.shoulder,l.knee,'rgba(53,224,255,.68)',0.7);line(l.knee,l.ankle,'rgba(53,224,255,.76)',0.6);line(l.ankle,l.tip,cyan,0.7);
      // Keep the hip attachment clean; only knee and ankle joints use glowing spheres.
      ball(l.knee,config.legs.jointRadius[1],sk.glow,5);ball(l.ankle,config.legs.jointRadius[2],cyan,4);ball(l.tip,0.8,cyan,3);
      if(l.lift>0)ball(l.visualFoot,1.5,'#baf7ff',4);
    }});}
    const mid={x:state.x,y:state.y},yaw=state.yaw;
    parts.push({y:state.y+4,draw:()=>{
      const age=now-state.startle, startled=state.startle>0&&age<550;
      const sense=now<state.senseUntil||now<state.pantUntil;
      const senseShake=sense?(Math.random()-.5)*3:0;
      const bounce=state.swingAnchor?Math.sin(now*.02)*8:(state.moving?Math.sin(state.phase*2)*1.3:Math.sin(now*.0014)*.7);
      const abdomen=rotate(point(-13,0),yaw),head=rotate(point(13,0),yaw);
      const sleepy=state.companionMode==='nap'||state.eggAction?.type==='nap'||state.windowVisit?.type==='perch';
      const hanging=state.windowVisit?.type==='hang';
      const flipping=state.poseAction&&now-state.poseAction.startedAt<state.poseAction.duration;
      const poseProgress=flipping?clamp((now-state.poseAction.startedAt)/state.poseAction.duration,0,1):1;
      const poseYaw=flipping?(state.poseAction.type==='spin'?Math.sin(poseProgress*Math.PI*2)*.35:Math.sin(poseProgress*Math.PI)*Math.PI):0;
      ctx.save();ctx.translate(state.x+senseShake,state.y+bounce+(startled?Math.sin(now*.08)*2:0));ctx.rotate(yaw+poseYaw+(hanging?Math.PI:0));if(sleepy)ctx.scale(1.04,.76);
      ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,13,30,16,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=skinColors().body;ctx.strokeStyle=skinColors().stroke;ctx.lineWidth=1.2;
      ctx.beginPath();ctx.roundRect(-30,-13,31,26,8);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.roundRect(4,-10,20,20,7);ctx.fill();ctx.stroke();
      ctx.restore();
      const pulse=(Math.sin(now*.0017)+1)/2;
      const cyan=sense?'#ffffff':state.pomodoro.mode==='work'?'#2A6BE0':sleepy?'#FFC56B':startledColor(startled,now);
      ctx.save();ctx.translate(state.x+abdomen.x,state.y+abdomen.y+bounce);ctx.rotate(yaw);
      ctx.beginPath();ctx.roundRect(-11,-9,22,18,5);ctx.clip();
      ctx.fillStyle='rgba(53,224,255,.11)';ctx.fillRect(-11,-9,22,18);
      const sweep=((now*.055)%52)-15;const grad=ctx.createLinearGradient(sweep-9,0,sweep+9,0);
      grad.addColorStop(0,'rgba(53,224,255,0)');grad.addColorStop(.5,cyan);grad.addColorStop(1,'rgba(53,224,255,0)');
      ctx.fillStyle=grad;ctx.fillRect(sweep-9,-10,18,20);ctx.restore();
      if(state.pomodoro.mode==='work'||state.pomodoro.mode==='break'){
        const left=Math.max(0,state.pomodoro.deadline-Date.now()),mm=String(Math.floor(left/60000)).padStart(2,'0'),ss=String(Math.floor(left/1000)%60).padStart(2,'0');
        ctx.save();ctx.translate(state.x+abdomen.x,state.y+abdomen.y+bounce);ctx.rotate(yaw);ctx.fillStyle='#eafcff';ctx.font='bold 5.5px Consolas, monospace';ctx.textAlign='center';ctx.fillText(`${mm}:${ss}`,0,2);ctx.restore();
      }
      const gaze=state.moving?Math.atan2(pointer.y-state.y,pointer.x-state.x)-yaw:Math.sin(now*.0006)*.12;
      const eyes=[-4,4].map(dx=>({x:state.x+head.x+Math.cos(yaw)*dx-Math.sin(yaw)*2,y:state.y+head.y+Math.sin(yaw)*dx+Math.cos(yaw)*2}));
      eyes.forEach(p=>ball({x:p.x+Math.cos(gaze)*1.1,y:p.y+Math.sin(gaze)*1.1},1.7, startled?'#E62429':skinColors().glow,5));
      ball(mid,1,'rgba(255,255,255,.45)',0);
    }});
    parts.sort((a,b)=>a.y-b.y).forEach(p=>p.draw());
    for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life);ball(point(p.x,p.y),p.size,p.color,4);ctx.globalAlpha=1;}
    if(state.eggAction?.type==='web'||state.windowVisit?.type==='web')drawWeb(now);
    if(state.swingAnchor)drawSwingLine(now);
    if(state.windowVisit?.type==='hang')drawHangLine(now);
    if(state.laser)drawLaser(now);
    drawNewspaperButton(now);
    drawSidebar();
    drawStatusBar();
    if(state.speech.until>Date.now())drawSpeech(state.speech.text);
  }
  function drawWeb(now){
    const radius=52+Math.sin(now*.005)*3;ctx.save();ctx.translate(state.x,state.y);
    ctx.strokeStyle='rgba(141,233,255,.64)';ctx.lineWidth=1.1;ctx.shadowBlur=9;ctx.shadowColor='#35e0ff';
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);ctx.stroke();}
    for(const r of [17,32,47]){ctx.beginPath();for(let i=0;i<=32;i++){const a=i*Math.PI*2/32,rr=r+Math.cos(a*8)*2;if(i===0)ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.stroke();}
    ctx.restore();
  }
  function drawSwingLine(now){if(!state.swingAnchor)return;ctx.save();ctx.strokeStyle='rgba(141,233,255,.5)';ctx.lineWidth=1;ctx.shadowBlur=6;ctx.shadowColor='#35e0ff';ctx.beginPath();ctx.moveTo(state.x,state.y-8);ctx.lineTo(state.swingAnchor.x,state.swingAnchor.y);ctx.stroke();ctx.restore();}
  function drawHangLine(now){const ay=Math.max(30,state.y-120);ctx.save();ctx.strokeStyle='rgba(141,233,255,.5)';ctx.lineWidth=1;ctx.shadowBlur=6;ctx.shadowColor='#35e0ff';ctx.beginPath();ctx.moveTo(state.x,state.y-8);ctx.lineTo(state.x,ay);ctx.stroke();ctx.restore();}
  function drawLaser(now){if(!state.laser)return;ball(point(state.laser.x,state.laser.y),2.2,'#ff4b57',9);ball(point(state.laser.x,state.laser.y),0.9,'#ffffff',0);}
  function drawCocoon(now){
    const breathe=1+Math.sin(now*.002)*.04;
    ctx.save();ctx.translate(state.x,state.y);
    ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(0,18,26,11,0,0,Math.PI*2);ctx.fill();
    ctx.scale(breathe,breathe);
    const grd=ctx.createRadialGradient(0,-4,2,0,0,22);
    grd.addColorStop(0,'#f4fbfc');grd.addColorStop(.55,'#dbe9ec');grd.addColorStop(1,'#b7c9cd');
    ctx.fillStyle=grd;ctx.strokeStyle='rgba(53,224,255,.35)';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(0,0,22,16,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=.6;
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-18,i*7);ctx.lineTo(18,i*7);ctx.stroke();}
    ctx.restore();
  }
  function drawSpeech(text){
    ctx.save();ctx.font='12px Segoe UI, sans-serif';const maxWidth=Math.min(300,Math.max(150,innerWidth-28)),words=[...text],lines=[];let lineText='';
    for(const char of words){if(lineText&&ctx.measureText(lineText+char).width>maxWidth-24){lines.push(lineText);lineText='';}lineText+=char;}if(lineText)lines.push(lineText);
    const width=Math.min(maxWidth,Math.max(120,...lines.map(value=>ctx.measureText(value).width+22))),height=lines.length*17+16;
    const x=clamp(state.x+34,8,innerWidth-width-8),y=clamp(state.y-54-height,8,innerHeight-height-8);
    ctx.fillStyle='rgba(8,16,21,.91)';ctx.strokeStyle='rgba(53,224,255,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x,y,width,height,9);ctx.fill();ctx.stroke();ctx.fillStyle='#c5faff';
    lines.forEach((lineText,index)=>ctx.fillText(lineText,x+11,y+19+index*17));ctx.restore();
  }
  function startledColor(startled,now){return startled?'#E62429':'#35E0FF';}
  function reportPomodoro(){const p=state.pomodoro;let remaining=0,total=0;if(p.mode==='work'||p.mode==='break'){remaining=Math.max(0,p.deadline-Date.now());total=(p.mode==='work'?p.workMinutes:p.breakMinutes)*60000;}else if(p.mode==='paused'){remaining=p.remainingMs||0;total=((p.nextMode||'work')==='work'?p.workMinutes:p.breakMinutes)*60000;}window.evPet?.reportPomodoro({mode:p.mode,remainingMs:remaining,totalMs:total});}
  function frame(now){
    const dt=Math.min(.05,(now-state.last)/1000||.016);state.last=now;
    if(!document.hidden){update(dt,now);draw(now);}
    state.frames++;if(now-state.lastFps>1000){state.fps=state.frames;state.frames=0;state.lastFps=now;document.querySelector('#fps').textContent=`${state.fps} FPS`;}
    const status=state.startle>0&&now-state.startle<550?'STARTLE · 受惊':state.pomodoro.mode==='work'?'POMODORO · 专注':state.pomodoro.mode==='break'?'BREAK · 休息':state.companionMode==='nap'?'NAP · 打盹':state.companionMode==='cling'?'NEARBY · 靠近光标':params.gaze&&Math.hypot(pointer.x-state.x,pointer.y-state.y)<params.followRadius?'CHASE · 注视':state.moving?'PATROL · 巡视':'WORKING · 待机';
    document.querySelector('#state').textContent=status;
    if(window.evPet&&status!==lastReportedStatus){lastReportedStatus=status;window.evPet.reportStatus(status);}
    if(window.evPet&&(!state.lastPomoReport||now-state.lastPomoReport>500)){state.lastPomoReport=now;reportPomodoro();}
    const delay=state.moving?1000/60:1000/12;
    if(now-state.lastFrame>=delay){state.lastFrame=now;requestAnimationFrame(frame);}else setTimeout(()=>requestAnimationFrame(frame),Math.max(1,delay-(now-state.lastFrame)));
  }
  // 喂食：接收拖放文件 + 投喂确认/精力旺盛
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    const paths = files.map(f => { try { return window.evPet?.getPathForFile?.(f); } catch { return null; } }).filter(Boolean);
    if (paths.length) window.evPet?.reportFileDrop(paths);
  });
  window.evPet?.onFeedOffer(v => { speak('是给我吃的吗？', 5000, 9); });
  window.evPet?.onFeedConfirmed(() => { state.hyperUntil = Date.now() + 30000; speak('好吃。我要乱爬一会儿。', 4200, 7); });
  requestAnimationFrame(frame);
})();
