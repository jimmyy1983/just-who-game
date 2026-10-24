import { Game, caption } from './engine.mjs';
import { LocalMemory, formatTime } from './storage.mjs';
import { Renderer, paintSprite } from './renderer.mjs';
import { Sound } from './audio.mjs';
const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{}
const memory=new LocalMemory(storage),sound=new Sound(Boolean(memory.get('muted',false)));
let selected=memory.get('character','boy');if(!['boy','girl'].includes(selected))selected='boy';
let renderer,ready=false,sort='count',last=performance.now(),lastTotal=-1,returnFocus=null;
const keys=new Set(),stick={active:false,x:0,y:0,origin:{x:0,y:0},id:null};
function resetInput(){keys.clear();stick.active=false;stick.x=0;stick.y=0;stick.id=null;}
const game=new Game({onEvent(type,detail){
 if(type==='room'){resetInput();$('hint').textContent=game.roomIndex===0?'拖动移动 · 也可使用方向键 / WASD':'';lastTotal=-1;}
 if(type==='start'){sound.unlock();$('hint').textContent='收集时钟，门开了就走。';}
 if(['clock','chase','door','death','win'].includes(type))sound.play(type);
 if(type==='clock'||type==='chase'){$('total').classList.remove('bump');void $('total').offsetWidth;$('total').classList.add('bump');}
 if(type==='chase')$('hint').textContent='';
 if(type==='door')resetInput();
 if(type==='pause'){resetInput();$('pause-panel').hidden=false;$('resume').focus();}
 if(type==='resume'){$('pause-panel').hidden=true;last=performance.now();$('scene').focus({preventScroll:true});}
 if(type==='death'||type==='win'){
  resetInput();memory.add(detail);$('hud').hidden=true;$('hint').textContent='';
  $('result-kicker').textContent=type==='win'?'最后一页，轻轻合上。':'原来，那些时钟是……';
  $('result-title').textContent=type==='win'?'你走到了最后':`你走过了 ${detail.count} 年`;
  $('result-caption').textContent=caption(detail.count);$('result-time').textContent=`有效生存时间 ${formatTime(detail.seconds)}`;
  $('result').hidden=false;$('retry').focus();
 }
}});
function select(character){selected=character;memory.set('character',character);document.querySelectorAll('[data-character]').forEach(b=>{const yes=b.dataset.character===character;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});}
document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>select(b.dataset.character));select(selected);
function muteUI(){document.querySelectorAll('.mute').forEach(b=>{b.textContent=b.classList.contains('icon-button')?(sound.muted?'♩̸':'♪'):`声音 ${sound.muted?'关':'开'}`;b.setAttribute('aria-label',sound.muted?'开启声音':'静音');b.setAttribute('aria-pressed',String(sound.muted));});}
document.querySelectorAll('.mute').forEach(b=>b.onclick=()=>{sound.unlock();sound.muted=!sound.muted;memory.set('muted',sound.muted);muteUI();});muteUI();
function start(){if(!ready)return;for(const id of ['menu','result','pause-panel','records','help'])$(id).hidden=true;$('play').hidden=false;$('hud').hidden=false;$('book').classList.add('in-game');$('book').classList.remove('home');resetInput();game.start(selected);last=performance.now();$('scene').focus({preventScroll:true});}
function home(){resetInput();game.state='menu';for(const id of ['play','pause-panel','result','records','help'])$(id).hidden=true;$('menu').hidden=false;$('book').classList.remove('in-game');$('book').classList.add('home');$('start').focus();}
$('start').onclick=start;$('retry').onclick=start;$('pause').onclick=()=>game.pause();$('resume').onclick=()=>game.resume();$('pause-home').onclick=home;$('result-home').onclick=home;
function showRecords(){returnFocus=document.activeElement;renderRecords();$('records').hidden=false;$('records-close').focus();}
function renderRecords(){const rows=memory.records(sort);$('record-rows').replaceChildren();rows.forEach((r,i)=>{const tr=document.createElement('tr');for(const value of [String(i+1).padStart(2,'0'),String(r.count),formatTime(r.seconds)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('record-rows').append(tr);});$('empty-records').hidden=rows.length>0;$('storage-note').textContent=memory.available?'纪录保存在本机浏览器，清除浏览数据会移除纪录。':'浏览器存储不可用，本次打开期间仍可游玩与查看纪录。';}
$('records-open').onclick=showRecords;$('result-records').onclick=showRecords;
$('records-close').onclick=()=>{$('records').hidden=true;returnFocus?.focus();};
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;document.querySelectorAll('[data-sort]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));});renderRecords();});
$('help-open').onclick=()=>{$('help').hidden=false;$('help-close').focus();};
function closeHelp(){$('help').hidden=true;$('help-open').focus();}$('help-close').onclick=closeHelp;$('help-done').onclick=closeHelp;
function worldPoint(e){const r=$('scene').getBoundingClientRect();return{x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*720/r.height};}
$('scene').addEventListener('pointerdown',e=>{if(game.state!=='playing'||stick.active||!e.isPrimary)return;e.preventDefault();sound.unlock();stick.active=true;stick.id=e.pointerId;stick.origin=worldPoint(e);stick.x=0;stick.y=0;$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!stick.active||e.pointerId!==stick.id)return;e.preventDefault();const p=worldPoint(e),dx=p.x-stick.origin.x,dy=p.y-stick.origin.y,m=Math.hypot(dx,dy);const strength=Math.min(1,m/32);stick.x=m>3?dx/m*strength:0;stick.y=m>3?dy/m*strength:0;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(event,e=>{if(e.pointerId===stick.id){stick.active=false;stick.id=null;stick.x=0;stick.y=0;}});
const controlKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d']);
window.addEventListener('keydown',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(key==='Escape'){if(!$('records').hidden){$('records-close').click();return;}if(!$('help').hidden){closeHelp();return;}if(game.state==='paused')game.resume();else game.pause();return;}if(controlKeys.has(key)&&['playing','transition'].includes(game.state)){e.preventDefault();keys.add(key);sound.unlock();}});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
function background(){resetInput();game.pause();}
window.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});window.addEventListener('pagehide',background);
window.addEventListener('resize',()=>renderer?.resize());
// Keep keyboard focus inside the visible paper note.
document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const panels=[...document.querySelectorAll('.overlay:not([hidden])')];const panel=panels.at(-1);if(!panel)return;const buttons=[...panel.querySelectorAll('button:not([disabled]),a[href]')];if(!buttons.length)return;const first=buttons[0],end=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}});
const atlas=new Image();atlas.onload=()=>{renderer=new Renderer($('scene'),atlas);document.querySelectorAll('[data-character]').forEach(b=>{const ctx=b.querySelector('canvas').getContext('2d');paintSprite(ctx,atlas,b.dataset.character==='boy'?0:1,100,296,150,275,{anchor:1});});paintSprite($('hud-clock').getContext('2d'),atlas,4,28,31,50,56);ready=true;$('start').disabled=false;$('start').textContent='推门进去';$('load-status').textContent='';};
atlas.onerror=()=>{$('load-status').textContent='手绘素材未能加载，请刷新后再试。';};atlas.src='./assets/atlas.png';
function frame(now){const dt=Math.min((now-last)/1000,.06);last=now;if(ready){if(game.state==='playing'||game.state==='transition'){const x=Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a')),y=Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));game.update(dt,{x:x||y?x:stick.x,y:x||y?y:stick.y});}if(game.room){renderer.draw(game,now/1000,stick);if(lastTotal!==game.total){$('total').textContent=game.total;$('room-count').textContent=`${game.count}/10`;lastTotal=game.total;}if(game.roomIndex===0&&game.roomTime>7&&game.mode==='collect')$('hint').textContent='';}}requestAnimationFrame(frame);}requestAnimationFrame(frame);
