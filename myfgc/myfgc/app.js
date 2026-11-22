// ---------- Game data (move to data/games.json and fetch() it once you serve the site) ----------
const GAMES = {
  sf6:  {name:"Street Fighter 6", chars:["Ryu","Ken","Chun-Li","Guile","Blanka","Dhalsim","E. Honda","Zangief","Cammy","Dee Jay","Juri","Luke","Jamie","Kimberly","Manon","Marisa","Lily","JP",
          "Rashid","A.K.I.","Ed","Akuma","M. Bison","Terry","Mai","Elena","Sagat","C. Viper","Alex","Ingrid","Yasmine","Arjun"]},      // 32; Tifa and Bosch are announced for 2027
  t8:   {name:"Tekken 8", chars:["Kazuya","Jin","King","Jun","Paul","Law","Jack-8","Lars","Xiaoyu","Nina","Leroy","Asuka","Lili","Bryan","Hwoarang","Claudio","Azucena","Raven","Leo","Steve","Kuma","Yoshimitsu","Shaheen","Dragunov","Feng","Panda","Lee","Alisa","Zafina","Devil Jin","Victor","Reina","Eddy","Lidia","Heihachi","Clive","Anna","Fahkumram","Armor King","Miary Zo","Kunimitsu","Bob","Roger Jr."]},      // 43; Yujiro Hanma is announced for early 2027
  ggst: {name:"Guilty Gear Strive", chars:["Sol","Ky","May","Axl","Chipp","Potemkin","Faust","Millia","Zato","Ramlethal","Leo","Nagoriyuki","Giovanna","Anji","I-No","Goldlewis","Jack-O'","Happy Chaos","Baiken","Testament","Bridget","Sin","Bedman?","Asuka R#","Johnny","Elphelt","A.B.A","Slayer","Dizzy","Venom","Unika","Lucy","Jam","Robo-Ky"]},      // 34
  xko:  {name:"2XKO", chars:["Ahri","Akali","Blitzcrank","Braum","Caitlyn","Darius","Ekko","Illaoi","Jinx","Lux","Samira","Senna","Sett","Teemo","Thresh","Vi","Warwick","Yasuo"]},      // 18
  other:{name:"Other game", chars:[]}
};
const KEY = "myfgc.v1", $ = s => document.querySelector(s);
let db = load(), cur = null, F = {q:"", game:"", char:"", tag:""}, fh = null;
// Rosters as of Nov 18, 2026. Lists are alphabetized here, and any characters you added yourself are merged in without duplicates.
const chars = g => [...new Set([...GAMES[g].chars, ...(db.custom[g]||[])])].sort((a,b) => a.localeCompare(b));
const opts = (arr, first) => (first!==undefined?`<option value="">${first}</option>`:"") + arr.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
const gameOpts = first => opts(Object.entries(GAMES).map(([k,g])=>[k,g.name]), first);

// ---------- Storage ----------
function load(){
  let d; try{ d = JSON.parse(localStorage.getItem(KEY)); }catch{}
  d = d || {}; d.notes ||= []; d.matchups ||= {}; d.custom ||= {}; d.folders ||= []; d.resources ||= []; d.settings ||= {icons:true, arrows:true};
  d.notes.forEach(n => { n.tags ||= []; n.char ||= ""; n.folder ||= ""; n.files ||= []; n.embeds ||= []; }); return d;
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(db)); $("#saved").textContent="Saved"; writeFile(); }catch{ $("#saved").textContent="Storage full: export JSON now"; } }
$("#export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
  a.download = "myfgc-notes.json"; a.click(); URL.revokeObjectURL(a.href);
};
$("#import").onchange = async e => {
  try{ const d = JSON.parse(await e.target.files[0].text()); if(!Array.isArray(d.notes)) throw 0;
    localStorage.setItem(KEY, JSON.stringify(d)); db = load(); cur=null; refresh();
  }catch{ alert("That file isn't a MyFGC export."); }
  e.target.value="";
};

