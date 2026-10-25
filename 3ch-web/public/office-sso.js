(async()=>{
 'use strict';
 const config={"provider": "league", "api": "https://woorileague.com/api", "storage": "admin_token", "destination": "/admin"};
 const office='https://threech.com';
 const status=document.getElementById('status');
 if(!window.opener){status.textContent='OFFICE의 관리자페이지 버튼에서 다시 열어주세요.';return;}
 const opener=window.opener;
 const encode=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 const verifier=encode(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 let received=false;
 const timer=setTimeout(()=>{window.removeEventListener('message',receive);status.textContent='연결 시간이 만료됐습니다. OFFICE에서 다시 열어주세요.';},45000);
 async function receive(event){
  if(event.origin!==office||event.source!==opener||event.data?.type!=='office-sso-code'||received)return;
  if(typeof event.data.code!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(event.data.code))return;
  received=true;clearTimeout(timer);window.removeEventListener('message',receive);
  try{
   const response=await fetch(office+'/office/api/sso/exchange',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:config.provider,code:event.data.code,verifier}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('로그인 연결이 만료됐습니다. OFFICE에서 다시 시도해 주세요.');
   const {token}=await response.json();if(typeof token!=='string'||!token)throw new Error('인증 정보를 확인할 수 없습니다.');
   const me=await fetch(config.api+'/admin/me',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!me.ok)throw new Error('기존 서비스의 계정 권한을 확인해 주세요.');
   const data=await me.json(),user=config.provider==='league'?data.user:data;
   if(!user||(config.provider==='league'?(!user.is_admin&&user.system_role!=='MANAGER'):!['ADMIN','MANAGER'].includes(user.systemRole))||user.mustChangePassword||user.admin_password_reset_required)throw new Error('기존 서비스의 계정 권한을 확인해 주세요.');
   (config.provider==='league'?localStorage:sessionStorage).setItem(config.storage,token);
   window.opener=null;location.replace(config.destination);
  }catch(error){status.textContent=error.message||'로그인 연결에 실패했습니다.';}
 }
 window.addEventListener('message',receive);
 opener.postMessage({type:'office-sso-ready',challenge},office);
})().catch(()=>{document.getElementById('status').textContent='로그인 연결을 시작하지 못했습니다. OFFICE에서 다시 열어주세요.';});
