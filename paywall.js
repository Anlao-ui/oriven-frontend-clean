// ════════════════════════════════════════════════════════════════
// SOFT PAYWALL — upgrade prompt shown after last free generation
// ════════════════════════════════════════════════════════════════

var _softPaywallShown = false;

function showSoftPaywall(){
  if(_softPaywallShown) return;
  _softPaywallShown = true;

  _spBuildProgress();

  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;

  modal.style.display = "flex";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      modal.classList.add("sp-visible");
    });
  });
}

function closeSoftPaywall(){
  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;
  modal.classList.remove("sp-visible");
  setTimeout(function(){
    modal.style.display = "none";
    _showUpgradeBar();
  }, 270);
}

function closeSoftPaywallNoBar(){
  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;
  modal.classList.remove("sp-visible");
  setTimeout(function(){ modal.style.display = "none"; }, 270);
}

function _showUpgradeBar(){
  var bar = document.getElementById("upgradeBar");
  if(!bar) return;
  bar.style.display = "flex";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      bar.classList.add("upgrade-bar-visible");
    });
  });
}

function hideUpgradeBar(){
  var bar = document.getElementById("upgradeBar");
  if(!bar) return;
  bar.classList.remove("upgrade-bar-visible");
  setTimeout(function(){ bar.style.display = "none"; }, 270);
}

function _spBuildProgress(){
  var items = [
    { label: "Brand identity",     done: true  },
    { label: "Content generation", done: true  },
    { label: "Campaign creation",  done: false },
    { label: "Full brand system",  done: false }
  ];

  var done = items.filter(function(i){ return i.done; }).length;
  var pct  = 60; // fixed "you're partway there" feel

  var pctEl  = document.getElementById("spProgressPct");
  var fillEl = document.getElementById("spProgressFill");
  var listEl = document.getElementById("spProgressList");

  if(pctEl)  pctEl.textContent = pct + "%";
  if(fillEl) setTimeout(function(){ fillEl.style.width = pct + "%"; }, 80);
  if(listEl){
    listEl.innerHTML = items.map(function(item){
      var ico = item.done
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="#B7FF2A" stroke-width="2.2"><polyline points="2,8.5 6,12.5 14,4"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"><rect x="4.5" y="7" width="7" height="6.5" rx="1.2"/><path d="M6 7V5.5a2 2 0 0 1 4 0V7" stroke-linecap="round"/></svg>';
      return '<div class="sp-progress-item ' + (item.done ? 'sp-done' : 'sp-locked') + '">'
        + '<span class="sp-item-icon">' + ico + '</span>'
        + '<span class="sp-item-label">' + item.label + '</span>'
        + '</div>';
    }).join("");
  }
}
