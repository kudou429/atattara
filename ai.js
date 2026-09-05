const KEY='atattara_ai_v30';
const $=s=>document.querySelector(s);
const money=n=>Math.max(0,Math.round(Number(n)||0)).toLocaleString('ja-JP')+'円';
const oku=n=>{n=Math.max(0,Number(n)||0);return n>=100000000?(Math.round(n/1000000)/100+'億円'):n>=10000?(Math.round(n/10000).toLocaleString()+'万円'):money(n)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function defaults(){return{
  jackpot:300000000,
  profile:{work:'介護の仕事を週5',family:'妻と2歳の息子の3人',project:'CAREVAなど介護系プロジェクト',wish:'家族との時間と自由を増やしたい'},
  work:null,home:null,family:null,travel:null,car:null,project:null,
  freeWeekdays:0,costs:{home:0,travel:0,car:0},
  history:[],decisions:[],snapshots:[],quick:['仕事を少し減らしたい','まず家族との時間を増やしたい','何もしない時間も欲しい','家のことも考えたい']
}}
let S=load()||defaults();

function load(){try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}}
function save(){localStorage.setItem(KEY,JSON.stringify(S))}
function remaining(){return Math.max(0,S.jackpot-(Number(S.costs?.home)||0)-(Number(S.costs?.travel)||0)-(Number(S.costs?.car)||0))}
function count(){return [S.work,S.home,S.family,S.travel,S.car,S.project].filter(Boolean).length}
function snapshot(){return JSON.parse(JSON.stringify({work:S.work,home:S.home,family:S.family,travel:S.travel,car:S.car,project:S.project,freeWeekdays:S.freeWeekdays,costs:S.costs,decisions:S.decisions}))}

function addMessage(role,text,opts={}){
  const row=document.createElement('div');row.className='msg '+(role==='user'?'me':'ai')+(opts.error?' error':'');
  if(role==='user')row.innerHTML=`<div class="bubble">${esc(text)}</div>`;
  else row.innerHTML=`<div class="avatar">当</div><div class="bubble">${esc(text)}</div>`;
  $('#messages').appendChild(row);scrollChat();
}
function scrollChat(){requestAnimationFrame(()=>{const m=$('#messages');m.scrollTop=m.scrollHeight})}
function typing(on){$('#typing')?.remove();if(!on)return;const row=document.createElement('div');row.id='typing';row.className='msg ai';row.innerHTML='<div class="avatar">当</div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>';$('#messages').appendChild(row);scrollChat()}
function renderHistory(){
  $('#messages').innerHTML='';
  if(!S.history.length){
    const greeting=`${oku(S.jackpot)}、当たったとします。\n\n「どんな豪邸が欲しい？」からは始めません。今の生活の続きとして、まず何を変えたいですか？\nまとまっていなくても大丈夫です。`;
    S.history.push({role:'assistant',content:greeting});save();
  }
  S.history.forEach(x=>addMessage(x.role,x.content));renderQuick();
}
function renderQuick(){const q=$('#quick');q.innerHTML='';(S.quick||[]).slice(0,4).forEach(text=>{const b=document.createElement('button');b.textContent=text;b.onclick=()=>sendMessage(text);q.appendChild(b)})}

function renderLife(){
  $('#jackpotText').textContent=money(S.jackpot);$('#jackpotSelect').value=String(S.jackpot);$('#mobileCount').textContent=count();
  const cells=[
    ['🏡','住まい',S.home?.label||'まだ決めていない',!!S.home],
    ['💼','仕事',S.work?.label||'まだ決めていない',!!S.work],
    ['👨‍👩‍👦','家族',S.family?.label||'今の暮らしの続き',!!S.family],
    ['✈️','旅行',S.travel?.label||'まだ決めていない',!!S.travel],
    ['🚗','車',S.car?.label||'まだ決めていない',!!S.car],
    ['🌱','挑戦',S.project?.label||S.profile.project,!!S.project]
  ];
  const rem=remaining();
  $('#lifePanel').innerHTML=`<div class="lifehead"><b>MY LIFE</b><span>AIが自動更新</span></div>
  <div class="profilebox"><small>今の自分</small><p>${esc(S.profile.work)} ／ ${esc(S.profile.family)}<br>${esc(S.profile.wish)}</p></div>
  <div class="lifegrid">${cells.map(c=>`<div class="lifeitem ${c[3]?'done':''}"><div class="ico">${c[0]}</div><b>${c[1]}</b><small>${esc(c[2])}</small></div>`).join('')}</div>
  <div class="moneybox"><small>残っているお金</small><b>${oku(rem)}</b><div class="moneybar"><span style="width:${Math.max(2,rem/S.jackpot*100)}%"></span></div></div>
  <div class="metrics"><div class="metric"><small>自分で決める平日</small><b>+${Math.round((Number(S.freeWeekdays)||0)*50)}日/年</b></div><div class="metric"><small>週の自由平日</small><b>+${Number(S.freeWeekdays)||0}日</b></div></div>
  <div class="actions"><button class="summaryBtn" onclick="openSummary()">MY LIFEを見る</button><button class="undoBtn" onclick="undoLast()">1つ戻す</button></div>
  <div class="timeline"><div class="timelineHead">これまでの決定</div>${S.decisions.length?S.decisions.slice(-5).reverse().map(d=>`<div class="decision"><i></i><div><b>${esc(d.title)}</b><br>${esc(d.detail)}</div></div>`).join(''):'<div style="font-size:8.5px;color:#89969b">まだ何も決めていません</div>'}</div>`;
}

