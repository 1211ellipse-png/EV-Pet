(() => {
  const params = { motion:{walkSpeed:90,chaseSpeed:170,turnSmoothing:.14}, legs:{stepThreshold:22,lookAhead:.18,stepDuration:.18}, chase:{followDistance:120,followRadius:420}, behavior:{roam:true,gaze:true,startle:true}, persona:{userTitle:''}, interaction:{pomodoroWorkMinutes:25,pomodoroBreakMinutes:5,clingEnabled:true,clingAfterSeconds:180,clingDistance:40,napEnabled:true,napAfterSeconds:600,weavingEnabled:true,weavingEveryMinutes:60,ambientTalkEnabled:true,ambientTalkMinMinutes:20,ambientTalkMaxMinutes:40} };
  const specs = [
    ['motion','walkSpeed','爬行速度',20,220,1,' px/s'],['motion','chaseSpeed','追随速度',40,320,1,' px/s'],
    ['motion','turnSmoothing','转向平滑',.03,.45,.01,''],['legs','stepThreshold','迈步阈值',8,48,1,' px'],
    ['legs','lookAhead','落脚预判',0,.5,.01,''],['legs','stepDuration','抬脚时长',.08,.42,.01,' s'],
    ['chase','followDistance','光标距离',70,240,1,' px'],['chase','followRadius','跟随半径',180,650,1,' px']
  ];
  const holder=document.querySelector('#controls');
  const inputs=[];
  for(const [group,key,label,min,max,step,unit] of specs){
    const row=document.createElement('label');row.className='control';
    row.innerHTML=`<span class="range-head"><span>${label}</span><output></output></span><input type="range" min="${min}" max="${max}" step="${step}">`;
    const input=row.querySelector('input'),output=row.querySelector('output');
    input.addEventListener('input',()=>{params[group][key]=Number(input.value);output.value=`${params[group][key]}${unit}`;apply();});
    inputs.push({input,output,group,key,unit});holder.append(row);
  }
  const interactionSpecs=[
    ['pomodoroWorkMinutes','番茄钟工作时长',5,90,1,' 分钟'],['pomodoroBreakMinutes','番茄钟休息时长',1,30,1,' 分钟'],
    ['clingAfterSeconds','空闲多久靠近光标',30,600,30,' 秒'],['clingDistance','靠近时与光标距离',20,100,5,' px'],
    ['napAfterSeconds','多久后开始打盹',300,3600,60,' 秒'],['weavingEveryMinutes','织网间隔',15,240,5,' 分钟'],
    ['ambientTalkMinMinutes','台词最短间隔',5,90,5,' 分钟'],['ambientTalkMaxMinutes','台词最长间隔',10,180,5,' 分钟']
  ];
  const interactionHolder=document.querySelector('#interaction-controls');
  const interactionInputs=[];
  for(const [key,label,min,max,step,unit] of interactionSpecs){
    const row=document.createElement('label');row.className='control';
    row.innerHTML=`<span class="range-head"><span>${label}</span><output></output></span><input type="range" min="${min}" max="${max}" step="${step}">`;
    const input=row.querySelector('input'),output=row.querySelector('output');
    input.addEventListener('input',()=>{params.interaction[key]=Number(input.value);output.value=`${params.interaction[key]}${unit}`;if(key==='pomodoroWorkMinutes')document.querySelector('#stats-work-length').textContent=`${params.interaction[key]} 分钟`;apply();});
    interactionInputs.push({input,output,key,unit});interactionHolder.append(row);
  }
  const toggles=[...document.querySelectorAll('[data-toggle]')];
  toggles.forEach(el=>el.addEventListener('change',()=>{params.behavior[el.dataset.toggle]=el.checked;apply();}));
  const interactionToggles=[...document.querySelectorAll('[data-interaction-toggle]')];
  interactionToggles.forEach(el=>el.addEventListener('change',()=>{params.interaction[el.dataset.interactionToggle]=el.checked;apply();}));
  function apply(){window.evPet?.applySettings(params);}
  const pageNames={dialogue:'对话',pomodoro:'番茄钟',settings:'设置',stats:'状态统计'};
  for(const button of document.querySelectorAll('[data-page-target]')){
    button.addEventListener('click',()=>{
      const target=button.dataset.pageTarget;
      document.querySelectorAll('[data-page-target]').forEach(item=>item.classList.toggle('active',item===button));
      document.querySelectorAll('[data-page]').forEach(page=>page.classList.toggle('active',page.dataset.page===target));
      document.querySelector('#page-title').textContent=pageNames[target]||'控制台';
    });
  }
  document.querySelector('#user-title').addEventListener('input',event=>{params.persona.userTitle=event.target.value;apply();});
  function load(config){
    if(!config)return;
    Object.assign(params.motion,config.motion||{});Object.assign(params.legs,config.legs||{});Object.assign(params.chase,config.chase||{});
    Object.assign(params.persona,config.persona||{});
    Object.assign(params.interaction,config.interaction||{});
    Object.assign(params.behavior,{roam:config.behavior?.roam??true,gaze:config.behavior?.gaze??true,startle:config.behavior?.startle??true});
    for(const item of inputs){const value=params[item.group][item.key];item.input.value=value;item.output.value=`${value}${item.unit}`;}
    for(const item of interactionInputs){const value=params.interaction[item.key];item.input.value=value;item.output.value=`${value}${item.unit}`;}
    for(const el of toggles)el.checked=params.behavior[el.dataset.toggle];
    for(const el of interactionToggles)el.checked=params.interaction[el.dataset.interactionToggle];
    document.querySelector('#user-title').value=params.persona.userTitle||'';
    document.querySelector('#stats-work-length').textContent=`${params.interaction.pomodoroWorkMinutes} 分钟`;
  }
  window.evPet?.onConfig(load);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')window.evPet?.closeDebug();});
  window.evPet?.onStatus(value=>{
    document.querySelector('#state').textContent=value;
    document.querySelector('#stats-status').textContent=value;
    const label=value.includes('POMODORO')?'专注中':value.includes('BREAK')?'休息中':value.includes('NAP')?'打盹':value.includes('NEARBY')?'靠近光标':value.includes('CHASE')?'跟随光标':value.includes('STARTLE')?'受惊':'待机';
    document.querySelector('#pomo-status').textContent=label;
    document.querySelector('#stats-pomodoro').textContent=label;
  });
  const updateCompanionTime=()=>window.evPet?.getCompanionMs().then(ms=>{
    const minutes=Math.floor(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes/60)%24;
    document.querySelector('#companion-time').textContent=`${days?`${days} 天 `:''}${hours} 小时 ${minutes%60} 分钟`;
  }).catch(()=>{});
  updateCompanionTime();setInterval(updateCompanionTime,60000);
  document.querySelector('#open-chat').addEventListener('click',()=>window.evPet?.openChat());
  for(const button of document.querySelectorAll('[data-command]')){
    button.addEventListener('click',()=>window.evPet?.sendDebugCommand(button.dataset.command));
  }
  document.querySelector('#save').addEventListener('click',async()=>{
    const config={body:{head:[20,18],abdomen:[30,26]},legs:{femur:30,tibia:25,tarsus:10,jointRadius:[4.5,3.5,2.5],...params.legs},gait:{phaseOrder:'L1,R2,L3,R4,R1,L2,R3,L4',waveSpread:.125},...params};
    await window.evPet?.saveConfig(config);
    document.querySelector('#saved').textContent='已保存 · 下次启动生效';
    setTimeout(()=>document.querySelector('#saved').textContent='拖动滑条实时生效',1800);
  });
  document.querySelector('#quit').addEventListener('click',()=>window.evPet?.quitApp());
  document.querySelector('#hide-debug').addEventListener('click',()=>window.evPet?.closeDebug());
})();