// ---------- Notation translator: one icon theme per game ----------
// Edit THEMES to restyle a game. For real game art, add an `img` map, e.g. THEMES.sf6.img = {lp:"icons/sf6/lp.svg"}.
const THEMES = {
  sf6: {shape:"round", arrow:"plain", crouch:true,
        // Street Fighter 6 fist / boot art, recolored by strength (icons/sf6/)
        img:Object.fromEntries(["lp","mp","hp","lk","mk","hk","p","k"].map(k=>[k,`icons/sf6/${k}.png`])),
        btn:{lp:["LP","#5ccfff"],mp:["MP","#ffd23f"],hp:["HP","#ff4d5e"],lk:["LK","#5ccfff"],mk:["MK","#ffd23f"],hk:["HK","#ff4d5e"],
        l:["L","#5ccfff"],m:["M","#ffd23f"],h:["H","#ff4d5e"],p:["P","#e8e8ea"],k:["K","#e8e8ea"]}},
  t8:  {shape:"square", arrow:"box", alias:{lp:"1",rp:"2",lk:"3",rk:"4"}, btn:{1:["LP","#ff7bb5"],2:["RP","#7bd88f"],3:["LK","#6bb8ff"],4:["RK","#ff6b6b"]},
        // Real Tekken 8 art (icons/t8/). Button combos use one image per combo, e.g. 1+2 -> 1_2.png.
        img:Object.fromEntries(["1","2","3","4","1_2","1_3","1_4","2_3","2_4","3_4","1_2_3","1_2_4","1_3_4","2_3_4","1_2_3_4"].map(k=>[k,`icons/t8/${k}.png`])),
        dirImg:{base:"icons/t8/", neutral:"n", set:{b:{tap:"b",hold:"bhold"},f:{tap:"f",hold:"fhold"},d:{tap:"d",hold:"dhold"},u:{tap:"u",hold:"uhold"},uf:{tap:"uf",hold:"ufhold"},df:{tap:"df",hold:"dfhold"},db:{tap:"db",hold:"dbhold"},ub:{tap:"ub",hold:"ubhold"}}},
        // ^ all 8 directions, tap + held. CAPITAL letter (F, D/B) = held. "n" = neutral star. Anything missing falls back to the back arrow, rotated.
        bracket:"icons/t8/bracketl.png", bracketR:"icons/t8/bracketr.png",   // [1+2] draws hold brackets
        // Move-property icons. Names in colonOnly need colons (:heat:) so normal words in your notes are left alone.
        props:{...Object.fromEntries(["balconybreak","chip","floorblast","floorbreak","forcecrouch","heat","homing","powercrush","tornado","wallblast","wallbound","wallbreak"].map(k=>[k,`icons/t8/${k}.png`])),
               balcony:"icons/t8/balconybreak.png", pc:"icons/t8/powercrush.png"},
        colonOnly:["heat","homing","tornado","chip","pc"]},
  ggst:{shape:"round", arrow:"plain", crouch:true, btnFirst:["d"], alias:{hs:"h"},      // btnFirst: a lone "d" is Dust, not down
        btn:{p:["P","#ff6b8a"],k:["K","#5aa9ff"],s:["S","#5ad17a"],h:["HS","#ff9f43"],d:["D","#c08bff"]},
        img:{p:"icons/ggst/p.png",k:"icons/ggst/k.png",s:"icons/ggst/s.png",h:"icons/ggst/hs.png",d:"icons/ggst/d.png"},
        props:{rc:"icons/ggst/rc.png",dash:"icons/ggst/dash.png",taunt:"icons/ggst/taunt.png"}, colonOnly:["dash","taunt"]},
  xko: {shape:"round", arrow:"plain", crouch:true, hideNeutral:true, alias:{s:"s1"},
        btn:{l:["L","#d0a8ff"],m:["M","#a855f7"],h:["H","#8b2cf5"],s1:["S1","#3cc0ff"],s2:["S2","#ff4d4d"]},
        img:{l:"icons/xko/light.png",m:"icons/xko/medium.png",h:"icons/xko/heavy.png",s1:"icons/xko/s1.png",s2:"icons/xko/s2.png"},
        // numpad digits (236S1) and letters (df) both use these arrows; 66 / 44 / ff / bb are the dash icons; a leading 5 is hidden (5L shows just L)
        dirImg:{base:"icons/xko/", cls:"flat", set:{b:{tap:"back"},f:{tap:"forward"},d:{tap:"down"},u:{tap:"up"},df:{tap:"downforward"},db:{tap:"downback"},ub:{tap:"upback"},uf:{tap:"upforward"}},
                dbl:{"66":"doubleforward","44":"doubleback",ff:"doubleforward",bb:"doubleback"}},
        props:{">":"icons/xko/sequence.png", sequence:"icons/xko/sequence.png", tag:"icons/xko/tag.png", t:"icons/xko/tag.png"}, colonOnly:["tag","sequence"]}
};
THEMES.other = THEMES.sf6;
const ARROW = {d:"↓",f:"→",b:"←",u:"↑",df:"↘",db:"↙",uf:"↗",ub:"↖","d/f":"↘","d/b":"↙","u/f":"↗","u/b":"↖",n:"•"};
const NUM = {1:"↙",2:"↓",3:"↘",4:"←",5:"•",6:"→",7:"↖",8:"↑",9:"↗"};
const MOTION = {qcf:"↓↘→",qcb:"↓↙←",dp:"→↓↘",rdp:"←↓↙",hcf:"←↙↓↘→",hcb:"→↘↓↙←"};
const STANCE = {ws:"WS",fc:"FC",ss:"SS",cd:"CD",wr:"WR"};
const PRE = /^(c\.|cr\.|st\.|j\.|cl\.)/;
const TEKKEN_HINT = /(^|\+)(d\/f|d\/b|u\/f|u\/b|df|db|uf|ub|d|f|b|u|n)\+[1-4]/;
const has = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const esc = s => s.replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const chip = (t,c="") => `<span class="chip ${c}">${t}</span>`;

