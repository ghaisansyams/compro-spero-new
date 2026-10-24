(function(){
var d=document,root=d.documentElement,$=function(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s))};
// theme
$('.theme-toggle,[aria-label="Toggle color theme"]').forEach(function(b){b.addEventListener('click',function(){
  var dark=root.classList.toggle('dark');try{localStorage.setItem('theme',dark?'dark':'light')}catch(e){}})});
// mobile menu
var mb=$('[aria-controls="mobile-menu"]')[0];
if(mb){mb.addEventListener('click',function(){
  var m=d.getElementById('mobile-menu');
  if(m){m.remove();mb.setAttribute('aria-expanded','false');return}
  m=d.createElement('div');m.className='mobile-menu';m.id='mobile-menu';
  var nav=$('.desktop-nav a');m.innerHTML=nav.map(function(a){return '<a href="'+a.getAttribute('href')+'">'+a.textContent+'</a>'}).join('')+
    '<div class="mobile-switcher">'+$('.desktop-switcher a').map(function(a){return a.outerHTML}).join('')+'</div>';
  $('.site-header')[0].appendChild(m);mb.setAttribute('aria-expanded','true')})}
// scroll: progress bar, header shadow, word highlight
var hl=$('.scroll-highlight'),bar=$('.scroll-progress')[0],hs=[];
function tick(){
  var h=root.scrollHeight-innerHeight;
  if(bar)bar.style.setProperty('--scroll-progress',h>0?scrollY/h:0);
  root.setAttribute('data-scrolled',scrollY>8?'true':'false');
  hs.forEach(function(e){var t=e.getBoundingClientRect();e.style.setProperty('--parallax',Math.min(Math.max(-t.top/Math.max(.9*t.height,1),0),1).toFixed(3))});
  hl.forEach(function(el){var r=el.getBoundingClientRect();
    var p=(.82*innerHeight-r.top)/Math.max(.62*innerHeight,.9*r.height);
    el.style.setProperty('--highlight-progress',Math.max(0,Math.min(1,p)))})}
hs=$('[data-hero-stage],.home-hero');
addEventListener('scroll',tick,{passive:true});addEventListener('resize',tick);tick();
// reveal on scroll
var sel='[data-reveal],.hero-lead>*,section>.container>*,.container.section>*,.service-detail>*,.page-intro>div>*,.page-intro>.studio-illustration,.service-row,.project-feature,.project-cover,.project-links,.principles article,.process-list li,.project-evidence>*,.profile-links>*,.footer-top>*';
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-reveal-state','in');io.unobserve(e.target)}})},{threshold:.08});
$(sel).forEach(function(el){if(!el.hasAttribute('data-reveal-skip'))io.observe(el)});
root.setAttribute('data-reveal','armed');
// svg illustrations: play when visible
var mo=new IntersectionObserver(function(es){es.forEach(function(e){e.target.setAttribute('data-motion',e.isIntersecting?'running':'paused')})});
$('[data-motion]').forEach(function(el){mo.observe(el)});
// marquee: same model as pana.id. Constant drift + boost from scroll velocity, direction follows scroll direction.
var mrows=$('[data-marquee-row]'),mpos=new Map(),mraf=0,mlast=0,mY=scrollY,mV=0,mT=0,still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mframe(now){
  var dt=mT?Math.min(now-mT,50)/16.667:1;mT=now;
  var dy=scrollY-mY;mY=scrollY;mV=.82*mV+.18*dy;
  var boost=Math.min(.9*Math.abs(mV),16),dir=mV<-.4?-1:1,any=false;
  mrows.forEach(function(r){
    if(r.getAttribute('data-motion')!=='running')return;any=true;
    var tr=r.firstElementChild;if(!tr)return;var half=tr.scrollWidth/2;if(!half)return;
    var l=r.getAttribute('data-direction')==='rtl'?-1:1,sp=parseFloat(r.getAttribute('data-speed'))||1;
    var u=(mpos.get(r)||0)+(.45+boost)*sp*dt*l*dir;mpos.set(r,u);
    tr.style.transform='translate3d('+(-(((u%half)+half)%half))+'px,0,0)'});
  mraf=any?requestAnimationFrame(mframe):0}
function mkick(){if(mraf||still)return;if(mrows.some(function(r){return r.getAttribute('data-motion')==='running'})){mT=0;mY=scrollY;mraf=requestAnimationFrame(mframe)}}
new MutationObserver(mkick).observe(d.body,{attributes:true,subtree:true,attributeFilter:['data-motion']});
mkick();
})();
