(function(){
var d=document,$=function(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s))};
var raw=d.getElementById('work-data'),DATA=raw?JSON.parse(raw.textContent):{};
// ---- sideways rail: snap, arrows, drag, counter, progress
$('[data-work-rail]').forEach(function(w){
  var tr=w.querySelector('[data-track]'),sl=$('[data-slide]',w),cnt=w.querySelector('[data-counter]'),bar=w.querySelector('[data-bar]'),idx=0,drag=null,moved=false;
  function step(){return sl.length>1?sl[1].offsetLeft-sl[0].offsetLeft:tr.clientWidth}
  function upd(){var max=tr.scrollWidth-tr.clientWidth;idx=Math.max(0,Math.min(sl.length-1,Math.round(tr.scrollLeft/step())));
    sl.forEach(function(s,i){s.classList.toggle('is-active',i===idx)});
    cnt.textContent=String(idx+1).padStart(2,'0')+' / '+String(sl.length).padStart(2,'0');
    bar.style.transform='scaleX('+(max>0?Math.max(.04,tr.scrollLeft/max):1)+')'}
  function go(i){tr.scrollTo({left:Math.max(0,Math.min(sl.length-1,i))*step(),behavior:'smooth'})}
  w.querySelector('[data-prev]').onclick=function(){go(idx-1)};w.querySelector('[data-next]').onclick=function(){go(idx+1)};
  tr.addEventListener('scroll',function(){requestAnimationFrame(upd)},{passive:true});addEventListener('resize',upd);
  tr.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();go(idx+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(idx-1)}});
  tr.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,l:tr.scrollLeft};moved=false});
  addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-drag.x;if(!moved&&Math.abs(dx)<6)return;moved=true;tr.classList.add('is-drag');tr.scrollLeft=drag.l-dx});
  addEventListener('pointerup',function(){if(!drag)return;drag=null;if(moved){go(Math.round(tr.scrollLeft/step()));setTimeout(function(){tr.classList.remove('is-drag')},350)}});
  tr.addEventListener('click',function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false}},true);
  // vertical mouse wheel stays page scroll; horizontal gestures pan natively
  upd();
});
// ---- show all + filter
var tg=d.querySelector('[data-toggle-all]'),all=d.getElementById('all');
function setAll(open){if(!all)return;all.hidden=!open;tg.setAttribute('aria-expanded',String(open));tg.firstElementChild.textContent=open?tg.dataset.less:tg.dataset.more;tg.lastElementChild.textContent=open?'↑':'↓';
  if(open)all.scrollIntoView({behavior:'smooth',block:'start'})}
if(tg)tg.onclick=function(){setAll(all.hidden)};
if(all&&location.hash==='#all')setTimeout(function(){setAll(true)},50);
$('[data-filter]').forEach(function(b){b.onclick=function(){
  $('[data-filter]').forEach(function(x){x.classList.toggle('is-on',x===b)});
  var f=b.dataset.filter;$('.work-card',all).forEach(function(c){c.hidden=!(f==='all'||c.dataset.cat===f)})}});
// ---- lightbox
var lb=d.getElementById('lightbox'),cur=null,k=0;
function show(){var it=DATA[cur],im=it.images[k];lb.querySelector('img').src=im.src;lb.querySelector('img').alt=it.name+' — '+im.label;
  lb.querySelector('figcaption').textContent=it.name+' · '+im.label+'  ('+(k+1)+'/'+it.images.length+')';
  lb.querySelector('[data-lb-prev]').hidden=lb.querySelector('[data-lb-next]').hidden=it.images.length<2}
function open(id){cur=id;k=0;lb.hidden=false;d.documentElement.style.overflow='hidden';show()}
function close(){lb.hidden=true;d.documentElement.style.overflow=''}
function nav(n){var len=DATA[cur].images.length;k=(k+n+len)%len;show()}
if(lb){d.addEventListener('click',function(e){var b=e.target.closest('[data-work]');if(b&&!e.defaultPrevented)open(b.dataset.work);else if(e.target===lb||e.target.closest('[data-close]'))close();
    else if(e.target.closest('[data-lb-prev]'))nav(-1);else if(e.target.closest('[data-lb-next]'))nav(1)});
  d.addEventListener('keydown',function(e){if(lb.hidden)return;if(e.key==='Escape')close();if(e.key==='ArrowRight')nav(1);if(e.key==='ArrowLeft')nav(-1)})}
})();