function btnIcon(th, p){      // typed button name -> icon HTML in this game's style, or null
  const k = has(th.alias||{}, p) ? th.alias[p] : p; if(!has(th.btn, k)) return null;
  const [label, color] = th.btn[k], img = th.img?.[k];
  return img ? `<img class="ic" src="${img}" alt="${label}">` : `<span class="ic ${th.shape}" style="--c:${color}">${label}</span>`;
}
const ROT = {b:0,ub:45,u:90,uf:135,f:180,df:225,d:270,db:315,"u/b":45,"u/f":135,"d/f":225,"d/b":315};
const imgTag = (src, alt, cls="", style="") => `<img class="ic ${cls}" src="${src}" alt="${esc(alt)}"${style ? ` style="${style}"` : ""}>`;
function token(tok, game){
  const low = tok.toLowerCase(), tek = game==="t8" || TEKKEN_HINT.test(low);
  const th = tek ? THEMES.t8 : (THEMES[game] || THEMES.other), arrows = db.settings.arrows;
  const dir = (glyphs, raw) => arrows ? [...glyphs].map(g=>`<span class="arrow ${th.arrow}">${g}</span>`).join("") : chip(raw,"mod");
  const dcls = "dir " + (th.dirImg?.cls || "");
  const dirIcon = (p, rp) => {
    if(!arrows) return chip(p.toUpperCase(),"mod");
    if(th.dirImg?.neutral && p==="n") return imgTag(th.dirImg.base+th.dirImg.neutral+".png","n",dcls);
    if(!(th.dirImg && has(ROT,p))) return dir(ARROW[p], p.toUpperCase());
    const hold = rp===rp.toUpperCase(), ent = th.dirImg.set[p.replace("/","")], file = ent && ((hold && ent.hold) || ent.tap);
    return file ? imgTag(`${th.dirImg.base}${file}.png`, p, dcls) : imgTag(`${th.dirImg.base}${hold?"bhold":"b"}.png`, p, dcls, `--rot:${ROT[p]}deg`);
  };
  const dblIcon = s => imgTag(th.dirImg.base+th.dirImg.dbl[s]+".png", s, dcls);
  const NUMKEY = {1:"db",2:"d",3:"df",4:"b",6:"f",7:"ub",8:"u",9:"uf"};
  const MOTKEYS = {qcf:["d","df","f"],qcb:["d","db","b"],dp:["f","d","df"],rdp:["b","d","db"],hcf:["b","db","d","df","f"],hcb:["f","df","d","db","b"]};
  const numDirs = (str, hasBtn) => {
    if(!arrows || !th.dirImg) return dir([...str].map(d=>NUM[d]).join(""), str);
    if(th.dirImg.dbl && has(th.dirImg.dbl,str)) return dblIcon(str);
    return [...str].map(d => has(NUMKEY,d) ? dirIcon(NUMKEY[d], NUMKEY[d]) : (th.hideNeutral && hasBtn ? "" : dir("•","5"))).join("");
  };
  let raw = tok, b0 = "", b1 = "", pre = "";
  if(th.bracket){ if(raw[0]==="["){ b0 = imgTag(th.bracket,"["); raw = raw.slice(1); } if(raw.endsWith("]")){ b1 = th.bracketR ? imgTag(th.bracketR,"]") : imgTag(th.bracket,"]","flip"); raw = raw.slice(0,-1); } }
  const m = raw.toLowerCase().match(PRE);
  if(m){ const k = m[1];
    pre = (k==="c."||k==="cr.") ? (th.crouch ? (th.dirImg && arrows ? dirIcon("d","d") : dir("↓","c.")) : chip(k,"mod"))
        : k==="j." ? (th.crouch ? (th.dirImg && arrows ? dirIcon("u","u") : dir("↑","j.")) : chip(k,"mod"))   // j. = jumping = up arrow
        : k==="st." ? "" : chip(k,"mod");
    raw = raw.slice(k.length); }
  const t = raw.toLowerCase();
  if(th.props){ const colon = t.length>2 && t[0]===":" && t.endsWith(":"), name = colon ? t.slice(1,-1) : t;
    if(has(th.props,name) && (colon || !th.colonOnly.includes(name))) return imgTag(th.props[name], name, "prop"); }
  if(th.dirImg?.dbl && has(th.dirImg.dbl,t)) return b0 + pre + (arrows ? dblIcon(t) : chip(t.toUpperCase(),"mod")) + b1;
  if(has(MOTION,t)) return b0 + pre + (arrows && th.dirImg ? MOTKEYS[t].map(k=>dirIcon(k,k)).join("") : dir(MOTION[t], t.toUpperCase())) + b1;
  const parts = t.split("+"), rparts = raw.split("+"), out = []; let grp = [];
  const flush = () => { if(!grp.length) return; const k = [...grp].sort().join("_");
    if(th.img && has(th.img,k)) out.push(imgTag(th.img[k], grp.map(g=>th.btn[g][0]).join("+")));
    else grp.forEach(g => out.push(btnIcon(th,g))); grp = []; };
  for(let i=0; i<parts.length; i++){ const p = parts[i], k = has(th.alias||{},p) ? th.alias[p] : p;
    if(has(ARROW,p) && !(th.btnFirst||[]).includes(p)){ flush(); out.push(dirIcon(p, rparts[i])); }
    else if(has(STANCE,p)){ flush(); out.push(chip(STANCE[p],"mod")); }
    else if(has(th.btn,k)) grp.push(k);                      // buttons pressed together are grouped
    else { flush(); const n = p.match(/^([1-9]+)([a-z]+\d?)?$/);   // numpad: 236p, 2l, 623h, 5s1
      const nb = n && (n[2] ? btnIcon(th, n[2]) : "");
      if(!n || nb===null) return null;
      out.push(numDirs(n[1], !!n[2]), nb); }
  }
  flush();
  return out.length ? b0 + pre + out.join("") + b1 : null;
}
const tokHTML = (w, game) => { const h = token(w, game); return h ? `<span class="tok" contenteditable="false" data-raw="${esc(w)}">${h}</span>` : null; };
const render = (text, game, on=true) => !on ? esc(text) : text.split(/(\s+|,)/).map(w => (!w.trim()||w===",") ? esc(w) : (tokHTML(w,game) ?? esc(w))).join("");
function ser(el){   // editor DOM -> plain text with the raw notation kept
  let s = ""; el.childNodes.forEach(c => {
    if(c.nodeType===3) s += c.textContent.replace(/\u00a0/g," ");
    else if(c.classList?.contains("tok")) s += c.dataset.raw;
    else if(c.nodeName==="BR") s += "\n";
    else s += (s && !s.endsWith("\n") ? "\n" : "") + ser(c);
  }); return s;
}

