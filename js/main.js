(function(){
'use strict';

var reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
var coarse=window.matchMedia('(pointer:coarse)').matches;
var doc=document.documentElement;

/* Обложка ждёт шрифты: пока они грузятся, её сборка стоит на паузе (см. CSS),
   иначе заголовок мелькает запасной гарнитурой и прыгает на Cormorant.
   Таймаут — страховка: если шрифты не пришли, показываем как есть. */
(function(){
  var go=function(){ doc.classList.add('fonts'); startHeroVideo(); };
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(go);
    setTimeout(go,2500);
  } else go();
})();

/* Ролик обложки. Запускается тем же сигналом, что снимает паузу с анимаций
   появления, — классом fonts. Раньше запуск висел на animationstart самого
   видео, и в Safari это не срабатывало: у анимации, которая стартует уже
   в состоянии paused, событие не приходит, и ролик стоял на первом кадре.
   Через autoplay нельзя: он отыграл бы свои 8 секунд, пока кадр прозрачен.

   Если браузер откажет в воспроизведении (в iOS так делает режим
   энергосбережения даже для беззвучного видео) или файл не проиграется —
   показываем статичный кадр: первый кадр ролика почти чёрный. */
var heroVideoStarted=false;
function startHeroVideo(){
  /* Ворота шрифтов срабатывают дважды — по fonts.ready и по своему таймауту.
     Без защёлки второй вызов запускал бы ролик поверх уже отработавшего отказа:
     видео играло скрытым, а на экране оставался статичный кадр. */
  if(heroVideoStarted) return;
  var v=document.querySelector('.hero__vid');
  if(!v||reduced) return;
  heroVideoStarted=true;
  var im=document.querySelector('.hero__still');

  function show(vid){
    if(!im) return;
    v.style.display = vid ? '' : 'none';
    im.style.display = vid ? '' : 'block';   /* '' возвращает display из CSS */
  }

  /* Отказ автозапуска — это почти всегда энергосбережение, а не поломка файла.
     В нём Safari блокирует даже беззвучное видео, но разрешает его после жеста
     пользователя. Поэтому: сразу показываем статичный кадр, чтобы обложка
     не осталась почти чёрной, и вешаем разовую попытку на первое касание. */
  function fallback(){
    show(false);
    var retry=function(){
      document.removeEventListener('pointerdown',retry);
      document.removeEventListener('keydown',retry);
      var again=v.play();
      if(again&&again.then) again.then(function(){ show(true); },function(){});
    };
    document.addEventListener('pointerdown',retry);
    document.addEventListener('keydown',retry);
  }

  v.addEventListener('error',fallback);
  var pr=v.play();
  if(pr&&pr.catch) pr.catch(fallback);
}

/* Модель в разделе «Здание» проматывается прокруткой: вниз — камера обходит
   фасад вперёд, вверх — назад. Кадр берётся не от таймера, а от положения
   рамки в окне, поэтому направление задаёт сам зритель.

   Перемотка идёт через currentTime и всегда в кадре rAF: события прокрутки
   сыплются чаще, чем экран успевает перерисоваться, и без сборки в один кадр
   браузер захлебнулся бы в перемотках.

   iOS не декодирует первый кадр, пока ролик не тронули: помогает короткий
   play() с немедленной паузой. Откажет — покажем статичный кадр. */
function setupScrub(){
  var v=document.querySelector('.setup__vid');
  if(!v||reduced) return;
  var box=v.closest('.renderview'), im=document.querySelector('.setup__still');
  var dur=0, want=0, raf=0;

  function fallback(){ if(im){ v.style.display='none'; im.style.display='block'; } }
  v.addEventListener('error',fallback);

  function apply(){
    raf=0;
    if(!dur) return;
    var t=clamp(want,0,1)*(dur-0.001);
    /* порог меньше половины кадра: без него мелкие движения дёргали бы перемотку */
    if(Math.abs(v.currentTime-t)>0.008) v.currentTime=t;
  }
  /* START — какая доля рамки видна в момент, когда облёт трогается: 1 значит
     «вошла целиком», .5 — «показалась наполовину», сейчас середина между ними.
     SPAN — сколько пикселей прокрутки занимает весь облёт.
     Начало привязано к высоте самой рамки, а длина задана в абсолютных пикселях:
     доля прохода по экрану растягивала бы облёт на высоком мониторе. */
  var START=.75, SPAN=200;
  function update(){
    var r=box.getBoundingClientRect(), vh=window.innerHeight;
    var from=vh-r.height*START;
    want=(from-r.top)/SPAN;
    if(!raf) raf=requestAnimationFrame(apply);
  }

  v.addEventListener('loadedmetadata',function(){
    dur=v.duration||0;
    var pr=v.play();
    if(pr&&pr.then) pr.then(function(){ v.pause(); update(); },fallback);
    else { v.pause(); update(); }
  });
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update);
  if(v.readyState>=1){ dur=v.duration||0; update(); }
}
setupScrub();

