import { WORLD, seeded, clamp } from './engine.mjs';
// Individual painted cutouts retain their natural proportions and transparent edges.
export const CUTS = [[91,10,200,370],[402,22,205,355],[735,9,200,371],[1040,25,208,353],
 [53,395,247,269],[378,398,249,264],[680,398,287,270],[1003,396,284,270],
 [59,682,250,232],[368,690,258,221],[671,685,300,228],[1005,685,289,226],
 [56,934,235,228],[378,927,260,236],[698,913,252,281],[1032,923,260,245]];
export function paintSprite(ctx, atlas, art, x, y, w, h, { alpha=1, angle=0, flip=false, anchor=.5 }={}) {
 const s=CUTS[art]; ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.scale(flip?-1:1,1);
 ctx.drawImage(atlas,...s,-w/2,-h*anchor,w,h);ctx.restore();
}
export class Renderer {
 constructor(canvas,atlas) { this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.atlas=atlas;this.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;this.room=null;this.texture=document.createElement('canvas');this.resize(); }
 resize(){const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=WORLD.w*dpr;this.canvas.height=WORLD.h*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 prepare(room) {
  this.room=room;const c=this.texture;c.width=480;c.height=720;const p=c.getContext('2d'),rng=seeded(room.seed),R=WORLD.room;
  p.fillStyle='#f4ecdc';p.fillRect(0,0,480,720);
  p.fillStyle='#e8dac0';p.fillRect(R.x,R.y,R.w,R.h);
  const wash=p.createLinearGradient(0,R.y,480,650);wash.addColorStop(0,'#e7dbc5');wash.addColorStop(.5,'#f1e4ca');wash.addColorStop(1,'#e4d5b9');p.fillStyle=wash;p.fillRect(R.x,R.y,R.w,R.h);
  // Fine wooden boards and pencil grain: identical over every hidden floor tile.
  p.lineWidth=.65;
  for(let x=R.x;x<=R.x+R.w;x+=24){p.strokeStyle=`rgba(130,106,72,${.08+rng()*.09})`;p.beginPath();p.moveTo(x+.3,R.y);p.lineTo(x-.4,R.y+R.h);p.stroke();
   for(let y=R.y+Math.floor(rng()*5)*24;y<R.y+R.h;y+=96+rng()*80){p.beginPath();p.moveTo(x,y);p.lineTo(x+24,y+1);p.stroke();}}
  for(let i=0;i<15000;i++){const x=rng()*480,y=rng()*720;p.fillStyle=rng()>.5?'#806a4911':'#fff9e926';p.fillRect(x,y,rng()*1.6,.7);}
  // A soft window-shaped wash adds light without changing collision geometry.
  p.save();p.beginPath();p.rect(R.x,R.y,R.w,R.h);p.clip();p.fillStyle='#fff7d62b';p.beginPath();p.moveTo(25,125);p.lineTo(140,125);p.lineTo(350,450);p.lineTo(160,550);p.closePath();p.fill();p.restore();
  for(const prop of room.props) paintSprite(p,this.atlas,prop.art,prop.x,prop.y,29*prop.scale,25*prop.scale,{angle:prop.angle,alpha:.42});
  // Pencil binding and stacked paper edges around the room.
  p.strokeStyle='#aa96755e';p.lineWidth=.8;
  for(let i=0;i<3;i++){p.strokeRect(10+i*3,88+i*2,460-i*6,600-i*3);}
 }
 stroke(points,color='#756850',width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
 draw(game,now,input){
  if(!game.room)return;if(this.room!==game.room)this.prepare(game.room);const c=this.ctx,R=WORLD.room;c.drawImage(this.texture,0,0);
  const jitter=this.reduce?0:Math.sin(Math.floor(now*3.5))*.25;
  c.save();c.shadowColor='#6a503d30';c.shadowBlur=9;c.shadowOffsetY=5;c.strokeStyle='#8c7a5a';c.lineWidth=8;c.strokeRect(R.x,R.y,R.w,R.h);c.restore();
  this.stroke([[R.x+jitter,R.y+1],[R.x+R.w+1,R.y-1],[R.x+R.w,R.y+R.h+1],[R.x-1,R.y+R.h],[R.x+jitter,R.y+1]],'#655b48',1.7);
  this.stroke([[R.x+5,R.y+5],[R.x+R.w-5,R.y+5],[R.x+R.w-5,R.y+R.h-5],[R.x+5,R.y+R.h-5],[R.x+5,R.y+5]],'#ad9a77',.7);
  for(const trap of game.room.traps)if(trap.state!=='hidden')this.trap(trap,game.roomTime);
  if(game.roomIndex===0&&game.mode==='collect'){
   c.save();c.strokeStyle='#9c8d8f50';c.lineWidth=1;c.setLineDash([3,7]);
   for(const g of game.ghosts){c.beginPath();g.path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
   c.fillStyle='#8d7a804a';for(let i=0;i<game.trail.length;i+=5){const p=game.trail[i];c.beginPath();c.ellipse(p.x+(i%2?3:-3),p.y,1.6,3, .3,0,Math.PI*2);c.fill();}c.restore();
  }
  if(game.room.door.open||game.state==='transition')this.door(game);
  if(game.clock){const p=game.clock,bob=this.reduce?0:Math.sin(now*3)*1.2;
   c.save();const glow=c.createRadialGradient(p.x,p.y,2,p.x,p.y,25);glow.addColorStop(0,'#fff9da9c');glow.addColorStop(1,'#fff9da00');c.fillStyle=glow;c.fillRect(p.x-25,p.y-25,50,50);c.restore();
   paintSprite(c,this.atlas,4,p.x,p.y-6+bob,25,28);}
  const actors=[...game.room.obstacles.map(o=>({type:'obstacle',item:o,y:o.y+o.h})),...game.ghosts.map(g=>({type:'ghost',item:g,y:g.y}))];
  if(game.state!=='transition')actors.push({type:'player',item:game.player,y:game.player.y});actors.sort((a,b)=>a.y-b.y);
  for(const a of actors){if(a.type==='obstacle')this.obstacle(a.item);else this.actor(a.item,game,a.type==='ghost',now);}
  if(input?.active&&game.state==='playing')this.joystick(input);
  if(game.state==='transition'&&game.transitionTime>.69){const t=clamp((game.transitionTime-.69)/.39,0,1);c.fillStyle=`rgba(247,240,224,${Math.sin(t*Math.PI/2)})`;c.fillRect(0,0,480,720);c.save();c.translate(480*(1-t),0);c.fillStyle='#e2d2b9';c.beginPath();c.moveTo(0,0);c.lineTo(34,0);c.lineTo(0,720);c.closePath();c.fill();c.restore();}
 }
 obstacle(o){const c=this.ctx;c.save();c.fillStyle='#65533d28';c.beginPath();c.ellipse(o.x+o.w/2,o.y+o.h-1,o.w*.52,7,0,0,Math.PI*2);c.fill();c.fillStyle='#bba17b';c.strokeStyle='#7f6b4f';c.lineWidth=1.2;c.fillRect(o.x+1,o.y+1,o.w-2,o.h-2);c.strokeRect(o.x+.7,o.y+.7,o.w-1.4,o.h-1.4);
  for(let x=o.x;x<o.x+o.w;x+=24)for(let y=o.y;y<o.y+o.h;y+=24)paintSprite(c,this.atlas,o.art,x+12,y+12,25,25);c.restore();}
 actor(a,game,ghost,now){const c=this.ctx,preview=ghost&&game.mode==='collect'&&a.grace>0,turn=ghost&&game.mode==='chase'&&game.freeze>0;const bob=this.reduce?0:Math.sin(a.walk)*.8;
  c.save();c.fillStyle=ghost?'#44324e20':'#77573730';c.beginPath();c.ellipse(a.x,a.y+1,ghost?9:9,3.2,0,0,Math.PI*2);c.fill();c.restore();
  if(preview||turn){c.save();c.strokeStyle=turn?'#b28b50a6':'#8a789469';c.lineWidth=1;c.setLineDash([2,3]);c.beginPath();c.ellipse(a.x,a.y,13,6,0,0,Math.PI*2);c.stroke();c.restore();}
  paintSprite(c,this.atlas,(game.character==='girl'?1:0)+(ghost?2:0),a.x,a.y+bob,25,44,{anchor:.97,flip:a.face<0,alpha:preview?.28:ghost?.86:1});
  if(turn){c.fillStyle='#f6df9c';c.beginPath();c.arc(a.x+(game.player.x>=a.x?5:-5),a.y-30,1.4,0,Math.PI*2);c.fill();}
 }
 trap(t,now){const c=this.ctx,x=t.x,y=t.y,C=WORLD.cell;if(t.state==='open'){c.fillStyle='#554a404a';c.fillRect(x-1,y-1,C+2,C+2);c.fillStyle='#37312e';c.beginPath();c.moveTo(x+1,y+4);c.lineTo(x+10,y+1);c.lineTo(x+18,y+3);c.lineTo(x+C-1,y+1);c.lineTo(x+C-2,y+C-1);c.lineTo(x+3,y+C-2);c.closePath();c.fill();this.stroke([[x+2,y+C-3],[x+2,y+5],[x+10,y+2]],'#a68a65',1.5);}else{const k=clamp((now-t.triggeredAt)/.9,0,1);this.stroke([[x+12,y+1],[x+10,y+7],[x+14,y+12],[x+9,y+18],[x+10,y+23]],'#78634d',.6+k);if(k>.2)this.stroke([[x+12,y+11],[x+20,y+13],[x+23,y+10]],'#8c7358',.8);if(k>.5)this.stroke([[x+10,y+17],[x+3,y+16],[x,y+21]],'#8c7358',.8);}}
 door(game){const c=this.ctx,d=game.room.door;c.save();c.translate(d.x,d.y);c.rotate(d.side==='top'?0:d.side==='right'?Math.PI/2:d.side==='bottom'?Math.PI:-Math.PI/2);
  c.fillStyle='#f4e6bc';c.fillRect(-24,-6,48,18);const glow=c.createLinearGradient(0,0,0,52);glow.addColorStop(0,'#ffedaa77');glow.addColorStop(1,'#ffedaa00');c.fillStyle=glow;c.beginPath();c.moveTo(-23,1);c.lineTo(23,1);c.lineTo(42,55);c.lineTo(-42,55);c.closePath();c.fill();
  if(game.state==='transition'){c.fillStyle='#a08b67';c.fillRect(-24,-4,48,9);this.stroke([[-24,5],[24,5]],'#635941',2);for(let x=-18;x<24;x+=9)this.stroke([[x,-3],[x,5]],'#76634b',.7);}else{c.fillStyle='#fff2c7';c.fillRect(-22,-7,44,12);this.stroke([[-25,7],[-25,-8],[25,-8],[25,7]],'#766142',2);this.stroke([[-24,7],[-12,15],[-12,-1],[-24,-8]],'#967c50',1.4);}c.restore();}
 joystick(input){const c=this.ctx;c.save();c.strokeStyle='#8e796449';c.lineWidth=1.5;c.beginPath();c.arc(input.origin.x,input.origin.y,24,0,Math.PI*2);c.stroke();c.fillStyle='#8e796433';c.beginPath();c.arc(input.origin.x+input.x*20,input.origin.y+input.y*20,8,0,Math.PI*2);c.fill();c.restore();}
}
