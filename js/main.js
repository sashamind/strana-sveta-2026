(function(){
'use strict';

var reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
var coarse=window.matchMedia('(pointer:coarse)').matches;
var doc=document.documentElement;

/* Обложка ждёт шрифты: пока они грузятся, её сборка стоит на паузе (см. CSS),
   иначе заголовок мелькает запасной гарнитурой и прыгает на Cormorant.
   Таймаут — страховка: если шрифты не пришли, показываем как есть. */
(function(){
  var go=function(){ doc.classList.add('fonts'); };
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(go);
    setTimeout(go,2500);
  } else go();
})();

function clamp(v,a,b){return v<a?a:v>b?b:v}
function scrollMax(){return Math.max(1,doc.scrollHeight-window.innerHeight)}

/* ============ 1. Шкала укрощения: прогресс, метки разделов, тон страницы ============ */

var railFill=document.getElementById('railFill');
var railTicks=document.getElementById('railTicks');
var hero=document.querySelector('.hero');
var sections=[].slice.call(document.querySelectorAll('section[data-nav]'));
var ticks=[];

sections.forEach(function(sec,i){
  var li=document.createElement('li');
  var b=document.createElement('button');
  b.className='rail__tick';
  b.type='button';
  b.innerHTML='<span class="rail__name"></span><span class="rail__dash"></span>';
  b.querySelector('.rail__name').textContent=sec.getAttribute('data-nav');
  b.addEventListener('click',function(){
    window.scrollTo({top:sec.offsetTop,behavior:reduced?'auto':'smooth'});
  });
  li.appendChild(b);
  railTicks.appendChild(li);
  ticks.push({el:li,btn:b,sec:sec});
});

function placeTicks(){
  var max=scrollMax();
  ticks.forEach(function(t){
    /* 3…95%, иначе подписи крайних разделов срезаются краем экрана */
    t.el.style.top=clamp(t.sec.offsetTop/max*100,3,95)+'%';
  });
}

/* Каждая секция гаснет в чёрное, когда уходит с экрана.
   У обложки отсчёт от её верхней кромки: она ровно в экран высотой, и гасить её
   логично сразу, как только тронули страницу.
   У остальных — от нижней кромки: раскадровка втрое выше экрана, и отсчёт сверху
   зачернил бы её прямо во время чтения. */
sections.forEach(function(sec){
  if(!sec.querySelector(':scope > .veil')){
    var v=document.createElement('div');
    v.className='veil';
    v.setAttribute('aria-hidden','true');
    sec.appendChild(v);
  }
});

function fadeSections(){
  var vh=window.innerHeight, band=vh*.55;
  sections.forEach(function(sec){
    var out;
    if(sec===hero) out=clamp(window.scrollY/(vh*.72),0,1);
    else out=clamp((band-sec.getBoundingClientRect().bottom)/band,0,1);
    sec.style.setProperty('--out',out.toFixed(3));
  });
}

function onScroll(){
  var p=clamp(window.scrollY/scrollMax(),0,1);
  railFill.style.height=p*100+'%';
  document.body.classList.toggle('scrolled',window.scrollY>40);

  fadeSections();

  var mid=window.scrollY+window.innerHeight*.4, cur=0;
  sections.forEach(function(sec,i){ if(sec.offsetTop<=mid) cur=i; });
  ticks.forEach(function(t,i){ t.btn.setAttribute('aria-current',i===cur?'true':'false'); });

  syncTimeline();
  markScrolling();
  queueFocus();
}

/* ============ 1a. Фокус чтения ============
   Блок, накрывающий центр экрана, горит в полную силу; остальные гаснут тем
   сильнее, чем дальше они от центра. Глубина затемнения переключается в CSS:
   при прокрутке сильная, в покое мягкая. */

var blocks=[].slice.call(document.querySelectorAll('.fb'));
var fRaf=0, idleTimer=0;

function markScrolling(){
  if(reduced) return;
  document.body.classList.add('scrolling');
  clearTimeout(idleTimer);
  idleTimer=setTimeout(function(){ document.body.classList.remove('scrolling'); },420);
}

function queueFocus(){ if(!fRaf) fRaf=requestAnimationFrame(applyFocus); }

function applyFocus(){
  fRaf=0;
  var vh=window.innerHeight, mid=vh*.5, range=vh*.5;
  blocks.forEach(function(b){
    var f=1;
    if(!reduced){
      var r=b.getBoundingClientRect();
      if(r.top<=mid&&r.bottom>=mid) f=1;
      else{
        var d=r.top>mid?r.top-mid:mid-r.bottom;
        f=clamp(1-d/range,0,1);
        f=f*f*(3-2*f); /* сглаживание, чтобы край не «щёлкал» */
      }
    }
    b.style.setProperty('--f',f.toFixed(3));
  });
}

applyFocus();

/* ============ 2. Подсветка карточек за курсором ============ */

if(!reduced&&!coarse){
  document.querySelectorAll('.meta,.layer').forEach(function(card){
    card.addEventListener('pointermove',function(e){
      var r=card.getBoundingClientRect();
      card.style.setProperty('--mx',(e.clientX-r.left)+'px');
      card.style.setProperty('--my',(e.clientY-r.top)+'px');
    },{passive:true});
  });
}

/* ============ 3. Искры на обложке ============ */

var cvs=document.getElementById('embers');
if(cvs&&!reduced){
  var ctx=cvs.getContext('2d'), parts=[], w=0, h=0, alive=true, anim=0;
  function size(){
    var r=cvs.getBoundingClientRect(), d=Math.min(window.devicePixelRatio||1,2);
    w=r.width; h=r.height;
    cvs.width=w*d; cvs.height=h*d; ctx.setTransform(d,0,0,d,0,0);
  }
  function spawn(y){
    return {x:Math.random()*w, y:y===undefined?h+Math.random()*h*.4:y,
            r:Math.random()*1.6+.5, v:Math.random()*.34+.12,
            sway:Math.random()*Math.PI*2, a:Math.random()*.5+.18};
  }
  function draw(){
    ctx.clearRect(0,0,w,h);
    parts.forEach(function(p){
      p.y-=p.v; p.sway+=.012; p.x+=Math.sin(p.sway)*.24;
      if(p.y<h*.18) p.a-=.004;
      if(p.y<-10||p.a<=0){ var n=spawn(); p.x=n.x; p.y=n.y; p.r=n.r; p.v=n.v; p.a=n.a; }
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,6.2832);
      ctx.fillStyle='rgba(242,'+Math.round(150+p.r*30)+',80,'+p.a+')';
      ctx.fill();
    });
    if(alive) anim=requestAnimationFrame(draw);
  }
  size();
  for(var i=0;i<46;i++) parts.push(spawn(Math.random()*h));
  draw();
  window.addEventListener('resize',size);
  /* не крутить анимацию, когда обложка ушла из вида */
  new IntersectionObserver(function(es){
    es.forEach(function(e){
      alive=e.isIntersecting;
      if(alive&&!anim) draw(); else if(!alive){cancelAnimationFrame(anim); anim=0;}
    });
  }).observe(cvs.parentNode);
}