function stateForApi(){return{
  jackpot:S.jackpot,remaining:remaining(),profile:S.profile,
  work:S.work,home:S.home,family:S.family,travel:S.travel,car:S.car,project:S.project,costs:S.costs
}}

function hasUpdates(u){return u&&Object.values(u).some(v=>v!==null&&v!==undefined)}
function applyAiResult(data){
  const u=data.updates||{};
  if(hasUpdates(u)||data.should_record_decision){S.snapshots.push(snapshot());S.snapshots=S.snapshots.slice(-12)}
  if(u.work_label!==null&&u.work_label!==undefined)S.work={label:u.work_label,days:u.work_days_per_week??S.work?.days??null};
  else if(S.work&&u.work_days_per_week!==null&&u.work_days_per_week!==undefined)S.work.days=u.work_days_per_week;
  if(u.free_weekdays_per_week!==null&&u.free_weekdays_per_week!==undefined)S.freeWeekdays=u.free_weekdays_per_week;
  if(u.home_label!==null&&u.home_label!==undefined)S.home={label:u.home_label,cost:u.home_cost_yen??S.home?.cost??0};
  else if(S.home&&u.home_cost_yen!==null&&u.home_cost_yen!==undefined)S.home.cost=u.home_cost_yen;
  if(u.home_cost_yen!==null&&u.home_cost_yen!==undefined)S.costs.home=u.home_cost_yen;
  if(u.family_label!==null&&u.family_label!==undefined)S.family={label:u.family_label};
  if(u.travel_label!==null&&u.travel_label!==undefined)S.travel={label:u.travel_label,budget:u.travel_budget_yen??S.travel?.budget??0};
  else if(S.travel&&u.travel_budget_yen!==null&&u.travel_budget_yen!==undefined)S.travel.budget=u.travel_budget_yen;
  if(u.travel_budget_yen!==null&&u.travel_budget_yen!==undefined)S.costs.travel=u.travel_budget_yen;
  if(u.car_label!==null&&u.car_label!==undefined)S.car={label:u.car_label,cost:u.car_cost_yen??S.car?.cost??0};
  else if(S.car&&u.car_cost_yen!==null&&u.car_cost_yen!==undefined)S.car.cost=u.car_cost_yen;
  if(u.car_cost_yen!==null&&u.car_cost_yen!==undefined)S.costs.car=u.car_cost_yen;
  if(u.project_label!==null&&u.project_label!==undefined)S.project={label:u.project_label};
  if(data.should_record_decision&&data.decision?.title&&data.decision?.detail){
    const last=S.decisions.at(-1);const same=last&&last.title===data.decision.title&&last.detail===data.decision.detail;
    if(!same)S.decisions.push({title:data.decision.title,detail:data.decision.detail,time:Date.now()});
    S.decisions=S.decisions.slice(-20);
  }
}

