export class Sound {
 constructor(muted=false){this.muted=muted;this.context=null;}
 unlock(){try{this.context??=new (window.AudioContext||window.webkitAudioContext)();this.context.resume();}catch{}}
 tone(f,t,d=.08,volume=.04,type='sine'){if(this.muted||!this.context)return;try{const a=this.context,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,a.currentTime+t);g.gain.setValueAtTime(.0001,a.currentTime+t);g.gain.exponentialRampToValueAtTime(volume,a.currentTime+t+.006);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t+d);o.connect(g);g.connect(a.destination);o.start(a.currentTime+t);o.stop(a.currentTime+t+d+.01);}catch{}}
 play(event){if(event==='clock'){this.tone(1250,0,.045,.025,'triangle');this.tone(1700,.055,.04,.015);}else if(event==='chase'){this.tone(950,0,.07,.045,'triangle');this.tone(420,.09,.35,.05);this.tone(210,.16,.5,.035);}else if(event==='door'){this.tone(80,0,.19,.08,'triangle');this.tone(50,.04,.22,.05);}else if(event==='death'){this.tone(270,0,.3,.05);this.tone(180,.12,.5,.04);}else if(event==='win'){[523,659,784,1047].forEach((f,i)=>this.tone(f,i*.16,.7,.035));}}
}