/* Сводки у символов и промыслов. На тач-экранах наведения нет, поэтому там
   пункт раскрывается касанием; одновременно открыт только один, повторное
   касание закрывает, клик мимо — тоже. На мыши хватает :hover, вешать клик
   не нужно: раскрытый пункт оставался бы гореть после ухода курсора. */
if(coarse){
  var lore=[].slice.call(document.querySelectorAll('.lore__item'));
  if(lore.length){
    lore.forEach(function(el){
      el.addEventListener('click',function(e){
        e.stopPropagation();
        var was=el.classList.contains('is-open');
        lore.forEach(function(o){ o.classList.remove('is-open'); });
        if(!was) el.classList.add('is-open');
      });
    });
    document.addEventListener('click',function(){
      lore.forEach(function(o){ o.classList.remove('is-open'); });
    });
  }
}

/* Схема ремёсел на тач-экранах. Наведения там нет, поэтому узел выбирается
   касанием: id уходит в data-lit на <figure>, а дальше всё делает CSS — теми
   же правилами, что и для :hover. Повторное касание и клик мимо снимают выбор. */
if(coarse){
  var flow=document.querySelector('.flow');
  if(flow){
    [].slice.call(flow.querySelectorAll('.flow__n')).forEach(function(g){
      g.addEventListener('click',function(e){
        e.stopPropagation();
        var id=g.getAttribute('data-node');
        if(flow.getAttribute('data-lit')===id) flow.removeAttribute('data-lit');
        else flow.setAttribute('data-lit',id);
      });
    });
    document.addEventListener('click',function(){ flow.removeAttribute('data-lit'); });
  }
}

/* Слоты под картинки, которых может ещё не быть. Правило одно на три места:
   имя файла лежит в data-атрибуте слота, скрипт перебирает расширения и, найдя
   файл, вставляет картинку и ставит слоту класс is-filled — по нему CSS убирает
   рамку-заглушку, а перебивку вообще показывает (без файла её нет ни на сайте,
   ни в PDF). Достаточно положить файл в нужную папку, разметку не трогают. */
/* Поиск файла по имени: расширения перебираются по очереди, побеждает первое
   загрузившееся. Вынесено отдельно, потому что тем же способом ищутся
   и добавочные кадры перебивок-последовательностей. */
function findImg(dir,name,exts){
  return exts.reduce(function(chain,ext){
    return chain.then(function(found){
      if(found) return found;
      return new Promise(function(res){
        var im=new Image();
        im.onload=function(){ res(im.src); };
        im.onerror=function(){ res(null); };
        im.src=dir+name+'.'+ext;
      });
    });
  },Promise.resolve(null));
}

function fillSlots(sel, attr, dir, exts, cls, onFill){
  var slots=[].slice.call(document.querySelectorAll(sel));
  if(!slots.length) return;
  slots.forEach(function(slot){
    findImg(dir,slot.getAttribute(attr),exts).then(function(src){
      if(!src) return;
      var im=new Image(); im.src=src; im.alt='';
      if(cls) im.className=cls;
      slot.appendChild(im); slot.classList.add('is-filled');
      if(onFill) onFill(slot);
    });
  });
}

