(function(){
var feed=document.getElementById('ig-feed');if(!feed)return;
var id=document.documentElement.lang==='id',L=id?{view:'Lihat di Instagram',show:'Lihat semua',hide:'Sembunyikan',empty:'Belum ada postingan.',err:'Gagal memuat postingan.',sample:'Menampilkan contoh postingan. Jalankan "node scripts/fetch-instagram.mjs" untuk memuat postingan terbaru dari @',upd:'Diperbarui ',types:{Video:'Video',Sidecar:'Carousel'}}:{view:'View on Instagram',show:'Show all',hide:'Show less',empty:'No posts yet.',err:'Could not load the posts.',sample:'Showing sample posts. Run "node scripts/fetch-instagram.mjs" to load the latest posts from @',upd:'Updated ',types:{Video:'Video',Sidecar:'Carousel'}};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
var fmt=new Intl.DateTimeFormat(id?'id-ID':'en-GB',{day:'numeric',month:'short',year:'numeric'});
function num(n){return n==null?null:new Intl.NumberFormat(id?'id-ID':'en-GB',{notation:'compact'}).format(n)}
function safe(u){return /^https:\/\/(www\.)?instagram\.com\//.test(u)?u:'https://www.instagram.com/'}
function card(p){
  var a=el('article','ig-card');
  var m=el('a','ig-media');m.href=safe(p.url);m.target='_blank';m.rel='noopener noreferrer';
  var im=el('img');im.src=p.image;im.alt='';im.loading='lazy';im.width=640;im.height=640;m.appendChild(im);
  if(p.type&&L.types[p.type])m.appendChild(el('span','ig-type',L.types[p.type]));
  a.appendChild(m);
  var b=el('div','ig-body'),meta=el('div','ig-meta');
  if(p.timestamp){var t=el('time',null,fmt.format(new Date(p.timestamp)));t.dateTime=p.timestamp;meta.appendChild(t)}
  var st=[];if(num(p.likes)!=null)st.push('♥ '+num(p.likes));if(num(p.comments)!=null)st.push('💬 '+num(p.comments));
  if(st.length)meta.appendChild(el('span',null,st.join('  ')));
  b.appendChild(meta);
  var w=el('div','work-descwrap'),c=el('p','work-desc',p.caption||'');w.appendChild(c);
  var tg=el('button','work-toggle',L.show);tg.type='button';tg.hidden=true;tg.setAttribute('aria-expanded','false');
  tg.onclick=function(){var o=w.classList.toggle('is-open');tg.setAttribute('aria-expanded',String(o));tg.textContent=o?L.hide:L.show};
  w.appendChild(tg);b.appendChild(w);
  var l=el('a','text-link');l.href=safe(p.url);l.target='_blank';l.rel='noopener noreferrer';l.appendChild(document.createTextNode(L.view));l.appendChild(el('span',null,'↗'));l.lastChild.setAttribute('aria-hidden','true');
  b.appendChild(l);a.appendChild(b);return a}
function clip(){feed.querySelectorAll('.work-descwrap').forEach(function(w){var p=w.querySelector('.work-desc'),b=w.querySelector('.work-toggle');if(w.classList.contains('is-open'))return;b.hidden=!(p.scrollHeight>p.clientHeight+2)})}
fetch(feed.dataset.src,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
  feed.textContent='';
  if(!d.posts||!d.posts.length){feed.appendChild(el('p','update-empty',L.empty));return}
  d.posts.forEach(function(p){feed.appendChild(card(p))});
  var note=document.getElementById('ig-note'),st=document.getElementById('ig-stamp');
  if(d.sample){note.textContent=L.sample+d.account+'.';note.hidden=false}
  else if(d.updatedAt&&st)st.textContent=L.upd+fmt.format(new Date(d.updatedAt));
  clip();addEventListener('resize',clip);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(clip);
}).catch(function(){feed.textContent='';feed.appendChild(el('p','update-empty',L.err))});
})();
