/* eslint-disable */
// @ts-nocheck
// Vendored port of the reference implementation; kept close to the original
// source so the motion behaviour stays identical.
/**
 * My Room motion engine.
 * Ported verbatim from the provided `my-room-velocity-upgraded.html` reference
 * (WebGL logo renderer, particle transition, ambient canvas), scoped to a React
 * container and wired to the app's Supabase auth via `options.onSubmit`.
 */
const MODEL_URL = "/assets/my-room-model.b64";

export type MyRoomMode = "login" | "signup" | "reset";

export type MyRoomSubmit = {
  mode: MyRoomMode;
  name: string;
  email: string;
  password: string;
};

export type MyRoomOptions = {
  onSubmit: (payload: MyRoomSubmit) => void;
};

export type MyRoomHandle = {
  destroy: () => void;
  setStatus: (text: string) => void;
  setBusy: (value: boolean) => void;
};

export function createMyRoom(root: HTMLElement, options: MyRoomOptions): MyRoomHandle {
'use strict';
let destroyed = false;
'use strict';
// Change these values to tune the visual without changing the animation logic.
const CONFIG={transitionMs:1750,entranceMs:2200,particlesPerLogo:2200,maxPixelRatio:1.6};
const $=(s)=>root.querySelector(s) as any,stage=$('.stage'),panel=$('.account-area'),card=$('.card'),hit=$('.enter-hit'),back=$('.back'),form=$('.form'),slot=$('.logo-slot'),status=$('.status'),pageStatus=$('.page-status'),fallback=$('.fallback'),logoCanvas=$('.logos'),ambient=$('.ambient');
const media=matchMedia('(prefers-reduced-motion: reduce)'),motionButton=$('.motion');
let paused=media.matches,opened=false,mode='login',busy=false,loaded=false,transition=null,entranceAt=0,clock=0,last=performance.now(),width=1,height=1,dpr=1,raf=0,offscreen=false;
let busy2=false;void busy2;
let px=0,py=0,sx=0,sy=0,dragging=false,drag=null,spin=0,tilt=0,velocity=0,ignoreClick=false;
const atomCanvas=$('.atoms'),fx=atomCanvas.getContext('2d');
let models=[],pose=[],gpu=null,ctx=ambient.getContext('2d'),layoutDirty=true,logoTargetY=200;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)},ease=t=>1-Math.pow(1-clamp(t),3);
let seed=48151;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
function updateMotion(){stage.classList.toggle('static',paused);motionButton.setAttribute('aria-pressed',String(paused));motionButton.setAttribute('aria-label',paused?'Aktifkan animasi':'Jeda animasi');motionButton.querySelector('span').textContent=paused?'Aktifkan animasi':'Jeda animasi';$('.pause-icon').style.display=paused?'none':'';$('.play-icon').style.display=paused?'':'none';if(paused&&transition)finishTransition();if(paused)entranceAt=-1e8;requestDraw();}
motionButton.addEventListener('click',()=>{paused=!paused;updateMotion()});
const onMedia=(e:MediaQueryListEvent)=>{paused=e.matches;updateMotion()};media.addEventListener('change',onMedia);
function setMode(next){
 mode=next;const reg=next==='signup',reset=next==='reset';
 $('#form-title').textContent=reg?'Bikin akun My Room':reset?'Lupa password?':'Masuk ke My Room';
 $('.description').textContent=reg?'Mulai dari ruang yang sama.':reset?'Masukkan email akun lo.':'Senang ketemu lo lagi.';
 $('.name-field').hidden=!reg;form.elements.name.required=reg;form.elements.name.disabled=!reg;
 $('.password-field').hidden=reset;form.elements.password.required=!reset;form.elements.password.disabled=reset;form.elements.password.type='password';form.elements.password.autocomplete=reg?'new-password':'current-password';
 $('.eye').setAttribute('aria-label','Tampilkan password');$('.eye').setAttribute('aria-pressed','false');
 $('.forgot-row').hidden=reset||reg;$('.submit span').textContent=reg?'Daftar':reset?'Kirim tautan reset':'Masuk';
 $('.signup-row>span').textContent=reg?'Sudah punya akun?':reset?'Ingat password lo?':'Belum punya akun?';$('.signup').textContent=reg||reset?'Masuk':'Daftar';
 status.textContent='';$('.form-heading').classList.remove('form-swap');void card.offsetWidth;$('.form-heading').classList.add('form-swap');layoutDirty=true;requestDraw();
}
$('.forgot').addEventListener('click',()=>{setMode('reset');form.elements.email.focus({preventScroll:true})});
$('.signup').addEventListener('click',()=>{setMode(mode==='login'?'signup':'login');(mode==='signup'?form.elements.name:form.elements.email).focus({preventScroll:true})});
$('.eye').addEventListener('click',()=>{const showing=form.elements.password.type==='password';form.elements.password.type=showing?'text':'password';$('.eye').setAttribute('aria-label',showing?'Sembunyikan password':'Tampilkan password');$('.eye').setAttribute('aria-pressed',String(showing))});
// Front-end preview only. No credentials are transmitted, logged, or persisted.
// Replace this handler with your own authentication integration when ready.
form.addEventListener('submit',(e:Event)=>{e.preventDefault();const data=new FormData(form);options.onSubmit({mode,name:String(data.get('name')||''),email:String(data.get('email')||''),password:String(data.get('password')||'')});layoutDirty=true;requestDraw()});
function target(i,open){const sign=i?-1:1; // RK at left, UI at right.
 const side=-sign;
 if(open)return {x:width/2+side*40,y:logoTargetY,size:55,rx:0,ry:side*.07,rz:0};
 const size=Math.min(200,width*.29,height*.255),separation=Math.min(150,width*.205);
 return {x:width/2+side*separation,y:height*.495+(paused?0:Math.sin(clock*.72+i*1.8)*5),size,rx:paused?0:sy*.15+tilt,ry:paused?side*.08:spin+sx*.45+side*.09+Math.sin(clock*.42)*.11,rz:paused?0:Math.sin(clock*.35+i)*.014};
}
function measure(){width=stage.clientWidth;height=stage.clientHeight;dpr=Math.min(window.devicePixelRatio||1,CONFIG.maxPixelRatio);[ambient,logoCanvas,atomCanvas].forEach(c=>{const w=Math.round(width*dpr),h=Math.round(height*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h}});if(!panel.hidden){/* card transform must not affect target anchor */logoTargetY=panel.offsetTop+parseFloat(getComputedStyle(panel).paddingTop)+parseFloat(getComputedStyle(card).paddingTop)+slot.offsetHeight/2;}if(gpu)gpu.gl.viewport(0,0,logoCanvas.width,logoCanvas.height);layoutDirty=false;}
function begin(open){
 if(busy||opened===open)return;
 if(layoutDirty)measure();const source=[0,1].map(i=>({...pose[i]||target(i,opened)}));
 opened=open;busy=true;stage.classList.toggle('open',open);hit.inert=true;hit.hidden=true;back.disabled=true;back.hidden=false;
 if(open){panel.hidden=false;panel.inert=true;form.elements.email.disabled=false;setMode('login');}else{panel.inert=true;card.classList.remove('shown');form.reset();form.elements.email.disabled=true;panel.hidden=true;}
 layoutDirty=true;measure();transition={start:performance.now(),source,open};
 if(paused||!loaded){finishTransition();return;}requestDraw();
}
function finishTransition(){
 transition=null;busy=false;back.disabled=false;back.hidden=!opened;
 if(opened){panel.hidden=false;panel.inert=false;card.classList.add('shown');form.elements.email.disabled=false;setMode('login');if(matchMedia('(pointer:fine)').matches)form.elements.email.focus({preventScroll:true});}
 else{panel.hidden=true;panel.inert=true;hit.hidden=false;hit.inert=false;setMode('login');form.elements.password.disabled=true;spin=0;tilt=0;velocity=0;hit.focus({preventScroll:true});}
 layoutDirty=true;requestDraw();
}
hit.addEventListener('click',()=>{if(ignoreClick){ignoreClick=false;return}begin(true)});back.addEventListener('click',()=>begin(false));
const onKeydown=(e:KeyboardEvent)=>{if(e.key==='Escape'&&opened&&!busy)begin(false)};document.addEventListener('keydown',onKeydown);
hit.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,id:e.pointerId};dragging=true;ignoreClick=false;hit.setPointerCapture(e.pointerId)});
hit.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;if(drag.moved&&!paused){spin+=dx*.01;tilt=clamp(tilt+dy*.004,-.65,.65);velocity=dx*.009;}drag.lastX=e.clientX;drag.lastY=e.clientY;requestDraw()});
function release(e){if(!drag)return;ignoreClick=drag.moved;dragging=false;drag=null;if(hit.hasPointerCapture(e.pointerId))hit.releasePointerCapture(e.pointerId);requestDraw()}
hit.addEventListener('pointerup',release);hit.addEventListener('pointercancel',e=>{release(e);ignoreClick=true});
stage.addEventListener('pointermove',e=>{const b=stage.getBoundingClientRect();px=(e.clientX-b.left)/width-.5;py=(e.clientY-b.top)/height-.5;stage.classList.add('hovering');requestDraw()},{passive:true});
stage.addEventListener('pointerleave',()=>{px=0;py=0;stage.classList.remove('hovering')});
const resize=new ResizeObserver(()=>{layoutDirty=true;requestDraw()});resize.observe(stage);resize.observe(card);
const visibility=new IntersectionObserver(entries=>{offscreen=!entries[0].isIntersecting;if(!offscreen){last=performance.now();requestDraw()}});visibility.observe(stage);
const onVisibility=()=>{last=performance.now();if(!document.hidden)requestDraw()};document.addEventListener('visibilitychange',onVisibility);
const rotateGLSL=`vec3 rotate(vec3 p,vec3 a){float cx=cos(a.x),sx=sin(a.x),cy=cos(a.y),sy=sin(a.y),cz=cos(a.z),sz=sin(a.z);p=vec3(p.x,cx*p.y-sx*p.z,sx*p.y+cx*p.z);p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);return vec3(cz*p.x-sz*p.y,sz*p.x+cz*p.y,p.z);}`;
const vertexSource=`precision highp float;attribute vec3 aPosition;attribute vec3 aNormal;uniform vec2 uView;uniform vec2 uCenter;uniform float uSize;uniform vec3 uAngle;varying vec3 vNormal;varying vec3 vPosition;${rotateGLSL}void main(){vec3 r=rotate(aPosition,uAngle)*uSize;vNormal=rotate(aNormal,uAngle);vPosition=r;vec2 screen=uCenter+vec2(r.x,-r.y);gl_Position=vec4(screen.x/uView.x*2.-1.,1.-screen.y/uView.y*2.,-r.z/1500.,1.);}`;
const fragmentSource=`precision mediump float;uniform vec3 uColor;uniform float uAlpha;uniform float uMetal;varying vec3 vNormal;varying vec3 vPosition;void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 key=normalize(vec3(-.55,.7,1.));vec3 fill=normalize(vec3(.8,.15,.7));float a=max(dot(n,key),0.);float b=max(dot(n,fill),0.);float shine=pow(max(dot(n,normalize(key+vec3(0.,0.,1.))),0.),38.);float rim=pow(1.-abs(n.z),2.7);vec3 color=uColor*(.45+a*.85+b*.38)+mix(vec3(.45,.57,.85),vec3(1.,.91,.7),uMetal)*shine*.6+vec3(.28,.38,.62)*rim*.2;color=pow(color/(color+.55),vec3(1./2.2));gl_FragColor=vec4(color,uAlpha);}`;
function createRenderer(){
 const gl=logoCanvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader};
 const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragmentSource);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
 const uniforms={};['uView','uCenter','uSize','uAngle','uColor','uAlpha','uMetal'].forEach(k=>uniforms[k]=gl.getUniformLocation(program,k));
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
 return {gl,program,uniforms,position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal')};
}
function prepareMesh(positions,indices,color,metal){
 const normals=new Float32Array(positions.length);
 for(let j=0;j<indices.length;j+=3){const a=indices[j]*3,b=indices[j+1]*3,c=indices[j+2]*3,ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const k of [a,b,c]){normals[k]+=nx;normals[k+1]+=ny;normals[k+2]+=nz}}
 for(let i=0;i<normals.length;i+=3){const len=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=len;normals[i+1]/=len;normals[i+2]/=len;}
 const gl=gpu.gl;const buffer=(data,type)=>{const b=gl.createBuffer();gl.bindBuffer(type,b);gl.bufferData(type,data,gl.STATIC_DRAW);return b};
 return {positions,indices,color,metal,pbuffer:buffer(positions,gl.ARRAY_BUFFER),nbuffer:buffer(normals,gl.ARRAY_BUFFER),ibuffer:buffer(indices,gl.ELEMENT_ARRAY_BUFFER)};
}
function sampleModel(parts,count){
 // Area-weighted sampling of the actual logo surfaces, not a generic cloud.
 const tris=[];let total=0;
 for(const part of parts){const p=part.positions,idx=part.indices;for(let j=0;j<idx.length;j+=3){const a=idx[j]*3,b=idx[j+1]*3,c=idx[j+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];const area=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;if(area>1e-9){total+=area;tris.push({p,a,b,c,color:part.color,end:total})}}}
 const points=[];for(let k=0;k<count;k++){const pick=random()*total;let lo=0,hi=tris.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(tris[mid].end<pick)lo=mid+1;else hi=mid}const t=tris[lo],u=Math.sqrt(random()),v=random(),a=1-u,b=u*(1-v),c=u*v;const color=t.color.map(x=>Math.round(90+165*Math.pow(clamp(x),1/2.2)));points.push({x:t.p[t.a]*a+t.p[t.b]*b+t.p[t.c]*c,y:t.p[t.a+1]*a+t.p[t.b+1]*b+t.p[t.c+1]*c,z:t.p[t.a+2]*a+t.p[t.b+2]*b+t.p[t.c+2]*c,angle:random()*Math.PI*2,radius:35+random()*160,seed:random(),color:`rgb(${color.join(',')})`});}return points;
}
async function init(){
 try{
 const response=await fetch(MODEL_URL);if(!response.ok)throw Error('model fetch failed');const packed=Uint8Array.from(atob((await response.text()).trim()),c=>c.charCodeAt(0));
 const bytes=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),length=new DataView(bytes).getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,4,length))),base=4+length;
 gpu=createRenderer();
 for(const name of ['RK','UI']){const parts=meta[name].map(m=>{const p=new Float32Array(m.v),view=new DataView(bytes,base+m.offset,m.v*2+m.i*2);for(let i=0;i<m.v;i++)p[i]=view.getInt16(i*2,true)/10000;const idx=new Uint16Array(m.i);for(let i=0;i<m.i;i++)idx[i]=view.getUint16(m.v*2+i*2,true);return {p,idx,m}});const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const part of parts)for(let i=0;i<part.p.length;i++){const axis=i%3;low[axis]=Math.min(low[axis],part.p[i]);high[axis]=Math.max(high[axis],part.p[i]);}const unit=1/Math.max(high[0]-low[0],high[1]-low[1]);const meshes=parts.map(({p,idx,m})=>{for(let i=0;i<p.length;i++)p[i]=(p[i]-(low[i%3]+high[i%3])/2)*unit;return prepareMesh(p,idx,m.color,m.metal)});models.push({meshes,points:sampleModel(meshes,width<600?1300:CONFIG.particlesPerLogo)});}
 loaded=true;fallback.hidden=true;entranceAt=performance.now();pageStatus.textContent='';layoutDirty=true;
 }catch(error){gpu=null;fallback.hidden=false;pageStatus.textContent='Mode ringan aktif. Klik untuk masuk.';console.warn('My Room: using embedded vector logo fallback.');}
 requestDraw();
}
logoCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gpu=null;loaded=false;fallback.hidden=false;pageStatus.textContent='Mode ringan aktif. Klik untuk masuk.';if(transition)finishTransition();requestDraw()});
function project(p,pose){let x=p.x,y=p.y,z=p.z;const cx=Math.cos(pose.rx),ax=Math.sin(pose.rx),cy=Math.cos(pose.ry),ay=Math.sin(pose.ry),cz=Math.cos(pose.rz),az=Math.sin(pose.rz);[y,z]=[cx*y-ax*z,ax*y+cx*z];[x,z]=[cy*x+ay*z,-ay*x+cy*z];return {x:pose.x+(cz*x-az*y)*pose.size,y:pose.y-(az*x+cz*y)*pose.size};}
const dust=Array.from({length:64},()=>({x:random(),y:random(),s:random(),a:random()*6.28}));
function drawAmbient(now){
 if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const opacity=opened?.28:1;
 // A restrained, flowing particle horizon with cursor parallax.
 const cols=width<600?52:92,rows=14;
 for(let row=0;row<rows;row++){const depth=row/(rows-1);ctx.fillStyle=`rgba(109,150,222,${(.02+depth*.10)*opacity})`;ctx.beginPath();for(let col=0;col<cols;col++){const u=col/(cols-1),x=u*width*1.18-width*.09+sx*depth*19;const wave=Math.sin(u*9+clock*.18+depth*3)*15+Math.sin(u*16-clock*.14+depth*2)*5;const y=height*.80+depth*depth*height*.2+wave*(.3+depth*.7)+sy*depth*9;const radius=.45+depth*.55;ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,Math.PI*2)}ctx.fill();}
 for(const p of dust){const x=p.x*width+Math.sin(clock*.1+p.a)*7+sx*p.s*12,y=p.y*height+Math.cos(clock*.08+p.a)*8;const a=(.04+p.s*.16)*opacity;ctx.fillStyle=`rgba(165,192,237,${a})`;ctx.beginPath();ctx.arc(x,y,.4+p.s*.6,0,Math.PI*2);ctx.fill();}
 if(transition){const t=clamp((now-transition.start)/CONFIG.transitionMs);ctx.strokeStyle=`rgba(160,193,255,${Math.sin(t*Math.PI)*.08})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(width/2,height*.50,Math.min(width*.46,340)*(t+.1),80*(t+.1),-.1,0,Math.PI*2);ctx.stroke();}
}
function drawParticles(model,from,to,t,entrance=false){
 if(!fx||paused)return;const mix=ease(t),scatter=Math.sin(Math.PI*t),alpha=entrance?(1-smooth(.76,1,t))*smooth(0,.16,t):smooth(0,.12,t)*(1-smooth(.83,1,t));if(alpha<.003)return;
 fx.save();fx.globalCompositeOperation='lighter';
 for(const p of model.points){const start=project(p,from),end=project(p,to),angle=p.angle+t*1.6,r=(entrance?(1-mix):scatter)*p.radius;const x=lerp(start.x,end.x,mix)+Math.cos(angle)*r,y=lerp(start.y,end.y,mix)+Math.sin(angle)*r*.6-(entrance?0:scatter*34);const s=(.48+p.seed*.7)*(entrance?1:1+scatter*.35);fx.globalAlpha=alpha*(.35+p.seed*.55);fx.fillStyle=p.color;fx.fillRect(x-s/2,y-s/2,s,s);}
 fx.restore();
}
function drawMesh(model,p,alpha){
 if(!gpu||alpha<.004)return;const {gl,uniforms:u,position,normal}=gpu;gl.uniform2f(u.uView,width,height);gl.uniform2f(u.uCenter,p.x,p.y);gl.uniform1f(u.uSize,p.size);gl.uniform3f(u.uAngle,p.rx,p.ry,p.rz);gl.uniform1f(u.uAlpha,alpha);
 for(const m of model.meshes){gl.bindBuffer(gl.ARRAY_BUFFER,m.pbuffer);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.nbuffer);gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ibuffer);gl.uniform3fv(u.uColor,m.color);gl.uniform1f(u.uMetal,m.metal);gl.drawElements(gl.TRIANGLES,m.indices.length,gl.UNSIGNED_SHORT,0);}
}
function requestDraw(){if(destroyed)return;if(!raf&&!document.hidden&&!offscreen)raf=requestAnimationFrame(frame)}
function frame(now:number){
 raf=0;if(destroyed||document.hidden||offscreen)return;if(layoutDirty)measure();const dt=Math.min((now-last)/1000,.05);last=now;if(!paused){clock+=dt;sx+=(px-sx)*(1-Math.exp(-dt*5));sy+=(py-sy)*(1-Math.exp(-dt*5));if(!dragging&&!opened){spin+=velocity;velocity*=Math.exp(-dt*7);tilt*=Math.exp(-dt*2.5);}}
 drawAmbient(now);if(fx){fx.setTransform(dpr,0,0,dpr,0,0);fx.clearRect(0,0,width,height);}if(gpu){gpu.gl.clear(gpu.gl.COLOR_BUFFER_BIT|gpu.gl.DEPTH_BUFFER_BIT);gpu.gl.useProgram(gpu.program);}
 if(transition&&now-transition.start>=CONFIG.transitionMs)finishTransition();
 const t=transition?clamp((now-transition.start)/CONFIG.transitionMs):0,entry=paused?1:clamp((now-entranceAt)/CONFIG.entranceMs);
 if(transition&&transition.open&&t>.43)card.classList.add('shown');
 for(let i=0;i<2;i++){
  const destination=target(i,opened);let p=destination,alpha=1;
  if(transition){const from=transition.source[i],move=ease(t);p={};for(const key of ['x','y','size','rx','ry','rz'])p[key]=lerp(from[key],destination[key],move);p.y-=Math.sin(t*Math.PI)*28;alpha=1-smooth(0,.18,t)+smooth(.80,1,t);if(loaded)drawParticles(models[i],from,destination,t);}
  else if(loaded&&!opened&&entry<1){alpha=smooth(.68,1,entry);const from={...destination,x:destination.x+(i?170:-170),y:destination.y+25,size:destination.size*1.4};drawParticles(models[i],from,destination,entry,true);}
   pose[i]=p;if(gpu&&models[i])drawMesh(models[i],p,alpha);
  if(!fallback.hidden){const el=fallback.children[i];el.style.width=p.size+'px';el.style.height=p.size+'px';el.style.left=(p.x-p.size/2)+'px';el.style.top=(p.y-p.size/2)+'px';el.style.transform=`perspective(600px) rotateY(${p.ry}rad) rotateX(${-p.rx}rad)`;el.style.opacity=String(transition?Math.max(.12,alpha):1);}
 }
 if(!paused||transition)requestDraw();
}
measure();updateMotion();void init();requestDraw();
return {
 destroy(){
  destroyed=true;
  if(raf)cancelAnimationFrame(raf);raf=0;
  media.removeEventListener('change',onMedia);
  document.removeEventListener('keydown',onKeydown);
  document.removeEventListener('visibilitychange',onVisibility);
  resize.disconnect();visibility.disconnect();
  if(gpu){const ext=gpu.gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();gpu=null;}
  models=[];
 },
 setStatus(text:string){status.textContent=text;},
 setBusy(value:boolean){
  busy2=value;
  const submit=$('.submit') as HTMLButtonElement|null;
  if(submit)submit.disabled=value;
  root.querySelectorAll('.card input').forEach((el)=>{
   const input=el as HTMLInputElement;
   if(value)input.setAttribute('data-busy','1');
   else input.removeAttribute('data-busy');
  });
 },
};
}