// ---------- Single-box editor ----------
const body = $("#body"), curNote = () => { const n = db.notes.find(x=>x.id===cur); if(n){ n.files ||= []; n.embeds ||= []; } return n; };
function convertBefore(){         // turn the word before the caret into an icon token
  if(!iconsOn()) return;
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return;
  const r = s.getRangeAt(0), n = r.startContainer; if(n.nodeType!==3) return;
  const m = n.textContent.slice(0, r.startOffset).replace(/\u00a0/g," ").match(/(\S+)$/); if(!m) return;
  const html = tokHTML(m[1], $("#game").value); if(!html) return;
  const start = r.startOffset - m[1].length; n.splitText(r.startOffset);
  const mid = n.splitText(start), tmp = document.createElement("span"); tmp.innerHTML = html;
  const el = tmp.firstChild; mid.replaceWith(el);
  const nr = document.createRange(); nr.setStartAfter(el); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
}
function unchip(e){               // Backspace on an icon turns it back into editable text
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return;
  const r = s.getRangeAt(0), p = r.startContainer;
  let prev; if(p.nodeType===3){ if(r.startOffset>0) return; prev = p.previousSibling; } else prev = p.childNodes[r.startOffset-1];
  if(!prev?.classList?.contains("tok")) return;
  e.preventDefault(); const t = document.createTextNode(prev.dataset.raw); prev.replaceWith(t);
  const nr = document.createRange(); nr.setStart(t, t.length); nr.collapse(true); s.removeAllRanges(); s.addRange(nr); edit();
}
body.addEventListener("keydown", e => { if([" ",",","Enter"].includes(e.key)) convertBefore(); else if(e.key==="Backspace") unchip(e); });
body.addEventListener("input", edit);
body.addEventListener("paste", e => { const imgs = [...(e.clipboardData.files||[])].filter(f => f.type.startsWith("image/")); if(imgs.length){ e.preventDefault(); addFiles(imgs); return; }
  e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text")); body.innerHTML = render(ser(body), $("#game").value, iconsOn()); edit(); });

function edit(){
  const n = curNote(); if(!n) return;
  Object.assign(n, {title:$("#title").value, game:$("#game").value, char:$("#char").value, body:ser(body),
    tags:$("#tags").value.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean), updated:Date.now(), folder:$("#folder").value});
  save(); paint(); renderList();
}
function showEditor(){
  const n = curNote(); $("#editor").hidden = !n; $("#welcome").hidden = !!n; if(!n) return;
  $("#title").value = n.title; $("#game").value = n.game; fillChars(); $("#char").value = n.char; fillFolders(); $("#folder").value = n.folder;
  $("#tags").value = n.tags.join(", "); body.innerHTML = render(n.body, n.game, iconsOn()); paint(); renderAttach();
}
const fillChars = () => $("#char").innerHTML = opts(chars($("#game").value).map(c=>[c,c]), "No character");
$("#game").onchange = () => { const t = ser(body); fillChars(); const n = curNote(); n.game = $("#game").value; n.char = ""; body.innerHTML = render(t, n.game, iconsOn()); edit(); };
["#title","#char","#tags"].forEach(s => $(s).addEventListener("input", edit));
$("#new").onclick = () => { const n = {id:crypto.randomUUID(), title:"", game:F.game||"sf6", char:F.char, body:"", tags:F.tag?[F.tag]:[], files:[], embeds:[], updated:Date.now()};
  db.notes.push(n); cur = n.id; save(); showEditor(); renderList(); $("#title").focus(); };
$("#delete").onclick = () => { if(!confirm("Delete this note?")) return; curNote().files.forEach(f => idbDel(f.id)); db.notes = db.notes.filter(n=>n.id!==cur); cur=null; save(); showEditor(); renderList(); };
$("#list").onclick = e => { const li = e.target.closest("li"); if(li){ cur = li.dataset.id; showEditor(); renderList(); } };

// ---------- Search + filters (text, game, character, tag) ----------
function renderList(){
  const cOpt = c => `<option>${esc(c)}</option>`;
  $("#fchar").innerHTML = `<option value="">All characters</option>` + (F.game ? chars(F.game).map(cOpt).join("")
    : Object.keys(GAMES).filter(g=>chars(g).length).map(g=>`<optgroup label="${GAMES[g].name}">${chars(g).map(cOpt).join("")}</optgroup>`).join(""));
  $("#fchar").value = F.char;
  const tags = [...new Set(db.notes.flatMap(n=>n.tags))].sort();
  $("#tagbar").innerHTML = tags.map(t=>`<button class="tag ${F.tag===t?"on":""}" data-t="${esc(t)}">#${esc(t)}</button>`).join("");
  const q = F.q.toLowerCase(), by = $("#sort").value;
  const hits = db.notes.filter(n => (!F.game||n.game===F.game) && (!F.char||n.char===F.char) && (!F.tag||n.tags.includes(F.tag))
    && (n.title+" "+n.body+" "+n.char+" "+n.tags.join(" ")).toLowerCase().includes(q))
    .sort((a,b) => (+!!b.pin - +!!a.pin) || (by==="title" ? a.title.localeCompare(b.title) : by==="game" ? a.game.localeCompare(b.game) : b.updated-a.updated));
  const li = n => `<li data-id="${n.id}" class="${n.id===cur?"on":""}">${n.pin?"★ ":""}${esc(n.title||"Untitled")}${n.files.length+n.embeds.length ? " 📎"+(n.files.length+n.embeds.length) : ""}
    <small>${GAMES[n.game].name}${n.char?" - "+esc(n.char):""}${n.tags.length?" - #"+n.tags.map(esc).join(" #"):""}</small></li>`;
  const folders = db.folders.map(f => { const m = hits.filter(n=>n.folder===f); return `<details open><summary>${esc(f)} (${m.length})</summary><ul>${m.map(li).join("")}</ul></details>`; }).join("");
  const loose = hits.filter(n => !db.folders.includes(n.folder));
  $("#list").innerHTML = folders + `<ul>${loose.map(li).join("")}</ul>` + (hits.length ? "" : `<p class="hint">No notes match these filters.</p>`);
}
$("#search").oninput = e => { F.q = e.target.value; renderList(); };
$("#fgame").onchange = e => { F.game = e.target.value; F.char = ""; renderList(); };
$("#fchar").onchange = e => { F.char = e.target.value; renderList(); };
$("#tagbar").onclick = e => { const t = e.target.dataset.t; if(t){ F.tag = F.tag===t ? "" : t; renderList(); } };

// ---------- Characters tab ----------
const key = (g, me) => g + "|" + (me||"any");
function record(g, c){ let w=0, l=0;
  for(const [k,v] of Object.entries(db.matchups)) if(k.startsWith(g+"|") && v[c]){ w += +v[c].w||0; l += +v[c].l||0; } return {w,l}; }
const pct = (w,l) => w+l ? Math.round(100*w/(w+l)) + "%" : "–";
function renderChars(){
  const g = $("#cgame").value;
  $("#cgrid").innerHTML = chars(g).map(c => { const r = record(g,c), n = db.notes.filter(x=>x.game===g && x.char===c).length;
    return `<button data-c="${esc(c)}"><b>${esc(c)}</b><small>${n} note${n===1?"":"s"}</small><small>${r.w}W ${r.l}L · ${pct(r.w,r.l)}</small></button>`; }).join("")
    || "<p class='hint'>No characters yet. Add one above.</p>";
}
$("#cgame").onchange = renderChars;
$("#cadd").onclick = () => { const g = $("#cgame").value, c = $("#cnew").value.trim(); if(!c || chars(g).includes(c)) return;
  (db.custom[g] ||= []).push(c); $("#cnew").value=""; save(); renderChars(); };
$("#cgrid").onclick = e => { const b = e.target.closest("button"); if(!b) return;
  F = {q:"", game:$("#cgame").value, char:b.dataset.c, tag:""}; $("#search").value=""; $("#fgame").value = F.game; tab("notes"); renderList(); };

// ---------- Matchups tab: wins, losses, win % ----------
function renderMatchups(){
  const g = $("#mgame").value; if(!$("#mme").dataset.g || $("#mme").dataset.g!==g){ $("#mme").innerHTML = opts(chars(g).map(c=>[c,c]), "Any character"); $("#mme").dataset.g = g; }
  const data = db.matchups[key(g,$("#mme").value)] ||= {}; let W=0, L=0;
  const rows = chars(g).map(c => { const r = data[c] || {w:0,l:0}; W += +r.w; L += +r.l;
    return `<tr><td>${esc(c)}</td><td><input type="number" min="0" data-c="${esc(c)}" data-k="w" value="${r.w}" aria-label="Wins vs ${esc(c)}"> <button data-c="${esc(c)}" data-add="w">+W</button></td>
      <td><input type="number" min="0" data-c="${esc(c)}" data-k="l" value="${r.l}" aria-label="Losses vs ${esc(c)}"> <button data-c="${esc(c)}" data-add="l">+L</button></td>
      <td class="${r.w+r.l ? (r.w>r.l?"good":r.w<r.l?"bad":"") : ""}">${pct(r.w,r.l)}</td></tr>`; }).join("");
  $("#mtable").innerHTML = `<tr><th>Opponent</th><th>Wins</th><th>Losses</th><th>Win %</th></tr>` +
    (rows ? rows + `<tr class="total"><td>Total</td><td>${W}</td><td>${L}</td><td>${pct(W,L)}</td></tr>` : `<tr><td colspan="4">No characters yet. Add some in the Characters tab.</td></tr>`);
}
$("#mgame").onchange = () => { $("#mme").dataset.g=""; renderMatchups(); }; $("#mme").onchange = renderMatchups;
function setRec(c, k, v){ const d = db.matchups[key($("#mgame").value,$("#mme").value)]; (d[c] ||= {w:0,l:0})[k] = Math.max(0, parseInt(v)||0); save(); renderMatchups(); }
$("#mtable").onchange = e => { if(e.target.dataset.k) setRec(e.target.dataset.c, e.target.dataset.k, e.target.value); };
$("#mtable").onclick = e => { const a = e.target.dataset.add; if(a){ const d = db.matchups[key($("#mgame").value,$("#mme").value)][e.target.dataset.c] || {w:0,l:0}; setRec(e.target.dataset.c, a, (+d[a]||0)+1); } };

// ---------- Tabs + startup ----------
function tab(name){
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.view===name));
  for(const v of ["notes","chars","matchups","notation","resources","feedback"]) $("#"+v).hidden = v!==name;
  if(name==="chars") renderChars(); if(name==="matchups") renderMatchups();
  if(name==="notation"){ if(curNote()) $("#ngame").value = curNote().game; renderNotation(); }
  if(name==="resources") renderResources();
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => tab(b.dataset.view));
function refresh(){ showEditor(); renderList(); }
$("#fgame").innerHTML = gameOpts("All games"); $("#game").innerHTML = gameOpts(); $("#cgame").innerHTML = gameOpts(); $("#mgame").innerHTML = gameOpts();
fillChars(); refresh();

