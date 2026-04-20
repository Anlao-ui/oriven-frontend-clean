// ═══ STUDIO ═══════════════════════════════════════════════════

function refreshStudio(){
  renderAssets();
  renderCampaigns();
  updateStudioBCPanel();
  resetCheckPanel();
  var sisc=document.getElementById("siSavedCount");
  if(sisc) sisc.textContent=S.assets.length+" asset"+(S.assets.length===1?"":"s");
}

function switchStudioTab(name){
  // Activate the correct panel
  document.querySelectorAll(".studio-panel").forEach(function(p){p.classList.remove("active");});
  var panelEl=document.getElementById("tab-"+name);
  if(panelEl) panelEl.classList.add("active");

  // Show panel view, hide hub
  var hub=document.getElementById("studioHubView");
  var pv=document.getElementById("studioPanelView");
  var titleEl=document.getElementById("studioPanelTitle");
  if(hub) hub.style.display="none";
  if(pv) pv.classList.remove("hidden");
  var titles={saved:"Saved",brandcore:"Brand Core",check:"Brand Check",campaigns:"Campaigns"};
  if(titleEl) titleEl.textContent=titles[name]||name;

  if(name==="saved") renderAssets();
  if(name==="campaigns") renderCampaigns();
  if(name==="brandcore") refreshBC();
}

function showStudioHub(){
  var hub=document.getElementById("studioHubView");
  var pv=document.getElementById("studioPanelView");
  if(hub) hub.style.display="";
  if(pv) pv.classList.add("hidden");
}

// ═══ SAVED ════════════════════════════════════════════════════

function renderAssets(){
  var grid=document.getElementById("assetGrid");
  var empty=document.getElementById("assetEmpty");
  var badge=document.getElementById("savedCount");
  if(badge) badge.textContent=S.assets.length+" item"+(S.assets.length===1?"":"s");
  var sisc=document.getElementById("siSavedCount");
  if(sisc) sisc.textContent=S.assets.length+" asset"+(S.assets.length===1?"":"s");
  if(!S.assets.length){
    if(grid) grid.innerHTML="";
    if(empty) empty.classList.remove("hidden");
    return;
  }
  if(empty) empty.classList.add("hidden");
  if(!grid) return;
  var html="";
  S.assets.forEach(function(a){
    var isCopy=a.category==="copy";
    var bg=a.brandColor||"#1A4229";
    var thumb=isCopy
      ?'<div style="font-size:11px;font-weight:600;color:var(--c2)">Copy</div>'
      :'<div style="width:48px;height:48px;border-radius:10px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">'+(a.brandName||"A").charAt(0)+"</div>";
    html+='<div class="acard">';
    html+='<div class="ath"'+(isCopy?' style="background:var(--bg3)"':' style="background:linear-gradient(135deg,'+bg+'22,'+bg+'44)"')+">"+thumb+"</div>";
    html+='<div class="ameta"><div class="a-name">'+a.name+'</div><div class="a-info">'+a.category+" · "+(a.createdAt||"")+"</div></div>";
    html+='<div class="aov">';
    html+='<button class="aov-btn" onclick="openRename('+a.id+')" title="Rename"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h10M10.5 2.5a1.5 1.5 0 0 1 2.1 2.1L4.5 12.7l-3 .8.8-3L10.5 2.5z"/></svg></button>';
    html+='<button class="aov-btn" onclick="toast(\'Exported\')" title="Export"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 1v9M4 7l3 3 3-3M2 12h10"/></svg></button>';
    html+='<button class="aov-btn" onclick="addAssetToCampaign('+a.id+')" title="Use in campaign" style="background:rgba(26,66,41,.3)"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h8M7 3v8"/></svg></button>';
    html+='<button class="aov-btn" onclick="delAsset('+a.id+')" title="Delete" style="background:rgba(239,68,68,.3)"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h10M5 4V2h4v2M11 4l-1 8H4L3 4"/></svg></button>';
    html+="</div></div>";
  });
  grid.innerHTML=html;
}

function addAssetToCampaign(id){
  if(!S.campaigns.length){
    toast("Create a campaign first","warn");
    switchStudioTab("campaigns");
    return;
  }
  // Add to most recent campaign
  var camp=S.campaigns[S.campaigns.length-1];
  if(!camp.assets) camp.assets=[];
  if(camp.assets.indexOf(id)<0){
    camp.assets.push(id);
    toast("Added to \""+camp.name+"\"");
  } else {
    toast("Already in \""+camp.name+"\"","warn");
  }
}

function delAsset(id){
  S.assets=S.assets.filter(function(a){return a.id!==id;});
  toast("Asset deleted"); renderAssets();
}
function openRename(id){
  S.renameId=id;
  var a=S.assets.find(function(x){return x.id===id;});
  document.getElementById("renameInp").value=a?a.name:"";
  openModal("modal-rename");
}
function doRename(){
  var n=document.getElementById("renameInp").value.trim();
  if(!n) return;
  var a=S.assets.find(function(x){return x.id===S.renameId;});
  if(a){a.name=n; toast("Renamed");}
  closeModal("modal-rename"); renderAssets();
}

