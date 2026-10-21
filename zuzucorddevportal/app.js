(() => {"use strict";
const URL="https://wfqudstuncdldsvxqveu.supabase.co";
const KEY="sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar";
const $=id=>document.getElementById(id);
let session=null,busy=false;
const state=(msg,error=false)=>{const el=$("status");el.textContent=msg;el.classList.toggle("error",error)};
const alias=value=>{let s=value.trim().toLowerCase();if(s.endsWith("@zuzucord.com"))s=s.slice(0,-"@zuzucord.com".length);return /^[a-z0-9_]{3,24}$/.test(s)?s+"@users.zuzucord.invalid":s};
async function api(path,{method="GET",body,authenticated=true}={}){
 const headers={apikey:KEY,Accept:"application/json"};
 if(authenticated){if(!session?.access_token)throw Error("Sign in first");headers.Authorization="Bearer "+session.access_token;}
 if(body!==undefined)headers["Content-Type"]="application/json";
 const response=await fetch(URL+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=null}
 if(!response.ok)throw Error(data?.message||data?.error_description||data?.error||"HTTP "+response.status);
 return data;
}
async function refresh(){
 const data=await api("/rest/v1/zuzucord_bot_apps?select=id,name,description,created_at&owner_id=eq."+session.user.id+"&order=created_at.desc");
 const list=$("bot-list");list.replaceChildren();
 if(!data.length){const p=document.createElement("p");p.textContent="No bot applications yet. Create one to begin.";list.append(p)}
 for(const bot of data){
  const card=document.createElement("article");card.className="bot-card";
  const h=document.createElement("h3");h.textContent=bot.name;
  const desc=document.createElement("p");desc.textContent=bot.description||"No description";
  const id=document.createElement("code");id.textContent="App ID: "+bot.id;
  const btns=document.createElement("div");btns.className="buttons";
  const issue=document.createElement("button");issue.textContent="Generate / rotate token";
  issue.onclick=()=>void credential(bot.id,"issue");
  const revoke=document.createElement("button");revoke.textContent="Revoke token";
  revoke.onclick=()=>void credential(bot.id,"revoke");
  const copy=document.createElement("button");copy.textContent="Copy application ID";
  copy.onclick=()=>void navigator.clipboard.writeText(bot.id).then(()=>state("Bot application ID copied."));
  btns.append(issue,revoke,copy);card.append(h,desc,id,btns);list.append(card);
 }
}
async function credential(id,action){
 if(action==="issue"&&!confirm("Generating a new token revokes the previous token. Continue?"))return;
 if(action==="revoke"&&!confirm("Revoke every active token for this bot?"))return;
 try{
  const result=await api("/functions/v1/zuzucord-bot-api",{method:"POST",body:{action,bot_id:id}});
  if(result.token){$("new-token").textContent=result.token;$("issued").hidden=false;state("New bot token created. Copy it once.");}
  else{$("issued").hidden=true;$("new-token").textContent="";state("Bot tokens revoked.");}
 }catch(error){state(error.message,true)}
}
$("login-form").addEventListener("submit",async event=>{
 event.preventDefault();if(busy)return;busy=true;
 try{
  const result=await api("/auth/v1/token?grant_type=password",{authenticated:false,method:"POST",body:{email:alias($("username").value),password:$("password").value}});
  $("password").value="";
  if(!result?.access_token||!result.user?.id)throw Error("Authentication failed");
  session=result;
  const allowed=await api("/rest/v1/rpc/zuzucord_has_role",{method:"POST",body:{p_role:"developer"}});
  if(allowed!==true)throw Error("Developer role required. Ask an authorized administrator for access.");
  $("login-panel").hidden=true;$("developer-panel").hidden=false;$("logout").hidden=false;
  $("login-state").textContent="Developer access granted";await refresh();state("Developer portal unlocked.");
 }catch(error){session=null;$("login-state").textContent=error.message;state(error.message,true)}
 finally{busy=false}
});
$("logout").onclick=()=>{session=null;$("developer-panel").hidden=true;$("login-panel").hidden=false;$("logout").hidden=true;$("new-token").textContent="";$("issued").hidden=true;state("Signed out.")};
$("create-bot").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
  const name=$("bot-name").value.trim(),description=$("bot-description").value.trim();
  await api("/rest/v1/zuzucord_bot_apps",{method:"POST",body:{owner_id:session.user.id,name,description}});
  $("create-bot").reset();await refresh();state("Bot application created.");
 }catch(error){state(error.message,true)}finally{busy=false}
});
$("announcement-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!confirm("Publish this official read-only announcement to all ZuzuCord accounts?"))return;
 try{await api("/rest/v1/rpc/zuzucord_publish_announcement",{method:"POST",body:{p_title:$("announcement-title").value,p_content:$("announcement-message").value}});$("announcement-form").reset();state("Official announcement published.")}catch(error){state(error.message,true)}
});
async function resolveCrystalRecipient(identity){
 const name=identity.trim().toLowerCase().replace(/@zuzucord\\.com$/,'');
 if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name))return name;
 if(!/^[a-z0-9_]{3,24}$/.test(name))throw Error("Enter a valid ZuzuCord username or account UUID.");
 const match=await api("/rest/v1/rpc/zuzucord_find_username",{
   method:"POST",body:{p_username:name}
 });
 if(!Array.isArray(match)||!match[0]?.user_id)throw Error("No ZuzuCord user matches that name.");
 return match[0].user_id;
}
$("credit-form").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
  const target=await resolveCrystalRecipient($("credit-user").value);
  const amount=Number($("credit-amount").value);
  if(!Number.isInteger(amount)||amount<1||amount>1000)throw Error("Grant between 1 and 1,000 Crystals.");
  if(!confirm("Grant "+amount+" non-purchasable Crystals to this user?"))return;
  const result=await api("/rest/v1/rpc/zuzucord_grant_crystals",{
    method:"POST",body:{p_user:target,p_amount:amount}
  });
  state("Crystals granted and recorded in recipient history. Balance: "+result);
 }catch(error){state(error.message,true)}
 finally{busy=false}
});
$("badge-form").addEventListener("submit",async e=>{
 e.preventDefault();try{await api("/rest/v1/rpc/zuzucord_set_user_badge",{method:"POST",body:{p_target:$("badge-user").value,p_role:$("badge-role").value,p_enabled:$("badge-enable").value==="true"}});state("User badge updated.")}catch(error){state(error.message,true)}
});
$("copy-token").onclick=()=>void navigator.clipboard.writeText($("new-token").textContent).then(()=>state("Token copied. Keep it secret."));
$("hide-token").onclick=()=>{$("issued").hidden=true;$("new-token").textContent=""};
})();