// ---------- v3: toggles, folders, settings, save file ----------
function iconsOn(n){ n ||= curNote(); return !!n && (n.icons ?? db.settings.icons); }
function paint(){ const n = curNote(); if(!n) return; const b = $("#banner"); b.className = "banner " + n.game;
  b.textContent = GAMES[n.game].name + (n.char ? " - " + n.char : ""); $("#tIcons").classList.toggle("on", iconsOn()); $("#tPin").classList.toggle("on", !!n.pin); }
function fillFolders(){ $("#folder").innerHTML = opts(db.folders.map(f=>[esc(f),esc(f)]), "No folder"); }
function addFolder(){ const f = (prompt("Folder name") || "").trim(); if(f && !db.folders.includes(f)){ db.folders.push(f); save(); renderList(); if(curNote()){ fillFolders(); $("#folder").value = curNote().folder; } } }
$("#nfolder").onclick = $("#wfolder").onclick = addFolder;
$("#wnew").onclick = () => $("#new").click();
$("#sort").onchange = renderList;
$("#tIcons").onclick = () => { const n = curNote(), t = ser(body); n.icons = !iconsOn(n); body.innerHTML = render(t, n.game, iconsOn(n)); edit(); };
$("#tPin").onclick = () => { const n = curNote(); n.pin = !n.pin; edit(); };
$("#gear").onclick = () => { $("#sIcons").checked = db.settings.icons; $("#sArrows").checked = db.settings.arrows; $("#sTheme").value = db.settings.theme || "night"; $("#settings").showModal(); };
$("#sIcons").onchange = $("#sArrows").onchange = () => { db.settings = {...db.settings, icons:$("#sIcons").checked, arrows:$("#sArrows").checked}; save(); showEditor(); };
$("#sClose").onclick = () => $("#settings").close();
async function writeFile(){ if(!fh) return; try{ const w = await fh.createWritable(); await w.write(JSON.stringify(db,null,2)); await w.close(); }catch{} }
$("#savefile").onclick = $("#wsave").onclick = async () => {
  if(!window.showSaveFilePicker) return alert("This browser can't pick a save location. Use Export JSON instead.");
  try{ fh = await showSaveFilePicker({suggestedName:"myfgc-notes.json", types:[{accept:{"application/json":[".json"]}}]}); await writeFile(); $("#saved").textContent = "Saved to file"; }catch{}
};
refresh();