// ═══ BRAND CHECK ══════════════════════════════════════════════

var _checkImageData=null;

function resetCheckPanel(){
  _checkImageData=null;
  var upZone=document.getElementById("upZone");
  var ckPreview=document.getElementById("ckPreview");
  var ckActions=document.getElementById("ckActions");
  var ckLoad=document.getElementById("ckLoad");
  var ckScore=document.getElementById("ckScore");
  var ckOrDivider=document.getElementById("ckOrDivider");
  var ckManualBtn=document.getElementById("ckManualBtn");
  if(upZone){ upZone.style.display="flex"; }
  if(ckPreview){ ckPreview.classList.add("hidden"); }
  if(ckActions){ ckActions.classList.add("hidden"); }
  if(ckLoad){ ckLoad.classList.add("hidden"); }
  if(ckScore){ ckScore.classList.add("hidden"); }
  if(ckOrDivider){ ckOrDivider.style.display=""; }
  if(ckManualBtn){ ckManualBtn.style.display=""; }
}

function handleCheckUpload(input){
  if(!input.files||!input.files[0]) return;
  var file=input.files[0];
  var reader=new FileReader();
  reader.onload=function(e){
    _checkImageData=e.target.result;
    showImagePreview(_checkImageData, file.name);
  };
  reader.readAsDataURL(file);
}

function handleCheckDrop(e){
  e.preventDefault();
  e.stopPropagation();
  var dt=e.dataTransfer;
  if(!dt||!dt.files||!dt.files[0]) return;
  var file=dt.files[0];
  if(!file.type.startsWith("image/")){ toast("Please drop an image file","warn"); return; }
  var reader=new FileReader();
  reader.onload=function(ev){
    _checkImageData=ev.target.result;
    showImagePreview(_checkImageData, file.name);
  };
  reader.readAsDataURL(file);
}

function handleCheckDragOver(e){
  e.preventDefault();
  document.getElementById("upZone").classList.add("drag-over");
}
function handleCheckDragLeave(){
  document.getElementById("upZone").classList.remove("drag-over");
}

function showImagePreview(src, name){
  var upZone=document.getElementById("upZone");
  var ckPreview=document.getElementById("ckPreview");
  var ckActions=document.getElementById("ckActions");
  var ckOrDivider=document.getElementById("ckOrDivider");
  var ckManualBtn=document.getElementById("ckManualBtn");
  if(upZone) upZone.style.display="none";
  if(ckOrDivider) ckOrDivider.style.display="none";
  if(ckManualBtn) ckManualBtn.style.display="none";
  if(ckPreview){
    ckPreview.classList.remove("hidden");
    var img=document.getElementById("ckPreviewImg");
    var fname=document.getElementById("ckFileName");
    if(img) img.src=src;
    if(fname) fname.textContent=name||"Uploaded image";
  }
  if(ckActions) ckActions.classList.remove("hidden");
}


function _runBrandCheckRequest(payload, isManual){
  var ckActions=document.getElementById("ckActions");
  var ckLoad=document.getElementById("ckLoad");
  var ckScore=document.getElementById("ckScore");
  if(ckActions) ckActions.classList.add("hidden");
  if(ckLoad) ckLoad.classList.remove("hidden");
  if(ckScore) ckScore.classList.add("hidden");
  fetch("http://localhost:3000/api/brand-check",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  })
  .then(function(res){return res.json();})
  .then(function(data){
    if(ckLoad) ckLoad.classList.add("hidden");
    if(data.error){
      toast(data.error,"warn");
      if(!isManual && ckActions) ckActions.classList.remove("hidden");
      return;
    }
    S.lastScore=data.score;
    showCheckResult(data);
    if(!isManual && ckActions) ckActions.classList.remove("hidden");
  })
  .catch(function(err){
    if(ckLoad) ckLoad.classList.add("hidden");
    console.error("[BrandCheck] Error:",err);
    toast("Could not connect to the backend. Make sure the server is running on port 3000.","warn");
    if(!isManual && ckActions) ckActions.classList.remove("hidden");
  });
}

function startCheck(){
  if(!_checkImageData){toast("Upload an image first","warn");return;}
  var bc=S.brandCore;
  _runBrandCheckRequest({
    brandName:bc?bc.name:"Unknown Brand",
    colors:bc?bc.colors.map(function(c){return c.hex;}):[],
    fonts:bc?bc.fonts.map(function(f){return f.family;}):[],
    brandPromise:bc?bc.promise:"",
    description:bc?bc.desc:"",
    targetAudience:bc?bc.audience:"",
    styleDirection:bc?bc.styleDirection:"",
    imageData:_checkImageData
  });
}

