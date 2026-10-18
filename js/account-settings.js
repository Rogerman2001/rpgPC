// Presentation only: the existing export/logout buttons retain their original handlers.
const dialog=document.getElementById('account-settings');
const trigger=document.getElementById('open-account-settings');
const name=document.getElementById('account-name');
const status=document.getElementById('cloud-status');
function reflectAccount(){
 document.getElementById('settings-player-name').textContent=name.textContent;
 document.getElementById('settings-cloud-status').textContent=status.textContent;
}
new MutationObserver(reflectAccount).observe(name,{childList:true,characterData:true,subtree:true});
new MutationObserver(reflectAccount).observe(status,{childList:true,characterData:true,subtree:true});
trigger.addEventListener('click',()=>{reflectAccount();if(!dialog.open)dialog.showModal();});
for(const id of ['close-account-settings','back-to-game'])document.getElementById(id).addEventListener('click',()=>dialog.close());
// Native dialog handles Escape, focus confinement and focus restoration.
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const box=dialog.getBoundingClientRect();
 if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
});
document.addEventListener('account-ended',()=>{if(dialog.open)dialog.close();});