/* Иконки символов и промыслов «Малой родины». Растровые попадаются чаще —
   их расширения и пробуем первыми. */
fillSlots('.lore__ico[data-ico]','data-ico','assets/icons/',['webp','png','svg']);

/* Кадры разворотов героев: имя слота в data-shot совпадает с именем иконки. */
fillSlots('.shot__fr[data-shot]','data-shot','assets/heroes/shots/',['webp','jpg','png']);

/* Перебивки — кадр во весь слайд перед разделом или после него. Слоты стоят
   у каждого раздела, но пустой слот не показывается и лишней страницы в PDF
   не делает: раздел получает перебивку ровно тогда, когда в assets/interludes/
   лежит файл с его именем. */
/* Заполненные слоты собираются сюда, и дальше их прозрачность ведёт прокрутка
   (см. «Фокус чтения»): кадр разгорается на подходе к центру экрана и гаснет,
   сойдя с него. Пустые в список не попадают — им и гаснуть нечем. */
var interludes=[];
fillSlots('.interlude[data-interlude]','data-interlude','assets/interludes/',['webp','jpg','png'],'render',
          function(slot){ interludes.push(slot); stackFrames(slot); applyFocus(); });

/* Перебивка из нескольких кадров. Базовый кадр приходит от fillSlots как
   у любой другой перебивки — его и только его берёт печать. Добавочные
   перечислены в data-seq, ложатся поверх базового и сменяют друг друга
   анимацией (тайминг — в CSS, .frames). Нет data-seq — перебивка остаётся
   одиночной, и ничего из этого не включается. */
function stackFrames(slot){
  var seq=(slot.getAttribute('data-seq')||'').split(',')
            .map(function(n){ return n.trim(); }).filter(Boolean);
  var base=slot.querySelector('img');
  if(!seq.length||!base) return;
  /* Какой из кадров печатается. По умолчанию базовый; data-print позволяет
     отправить на бумагу другой — например, когда кадр покоя не отвечает
     подписи под перебивкой. */
  var printName=slot.getAttribute('data-print')||slot.getAttribute('data-interlude');

  /* Базовый кадр переезжает в общую коробку: она держит размер по нему,
     а добавочные кладутся поверх абсолютом. Коробка встаёт на место кадра
     в потоке слота, поэтому порядок с подписью не меняется. */
  var box=document.createElement('div');
  box.className='frames';
  base.parentNode.insertBefore(box,base);
  box.appendChild(base);
  base.classList.add('frames__f','frames__f--base');
  if(printName===slot.getAttribute('data-interlude')) base.classList.add('frames__f--print');

  /* Кадры добавляются по мере загрузки, но встают в порядке data-seq:
     место под каждый занято заранее, иначе быстрый файл обогнал бы
     медленный и порядок смены сбился бы. */
  var holes=seq.map(function(){ var h=document.createComment(''); box.appendChild(h); return h; });
  seq.forEach(function(name,i){
    findImg('assets/interludes/',name,['webp','jpg','png']).then(function(src){
      if(!src) return;
      var im=new Image();
      im.src=src; im.alt=''; im.className='render frames__f';
      if(name===printName) im.classList.add('frames__f--print');
      /* Нумерация с единицы: базовый кадр — нулевой, от неё считается
         задержка каждого следующего в CSS. */
      im.style.setProperty('--n',i+1);
      box.replaceChild(im,holes[i]);
      box.classList.add('is-seq');
    });
  });
}

/* Касание по карте подбрасывает метку. На мыши это делает :hover, но на
   тач-экранах он залипает, поэтому там прыжок вешается классом и снимается
   по окончании анимации — иначе повторное касание её не перезапустит. */
(function(){
  var fig=document.querySelector('.mapfig'), pin=fig&&fig.querySelector('.mapfig__pin');
  if(!fig||!pin||reduced) return;
  pin.addEventListener('animationend',function(e){
    if(e.animationName==='pindrop') pin.classList.add('pin-set');   /* появление отыграло */
    else pin.classList.remove('is-hop');
  });
  fig.addEventListener('click',function(){
    pin.classList.remove('is-hop');
    void pin.offsetWidth;              /* перезапуск анимации */
    pin.classList.add('is-hop');
  });
})();