function startManualCheck(){
  var bc=S.brandCore;
  if(!bc){toast("Set up your Brand Core first","warn");return;}
  console.log("[BrandCheck Manual] Collecting BrandCore data for:", bc.name);
  var payload={
    brandName:bc.name,
    colors:bc.colors?bc.colors.map(function(c){return c.hex+' ('+c.name+')';}):[],
    fonts:bc.fonts?bc.fonts.map(function(f){return f.role+': '+f.family;}):[],
    brandPromise:bc.promise||"",
    description:bc.desc||"",
    targetAudience:bc.audience||bc.aud||"",
    styleDirection:bc.styleDirection||"",
    colorMood:bc.colorMood||"",
    mission:bc.mission||"",
    vision:bc.vision||"",
    personality:bc.personality||"",
    toneOfVoice:bc.tone?bc.tone.join(", "):"",
    values:Array.isArray(bc.wordsUse)?bc.wordsUse.join(", "):"",
    positioning:bc.diff||"",
    logoConcept:bc.logoConcept?bc.logoConcept.description:""
  };
  console.log("[BrandCheck Manual] Sending to /api/brand-check:", payload.brandName);
  _runBrandCheckRequest(payload, true);
}

function resetCheck(){
  resetCheckPanel();
}

function showCheckResult(data){
  var card=document.getElementById("ckScore");
  if(!card) return;
  card.classList.remove("hidden");
  var score=data.score||0;
  var lbl=score>=85?"Excellent":score>=70?"Good — minor issues":"Needs improvement";
  var html='<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">';
  html+='<div><div class="big-s">'+score+'<span>%</span></div><div class="s-desc">'+(data.professionalLevel||lbl)+'</div></div>';
  html+='<span class="badge '+(score>=85?"bg-green":score>=70?"bg-warm":"bg-red")+'">'+lbl+"</span></div>";
  if(data.summary){
    html+='<div style="font-size:13px;color:var(--charcoal);line-height:1.6;margin-bottom:16px;padding:12px;background:var(--bg2);border-radius:var(--rl)">'+data.summary+"</div>";
  }
  html+="<div class='hr'></div><div class='ck-items' style='margin-top:12px'>";
  if(data.strengths&&data.strengths.length){
    html+='<div style="font-size:12px;font-weight:600;color:var(--c2);margin-bottom:6px;margin-top:4px">Strengths</div>';
    data.strengths.forEach(function(s){
      html+='<div class="ck-row"><div class="ck-dot p"></div><div class="ck-txt"><p>'+s+"</p></div></div>";
    });
  }
  if(data.weaknesses&&data.weaknesses.length){
    html+='<div style="font-size:12px;font-weight:600;color:var(--c2);margin-bottom:6px;margin-top:12px">Weaknesses</div>';
    data.weaknesses.forEach(function(w){
      html+='<div class="ck-row"><div class="ck-dot w"></div><div class="ck-txt"><p>'+w+"</p></div></div>";
    });
  }
  if(data.improvements&&data.improvements.length){
    html+='<div style="font-size:12px;font-weight:600;color:var(--c2);margin-bottom:6px;margin-top:12px">Improvements</div>';
    data.improvements.forEach(function(imp){
      html+='<div class="ck-row"><div class="ck-dot f"></div><div class="ck-txt"><p>'+imp+"</p></div></div>";
    });
  }
  if(data.consistencyCheck){
    html+='<div style="font-size:12px;font-weight:600;color:var(--c2);margin-bottom:6px;margin-top:12px">Consistency</div>';
    html+='<div class="ck-row"><div class="ck-txt"><p>'+data.consistencyCheck+"</p></div></div>";
  }
  html+="</div>";
  card.innerHTML=html;
}

// ═══ CAMPAIGNS ════════════════════════════════════════════════

function renderCampaigns(){
  var list=document.getElementById("campList");
  var empty=document.getElementById("campEmpty");
  // Close any open detail view first
  var detail=document.getElementById("campDetail");
  if(detail) detail.classList.add("hidden");
  var main=document.getElementById("campMain");
  if(main) main.classList.remove("hidden");

  if(!S.campaigns.length){
    if(list) list.innerHTML="";
    if(empty) empty.classList.remove("hidden");
    return;
  }
  if(empty) empty.classList.add("hidden");
  if(!list) return;
  var html="";
  S.campaigns.forEach(function(camp){
    var assetCount=(camp.assets||[]).length;
    var prog=camp.prog||10;
    html+='<div class="camp-card" onclick="openCampaignDetail('+camp.id+')">';
    html+='<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">';
    html+='<div class="camp-name">'+camp.name+"</div>";
    html+='<span class="badge bg-grey" style="font-size:10px">'+assetCount+" asset"+(assetCount===1?"":"s")+"</span></div>";
    html+='<div class="camp-meta">'+camp.obj+" · "+camp.aud+"</div>";
    html+='<div class="camp-pb"><div class="camp-pf" style="width:'+prog+'%"></div></div></div>';
  });
  list.innerHTML=html;
}

