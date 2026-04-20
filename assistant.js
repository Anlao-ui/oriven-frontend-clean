// ═══ FLOATING BRAND ASSISTANT ═════════════════════════════════
var FAB={open:false,msgs:[]};

var FAB_GREETINGS=[
  "How can I support your brand today?",
  "What are your plans for your brand today?",
  "How is your brand performing today?",
  "Ready to build something great for your brand.",
  "What brand challenge can I help you solve today?"
];

function openFAB(){
  // Open the fullscreen Brand Assistant workspace (same as Create workspace)
  S._cwsHistory=[];
  openCreateWorkspace("assistant","copy");
}
function minimizeFAB(){
  // Already in fullscreen — just navigate back
  navigate("create");
}
function expandFAB(){
  openFAB();
}
function openFABPanel(){
  // Open the small corner panel (used by the widget header expand)
  FAB.open=true;
  var panel=document.getElementById("fabPanel");
  var mini=document.getElementById("fabMini");
  if(panel) panel.classList.remove("hidden");
  if(mini) mini.style.display="none";
  if(FAB.msgs.length===0) addFABWelcome();
  var fi=document.getElementById("fabInput");
  if(fi) fi.focus();
}
function closeFABPanel(){
  FAB.open=false;
  var panel=document.getElementById("fabPanel");
  var mini=document.getElementById("fabMini");
  if(panel) panel.classList.add("hidden");
  if(mini) mini.style.display="flex";
}
function addFABWelcome(){
  var greeting=FAB_GREETINGS[Math.floor(Math.random()*FAB_GREETINGS.length)];
  var bc=S.brandCore;
  var tag=document.getElementById("fabBCTag");
  if(tag) tag.textContent=bc?bc.name+" Brand Core active":"No Brand Core — set one up";
  appendFABMsg("ai",greeting);
}
function appendFABMsg(role,text){
  FAB.msgs.push({role:role,text:text});
  var msgs=document.getElementById("fabMsgs");
  if(!msgs) return;
  var row=document.createElement("div");
  row.className="fab-msg-row"+(role==="user"?" user":"");
  var bubble=document.createElement("div");
  bubble.className="fab-msg-bubble";
  bubble.textContent=text;
  if(role==="ai"){
    var av=document.createElement("div");
    av.className="fab-msg-avatar";
    av.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.6"><path d="M8 1L10 6H15L11 9L12.5 14L8 11L3.5 14L5 9L1 6H6Z"/></svg>';
    row.appendChild(av);
  }
  row.appendChild(bubble);
  msgs.appendChild(row);
  msgs.scrollTop=msgs.scrollHeight;
}
function showFABTyping(){
  var msgs=document.getElementById("fabMsgs");
  if(!msgs) return null;
  var row=document.createElement("div");
  row.className="fab-msg-row";
  row.id="fab-typing-"+Date.now();
  var av=document.createElement("div");
  av.className="fab-msg-avatar";
  av.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.6"><path d="M8 1L10 6H15L11 9L12.5 14L8 11L3.5 14L5 9L1 6H6Z"/></svg>';
  var bubble=document.createElement("div");
  bubble.className="fab-msg-bubble";
  bubble.innerHTML='<div class="fab-typing"><span></span><span></span><span></span></div>';
  row.appendChild(av);
  row.appendChild(bubble);
  msgs.appendChild(row);
  msgs.scrollTop=msgs.scrollHeight;
  return row.id;
}
function sendFAB(){
  var input=document.getElementById("fabInput");
  if(!input) return;
  var text=input.value.trim();
  if(!text) return;
  input.value="";
  appendFABMsg("user",text);
  var tid=showFABTyping();
  setTimeout(function(){
    if(tid){var el=document.getElementById(tid);if(el)el.remove();}
    var response=generateFABResponse(text);
    appendFABMsg("ai",response);
  },900+Math.floor(Math.random()*700));
}
function generateFABResponse(prompt){
  var p=prompt.toLowerCase();
  var bc=S.brandCore;
  var bn=bc?bc.name:"your brand";
  if(/(color|colour|palette)/.test(p))
    return bc?"Your Brand Core uses "+bc.colors.slice(0,2).map(function(c){return c.name+"("+c.hex+")";}).join(" and ")+". Consistent use of these builds recognition.":"Set up your Brand Core first to define your color palette.";
  if(/(tone|voice|writing)/.test(p))
    return bc?"Your brand tone is "+bc.tone.join(", ")+". Avoid words like "+bc.wordsAvoid.slice(0,2).join(", ")+".":"Your tone of voice is defined in your Brand Core. Set it up for tailored guidance.";
  if(/(slogan|tagline|promise)/.test(p))
    return bc&&bc.promise?'"'+bc.promise+'" — keep this at the heart of all content.':'Set your brand promise in Brand Core to get tailored tagline guidance.';
  if(/(headline|title)/.test(p))
    return "Strong headlines for "+bn+": focus on clarity, benefit, and brand confidence. Avoid jargon.";
  if(/(social|instagram|post)/.test(p))
    return "For social posts: open with a strong hook, deliver value in 2-3 lines, close with a clear CTA. Always stay in "+bn+"'s voice.";
  if(/(campaign)/.test(p))
    return "A strong campaign for "+bn+" needs a single clear objective, a memorable theme, and consistent visuals across all formats.";
  if(/(help|start|begin|what)/.test(p))
    return "I can help you with brand voice, content strategy, color and typography questions, or campaign direction. What would you like to explore?";
  return "For "+bn+": stay consistent, lead with your brand promise, and let your brand identity guide every creative decision.";
}
// Enter key for FAB input
document.addEventListener("DOMContentLoaded",function(){
  var fi=document.getElementById("fabInput");
  if(fi) fi.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();sendFAB();}});
});
