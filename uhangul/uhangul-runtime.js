/* uHangul v0.6-draft — file:// compatible runtime
 * No ES modules. A local dictionary is loaded when the page is served.
 * New consonants are onset-only.
 */
(function() {
"use strict";

const VERSION = "0.6-draft";
const SPUA_BASE = 0xFA000;
// The active list is the confirmed subset of uhangul-v0.6-draft.json.
const NEW = Object.freeze(["F","V","Z","TH","X"]);
const VOWELS = Object.freeze(Array.from("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"));
const FINALS = Object.freeze(["", ...Array.from("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")]);
let RECORDS = [{"id":"frank-stella","original":"Frank Stella","language":"en-US","korean":"프랭크 스텔라","uhangul":"[Fㅡ]랭크 스텔라","note":"F, R; 새 자음은 초성만","uhangulVersion":"0.6-draft"},{"id":"roy-lichtenstein","original":"Roy Lichtenstein","language":"en-US","korean":"로이 리히텐슈타인","uhangul":"로이 리히텐슈타인","note":"R 초성","uhangulVersion":"0.6-draft"},{"id":"robert-rauschenberg","original":"Robert Rauschenberg","language":"en-US","korean":"로버트 라우션버그","uhangul":"로버트 라우션버그","note":"어말/종성 r 표기 제거","uhangulVersion":"0.6-draft"},{"id":"georgia-okeeffe","original":"Georgia O'Keeffe","language":"en-US","korean":"조지아 오키프","uhangul":"조지아 오키[Fㅡ]","note":"final /f/가 기존 프 음절로 실현되어 F를 초성으로 사용","uhangulVersion":"0.6-draft"},{"id":"jasper-johns","original":"Jasper Johns","language":"en-US","korean":"재스퍼 존스","uhangul":"재스퍼 존스","note":"종성 r/z를 새 종성으로 만들지 않음","uhangulVersion":"0.6-draft"},{"id":"jeff-koons","original":"Jeff Koons","language":"en-US","korean":"제프 쿤스","uhangul":"제[Fㅡ] 쿤[Zㅡ]","note":"프/스의 초성만 F/Z로 교체","uhangulVersion":"0.6-draft"},{"id":"keith-haring","original":"Keith Haring","language":"en-US","korean":"키스 해링","uhangul":"키[THㅡ] 해링","note":"TH, R 초성","uhangulVersion":"0.6-draft"},{"id":"andy-warhol","original":"Andy Warhol","language":"en-US","korean":"앤디 워홀","uhangul":"앤디 워홀","note":"종성/rhotic R 미표기","uhangulVersion":"0.6-draft"},{"id":"francis-bacon","original":"Francis Bacon","language":"en-US","korean":"프랜시스 베이컨","uhangul":"[Fㅡ]랜시스 베이컨","note":"F, R","uhangulVersion":"0.6-draft"},{"id":"richard-hamilton","original":"Richard Hamilton","language":"en-US","korean":"리처드 해밀턴","uhangul":"리처드 해밀턴","note":"초성 R만 사용","uhangulVersion":"0.6-draft"},{"id":"edward-hopper","original":"Edward Hopper","language":"en-US","korean":"에드워드 호퍼","uhangul":"에드워드 호퍼","note":"종성/rhotic R 미표기","uhangulVersion":"0.6-draft"},{"id":"mark-rothko","original":"Mark Rothko","language":"en-US","korean":"마크 로스코","uhangul":"마크 로[THㅡ]코","note":"R 초성; /θ/가 스 음절로 실현","uhangulVersion":"0.6-draft"},{"id":"cindy-sherman","original":"Cindy Sherman","language":"en-US","korean":"신디 셔먼","uhangul":"신디 셔먼","note":"rhotic R 미표기","uhangulVersion":"0.6-draft"},{"id":"barbara-kruger","original":"Barbara Kruger","language":"en-US","korean":"바버라 크루거","uhangul":"바버라 크루거","note":"실제 R 초성으로 실현되는 음절만 교체","uhangulVersion":"0.6-draft"},{"id":"helen-frankenthaler","original":"Helen Frankenthaler","language":"en-US","korean":"헬렌 프랭컨탈러","uhangul":"헬렌 [Fㅡ]랭컨[THㅏㄹ]러","note":"F, R, TH; rhotic 종성 없음","uhangulVersion":"0.6-draft"},{"id":"david-hockney","original":"David Hockney","language":"en-US","korean":"데이비드 호크니","uhangul":"데이[Vㅣ]드 호크니","note":"V","uhangulVersion":"0.6-draft"},{"id":"vanessa-bell","original":"Vanessa Bell","language":"en-US","korean":"바네사 벨","uhangul":"[Vㅏ]네사 벨","note":"V","uhangulVersion":"0.6-draft"},{"id":"eva-hesse","original":"Eva Hesse","language":"en-US","korean":"에바 헤세","uhangul":"에[Vㅏ] 헤세","note":"V","uhangulVersion":"0.6-draft"},{"id":"frida-kahlo","original":"Frida Kahlo","language":"es-MX","korean":"프리다 칼로","uhangul":"[Fㅡ]리다 칼로","note":"F; 스페인어 r는 /ɹ/가 아니므로 ㄹ 유지","uhangulVersion":"0.6-draft"},{"id":"lucas-cranach","original":"Lucas Cranach","language":"de-DE","korean":"루카스 크라나흐","uhangul":"루카스 크라나[Xㅡ]","note":"독일어 /x/","uhangulVersion":"0.6-draft"},{"id":"caspar-david-friedrich","original":"Caspar David Friedrich","language":"de-DE","korean":"카스파르 다비트 프리드리히","uhangul":"카스파르 다[Vㅣ]트 [Fㅡ]리드리히","note":"V, F; /ç/는 기존 ㅎ으로 표기","uhangulVersion":"0.6-draft"},{"id":"gerhard-richter","original":"Gerhard Richter","language":"de-DE","korean":"게르하르트 리히터","uhangul":"게르하르트 리히터","note":"/ç/는 기존 ㅎ으로 표기; 독일어 r는 /ɹ/로 강제 변환하지 않음","uhangulVersion":"0.6-draft"}];

const EXCLUDED = new Set(["SCRIPT","STYLE","TEXTAREA","INPUT","SELECT","OPTION","CODE","PRE","SVG","CANVAS"]);
const STORAGE_KEY = "ArtThroughTime.uHangulMode.v3";
const requestedMode = new URLSearchParams(location.search).get("uhangul");
const savedMode = ["original","uhangul","korean"].includes(requestedMode) ? requestedMode : sessionStorage.getItem(STORAGE_KEY);
let currentMode = ["original","uhangul"].includes(savedMode) ? savedMode : "korean";
const byId = new Map();
const normalizeText = text => String(text || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const byText = new Map();
const dynamicRecords = new Map();
const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;
const ONSETS = Array.from("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ");
const TARGET_ONSETS = Object.freeze({
  F: new Set(["ㅍ"]),
  V: new Set(["ㅂ","ㅍ"]),
  Z: new Set(["ㅈ","ㅅ","ㅆ"]),
  TH: new Set(["ㅅ","ㅌ","ㄷ"]),
  X: new Set(["ㅎ"])
});
const PASSTHROUGH_ONSETS = Object.freeze({
  L: new Set(["ㄹ"]),
  C: new Set(["ㅋ","ㄱ","ㅅ"]),
  K: new Set(["ㅋ","ㄱ"]),
  G: new Set(["ㄱ","ㅈ"]),
  P: new Set(["ㅍ","ㅂ"]),
  B: new Set(["ㅂ"]),
  D: new Set(["ㄷ"]),
  T: new Set(["ㅌ","ㄷ"]),
  S: new Set(["ㅅ"]),
  J: new Set(["ㅈ"]),
  M: new Set(["ㅁ"]),
  N: new Set(["ㄴ"]),
  H: new Set(["ㅎ"])
});
const MANUAL_UHANGUL_BY_ORIGINAL = Object.freeze({
  carllarsson: value => value.displayKorean || value.korean || "라르손, 칼",
  rogiervanderweyden: () => "[Vㅏㄴ] 데르 [Vㅔ]이던, 로히어르",
  // Spanish z is shown with the ordinary Korean ㅅ onset, not TH or Z.
  diegovelazquez: value => value.displayKorean || value.korean || "벨라스케스"
});

function tokenizeBlock(block) {
  const out=[];
  for(let i=0;i<block.length;) {
    if(block.startsWith("TH",i)) { out.push("TH"); i+=2; continue; }
    out.push(block[i++]);
  }
  return out;
}

function blockToCodePoint(block) {
  const t=tokenizeBlock(String(block).trim());
  if(t.length < 2 || t.length > 3) throw new Error("bad block ["+block+"]");
  const onset=t[0], vowel=t[1], final=t[2] || "";
  const oi=NEW.indexOf(onset), vi=VOWELS.indexOf(vowel), fi=FINALS.indexOf(final);
  if(oi<0) throw new Error("new consonant must be onset: ["+block+"]");
  if(vi<0) throw new Error("bad vowel: ["+block+"]");
  if(final && NEW.includes(final)) throw new Error("new finals disabled: ["+block+"]");
  if(fi<0) throw new Error("bad final: ["+block+"]");
  return SPUA_BASE + ((oi*21+vi)*28+fi);
}

function encodeNotation(input) {
  return String(input).replace(/\[([^\]]+)\]/g, function(_,block) {
    return String.fromCodePoint(blockToCodePoint(block));
  });
}

let candidates = [];
function rebuildRecordIndex() {
  byId.clear();
  byText.clear();
  for(const rec of RECORDS) {
    try { rec._encoded = encodeNotation(rec.uhangul); }
    catch(e) { console.error("[uHangul] bad record", rec, e); rec._encoded = rec.korean; }
    byId.set(rec.id,rec);
    const aliases = Array.isArray(rec.aliases) ? rec.aliases : [...(Array.isArray(rec.aliases?.ko) ? rec.aliases.ko : []), ...(Array.isArray(rec.aliases?.en) ? rec.aliases.en : [])];
    [rec.original,rec.korean,rec.displayKorean,...aliases].filter(Boolean).forEach(text => {
      const key=normalizeText(text), existing=byText.get(key);
      // A research-only long-name record can share aliases with the canonical
      // Wikidata artist record (for example, Caravaggio). Keep the canonical
      // QID record so document links retain their intended short display name.
      if(!existing || !/^Q\d+$/.test(String(existing.id || '')) || /^Q\d+$/.test(String(rec.id || ''))) byText.set(key,rec);
    });
  }
  candidates = RECORDS.flatMap(r => [{id:r.id,text:r.original}, {id:r.id,text:r.korean}, {id:r.id,text:r.displayKorean}]).filter(x=>x.text).sort((a,b)=>b.text.length-a.text.length);
}
rebuildRecordIndex();

function displayText(rec) {
  if(currentMode==="original") return rec.original;
  if(currentMode==="korean") return rec.korean;
  return rec._encoded || rec.korean;
}

function latinKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase();
}

function targetCues(original) {
  const text=latinKey(original);
  const cues=[];
  for(let i=0;i<text.length;) {
    if(text.startsWith("th",i)) { cues.push("TH"); i+=2; continue; }
    if(text.startsWith("ph",i)) { cues.push("F"); i+=2; continue; }
    const ch=text[i];
    if(ch==="f") cues.push("F");
    else if(ch==="v" || ch==="w") cues.push("V");
    else if(ch==="z") cues.push("Z");
    else if(ch==="x" || (ch==="g" && text[i+1]==="h")) cues.push("X");
    i += ch==="g" && text[i+1]==="h" ? 2 : 1;
  }
  return cues;
}

function consonantEvents(original) {
  const text=latinKey(original);
  const events=[];
  for(let i=0;i<text.length;) {
    if(text.startsWith("th",i)) { events.push({token:"TH",target:true,allowed:TARGET_ONSETS.TH}); i+=2; continue; }
    if(text.startsWith("ph",i)) { events.push({token:"F",target:true,allowed:TARGET_ONSETS.F}); i+=2; continue; }
    if(text.startsWith("gh",i)) { events.push({token:"X",target:true,allowed:TARGET_ONSETS.X}); i+=2; continue; }
    const ch=text[i];
    if(ch==="f") events.push({token:"F",target:true,allowed:TARGET_ONSETS.F});
    else if(ch==="v" || ch==="w") events.push({token:"V",target:true,allowed:TARGET_ONSETS.V});
    else if(ch==="z") events.push({token:"Z",target:true,allowed:TARGET_ONSETS.Z});
    else if(ch==="x") events.push({token:"X",target:true,allowed:TARGET_ONSETS.X});
    else if(ch==="l") events.push({target:false,allowed:PASSTHROUGH_ONSETS.L});
    else if(PASSTHROUGH_ONSETS[ch.toUpperCase()]) events.push({target:false,allowed:PASSTHROUGH_ONSETS[ch.toUpperCase()]});
    i++;
  }
  return events;
}

function hangulParts(char) {
  const code=char.codePointAt(0);
  if(code < HANGUL_BASE || code > HANGUL_END) return null;
  const index=code-HANGUL_BASE;
  const onset=Math.floor(index/(21*28));
  const vowel=Math.floor((index%(21*28))/28);
  const final=index%28;
  return {onset:ONSETS[onset],vowel:VOWELS[vowel],final:FINALS[final]};
}

function notationSyllable(char, token) {
  const parts=hangulParts(char);
  return parts ? `[${token}${parts.vowel}${parts.final}]` : char;
}

function applyCuesToKorean(original, korean) {
  const chars=Array.from(String(korean || ""));
  const used=new Set();
  let cursor=0;
  for(const event of consonantEvents(original)) {
    const allowed=event.allowed;
    if(!allowed) continue;
    for(let index=cursor; index<chars.length; index++) {
      if(used.has(index)) continue;
      const parts=hangulParts(chars[index]);
      if(!parts || !allowed.has(parts.onset)) continue;
      if(event.target) chars[index]=notationSyllable(chars[index],event.token);
      used.add(index);
      cursor=index+1;
      break;
    }
  }
  return chars.join("");
}

function autoNotation(original, korean) {
  const originalWords=latinKey(original).match(/[a-z]+/g) || [];
  const koreanWords=String(korean || "").match(/[가-힣]+/g) || [];
  if(originalWords.length > 1 && originalWords.length === koreanWords.length) {
    let wordIndex=0;
    return String(korean || "").replace(/[가-힣]+/g, word => applyCuesToKorean(originalWords[wordIndex++] || "",word));
  }
  return applyCuesToKorean(original,korean);
}

function displayNotation(canonicalKorean, canonicalNotation, displayKorean) {
  const display=String(displayKorean || canonicalKorean || "");
  const canonical=String(canonicalKorean || "");
  if(!display || display===canonical) return canonicalNotation;
  const sourceWords=canonical.split(/\s+/).filter(Boolean);
  const notationWords=String(canonicalNotation || "").split(/\s+/).filter(Boolean);
  const wordMap=new Map();
  sourceWords.forEach((word,index)=>{
    if(!wordMap.has(word) && notationWords[index]) wordMap.set(word,notationWords[index]);
  });
  return display.replace(/[가-힣]+/g, word => wordMap.get(word) || autoNotation("",word));
}

function generatedRecord(original, korean, displayKorean) {
  const key=[original,korean,displayKorean].map(value=>String(value || "")).join("\u001f");
  if(dynamicRecords.has(key)) return dynamicRecords.get(key);
  const canonical=korean || displayKorean || "";
  const shown=displayKorean || canonical;
  const manual=MANUAL_UHANGUL_BY_ORIGINAL[normalizeText(original)];
  const notation=manual ? manual({original,korean:canonical,displayKorean:shown}) : displayNotation(canonical,autoNotation(original,canonical),shown);
  const rec={
    id:"auto-"+(normalizeText(original) || normalizeText(shown) || "artist"),
    original:original || shown,
    korean:shown,
    uhangul:notation,
    generated:true
  };
  try { rec._encoded=encodeNotation(rec.uhangul); }
  catch(e) { rec._encoded=rec.korean; }
  dynamicRecords.set(key,rec);
  return rec;
}

function recordForElement(el) {
  if(el.dataset.uhOriginal || el.dataset.uhKorean || el.dataset.uhDisplayKorean) {
    const rec = byText.get(normalizeText(el.dataset.uhDisplayKorean)) || byText.get(normalizeText(el.dataset.uhKorean)) || byText.get(normalizeText(el.dataset.uhOriginal));
    if(rec) {
      el.dataset.uhId = rec.id;
      return rec;
    }
    return generatedRecord(el.dataset.uhOriginal || "",el.dataset.uhKorean || "",el.dataset.uhDisplayKorean || el.dataset.uhKorean || "");
  }
  const explicit=byId.get(el.dataset.uhId);
  if(explicit) return explicit;
  const rec = byText.get(normalizeText(el.dataset.uhOriginal)) || byText.get(normalizeText(el.dataset.uhKorean));
  if(rec) el.dataset.uhId = rec.id;
  return rec;
}

function applySpan(span) {
  const rec=recordForElement(span);
  if(!rec) return;
  span.textContent=displayText(rec);
  span.classList.toggle("uhangul-font",currentMode==="uhangul");
  span.title=rec.original+" · "+rec.korean+" · uHangul "+VERSION;
}

function boundSelector() {
  return "[data-uh-id],[data-uh-original],[data-uh-korean],[data-uh-display-korean]";
}

function targetCount() {
  const sidebarTargets = [...document.querySelectorAll(".artist-list .artist-name[data-uh-original],.artist-list .artist-name[data-uh-korean]")];
  if(sidebarTargets.length) return sidebarTargets.filter(recordForElement).length;
  return [...document.querySelectorAll(boundSelector())].filter(recordForElement).length;
}

function propagateModeToArtistLinks() {
  document.querySelectorAll("a.art-atlas-artist-link[href]").forEach(link=>{
    try {
      const target=new URL(link.href,location.href);
      if(!/\/index\.html$/i.test(target.pathname)) return;
      target.searchParams.set("uhangul",currentMode);
      link.href=target.href;
    } catch(e) {
      // Keep links that cannot be parsed unchanged.
    }
  });
}

function applyAll(persist=true) {
  document.querySelectorAll(boundSelector()).forEach(applySpan);
  document.querySelectorAll("[data-uh-mode]").forEach(btn=>{
    const a=btn.dataset.uhMode===currentMode;
    btn.dataset.active=String(a);
    btn.setAttribute("aria-pressed",String(a));
    if(btn.closest("[data-uhangul-document-toolbar]")) {
      btn.style.background=a ? "#425043" : "#fffdf8";
      btn.style.borderColor=a ? "#425043" : "#aebba8";
      btn.style.color=a ? "#fffdf8" : "#425043";
    }
  });
  const count=String(targetCount());
  document.querySelectorAll("[data-uh-count]").forEach(c=>{ c.textContent=count; });
  propagateModeToArtistLinks();
  if(persist) try { sessionStorage.setItem(STORAGE_KEY,currentMode); } catch(e) {}
}

function skip(node) {
  const p=node.parentElement;
  if(!p) return true;
  if(EXCLUDED.has(p.tagName)) return true;
  if(p.closest("[data-uh-ignore],[data-uhangul-ui],[data-uh-id],[data-uh-original],[data-uh-korean],[data-uh-display-korean]")) return true;
  if(p.isContentEditable) return true;
  return false;
}

function bestMatch(text) {
  let best=null;
  for(const c of candidates) {
    const i=text.indexOf(c.text);
    if(i<0) continue;
    if(!best || i<best.index || (i===best.index && c.text.length>best.item.text.length))
      best={index:i,item:c};
  }
  return best;
}

function wrapTextNode(node) {
  if(skip(node)) return false;
  const text=node.nodeValue;
  if(!text || !text.trim()) return false;
  let rest=text, changed=false;
  const frag=document.createDocumentFragment();
  while(rest.length) {
    const hit=bestMatch(rest);
    if(!hit) { frag.append(document.createTextNode(rest)); break; }
    if(hit.index>0) frag.append(document.createTextNode(rest.slice(0,hit.index)));
    const span=document.createElement("span");
    span.dataset.uhId=hit.item.id;
    span.className="uhangul-bound";
    applySpan(span);
    frag.append(span);
    rest=rest.slice(hit.index+hit.item.text.length);
    changed=true;
  }
  if(changed) node.replaceWith(frag);
  return changed;
}

function scan(root) {
  root=root || document.body;
  if(!root) return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; let n;
  while((n=walker.nextNode())) nodes.push(n);
  nodes.forEach(wrapTextNode);
  applyAll();
}

function init() {
  document.querySelectorAll("[data-uhangul-ui]").forEach(el=>el.remove());
  scan(document.body);
  let scheduled=false;
  const obs=new MutationObserver(ms=>{
    if(!ms.some(m=>m.addedNodes.length)) return;
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{ scheduled=false; scan(document.body); });
  });
  obs.observe(document.body,{childList:true,subtree:true});
  document.documentElement.dataset.uhangulLoaded="true";
  console.info("[uHangul v"+VERSION+"] loaded; file protocol compatible; "+RECORDS.length+" records.");
  loadProjectDictionary();
}