function createCampaign(){
  var name=document.getElementById("ncName").value.trim();
  if(!name){toast("Enter a campaign name","warn");return;}
  // Collect selected asset IDs from the modal picker
  var selectedAssets=[];
  document.querySelectorAll(".nc-asset-pick.selected").forEach(function(el){
    selectedAssets.push(parseInt(el.getAttribute("data-id")));
  });
  var camp={
    id:Date.now(),
    name:name,
    obj:document.getElementById("ncObj").value,
    aud:document.getElementById("ncAud").value,
    notes:document.getElementById("ncNotes").value,
    assets:selectedAssets,
    prog:selectedAssets.length?40:10,
    createdAt:new Date().toLocaleDateString()
  };
  S.campaigns.push(camp);
  closeModal("modal-newcamp");
  document.getElementById("ncName").value="";
  document.getElementById("ncNotes").value="";
  toast("Campaign created");
  renderCampaigns();
}

function openCampaignDetail(id){
  var camp=S.campaigns.find(function(c){return c.id===id;});
  if(!camp) return;
  S._activeCampId=id;
  var main=document.getElementById("campMain");
  var detail=document.getElementById("campDetail");
  if(main) main.classList.add("hidden");
  if(detail){
    detail.classList.remove("hidden");
    renderCampaignDetail(camp);
  }
}

function renderCampaignDetail(camp){
  var el=document.getElementById("campDetail");
  if(!el) return;
  var linkedAssets=S.assets.filter(function(a){return (camp.assets||[]).indexOf(a.id)>=0;});

  var html='<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">';
  html+='<button class="btn btn-g btn-sm" onclick="closeCampaignDetail()">← Back</button>';
  html+='<div style="font-size:16px;font-weight:700;color:var(--charcoal)">'+camp.name+"</div></div>";

  // Info grid
  html+='<div class="camp-detail-grid">';
  html+='<div class="camp-detail-card"><div class="camp-detail-label">Objective</div><div class="camp-detail-val">'+camp.obj+"</div></div>";
  html+='<div class="camp-detail-card"><div class="camp-detail-label">Audience</div><div class="camp-detail-val">'+(camp.aud||"—")+"</div></div>";
  if(camp.notes) html+='<div class="camp-detail-card" style="grid-column:span 2"><div class="camp-detail-label">Notes</div><div class="camp-detail-val">'+camp.notes+"</div></div>";
  html+="</div>";

  // Linked assets
  html+='<div style="margin:20px 0 10px;font-size:13px;font-weight:600;color:var(--charcoal)">Linked Assets <span style="color:var(--muted);font-weight:400;font-size:12px">('+linkedAssets.length+")</span></div>";
  if(linkedAssets.length){
    html+='<div class="camp-asset-row">';
    linkedAssets.forEach(function(a){
      var bg=a.brandColor||"#1A4229";
      html+='<div class="camp-asset-thumb" style="background:linear-gradient(135deg,'+bg+'33,'+bg+'66)">';
      html+='<span style="font-size:16px;font-weight:700;color:'+bg+'">'+( a.brandName||"A").charAt(0)+"</span></div>";
    });
    html+="</div>";
  } else {
    html+='<div style="font-size:12px;color:var(--muted);margin-bottom:16px">No assets linked yet.</div>';
  }

  // Preview formats
  html+='<div style="margin:20px 0 12px;font-size:13px;font-weight:600;color:var(--charcoal)">Preview Formats</div>';
  html+='<div class="camp-preview-grid">';
  var bc=S.brandCore;
  var col=bc?bc.colors[0].hex:"#1A4229";
  var bn=bc?bc.name:"ORIVEN";
  [
    {label:"Square Post",w:1,h:1,tag:"1080 × 1080"},
    {label:"Landscape Banner",w:1.78,h:1,tag:"1920 × 1080"},
    {label:"Portrait",w:0.8,h:1,tag:"1080 × 1350"},
    {label:"Story",w:0.56,h:1,tag:"1080 × 1920"}
  ].forEach(function(fmt){
    var pw=140; var ph=Math.round(pw/fmt.w);
    if(ph>180) ph=180;
    html+='<div class="camp-preview-item">';
    html+='<div class="camp-preview-frame" style="width:'+pw+'px;height:'+ph+'px;background:linear-gradient(135deg,'+col+' 0%,#0a1f12 100%);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer" onclick="generatePreview(\''+fmt.label+'\')">';
    html+='<div style="font-size:9px;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase">'+bn+"</div>";
    html+='<div style="font-size:'+(pw>100?12:10)+'px;font-weight:700;color:#fff;text-align:center;padding:0 8px;line-height:1.2">'+camp.name+"</div>";
    html+='<div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:2px">'+fmt.tag+"</div></div>";
    html+='<div style="font-size:11px;color:var(--c2);font-weight:500;margin-top:6px;text-align:center">'+fmt.label+"</div></div>";
  });
  html+="</div>";

  // Actions
  html+='<div class="camp-detail-actions">';
  html+='<button class="btn btn-g" onclick="editCampaign('+camp.id+')">Edit Campaign</button>';
  html+='<button class="btn btn-g" onclick="changeCampaignImages('+camp.id+')">Change Images</button>';
  html+='<button class="btn btn-p" onclick="generatePreview(\'Poster\')">Generate Poster Preview</button>';
  html+="</div>";

  el.innerHTML=html;
}