function clamp(v,a,b){return v<a?a:v>b?b:v}
function scrollMax(){return Math.max(1,doc.scrollHeight-window.innerHeight)}

/* ============ 1. Шкала укрощения: прогресс, метки разделов, тон страницы ============ */

var railFill=document.getElementById('railFill');
var railTicks=document.getElementById('railTicks');
var hero=document.querySelector('.hero');
var sections=[].slice.call(document.querySelectorAll('section[data-nav]'));
/* Метки шкалы берутся со всех [data-nav], а не только с секций: «Концепция»
   по разметке лежит внутри «Малой родины», но для читателя это отдельный
   раздел — в презентации он идёт под своим номером. Затемнение при уходе
   с экрана осталось за секциями (см. ниже), поэтому список отдельный. */
var navPoints=[].slice.call(document.querySelectorAll('[data-nav]'));
var ticks=[];

/* offsetTop у вложенного блока считается от секции (у section своё
   position:relative), поэтому позиция берётся от документа. */
function docTop(el){ return Math.round(el.getBoundingClientRect().top+window.scrollY); }

navPoints.forEach(function(sec){
  var li=document.createElement('li');
  var b=document.createElement('button');
  b.className='rail__tick';
  b.type='button';
  b.innerHTML='<span class="rail__name"></span><span class="rail__dash"></span>';
  b.querySelector('.rail__name').textContent=sec.getAttribute('data-nav');
  b.addEventListener('click',function(){
    window.scrollTo({top:docTop(sec),behavior:reduced?'auto':'smooth'});
  });
  li.appendChild(b);
  railTicks.appendChild(li);
  ticks.push({el:li,btn:b,sec:sec,top:0});
});

function placeTicks(){
  /* 3…95%, иначе подписи крайних разделов срезаются краем экрана */
  var max=scrollMax(), n=ticks.length, gap=20/window.innerHeight*100, p=[], i;
  ticks.forEach(function(t){ t.top=docTop(t.sec); p.push(clamp(t.top/max*100,3,95)); });
  /* Последние разделы короткие и на шкале сходятся в одну точку — разводим
     их на минимальный зазор, иначе «Инструменты» и «Финал» печатаются друг на друге. */
  for(i=1;i<n;i++) if(p[i]-p[i-1]<gap) p[i]=p[i-1]+gap;
  if(p[n-1]>95){
    p[n-1]=95;
    for(i=n-2;i>=0;i--) if(p[i]>p[i+1]-gap) p[i]=p[i+1]-gap;
  }
  ticks.forEach(function(t,k){ t.el.style.top=p[k]+'%'; });
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
  ticks.forEach(function(t,i){ if(t.top<=mid) cur=i; });
  ticks.forEach(function(t,i){ t.btn.setAttribute('aria-current',i===cur?'true':'false'); });

  syncTimeline();
  markScrolling();
  queueFocus();
}

/* ============ 1a. Фокус чтения ============
   Блок, накрывающий центр экрана, горит в полную силу; остальные гаснут тем
   сильнее, чем дальше они от центра. Глубина затемнения переключается в CSS:
   при прокрутке сильная, в покое мягкая. */

/* .lore__item в списке фокуса ради телефона: там пункты идут в столбик
   по одному на экран, и каждый гаснет отдельно. На широком экране они стоят
   в один ряд, --f у них одинаковый, а CSS его там и не читает. */
var blocks=[].slice.call(document.querySelectorAll('.fb, .lore__item'));
/* Близость к центру экрана — свой счёт, отдельный от фокуса чтения: окно
   у него уже, и на телефоне по нему CSS оживляет то, что на десктопе живёт
   от курсора. Наведения на тач-экране нет, и роль курсора берёт прокрутка.
   У «Малой родины» меряем сам слот, а не пункт: пункт вместе со сводкой
   занимает почти весь экран, и его центр к иконке отношения не имеет.
   У «Персонажей» — наоборот, карточку целиком: --c с неё наследуется
   и иконке, и тексту, поэтому карточка просыпается вся разом, как под
   курсором на широком экране. */