// ---------- Notation reference (built from the live translator, so it always matches your notes) ----------
const NUMPAD = ["1","2","3","4","5","6","7","8","9"];
const REF = {
  t8: [["Directions (lowercase = tap)",["d","df","f","uf","u","ub","b","db","n"]], ["Held directions (CAPITALS)",["D","DF","F","UF","U","UB","B","DB"]],
       ["Buttons and combinations",["1","2","3","4","1+2","1+3","1+4","2+3","2+4","3+4","1+2+3","1+2+4","1+3+4","2+3+4","1+2+3+4"]],
       ["Hold brackets",["[1]","[1+2]"]], ["Stances",["ws","fc","ss","cd","wr"]],
       ["Move properties",["balconybreak","floorbreak","floorblast","wallbreak","wallblast","wallbound","forcecrouch","powercrush"]],
       ["Properties that need colons (so normal words stay plain)",[":heat:",":homing:",":tornado:",":chip:",":pc:"]],
       ["Whole combos (separate with commas or spaces)",["df+1,2","f,f+2","d/f+1+2","1,2,1+2"]]],
  sf6: [["Numpad directions",NUMPAD], ["Motions",["qcf","qcb","dp","rdp","hcf","hcb"]], ["Buttons",["lp","mp","hp","lk","mk","hk"]],
        ["Prefixes",["c.lp","st.mp","j.hk","cl.hp"]], ["Whole combos",["2MK,236P","623HP","c.MP,5HP"]]],
  ggst:[["Numpad directions",NUMPAD], ["Motions",["qcf","qcb","dp"]], ["Buttons",["p","k","s","h","d"]], ["Prefixes (c. = crouching, j. = jumping)",["c.s","j.hs","j.p"]],
        ["Roman Cancel, dash and taunt",["rc",":dash:",":taunt:"]], ["Whole combos",["5P,2K,6P","236S","j.HS","5D,rc"]]],
  xko: [["Numpad directions",NUMPAD], ["Letter directions",["d","df","f","uf","u","ub","b","db"]], ["Dashes",["66","44","ff","bb"]], ["Motions",["qcf","qcb","dp"]],
        ["Buttons",["l","m","h","s1","s2"]], ["Prefixes",["c.l","j.h"]], ["Tag and sequence",["t",":tag:",">",":sequence:"]], ["Whole combos",["5L > 2M > 5H","236S1","j.H > t","66 5L"]]]
};
REF.other = REF.sf6;
function renderNotation(){
  const g = $("#ngame").value;
  $("#nref").innerHTML = `<p class="hint">Type the text on the left in a note set to ${GAMES[g].name}. Icons appear when you press space, comma or Enter. Use the 👊 button in a note to turn icons off for that note, or ⚙ Settings to turn arrows off.</p>` +
    REF[g].map(([title,items]) => `<h3>${title}</h3><div class="refgrid ${/combos/.test(title)?"wide":""}">` +
      items.map(x => `<div class="refcell"><code>${esc(x)}</code>${render(x, g, true)}</div>`).join("") + "</div>").join("");
}
$("#ngame").innerHTML = gameOpts(); $("#ngame").onchange = renderNotation;