function closeCampaignDetail(){
  var detail=document.getElementById("campDetail");
  var main=document.getElementById("campMain");
  if(detail) detail.classList.add("hidden");
  if(main) main.classList.remove("hidden");
  S._activeCampId=null;
}

function generatePreview(fmt){
  toast("Generating "+fmt+" preview...");
  setTimeout(function(){toast(fmt+" preview ready!");},1400);
}

function editCampaign(id){
  var camp=S.campaigns.find(function(c){return c.id===id;});
  if(!camp) return;
  // Pre-fill modal
  document.getElementById("ncName").value=camp.name;
  document.getElementById("ncObj").value=camp.obj||"Product Launch";
  document.getElementById("ncAud").value=camp.aud||"";
  document.getElementById("ncNotes").value=camp.notes||"";
  S._editCampId=id;
  openCampaignModal();
}

function changeCampaignImages(id){
  S._editCampId=id;
  openCampaignModal();
  toast("Select new images from your saved assets");
}

function openCampaignModal(){
  // Populate asset picker
  renderAssetPicker();
  openModal("modal-newcamp");
}

function renderAssetPicker(){
  var picker=document.getElementById("ncAssetPicker");
  if(!picker) return;
  if(!S.assets.length){
    picker.innerHTML='<div style="font-size:12px;color:var(--muted)">No saved assets yet. Generate content in AI Chat first.</div>';
    return;
  }
  var currentCampAssets=[];
  if(S._editCampId){
    var ec=S.campaigns.find(function(c){return c.id===S._editCampId;});
    if(ec) currentCampAssets=ec.assets||[];
  }
  var html="";
  S.assets.forEach(function(a){
    var sel=currentCampAssets.indexOf(a.id)>=0;
    var bg=a.brandColor||"#1A4229";
    html+='<div class="nc-asset-pick'+(sel?" selected":"")+'" data-id="'+a.id+'" onclick="toggleAssetPick(this)">';
    html+='<div style="width:32px;height:32px;border-radius:7px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0">'+(a.brandName||"A").charAt(0)+"</div>";
    html+='<div style="overflow:hidden"><div style="font-size:12px;font-weight:500;color:var(--charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+a.name+"</div>";
    html+='<div style="font-size:11px;color:var(--muted)">'+a.category+"</div></div>";
    if(sel) html+='<div style="margin-left:auto;color:var(--gm)"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M2 7l4 4 6-7"/></svg></div>';
    html+="</div>";
  });
  picker.innerHTML=html;
}

function toggleAssetPick(el){
  el.classList.toggle("selected");
  // Show/hide check icon
  var check=el.querySelector("svg");
  if(el.classList.contains("selected")){
    if(!check){
      el.insertAdjacentHTML("beforeend",'<div style="margin-left:auto;color:var(--gm)"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M2 7l4 4 6-7"/></svg></div>');
    }
  } else {
    var chkDiv=el.querySelector('[style*="margin-left:auto"]');
    if(chkDiv) chkDiv.remove();
  }
}



// ═══════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════
var TEMPLATES=[
  {id:1,name:"Instagram Launch Post",type:"Instagram 1080x1080",cat:"social",bg:"linear-gradient(135deg,#1A4229,#0A1F12)"},
  {id:2,name:"Story Announcement",type:"Instagram Story",cat:"social",bg:"linear-gradient(160deg,#265E38,#1A4229)"},
  {id:3,name:"Website Hero",type:"Web Section",cat:"web",bg:"var(--bg3)"},
  {id:4,name:"Testimonial Graphic",type:"Social Various",cat:"social",bg:"var(--charcoal)"},
  {id:5,name:"Founder Quote",type:"LinkedIn 1200x627",cat:"social",bg:"#2A1F14"},
  {id:6,name:"Product Reveal",type:"Instagram 1080x1080",cat:"social",bg:"linear-gradient(135deg,#0A2015,#1A4229)"},
  {id:7,name:"Ad Banner",type:"Display 728x90",cat:"ads",bg:"var(--green)"},
  {id:8,name:"Email Header",type:"Email 600x200",cat:"email",bg:"var(--bg2)"},
  {id:9,name:"Product Description",type:"Ecommerce Copy",cat:"copy",bg:"var(--sf2)"},
  {id:10,name:"Headline Variants",type:"Multi-use Copy",cat:"copy",bg:"var(--gpale)"},
  {id:11,name:"CTA Bundle",type:"Web and Email Copy",cat:"copy",bg:"#EEF7EE"},
  {id:12,name:"Carousel Series",type:"Instagram Carousel",cat:"social",bg:"linear-gradient(135deg,#1A4229,#3A7A4A)"}
];
var tplFilter="all";

// ═══ INSPIRATION ══════════════════════════════════════════════