var icons=[].slice.call(document.querySelectorAll(
  '.lore__item .lore__ico, .layers--cast .layer, .scen--tall .scen__g'));
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
  /* У пунктов «Малой родины» окно уже и несимметричное: снизу — чтобы пункт
     разгорался позже, ближе к центру; сверху — ещё уже, чтобы уходил раньше,
     как только строка минует центр. У остальных блоков окно прежнее. */
  var lateIn=vh*.28, earlyOut=vh*.16;
  blocks.forEach(function(b){
    var f=1;
    if(!reduced){
      var r=b.getBoundingClientRect(), tight=b.classList.contains('lore__item');
      if(r.top<=mid&&r.bottom>=mid) f=1;
      else if(r.top>mid) f=clamp(1-(r.top-mid)/(tight?lateIn:range),0,1);
      else f=clamp(1-(mid-r.bottom)/(tight?earlyOut:range),0,1);
      f=f*f*(3-2*f); /* сглаживание, чтобы край не «щёлкал» */
    }
    b.style.setProperty('--f',f.toFixed(3));
  });
  /* Окно роста симметричное: иконка одинаково разгорается на подходе к центру
     и ужимается, сойдя с него. Внутри hold от центра она стоит в полном
     размере — иначе рост и спад сходятся в одной точке и иконка «клюёт»;
     ramp короче hold, так что переход быстрый, а полка длинная. */
  var hold=vh*.19, ramp=vh*.12;
  icons.forEach(function(ic){
    var c=1;
    if(!reduced){
      var q=ic.getBoundingClientRect();
      c=clamp(1-(Math.abs((q.top+q.bottom)/2-mid)-hold)/ramp,0,1);
      c=c*c*(3-2*c);
    }
    ic.style.setProperty('--c',c.toFixed(3));
  });
  /* Перебивки: кадр во весь экран разгорается на подходе к центру и гаснет,
     сойдя с него. Окно несимметричное, как у пунктов «Малой родины»: снизу
     шире — кадр начинает проявляться позже, уже заметно войдя в экран;
     сверху уже — уходит раньше, не дожидаясь края. Внутри полки вокруг
     центра кадр стоит в полную силу, иначе разгон и спад сошлись бы
     в одной точке и он «клевал» бы на проходе. */
  var iHold=vh*.20, iIn=vh*.30, iOut=vh*.24;
  interludes.forEach(function(el){
    var o=1;
    if(!reduced){
      var q=el.getBoundingClientRect(), d=(q.top+q.bottom)/2-mid;
      o=clamp(1-(Math.abs(d)-iHold)/(d>0?iIn:iOut),0,1);
      o=o*o*(3-2*o);
    }
    el.style.setProperty('--o',o.toFixed(3));
  });
}

applyFocus();

/* Круговая стрелка «Базового мифа» крутится через SVG-шный animateTransform,
   а его CSS не выключает — снимаем вручную, когда система просит меньше
   движения. */
