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
var hl=$('.scroll-highlight'),bar=$('.scroll-progress')[0];
function tick(){
  var h=root.scrollHeight-innerHeight;
  if(bar)bar.style.setProperty('--scroll-progress',h>0?scrollY/h:0);
  root.setAttribute('data-scrolled',scrollY>8?'true':'false');
  hl.forEach(function(el){var r=el.getBoundingClientRect();
    var p=(innerHeight*0.88-r.top)/(innerHeight*0.45+r.height*0.4);
    el.style.setProperty('--highlight-progress',Math.max(0,Math.min(1,p)))})}
addEventListener('scroll',tick,{passive:true});addEventListener('resize',tick);tick();
// reveal on scroll
var sel='[data-reveal],.hero-lead>*,section>.container>*,.container.section>*,.service-detail>*,.page-intro>div>*,.page-intro>.studio-illustration,.service-row,.project-feature,.project-cover,.project-links,.principles article,.process-list li,.project-evidence>*,.profile-links>*,.footer-top>*';
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-reveal-state','in');io.unobserve(e.target)}})},{threshold:.08});
$(sel).forEach(function(el){if(!el.hasAttribute('data-reveal-skip'))io.observe(el)});
root.setAttribute('data-reveal','armed');
// svg illustrations: play when visible
var mo=new IntersectionObserver(function(es){es.forEach(function(e){e.target.setAttribute('data-motion',e.isIntersecting?'running':'paused')})});
$('[data-motion]').forEach(function(el){mo.observe(el)});
// marquee: scroll-driven, rows travel in opposite directions, eased
var rows=$('[data-marquee-row]').map(function(r){return {el:r,track:r.querySelector('.marquee-track'),dir:r.getAttribute('data-direction')==='rtl'?-1:1,speed:parseFloat(r.getAttribute('data-speed'))||1,cur:0}});
var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mq(){
  rows.forEach(function(r){
    var gw=r.track.firstElementChild?r.track.firstElementChild.offsetWidth:0; if(!gw)return;
    var target=scrollY*0.45*r.speed*r.dir; r.cur+=(target-r.cur)*0.12;
    var m=((r.cur%gw)+gw)%gw;                  // 0..gw
    r.track.style.transform='translate3d('+(-m)+'px,0,0)'});
  if(!still)requestAnimationFrame(mq)}
if(rows.length&&!still)requestAnimationFrame(mq);
})();
