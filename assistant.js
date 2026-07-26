// ═══ Brand assistant entry points (opens the Oriven full-screen workspace) ═══
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