/* ============ 4. Появление блоков ============ */

/* Контур области подставляется инлайном: обводку (stroke-dashoffset) можно
   анимировать только у настоящего SVG в документе, у <img> она недоступна.
   Файл остаётся один — assets/map.svg; не подгрузился, останется картинка. */
(function(){
  var img=document.querySelector('.mapfig .mapline');
  if(!img || !window.fetch) return;
  fetch(img.getAttribute('src')).then(function(r){
    return r.ok ? r.text() : Promise.reject();
  }).then(function(txt){
    var box=document.createElement('div'); box.innerHTML=txt;
    var svg=box.querySelector('svg'); if(!svg) return;
    svg.setAttribute('class','mapline');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('role','img');
    svg.setAttribute('aria-label',img.getAttribute('alt')||'');
    /* доли длины вместо пикселей: любой новый контур нарисуется так же */
    svg.querySelectorAll('path').forEach(function(p){ p.setAttribute('pathLength','1'); });
    img.parentNode.replaceChild(svg,img);
  }).catch(function(){});
})();

var io=new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:.12});
document.querySelectorAll('.rv').forEach(function(el){io.observe(el);});

/* ============ 5. Скраббер раскадровки ============ */

var scenes=[].slice.call(document.querySelectorAll('.scene[data-start]'));
var tl=document.getElementById('tl');
var tlBar=document.getElementById('tlBar');
var tlNow=document.getElementById('tlNow');
var tlTitle=document.getElementById('tlTitle');
var TOTAL=150, segs=[], play=null;

function mmss(s){
  var m=Math.floor(s/60), r=Math.floor(s%60);
  return m+':'+(r<10?'0':'')+r;
}