var INSP_CARDS=[
  {id:1,cat:"social",title:"Minimal Product Launch",desc:"Clean whitespace, centered type, one hero visual.",type:"image",prompt:"Create a minimal Instagram post for a premium product launch. Clean layout, strong typography.",tall:false,wide:false,style:"dark",bg:"#1A4229",bg2:"#0d2a1a",lbl:"LAUNCH",hl:"Something beautiful arrives.",sub:"01.03.2025"},
  {id:2,cat:"social",title:"Bold Brand Story",desc:"High-contrast storytelling for Instagram feed.",type:"image",prompt:"Create a bold high-contrast Instagram post about our brand journey and founding vision.",tall:true,wide:false,style:"dark",bg:"#18181A",bg2:"#2C2C2E",lbl:"STORY",hl:"This is how we build.",sub:"Chapter 1"},
  {id:3,cat:"social",title:"Feature Spotlight",desc:"Highlight a single product feature in a carousel-ready frame.",type:"image",prompt:"Create an Instagram carousel post spotlighting a key product feature with clean visual design.",tall:false,wide:true,style:"dark",bg:"#265E38",bg2:"#1A4229",lbl:"NEW",hl:"Feature Release",sub:"Swipe to explore"},
  {id:4,cat:"social",title:"Testimonial Quote Card",desc:"Premium quote layout for social proof content.",type:"image",prompt:"Create a premium testimonial quote card for social media with strong typography and brand feel.",tall:false,wide:false,style:"light",bg:"#FAF8F5",bg2:"#EEE9E1",lbl:"TESTIMONIAL",hl:"The most consistent brand system.",sub:"Sarah K., Head of Brand"},
  {id:5,cat:"ads",title:"Bold Product Ad",desc:"Strong headline, clear CTA, brand-forward layout.",type:"ads",prompt:"Create a bold display ad creative for a product launch with a strong headline and clear CTA.",tall:false,wide:false,style:"dark",bg:"#1A1A2E",bg2:"#16213E",lbl:"AD",hl:"Stop guessing. Start building.",cta:"Try free"},
  {id:6,cat:"ads",title:"Retargeting Hook Ad",desc:"Conversational tone, problem-aware copy.",type:"ads",prompt:"Create a retargeting ad with a conversational hook that addresses a brand consistency problem.",tall:false,wide:true,style:"dark",bg:"#2D1B69",bg2:"#1A0A3D",lbl:"RETARGET",hl:"Still struggling with consistency?",sub:"You are not alone."},
  {id:7,cat:"ads",title:"Social Proof Ad",desc:"Metric-driven ad with strong credibility signals.",type:"ads",prompt:"Create a social proof ad featuring brand metrics and a clear value proposition.",tall:true,wide:false,style:"light",bg:"#F0F5F1",bg2:"#E5EDE7",lbl:"SOCIAL PROOF",metric:"500+",metricSub:"brands trust us",cta:"Start free"},
  {id:8,cat:"poster",title:"Minimal Launch Poster",desc:"Premium typography, generous whitespace, editorial feel.",type:"image",prompt:"Create a minimal premium brand poster for a product launch with editorial typography.",tall:true,wide:false,style:"light",bg:"#F6F3EE",bg2:"#EEE9E1",lbl:"BRAND",hl:"The Art of Consistency.",sub:"2025"},
  {id:9,cat:"poster",title:"Dark Premium Poster",desc:"Rich dark background, gold and accent details.",type:"image",prompt:"Create a dark premium brand poster with strong visual contrast and a luxury editorial feel.",tall:false,wide:false,style:"dark",bg:"#0A0A0A",bg2:"#1A1208",lbl:"PREMIUM",hl:"Quality is not an afterthought.",sub:"Limited Collection"},
  {id:10,cat:"poster",title:"Event Announcement",desc:"Date-forward layout for launches and events.",type:"image",prompt:"Create a premium event announcement poster with strong date typography and brand identity.",tall:false,wide:true,style:"dark",bg:"#1A4229",bg2:"#0d2a1a",bigNum:"03",bigSub:"MARCH",hl:"Brand Summit",sub:"Annual Brand Strategy Event"},
  {id:11,cat:"campaign",title:"Product Launch Series",desc:"Three-phase campaign: teaser, reveal, conversion.",type:"campaign",prompt:"Create a 3-phase product launch campaign with teaser, reveal, and conversion content.",tall:false,wide:true,style:"dark",bg:"#1A4229",bg2:"#265E38",lbl:"PHASE 1",hl:"Launch Campaign",sub:"Teaser - Reveal - Convert"},
  {id:12,cat:"campaign",title:"Brand Awareness Push",desc:"Educational content series to build brand recognition.",type:"campaign",prompt:"Create a brand awareness campaign with educational posts and consistent visual language.",tall:false,wide:false,style:"dark",bg:"#2D1B69",bg2:"#1A0A3D",lbl:"AWARENESS",hl:"Make them remember you.",sub:"5-post LinkedIn series"},
  {id:13,cat:"campaign",title:"Seasonal Drop",desc:"Limited-time urgency campaign for seasonal moments.",type:"campaign",prompt:"Create a seasonal brand campaign for a limited product drop with urgency and premium visual language.",tall:true,wide:false,style:"dark",bg:"#7F1D1D",bg2:"#991B1B",lbl:"LIMITED",hl:"Season Drop.",sub:"Only this week"},
  {id:14,cat:"identity",title:"Monochrome Color System",desc:"Minimal tonal palette built for clarity and premium feel.",type:"image",prompt:"Create a minimal brand color system with tonal variations and usage guidelines.",tall:false,wide:false,style:"light",bg:"#F6F3EE",bg2:"#EEE9E1",palette:true},
  {id:15,cat:"identity",title:"Serif Typographic Brand",desc:"Editorial serif heading style with clean body pairing.",type:"image",prompt:"Create a brand typography system with an editorial serif display font and clean body pairing.",tall:false,wide:true,style:"dark",bg:"#18181A",bg2:"#2C2C2E",typo:true},
  {id:16,cat:"identity",title:"Bold Logo Direction",desc:"Symbol-driven logo mark with strong geometric form.",type:"image",prompt:"Create a bold logo direction for a brand with a geometric symbol mark and strong visual identity.",tall:true,wide:false,style:"dark",bg:"#1A4229",bg2:"#0d2a1a",logomark:true},
  {id:17,cat:"content",title:"Behind the Brand Story",desc:"Authentic founder or team narrative content.",type:"text",prompt:"Write a behind-the-brand story post about the founding vision and what drives the team.",tall:false,wide:false,style:"light",bg:"#FFF8E1",bg2:"#FFF3CD",lbl:"BEHIND THE BRAND",hl:"Why we built this.",sub:"Read the story"},
  {id:18,cat:"content",title:"Value Proposition Carousel",desc:"5-slide LinkedIn carousel breaking down the core value.",type:"text",prompt:"Create a 5-slide LinkedIn carousel post breaking down our core brand value proposition.",tall:false,wide:true,style:"light",bg:"#EDF2FF",bg2:"#E0EAFF",lbl:"CAROUSEL",hl:"5 reasons brands trust us.",sub:"Swipe through"},
  {id:19,cat:"content",title:"Visual Abstract Concept",desc:"Abstract, mood-driven visual for brand storytelling.",type:"image",prompt:"Create an abstract visual concept for brand storytelling that communicates clarity and ambition.",tall:true,wide:false,style:"light",bg:"#F3E8FF",bg2:"#E9D5FF",lbl:"ABSTRACT",hl:"Visual Direction",sub:"Brand storytelling concept"},
  {id:20,cat:"content",title:"Founder Thought Leadership",desc:"Personal brand post positioning the founder as a leader.",type:"text",prompt:"Write a thought leadership post from the founder perspective on brand strategy and consistency.",tall:false,wide:false,style:"light",bg:"#F0EFFF",bg2:"#E5E2FF",lbl:"THOUGHT LEADERSHIP",hl:"Why your brand is your moat.",sub:"LinkedIn Post"}
];