if(reduced){
  document.querySelectorAll('.myth__spin animateTransform').forEach(function(a){ a.remove(); });
}

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
  function spawn(y,burst){
    return {x:Math.random()*w, y:y===undefined?h+Math.random()*h*.4:y,
            r:Math.random()*1.1+.34, v:Math.random()*.52+.2,
            sway:Math.random()*Math.PI*2, a:Math.random()*.5+.18, burst:!!burst};
  }
  /* Жар первых секунд: сразу после появления обложки искр втрое больше,
     они быстрее и мечутся из стороны в сторону, потом поток успокаивается
     до ровного подъёма. Затухание по времени, а не по кадрам: на слабой
     машине покадровое шло бы дольше и разогрев растянулся бы. */
  /* На телефоне искр вдвое меньше и в потоке, и во всплеске: то же число
     на узком экране читается заметно гуще — площадь канваса меньше,
     а искры те же, — и без нужды греет слабый GPU. Порог тот же 900 px,
     что и у мобильной вёрстки в styles.css. */
  var narrow=window.matchMedia('(max-width:900px)').matches;
  var BASE=narrow?38:76, BURST=narrow?52:105, t0=performance.now();
  function heat(){ return Math.exp(-(performance.now()-t0)/2600); }
  /* отсчёт с момента, когда канвас реально начал проявляться: у него своя
     задержка в 2,3 с, и без этого всплеск отгорел бы ещё до появления */
  cvs.addEventListener('animationstart',function(){ t0=performance.now(); },{once:true});

  function draw(){
    var k=heat();
    ctx.clearRect(0,0,w,h);
    for(var i=parts.length-1;i>=0;i--){
      var p=parts[i];
      p.y-=p.v*(1+k*1.7);
      p.sway+=.016+k*.06;
      p.x+=Math.sin(p.sway)*(.22+k*1.2)+(Math.random()-.5)*k*1.1;
      if(p.y<h*.18) p.a-=.006;   /* искры быстрые — гасим резче, иначе долетают до верха */
      /* Искры всплеска гаснут по мере остывания, а не когда долетят до верха:
         при обычной скорости подъёма это заняло бы полминуты, и всплеск
         рассасывался бы весь первый экран. */
      if(p.burst) p.a-=.006*(1-k);
      if(p.y<-10||p.a<=0){
        if(p.burst){ parts.splice(i,1); continue; }
        var n=spawn(); p.x=n.x; p.y=n.y; p.r=n.r; p.v=n.v; p.a=n.a; p.sway=n.sway;
      }
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,6.2832);
      /* на жару искры краснее и ярче */
      ctx.fillStyle='rgba(242,'+Math.round(150+p.r*44)+','+Math.round(80-k*34)+','
                    +Math.min(1,p.a*(1+k*.6))+')';
      ctx.fill();
    }
    if(alive) anim=requestAnimationFrame(draw);
  }
  size();
  for(var i=0;i<BASE;i++) parts.push(spawn(Math.random()*h));
  /* всплеск стартует снизу, от огня */
  for(var j=0;j<BURST;j++) parts.push(spawn(h*(.5+Math.random()*.55),true));
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

/* Порог в долях площади не годится: «Малая родина» вместе с «Концепцией»
   переросла экран телефона в десять раз, её видимая доля не поднимается
   выше 0,10 — порог 0,12 не срабатывал никогда, и весь раздел оставался
   невидимым. Условие height-independent: блок проявляется, когда его верх
   поднимается выше 88% высоты экрана. */
var io=new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:0, rootMargin:'0px 0px -12% 0px'});
document.querySelectorAll('.rv').forEach(function(el){io.observe(el);});

/* ============ 5. Скраббер раскадровки ============ */

/* Раскадровка — последовательность, а не хронометраж: тайминга у сцен нет,
   скраббер отсчитывает кадры. Сегменты поэтому равной ширины, а не
   пропорциональны длительности, и головка идёт по номеру кадра. */
var scenes=[].slice.call(document.querySelectorAll('.scene[data-scene]'));
var tl=document.getElementById('tl');
var tlBar=document.getElementById('tlBar');
var tlNow=document.getElementById('tlNow');
var tlTitle=document.getElementById('tlTitle');
var segs=[], play=null;

function nn(i){ return (i<9?'0':'')+(i+1); }