// ---------- Resources, filtered by game ----------
// g: a game key, or "all" for tools that work for every game. Edit this list, or add your own in the app.
const RESOURCES = [
  {t:"The Fighting Game Glossary", u:"https://glossary.infil.net/", g:"all", k:"Guide", d:"General knowledge: fighting game terms and concepts."},
  {t:"SuperCombo Wiki", u:"https://wiki.supercombo.gg/", g:"sf6", k:"Wiki", d:"Street Fighter and other Capcom games, plus Avatar, MK, IVS and more."},
  {t:"Dustloop Wiki", u:"https://www.dustloop.com/w/Main_Page", g:"ggst", k:"Wiki", d:"Anime fighting games: Guilty Gear, Marvel Tokon and more."},
  {t:"Ewgf Stats", u:"https://ewgf.gg/", g:"t8", k:"Tool", d:"Tekken stats."},
  {t:"Replay Theatre", u:"https://replaytheater.app/", g:"all", k:"Tool", d:"General knowledge."},
  {t:"Combo Translator (FGC Combo Companion)", u:"https://app.fgc-combo-companion.xyz/combo-translator", g:"all", k:"Tool", d:"Turns typed combo notation into icons. Check which games it supports."},
  {t:"Fighting Game Input Translator", u:"https://ygg-m.github.io/fg-input-translator/", g:"all", k:"Tool", d:"Translates numpad notation into visual inputs."},
  {t:"comboNotes", u:"https://daijoubu-dev.github.io/comboNotes/", g:"sf6", k:"Tool", d:"Combo notation to Street Fighter 6 icons. Other games are planned."},
  {t:"SF Stats", u:"https://sfstats.app/Spritex", g:"sf6", k:"Tool", d:"Street Fighter stats site from your market study."},
  {t:"ComboTier", u:"https://combotier.com/", g:"all", k:"Tool", d:"Combo site from your market study."},
  {t:"ComboForge", u:"https://comboforge.gg/", g:"all", k:"Tool", d:"Combo site from your market study."},
  {t:"ComboLab", u:"https://combolab.app/en", g:"all", k:"Tool", d:"Combo site from your market study."},
  {t:"Matchups.gg", u:"https://matchups.gg/#startLabbing", g:"all", k:"Tool", d:"Matchup site from your market study."},
  {t:"2XKO Discord", u:"https://discord.gg/2XKO", g:"xko", k:"Community", d:"2XKO community Discord."}
];
const RKINDS = ["Tool","Guide","Wiki","Community","Video","Frame data","Other"];
function renderResources(){
  const g = $("#rgame").value, all = [...RESOURCES, ...db.resources.map((r,i)=>({...r, mine:i}))];
  const hits = all.filter(r => !g || r.g==="all" || r.g===g);
  $("#rhint").textContent = g ? `Showing ${GAMES[g].name} resources plus tools that work for every game.` : "Showing every resource. Pick a game to narrow the list.";
  $("#rlist").innerHTML = hits.map(r => `<div class="rcard"><a href="${esc(r.u)}" target="_blank" rel="noopener noreferrer">${esc(r.t)}</a>
    <small>${esc(r.k)} - ${r.g==="all" ? "All games" : GAMES[r.g].name}</small>${r.d ? `<p>${esc(r.d)}</p>` : ""}
    ${r.mine!==undefined ? `<button class="ghost" data-del="${r.mine}">Remove</button>` : ""}</div>`).join("") || `<p class="hint">Nothing here yet. Add one below.</p>`;
}
$("#rgame").innerHTML = gameOpts("All games"); $("#rgame").onchange = renderResources;
$("#rnewgame").innerHTML = opts([["all","All games"], ...Object.entries(GAMES).map(([k,g])=>[k,g.name])]);
$("#rkind").innerHTML = opts(RKINDS.map(k=>[k,k]));
$("#radd").onclick = () => { const t = $("#rtitle").value.trim(), u = $("#rurl").value.trim();
  if(!t || !/^https?:\/\//i.test(u)) return alert("Add a title and a link that starts with http:// or https://");
  db.resources.push({t, u, g:$("#rnewgame").value, k:$("#rkind").value, d:$("#rdesc").value.trim()});
  save(); ["#rtitle","#rurl","#rdesc"].forEach(i => $(i).value = ""); renderResources(); };
$("#rlist").onclick = e => { const i = e.target.dataset.del; if(i!==undefined){ db.resources.splice(+i,1); save(); renderResources(); } };

// ---------- Attachments: pictures/videos (stored in IndexedDB) and YouTube / X embeds ----------
let dbp, attachSeq = 0;
const idb = () => dbp ||= new Promise((res, rej) => { if(!window.indexedDB) return rej(new Error("no IndexedDB"));
  const q = indexedDB.open("myfgc-files", 1); q.onupgradeneeded = () => q.result.createObjectStore("files", {keyPath:"id"}); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const idbTx = async (mode, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction("files", mode), q = fn(t.objectStore("files")); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
const idbPut = rec => idbTx("readwrite", s => s.put(rec)), idbGet = id => idbTx("readonly", s => s.get(id)), idbDel = id => idbTx("readwrite", s => s.delete(id)).catch(() => {});

async function addFiles(files){
  const n = curNote(); if(!n) return;
  for(const f of files){
    if(!/^(image|video)\//.test(f.type)){ alert(`${f.name}: only pictures and videos can be attached.`); continue; }
    if(f.size > 200*1024*1024){ alert(`${f.name} is over 200 MB. Embed it from YouTube or X instead.`); continue; }
    const id = crypto.randomUUID();
    try{ await idbPut({id, blob:f, name:f.name}); }catch{ alert("This browser couldn't store the file (private browsing or full storage)."); break; }
    n.files.push({id, name:f.name, type:f.type, size:f.size});
  }
  n.updated = Date.now(); save(); renderList(); renderAttach();
}
function parseEmbed(raw){          // only YouTube and X/Twitter post links; returns validated ids, never raw URLs
  let u; try{ u = new URL(raw.trim()); }catch{ return null; }
  if(!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.replace(/^(www\.|m\.)/, "");
  if(["youtu.be","youtube.com","youtube-nocookie.com"].includes(h)){
    const id = h==="youtu.be" ? u.pathname.slice(1).split("/")[0] : (u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)||[])[1]);
    if(!/^[\w-]{11}$/.test(id||"")) return null;
    const m = (u.searchParams.get("t") || u.searchParams.get("start") || "").match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    return {kind:"youtube", id, start: m ? (+m[1]||0)*3600 + (+m[2]||0)*60 + (+m[3]||0) : 0};
  }
  if(["x.com","twitter.com","mobile.twitter.com"].includes(h)){ const m = u.pathname.match(/\/status(?:es)?\/(\d{5,25})/); return m ? {kind:"x", id:m[1]} : null; }
  return null;
}
function embedCard(e, i){          // ids are re-checked here, so a hand-edited import file can't inject markup
  const yt = e.kind==="youtube";
  if(!(yt ? /^[\w-]{11}$/.test(e.id) : e.kind==="x" && /^\d{5,25}$/.test(e.id))) return "";
  const start = yt ? Math.max(0, parseInt(e.start)||0) : 0;
  const src = yt ? `https://www.youtube-nocookie.com/embed/${e.id}${start ? "?start="+start : ""}` : `https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&id=${e.id}`;
  const link = yt ? `https://www.youtube.com/watch?v=${e.id}${start ? "&t="+start : ""}` : `https://x.com/i/status/${e.id}`;
  return `<figure class="acard embed ${e.kind}"><iframe src="${src}" title="${yt ? "YouTube video" : "X post"}" loading="lazy" allowfullscreen
    allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"></iframe>
    <figcaption><a href="${link}" target="_blank" rel="noopener noreferrer">Open on ${yt ? "YouTube" : "X"}</a><button class="ghost" data-re="${i}">Remove</button></figcaption></figure>`;
}
let objUrls = [];
async function renderAttach(){
  const n = curNote(), seq = ++attachSeq; if(!n) return;
  const urls = [], cards = [];
  for(const f of n.files){
    const rec = await idbGet(f.id).catch(() => null);
    if(seq !== attachSeq){ urls.forEach(u => URL.revokeObjectURL(u)); return; }       // the person switched notes meanwhile
    let media = `<p class="hint">This file isn't in this browser (it was added on another device or cleared).</p>`;
    if(rec){ const u = URL.createObjectURL(rec.blob); urls.push(u);
      media = String(f.type).startsWith("video/") ? `<video src="${u}" controls preload="metadata"></video>` : `<img src="${u}" alt="${esc(f.name)}">`; }
    cards.push(`<figure class="acard">${media}<figcaption><span>${esc(f.name)}</span><button class="ghost" data-rf="${esc(f.id)}">Remove</button></figcaption></figure>`);
  }
  n.embeds.forEach((e, i) => cards.push(embedCard(e, i)));
  objUrls.forEach(u => URL.revokeObjectURL(u)); objUrls = urls;
  $("#agrid").innerHTML = cards.join("");
}
$("#afile").onchange = e => { addFiles([...e.target.files]); e.target.value = ""; };
$("#tAttach").onclick = () => $("#afile").click();
$("#attach").ondragover = e => e.preventDefault();
$("#attach").ondrop = e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); };
$("#eadd").onclick = () => { const n = curNote(), p = parseEmbed($("#eurl").value);
  if(!n) return; if(!p) return alert("Paste a link to a YouTube video or an X post (for example https://youtu.be/... or https://x.com/user/status/...).");
  if(!n.embeds.some(e => e.kind===p.kind && e.id===p.id && (e.start||0)===(p.start||0))) n.embeds.push(p);
  $("#eurl").value = ""; n.updated = Date.now(); save(); renderList(); renderAttach(); };
$("#eurl").addEventListener("keydown", e => { if(e.key==="Enter") $("#eadd").click(); });
$("#agrid").onclick = async e => { const b = e.target.closest("button"), n = curNote(); if(!b || !n) return;
  if(b.dataset.rf){ if(!confirm("Remove this file from the note?")) return; await idbDel(b.dataset.rf); n.files = n.files.filter(f => f.id !== b.dataset.rf); }
  else if(b.dataset.re !== undefined) n.embeds.splice(+b.dataset.re, 1);
  save(); renderList(); renderAttach(); };

// ---------- Day / night mode ----------
const lightQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
function applyTheme(){
  const t = db.settings.theme || "night";
  document.documentElement.dataset.theme = (t==="day" || (t==="system" && lightQuery?.matches)) ? "light" : "dark";
}
lightQuery?.addEventListener?.("change", applyTheme);
$("#sTheme").onchange = () => { db.settings.theme = $("#sTheme").value; save(); applyTheme(); };
applyTheme();