async function sendMessage(raw){
  const text=String(raw||'').trim();if(!text||$('#send').disabled)return;
  const prior=S.history.slice(-12);
  S.history.push({role:'user',content:text});S.history=S.history.slice(-40);S.quick=[];save();
  addMessage('user',text);renderQuick();$('#input').value='';autoGrow();setBusy(true);typing(true);
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:prior,state:stateForApi()})});
    const data=await r.json().catch(()=>({error:'AIから正しい応答を受け取れませんでした。'}));
    typing(false);
    if(!r.ok)throw new Error(data.error||'AIとの接続に失敗しました。');
    applyAiResult(data);
    const reply=String(data.reply||'もう少し聞かせてください。');
    S.history.push({role:'assistant',content:reply});S.history=S.history.slice(-40);S.quick=Array.isArray(data.quick_replies)?data.quick_replies.slice(0,4):[];save();
    addMessage('assistant',reply);renderQuick();renderLife();
  }catch(e){
    typing(false);const msg=e?.message||'AIとの接続に失敗しました。';addMessage('assistant',msg,{error:true});
    if(location.hostname.endsWith('github.io'))addMessage('assistant','このAI版はGitHub PagesではAPIを呼べません。Vercel版で開く必要があります。',{error:true});
  }finally{setBusy(false)}
}
function setBusy(v){$('#send').disabled=v;$('#input').disabled=v}
function autoGrow(){const x=$('#input');x.style.height='auto';x.style.height=Math.min(120,x.scrollHeight)+'px'}

function undoLast(){
  const p=S.snapshots.pop();if(!p)return showToast('戻せる決定はまだありません');
  Object.assign(S,p);S.history.push({role:'assistant',content:'直前のMY LIFE更新を1つ戻しました。会話はそのまま残してあります。'});save();renderHistory();renderLife()
}
function showToast(text){addMessage('assistant',text)}

function openProfile(){openModal(`<div class="modalTop"><b>今の自分を編集</b><button class="close" onclick="closeModal()">×</button></div><div class="profileform"><label>今の仕事</label><input id="pfWork" value="${esc(S.profile.work)}"><label>家族</label><input id="pfFamily" value="${esc(S.profile.family)}"><label>自分のプロジェクト・やりたいこと</label><input id="pfProject" value="${esc(S.profile.project)}"><label>今いちばん変えたいこと</label><input id="pfWish" value="${esc(S.profile.wish)}"><button class="primary" onclick="saveProfile()">この現在地で話す</button></div>`)}
function saveProfile(){S.profile.work=$('#pfWork').value.trim()||S.profile.work;S.profile.family=$('#pfFamily').value.trim()||S.profile.family;S.profile.project=$('#pfProject').value.trim()||S.profile.project;S.profile.wish=$('#pfWish').value.trim()||S.profile.wish;save();closeModal();renderLife();S.history.push({role:'assistant',content:`現在地を更新しました。「${S.profile.wish}」を前提に、続きを話しましょう。`});save();renderHistory()}
function openSummary(){
  const lines=[`当選額：${oku(S.jackpot)}`,`残り：約${oku(remaining())}`,`仕事：${S.work?.label||'未定'}`,`家族：${S.family?.label||'今の暮らしの続き'}`,`住まい：${S.home?.label||'未定'}`,`旅行：${S.travel?.label||'未定'}`,`車：${S.car?.label||'未定'}`,`挑戦：${S.project?.label||'未定'}`,`自由な平日：+${Math.round((Number(S.freeWeekdays)||0)*50)}日/年`];
  openModal(`<div class="modalTop"><b>今のMY LIFE</b><button class="close" onclick="closeModal()">×</button></div><div class="summaryText">${esc(lines.join('\n'))}</div><button class="primary" onclick="closeModal()">会話に戻る</button>`)
}
function openMobileLife(){openModal(`<div class="modalTop"><b>MY LIFE</b><button class="close" onclick="closeModal()">×</button></div><div id="mobileLifeContent"></div>`);const tmp=$('#lifePanel').cloneNode(true);tmp.style.display='block';tmp.style.position='static';tmp.style.boxShadow='none';tmp.style.border='0';tmp.style.padding='0';$('#mobileLifeContent').appendChild(tmp)}
function openModal(html){$('#modal').innerHTML=html;$('#modalBack').classList.add('on');$('#modalBack').setAttribute('aria-hidden','false')}
function closeModal(){$('#modalBack').classList.remove('on');$('#modalBack').setAttribute('aria-hidden','true')}

$('#send').onclick=()=>sendMessage($('#input').value);
$('#input').addEventListener('input',autoGrow);
$('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage($('#input').value)}});
$('#profileBtn').onclick=openProfile;
$('#mobileLife').onclick=openMobileLife;
$('#jackpotSelect').onchange=e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<=0)return;S.jackpot=n;save();renderLife()};
$('#modalBack').onclick=e=>{if(e.target.id==='modalBack')closeModal()};
window.undoLast=undoLast;window.openSummary=openSummary;window.closeModal=closeModal;window.saveProfile=saveProfile;
renderLife();renderHistory();
