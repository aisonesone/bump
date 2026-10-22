let key, items=[], visible=[], selected=0, category='character', revision=0;
const urls=new Map();
let originalImageURL=null;
function releaseOriginalImage(){if(originalImageURL){URL.revokeObjectURL(originalImageURL);originalImageURL=null;}}
const gallery=document.querySelector('#gallery'), viewer=document.querySelector('#viewer'), full=document.querySelector('#full-image'), stage=document.querySelector('#image-stage');
async function decrypt(path){const response=await fetch(path);if(!response.ok)throw Error('load');const bytes=new Uint8Array(await response.arrayBuffer());return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12));}
async function asset(path,type="image/webp"){const paths=Array.isArray(path)?path:[path],cacheKey=paths.join("|");if(!urls.has(cacheKey))urls.set(cacheKey,Promise.all(paths.map(decrypt)).then(parts=>URL.createObjectURL(new Blob(parts,{type}))).catch(error=>{urls.delete(cacheKey);throw error}));return urls.get(cacheKey);}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){observer.unobserve(entry.target);const image=entry.target;asset(image.dataset.path).then(url=>image.src=url).catch(()=>{image.closest('button').addEventListener('click',()=>asset(image.dataset.path).then(url=>image.src=url),{once:true})});}}},{rootMargin:'400px'});
function render(){gallery.querySelectorAll("audio,video").forEach(media=>media.pause());observer.disconnect();visible=items.filter(item=>item.category===category);if(category==="voice")visible.sort((a,b)=>(a.episode||1000)-(b.episode||1000));gallery.replaceChildren();gallery.classList.toggle("voices",category==="voice");gallery.classList.toggle("previews",category==="preview");if(category==="preview"){visible.forEach(renderPreview);return;}if(category==="voice"){const note=document.createElement("p");note.className="voice-note";note.textContent="全25話・台本順の既存素材版です。未収録10行を含み、台本全文の完全収録版ではありません。細かいセリフ間違いは本動画生成時に修正します。";gallery.append(note);visible.forEach(renderVoice);return;}const groups=new Map();for(const [index,item] of visible.entries()){const button=document.createElement('button');button.className='card';button.setAttribute('aria-label',item.name);const frame=document.createElement('div');frame.className='frame';const image=document.createElement('img');image.alt=item.name;image.width=item.width;image.height=item.height;image.dataset.path=item.thumb;const name=document.createElement('p');name.textContent=item.name;frame.append(image);button.append(frame,name);button.addEventListener('click',()=>show(index));if(item.comparison){let group=groups.get(item.comparison);if(!group){group=document.createElement("section");group.className="comparison";group.setAttribute("aria-label","天満澪 比較");groups.set(item.comparison,group);gallery.append(group);}group.append(button);}else{gallery.append(button);}observer.observe(image);}}
async function show(index){selected=(index+visible.length)%visible.length;const item=visible[selected], ticket=++revision;stage.classList.remove('zoomed');full.removeAttribute('src');releaseOriginalImage();full.alt=item.name;document.querySelector('#image-name').textContent=item.name;if(!viewer.open)viewer.showModal();try{const url=item.srcParts?URL.createObjectURL(new Blob(await Promise.all(item.srcParts.map(decrypt)),{type:item.mime||"image/png"})):await asset(item.src);if(ticket===revision){if(item.srcParts)originalImageURL=url;full.src=url;}else if(item.srcParts){URL.revokeObjectURL(url);}}catch{viewer.close();}}
document.querySelector('#unlock').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,input=form.elements.password,button=form.querySelector('button');button.disabled=true;try{const config=await fetch('crypto.json').then(r=>r.json());const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.value),'PBKDF2',false,['deriveKey']);key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:Uint8Array.from(atob(config.salt),c=>c.charCodeAt(0)),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);items=JSON.parse(new TextDecoder().decode(await decrypt('catalog.bin')));input.value='';document.querySelector('#gate').hidden=true;document.querySelector('#site').hidden=false;render();document.querySelector('nav button').focus();}catch{form.querySelector('.password').classList.add('invalid');input.setAttribute('aria-invalid','true');input.select();}finally{button.disabled=false;}});
document.querySelector('input').addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');document.querySelector('.password').classList.remove('invalid')});
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));gallery.setAttribute('aria-label',button.textContent);render();window.scrollTo({top:0});}));
document.querySelector('#close').onclick=()=>viewer.close();document.querySelector('#previous').onclick=()=>show(selected-1);document.querySelector('#next').onclick=()=>show(selected+1);viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(selected-1)}if(event.key==='ArrowRight'){event.preventDefault();show(selected+1)}});full.onclick=()=>stage.classList.toggle('zoomed');viewer.addEventListener('close',()=>{revision++;full.removeAttribute('src');releaseOriginalImage()});