function renderCardPreview(card,bc){
  var col=(bc&&bc.colors&&bc.colors[0])?bc.colors[0].hex:"#1A4229";
  var isLight=card.style==="light";
  var textPrimary=isLight?"#18181A":"#fff";
  var textMuted=isLight?"rgba(24,24,26,.45)":"rgba(255,255,255,.45)";
  var textSub=isLight?"rgba(24,24,26,.55)":"rgba(255,255,255,.55)";
  var parts=[];

  if(card.palette){
    var shades=["#1A4229","#265E38","#4A9060","#8FC9A0","#D4EDD9"];
    if(bc&&bc.colors) shades=bc.colors.slice(0,5).map(function(x){return x.hex;});
    parts.push('<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">');
    shades.slice(0,5).forEach(function(h){parts.push('<div style="width:30px;height:52px;border-radius:8px;background:'+h+'"></div>');});
    parts.push('</div>');
    parts.push('<div style="font-size:10px;color:'+textMuted+';text-align:center">Color System</div>');
    return parts.join("");
  }
  if(card.typo){
    return '<div style="font-family:\'Instrument Serif\',serif;font-size:52px;color:#fff;line-height:1;text-align:center">Aa</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-top:6px">Instrument Serif</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.32);text-align:center;margin-top:3px">Body: Geist Regular</div>';
  }
  if(card.logomark){
    var initial=(bc&&bc.name)?bc.name.charAt(0).toUpperCase():"O";
    return '<div style="width:76px;height:76px;border-radius:18px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-family:\'Instrument Serif\',serif;font-size:44px;color:#fff">'+initial+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.45);text-align:center">Primary Mark</div>';
  }
  if(card.metric){
    return '<div style="font-family:\'Instrument Serif\',serif;font-size:44px;color:'+col+';line-height:1;text-align:center">'+card.metric+'</div>'
      +'<div style="font-size:12px;color:'+textSub+';text-align:center;margin-top:4px">'+card.metricSub+'</div>'
      +(card.cta?'<div style="display:inline-block;background:'+col+';color:#fff;border-radius:8px;padding:5px 14px;font-size:11px;font-weight:600;margin-top:10px">'+card.cta+'</div>':"");
  }
  if(card.bigNum){
    return '<div style="font-family:\'Instrument Serif\',serif;font-size:52px;color:rgba(255,255,255,.12);line-height:1;text-align:center">'+card.bigNum+'</div>'
      +'<div style="font-size:10px;color:rgba(255,255,255,.5);text-align:center;letter-spacing:1px">'+card.bigSub+'</div>'
      +'<div style="font-family:\'Instrument Serif\',serif;font-size:20px;color:#fff;text-align:center;margin-top:6px">'+card.hl+'</div>'
      +(card.sub?'<div style="font-size:10px;color:rgba(255,255,255,.42);text-align:center;margin-top:4px">'+card.sub+'</div>':"");
  }
  // Standard layout
  if(card.lbl) parts.push('<div style="font-size:9px;font-weight:700;letter-spacing:1.2px;color:'+textMuted+';text-transform:uppercase;text-align:center">'+card.lbl+'</div>');
  if(card.hl) parts.push('<div style="font-family:\'Instrument Serif\',serif;font-size:20px;font-weight:700;color:'+textPrimary+';text-align:center;line-height:1.2;margin-top:6px">'+card.hl+'</div>');
  if(card.sub) parts.push('<div style="font-size:11px;color:'+textSub+';text-align:center;margin-top:6px">'+card.sub+'</div>');
  if(card.cta) parts.push('<div style="display:inline-block;background:rgba(255,255,255,.2);color:'+textPrimary+';border-radius:8px;padding:5px 14px;font-size:11px;font-weight:600;margin-top:8px">'+card.cta+'</div>');
  return parts.join("");
}