function loadProjectDictionary() {
  if(location.protocol === 'file:') return;
  const runtime = document.querySelector('script[data-uhangul-integration][src*="uhangul-runtime"]');
  if(!runtime || !runtime.src) return;
  const url = new URL('../data/person-name-dictionary.json', runtime.src);
  fetch(url.href, {cache:'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(dictionary => {
      const records = Array.isArray(dictionary?.records) ? dictionary.records.filter(record => record?.id && record?.korean && record?.uhangul) : [];
      if(!records.length) return;
      RECORDS = [...RECORDS, ...records];
      rebuildRecordIndex();
      scan(document.body);
    })
    .catch(() => {});
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
else init();

window.addEventListener("uhangulmodechange", event => {
  const mode = event && event.detail && event.detail.mode;
  if(!["original","korean","uhangul"].includes(mode)) return;
  currentMode = mode;
  applyAll();
});

document.addEventListener("click", event => {
  const button=event.target.closest("[data-uh-local-mode]");
  if(!button) return;
  const mode=button.dataset.uhLocalMode;
  if(!["original","korean","uhangul"].includes(mode)) return;
  event.preventDefault();
  currentMode=mode;
  applyAll(false);
  if(window.parent && window.parent !== window) {
    window.parent.postMessage({type:"art-through-time-uhangul-mode",mode},location.origin);
  }
});

window.uHangulV06 = {
  version: VERSION,
  encodeNotation,
  blockToCodePoint,
  get records() { return RECORDS; }
};
})();