scenes.forEach(function(sc,i){
  var accent=sc.style.getPropertyValue('--accent').trim();
  var b=document.createElement('button');
  b.className='tl__seg';
  b.type='button';
  b.style.setProperty('--a',accent);
  b.title=sc.querySelector('h3').textContent;
  b.setAttribute('aria-label','Сцена '+(i+1)+' — '+b.title);
  b.innerHTML='<b>'+nn(i)+'</b>';
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

  tlNow.textContent=nn(cur);
  tlTitle.textContent=sc.querySelector('h3').textContent;
  /* Головка внутри сегмента текущей сцены: доля прокрутки по ней и даёт
     положение, раз общей шкалы времени больше нет. */
  play.style.left=clamp((cur+within)/scenes.length*100,0,100)+'%';

  segs.forEach(function(s,i){
    s.classList.toggle('cur',i===cur);
    s.classList.toggle('on',i<cur);
    s.setAttribute('aria-current',i===cur?'true':'false');
  });
  scenes.forEach(function(s,i){ s.classList.toggle('is-cur',i===cur); });
}

/* ============ 5a. Проигрыватель «Звука» ============
   Дорожка кладётся в assets/sound/ с именем слота: track.mp3, track.m4a и т.д.
   Пока файла нет, блок скрыт — как пустая перебивка, и по той же причине:
   он не должен ни занимать место на сайте, ни обещать в PDF того, чего там
   нет. Расширения перебираются по очереди, потому что заранее неизвестно,
   в чём придёт сведённая дорожка. */

(function(){
  var box=document.querySelector('.player[data-audio]');
  if(!box) return;
  var au=box.querySelector('.player__a');
  var btn=box.querySelector('.player__play');
  var bar=box.querySelector('.player__bar');
  var fill=box.querySelector('.player__fill');
  var head=box.querySelector('.player__head');
  var now=box.querySelector('.player__now');
  var dur=box.querySelector('.player__dur');
  var name=box.getAttribute('data-audio');

  function mmss(t){
    if(!isFinite(t)||t<0) t=0;
    var m=Math.floor(t/60), r=Math.floor(t%60);
    return m+':'+(r<10?'0':'')+r;
  }

  /* Проба файла: canPlayType отсекает форматы, которых браузер не понимает,
     и до сети дело не доходит. Остальное решает loadedmetadata против error —
     по ним же узнаём длительность, поэтому отдельного запроса не нужно. */
  function probe(exts){
    if(!exts.length) return;                    /* дорожки нет — блок остаётся скрытым */
    var ext=exts[0], rest=exts.slice(1);
    var type={mp3:'audio/mpeg', m4a:'audio/mp4', ogg:'audio/ogg', wav:'audio/wav'}[ext];
    if(type&&!au.canPlayType(type)) return probe(rest);
    var t=new Audio();
    t.preload='metadata';
    t.addEventListener('loadedmetadata',function(){ mount('assets/sound/'+name+'.'+ext, t.duration); });
    t.addEventListener('error',function(){ probe(rest); });
    t.src='assets/sound/'+name+'.'+ext;
  }

  function mount(src,len){
    au.src=src;
    dur.textContent=mmss(len);
    bar.setAttribute('aria-valuetext','0:00 из '+mmss(len));
    box.classList.add('is-filled');
  }

  function paint(){
    var len=au.duration, p=len?clamp(au.currentTime/len,0,1):0;
    fill.style.width=(p*100)+'%';
    head.style.left=(p*100)+'%';
    now.textContent=mmss(au.currentTime);
    bar.setAttribute('aria-valuenow',Math.round(p*100));
    bar.setAttribute('aria-valuetext',mmss(au.currentTime)+' из '+mmss(len));
  }

  btn.addEventListener('click',function(){
    if(au.paused) au.play(); else au.pause();
  });
  /* Состояние ведём по событиям самого элемента, а не по клику: дорожка может
     остановиться и без нас — кончилась, перебил другой звук в системе. */
  au.addEventListener('play',function(){
    box.classList.add('is-playing');
    btn.setAttribute('aria-label','Пауза');
  });
  au.addEventListener('pause',function(){
    box.classList.remove('is-playing');
    btn.setAttribute('aria-label','Воспроизвести');
  });
  au.addEventListener('ended',function(){ au.currentTime=0; paint(); });
  au.addEventListener('timeupdate',paint);
  /* Длительность иногда приходит только со вторым событием (потоковый mp3
     без точного заголовка) — тогда обновляем подпись. */
  au.addEventListener('durationchange',function(){ dur.textContent=mmss(au.duration); paint(); });

  /* Перемотка: тянуть можно и мимо полосы — указатель захвачен, пока кнопка
     нажата, иначе быстрый жест срывался бы с тонкой линии. */
  function seekTo(clientX){
    var r=bar.getBoundingClientRect();
    if(!r.width||!isFinite(au.duration)) return;
    au.currentTime=clamp((clientX-r.left)/r.width,0,1)*au.duration;
    paint();
  }
  /* Перехват в try: если указатель успел отпуститься (быстрый тап), браузер
     бросает исключение, и без него перемотка по этому нажатию сорвалась бы. */
  function grab(fn,id){ try{ return fn.call(bar,id); }catch(e){ return false; } }
  bar.addEventListener('pointerdown',function(e){
    grab(bar.setPointerCapture,e.pointerId);
    seekTo(e.clientX);
  });
  bar.addEventListener('pointermove',function(e){
    if(grab(bar.hasPointerCapture,e.pointerId)) seekTo(e.clientX);
  });
  bar.addEventListener('pointerup',function(e){ grab(bar.releasePointerCapture,e.pointerId); });

  /* С клавиатуры: стрелки — на пять секунд, Home и End — к краям,
     пробел и Enter — пуск и пауза, как в системных плеерах. */
  bar.addEventListener('keydown',function(e){
    var k=e.key, len=au.duration;
    if(!isFinite(len)) return;
    if(k==='ArrowRight'||k==='ArrowUp') au.currentTime=clamp(au.currentTime+5,0,len);
    else if(k==='ArrowLeft'||k==='ArrowDown') au.currentTime=clamp(au.currentTime-5,0,len);
    else if(k==='Home') au.currentTime=0;
    else if(k==='End') au.currentTime=len;
    else if(k===' '||k==='Enter'){ if(au.paused) au.play(); else au.pause(); }
    else return;
    e.preventDefault();
    paint();
  });

  probe(['mp3','m4a','ogg','wav']);
})();

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
  /* Первая строка .scene__tc — номер кадра; пометка («пик», «финал») лежит
     в дочернем span и в подпись не идёт. */
  var num=scene?scene.querySelector('.scene__tc').firstChild.textContent.trim():'';
  var name=scene?scene.querySelector('h3').textContent:'';
  lbStage.innerHTML='';
  lbStage.appendChild(media.cloneNode(true));
  lbCap.textContent=num+' · '+name;
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

/* ============ 9. Концы цветовой шкалы ============
   На телефоне шкала стоит вдоль колонки образцов и растягивается на всю её
   высоту. Но карточка начинается полем над плашкой и кончается подписью под
   ней, поэтому полоса выходила за плашки с обоих концов: сверху — раньше
   «Угля», снизу — ниже «Зеркала». Отмеряем оба выступа и поджимаем полосу,
   чтобы она шла ровно от верха первой плашки до низа последней. Поля и высота
   подписи зависят от кегля и переносов, поэтому меряем, а не считаем в CSS;
   --head и --tail читает только мобильная вёрстка. */

var gradEl=document.querySelector('#s-color .grad');
var gradBar=document.querySelector('#s-color .grad__bar');
var firstChip=document.querySelector('#s-color .swatches li:first-child i');
var lastChip=document.querySelector('#s-color .swatches li:last-child i');

function fitGrad(){
  if(!gradEl||!gradBar||!firstChip||!lastChip) return;
  var box=gradEl.getBoundingClientRect();
  var head=firstChip.getBoundingClientRect().top-box.top;
  var tail=box.bottom-lastChip.getBoundingClientRect().bottom;
  gradBar.style.setProperty('--head',Math.max(0,Math.round(head))+'px');
  gradBar.style.setProperty('--tail',Math.max(0,Math.round(tail))+'px');
}

/* ============ запуск ============ */

window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',function(){ placeTicks(); onScroll(); applyFocus(); fitGrad(); });
window.addEventListener('load',function(){ placeTicks(); fitGrad(); });
placeTicks();
onScroll();
fitGrad();

})();