var _inspFilter="all";

function renderInspiration(){
  var grid=document.getElementById("inspGrid");
  if(!grid) return;
  var cards=_inspFilter==="all"?INSP_CARDS:INSP_CARDS.filter(function(x){return x.cat===_inspFilter;});
  var bc=S.brandCore||null;
  var html="";
  cards.forEach(function(card){
    var cls="icard"+(card.tall?" tall":"")+(card.wide?" wide":"");
    var bg="linear-gradient(150deg,"+card.bg+" 0%,"+card.bg2+" 100%)";
    var preview=renderCardPreview(card,bc);
    html+='<div class="'+cls+'" onclick="useInspiration('+card.id+')">';
    html+='<div class="icard-visual"><div class="icard-visual-inner" style="background:'+bg+';flex-direction:column;gap:0;align-items:center;justify-content:center">'+preview+'</div>';
    html+='<div class="icard-overlay"><div class="icard-overlay-btn"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v6M5 8h6"/></svg>Create this</div></div></div>';
    html+='<div class="icard-meta"><div class="icard-cat">'+catLabel(card.cat)+'</div><div class="icard-title">'+card.title+'</div><div class="icard-desc">'+card.desc+'</div></div></div>';
  });
  grid.innerHTML=html;
}

function catLabel(cat){
  var m={social:"Social Media",ads:"Ad Creatives",poster:"Poster",campaign:"Campaign",identity:"Brand Identity",content:"Content Ideas"};
  return m[cat]||cat;
}

function useInspiration(id){
  var card=INSP_CARDS.find(function(x){return x.id===id;});
  if(!card) return;
  var typeMap={image:"image",text:"text",ads:"ads",campaign:"campaign"};
  var outTypeMap={image:"poster",text:"copy",ads:"ad_copy",campaign:"campaign"};
  var createType=typeMap[card.type]||"image";
  var outType=outTypeMap[card.type]||"poster";
  S._cwsHistory=[];
  openCreateWorkspace(createType,outType);
  setTimeout(function(){
    var inp=document.getElementById("cwsInput");
    if(inp){inp.value=card.prompt;inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,120)+"px";}
    var ctx=document.getElementById("cwsContext");
    if(ctx) ctx.textContent="From: "+card.title;
    toast("Ready — "+card.title);
  },80);
}

// Filter button clicks (event delegation)
document.addEventListener("click",function(e){
  var btn=e.target.closest(".if-btn");
  if(!btn) return;
  document.querySelectorAll(".if-btn").forEach(function(b){b.classList.remove("active");});
  btn.classList.add("active");
  _inspFilter=btn.getAttribute("data-cat");
  renderInspiration();
});


// ═══════════════════════════════════════════════════════════════

// useTpl: called from modal-tpl "Use Template" button
function useTpl(){
  // Find template by currentTplId and open in Create workspace
  var t=TEMPLATES.find(function(x){return x.id===S.currentTplId;});
  if(!t) return;
  closeModal("modal-tpl");
  openCreateWorkspace("image","poster");
  setTimeout(function(){
    var inp=document.getElementById("cwsInput");
    if(inp) inp.value="Create a "+t.name;
    toast(t.name+" loaded in Create");
  },100);
}