function renderVoice(item){
 const card=document.createElement('section');card.className='voice-card';
 const name=document.createElement('p');name.textContent=item.name;
 const row=document.createElement('div');row.className='voice-controls';
 const audio=document.createElement('audio');audio.preload='metadata';
 const play=document.createElement('button');play.type='button';play.textContent='▶';play.setAttribute('aria-label',item.name+'を再生');
 const seek=document.createElement('input');seek.type='range';seek.min=0;seek.max=100;seek.value=0;seek.step=.1;seek.disabled=true;seek.setAttribute('aria-label',item.name+'の再生位置');
 const time=document.createElement('span');time.className='voice-time';time.textContent='0:00 / 0:00';
 const format=n=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'0:00';
 time.textContent='0:00 / '+format(item.duration);
 const update=()=>{time.textContent=format(audio.currentTime)+' / '+format(audio.duration);if(Number.isFinite(audio.duration)){seek.max=audio.duration;seek.value=audio.currentTime;seek.disabled=false;}};
 play.onclick=async()=>{if(!audio.paused){audio.pause();return;}play.disabled=true;try{if(!audio.src)audio.src=await asset(item.parts||item.src,item.mime||'audio/mpeg');if(!card.isConnected)return;gallery.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause()});await audio.play();}catch{play.textContent='↻';play.setAttribute('aria-label',item.name+'の再生を再試行');}finally{play.disabled=false;}};
 audio.onplay=()=>{play.textContent='Ⅱ';play.setAttribute('aria-label',item.name+'を一時停止');};
 audio.onpause=audio.onended=()=>{play.textContent='▶';play.setAttribute('aria-label',item.name+'を再生');};
 audio.ontimeupdate=audio.onloadedmetadata=update;seek.oninput=()=>{audio.currentTime=Number(seek.value);update();};
 row.append(play,seek,time);card.append(name,row,audio);gallery.append(card);
}

function renderPreview(item){
 const card=document.createElement('section');card.className='preview-card';
 const name=document.createElement('p');name.textContent=item.name;
 const note=document.createElement('p');note.className='preview-note';note.textContent='※存在しないシーンのサンプルです';
 const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',item.name);
 const status=document.createElement('span');status.className='preview-status';status.setAttribute('role','status');status.textContent='読み込み中…';
 video.onloadedmetadata=()=>{status.textContent='';};
 video.onerror=()=>{status.textContent='動画を再生できませんでした。プレビューを開き直してください。';};
 card.append(name,note,video,status);gallery.append(card);
 const cacheKey=item.parts.join('|');
 if(!urls.has(cacheKey))urls.set(cacheKey,Promise.all(item.parts.map(decrypt)).then(parts=>URL.createObjectURL(new Blob(parts,{type:'video/mp4'}))).catch(error=>{urls.delete(cacheKey);throw error}));
 urls.get(cacheKey).then(url=>{if(card.isConnected)video.src=url;}).catch(()=>{if(card.isConnected)status.textContent='読み込めませんでした。プレビューを開き直してください。';});
}