scenes.forEach(function(sc,i){
  var dur=+sc.getAttribute('data-dur');
  var accent=sc.style.getPropertyValue('--accent').trim();
  var b=document.createElement('button');
  b.className='tl__seg';
  b.type='button';
  b.style.setProperty('--d',dur);
  b.style.setProperty('--a',accent);
  b.title=sc.querySelector('h3').textContent;
  b.setAttribute('aria-label','Сцена '+(i+1)+' — '+b.title);
  b.innerHTML='<b>'+(i<9?'0':'')+(i+1)+'</b>';
  b.addEventListener('click',function(){
    var y=sc.getBoundingClientRect().top+window.scrollY-tl.offsetHeight-28;
    window.scrollTo({top:y,behavior:reduced?'auto':'smooth'});
  });
  tlBar.appendChild(b);
  segs.push(b);
});
if(segs.length){
  play=document.createElement('i');
  play.className='tl__play';
  tlBar.appendChild(play);
}

function syncTimeline(){
  if(!segs.length) return;
  var line=tl.getBoundingClientRect().bottom+40;
  var cur=0, within=0;
  scenes.forEach(function(sc,i){
    var r=sc.getBoundingClientRect();
    if(r.top<=line){ cur=i; within=clamp((line-r.top)/r.height,0,1); }
  });
  var sc=scenes[cur];
  var t=+sc.getAttribute('data-start')+ +sc.getAttribute('data-dur')*within;

  tlNow.textContent=mmss(t);
  tlTitle.textContent=sc.querySelector('h3').textContent;
  play.style.left=clamp(t/TOTAL*100,0,100)+'%';

  segs.forEach(function(s,i){
    s.classList.toggle('cur',i===cur);
    s.classList.toggle('on',i<cur);
    s.setAttribute('aria-current',i===cur?'true':'false');
  });
  scenes.forEach(function(s,i){ s.classList.toggle('is-cur',i===cur); });
}

/* ============ 6. Кадры раскадровки ============
   Файлы кладутся в assets/scenes/ с именем слота: s01.jpg, s04.mp4 и т.д.
   Расширение любое из списков ниже — скрипт сам найдёт и подставит.
   Если файла нет, остаётся плейсхолдер.                                   */

var DIR='assets/scenes/';
var STUB='assets/setup.webp';   /* рабочая модель фасада вместо пустого слота */
var VIDEO=['mp4','webm','mov'];
var IMAGE=['jpg','jpeg','png','webp','avif','gif'];

/* Сначала пробуем прочитать список файлов в папке: и Live Server, и GitHub Pages
   отдают на каталог либо листинг, либо 404. Если листинг есть — ни одного лишнего
   запроса и чистая консоль. Если нет — откатываемся на перебор расширений. */
function listDir(){
  return fetch(DIR,{cache:'no-store'}).then(function(r){
    if(!r.ok) throw new Error('нет листинга');
    if((r.headers.get('content-type')||'').indexOf('html')<0) throw new Error('не листинг');
    return r.text();
  }).then(function(html){
    var names=[], re=/href="([^"?#]+)"/gi, m;
    while((m=re.exec(html))) names.push(decodeURIComponent(m[1]).split('/').pop().toLowerCase());
    /* Оставляем только имена вида s01.jpg. Если таких нет — это не листинг
       каталога, а другая страница: GitHub Pages, например, отдаёт на папку
       отрендеренный Jekyll'ом README. Возвращаем null, чтобы уйти на перебор. */
    names=names.filter(function(n){ return /^s\d\d\.[a-z0-9]+$/.test(n); });
    return names.length?names:null;
  }).catch(function(){ return null; });
}

/* выбор файла из готового списка: расширения в порядке приоритета */
function pick(names,slot,exts){
  for(var i=0;i<exts.length;i++){
    var want=slot+'.'+exts[i];
    if(names.indexOf(want)>=0) return DIR+want;
  }
  return null;
}

function probe(url,isVideo){
  return new Promise(function(resolve){
    var el=isVideo?document.createElement('video'):new Image();
    function done(ok){ resolve(ok?url:null); }
    if(isVideo){ el.preload='metadata'; el.onloadedmetadata=function(){done(true)}; }
    else { el.onload=function(){done(true)}; }
    el.onerror=function(){done(false)};
    el.src=url;
  });
}

/* последовательно пробует расширения, возвращает первое найденное */
function findFile(slot,exts,isVideo){
  return exts.reduce(function(chain,ext){
    return chain.then(function(found){
      return found||probe(DIR+slot+'.'+ext,isVideo);
    });
  },Promise.resolve(null));
}

function mount(frame,node,label){
  var ph=frame.querySelector('.frame__ph');
  if(ph) ph.remove();
  frame.appendChild(node);
  frame.classList.add('frame--filled');
  frame.tabIndex=0;
  frame.setAttribute('role','button');
  frame.setAttribute('aria-label','Открыть кадр: '+label);
}

function fillSlot(frame,names){
  var slot=frame.getAttribute('data-slot');
  var scene=frame.closest('.scene');
  var title=scene&&scene.querySelector('h3');
  var alt=title?title.textContent.trim():slot;

  /* со списком файлов ищем в нём, без списка — перебором */
  function look(exts,isVideo){
    return names?Promise.resolve(pick(names,slot,exts)):findFile(slot,exts,isVideo);
  }

  look(VIDEO,true).then(function(video){
    if(video){
      /* одноимённая картинка становится постером — она же уйдёт в PDF */
      return look(IMAGE,false).then(function(poster){
        var v=document.createElement('video');
        v.src=video;
        if(poster) v.poster=poster;
        v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true;
        v.setAttribute('muted',''); v.setAttribute('playsinline','');
        v.setAttribute('aria-label',alt);
        mount(frame,v,alt);
      });
    }
    return look(IMAGE,false).then(function(src){
      if(src){
        var img=new Image();
        img.src=src; img.alt=alt;
        mount(frame,img,alt);
        return;
      }
      /* своего кадра нет — ставим заглушку, подпись слота остаётся поверх */
      var stub=new Image();
      stub.src=STUB; stub.alt=''; stub.setAttribute('aria-hidden','true');
      frame.classList.add('frame--stub');
      frame.insertBefore(stub,frame.firstChild);
    });
  });
}

listDir().then(function(names){
  document.querySelectorAll('.frame[data-slot]').forEach(function(f){ fillSlot(f,names); });
});

/* ============ 7. Лайтбокс кадра ============ */

var lb=document.getElementById('lb');
var lbStage=document.getElementById('lbStage');
var lbCap=document.getElementById('lbCap');
var lbBack=null;

function openLb(frame){
  var media=frame.querySelector('img,video');
  if(!media) return;
  var scene=frame.closest('.scene');
  var tc=scene?scene.querySelector('.scene__tc').firstChild.textContent.trim():'';
  var name=scene?scene.querySelector('h3').textContent:'';
  lbStage.innerHTML='';
  lbStage.appendChild(media.cloneNode(true));
  lbCap.textContent=tc+' · '+name;
  lb.hidden=false;
  requestAnimationFrame(function(){lb.classList.add('on')});
  document.body.style.overflow='hidden';
  lbBack=frame;
  document.getElementById('lbX').focus();
}
function closeLb(){
  lb.classList.remove('on');
  document.body.style.overflow='';
  setTimeout(function(){ lb.hidden=true; lbStage.innerHTML=''; },300);
  if(lbBack){ lbBack.focus(); lbBack=null; }
}

document.addEventListener('click',function(e){
  var frame=e.target.closest&&e.target.closest('.frame--filled');
  if(frame){ openLb(frame); return; }
  if(e.target===lb||e.target.id==='lbX') closeLb();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!lb.hidden) closeLb();
  var frame=e.target.closest&&e.target.closest('.frame--filled');
  if(frame&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); openLb(frame); }
});

/* ============ 8. Кнопка PDF ============
   Отдаёт готовый priruchenny-ogon.pdf (собирается ./build-pdf.sh).
   Если файла ещё нет — откат на диалог печати, чтобы кнопка не вела в 404.
   Проверка только по http(s): по file:// fetch запрещён, а ссылка и так работает. */

var pdfBtn=document.getElementById('pdfBtn');

pdfBtn.addEventListener('click',function(e){
  /* по file:// fetch запрещён — отдаём клик браузеру как есть */
  if(location.protocol.indexOf('http')!==0) return;
  e.preventDefault();

  var name=pdfBtn.getAttribute('download')||'presentation.pdf';
  fetch(pdfBtn.getAttribute('href'),{cache:'no-store'}).then(function(r){
    if(!r.ok) throw new Error(r.status);
    return r.blob();
  }).then(function(blob){
    /* скачиваем через blob: файл гарантированно уходит в загрузки
       с нужным именем, а не открывается во вкладке просмотрщика */
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },1000);
  }).catch(function(){
    /* файла нет или он недоступен — открываем диалог печати, чтобы кнопка не вела в 404 */
    window.print();
  });
});

/* ============ запуск ============ */

window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',function(){ placeTicks(); onScroll(); applyFocus(); });
window.addEventListener('load',placeTicks);
placeTicks();
onScroll();

})();
