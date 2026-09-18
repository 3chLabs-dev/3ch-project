const app = document.getElementById('app');
const API = window.WOONSE_API_BASE_URL;
const kinds = { notice: '공지사항', faq: '자주 하는 질문', inquiry: '1:1 문의', guide: '이용방법' };
const providerNames = { EMAIL: '이메일', KAKAO: '카카오', NAVER: '네이버', GOOGLE: 'Google' };
let token = sessionStorage.getItem('woonse_admin_token') || '';
let user = null;
let route = location.hash.slice(1) || '/admin';
let page = 1;
let search = '';
let boardItems = [];
let modal = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '-';
const providers = member => (member.providers?.length ? member.providers : [member.provider])
  .map(value => providerNames[value] || value).join(' · ');
const verification = member => member.emailVerificationApplicable === false
  ? '<span class="muted">해당 없음</span>'
  : `<span class="pill ${member.emailVerifiedAt?'on':''}">${member.emailVerifiedAt?'인증':'미인증'}</span>`;
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/admin/login') logout();
    throw new Error(data.message || '요청에 실패했습니다.');
  }
  return data;
}
function logout() {
  token = ''; user = null;
  sessionStorage.removeItem('woonse_admin_token');
  renderLogin();
}
function renderLogin(error = '') {
  app.innerHTML = `<main class="login-wrap"><form class="login-card" id="login-form">
    <div class="brand">우리운세<small>관리자페이지</small></div>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <input class="field" name="email" type="email" autocomplete="username" placeholder="아이디(이메일)" required />
    <input class="field" name="password" type="password" autocomplete="current-password" placeholder="비밀번호" required />
    <button class="primary" type="submit">로그인</button></form></main>`;
  document.getElementById('login-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true; button.textContent = '로그인 중...';
    try {
      const result = await request('/admin/login', { method:'POST', body: JSON.stringify({ email: form.elements.namedItem('email').value, password: form.elements.namedItem('password').value }) });
      token = result.accessToken;
      sessionStorage.setItem('woonse_admin_token', token);
      user = await request('/admin/me');
      location.hash = '#/admin';
      await render();
    } catch (error) { renderLogin(error.message); }
  };
}
function nav(path, label, sub = false) {
  return `<button class="nav-item ${sub?'sub':''} ${route===path?'active':''}" data-route="${path}">${label}</button>`;
}
function shell(content) {
  const boardActive = route.startsWith('/admin/board/') || route.startsWith('/admin/policies/');
  const paymentActive = route === '/admin/payments';
  app.innerHTML = `<div class="layout"><header class="header"><div class="header-brand" data-route="/admin">우리운세<span>관리자페이지</span></div><div class="header-right"><span>${esc(user?.nickname || user?.email)}</span><button class="secondary" id="logout">로그아웃</button></div></header>
    <div class="body"><aside class="sidebar">${nav('/admin','대시보드')}${nav('/admin/members','회원 관리')}<hr />
    <div class="nav-heading ${boardActive?'active':''}">게시판 관리</div>
    ${Object.entries(kinds).map(([key,label]) => nav(`/admin/board/${key}`,label,true)).join('')}
    ${nav('/admin/policies/terms','이용약관',true)}${nav('/admin/policies/privacy','개인정보 처리방침',true)}
    <hr /><div class="nav-heading ${paymentActive?'active':''}">결제 관리</div>${nav('/admin/payments','결제내역',true)}</aside>
    <main class="content-wrap"><section class="panel">${content}</section></main></div></div>`;
  document.querySelectorAll('[data-route]').forEach(el => el.onclick = () => { location.hash = '#' + el.dataset.route; });
  document.getElementById('logout').onclick = logout;
}
function errorPage(error) { shell(`<div class="error">${esc(error.message)}</div>`); }
async function renderDashboard() {
  const stats = await request('/admin/stats');
  shell(`<h1 class="page-title">대시보드</h1><div class="cards">
    <div class="card"><span class="muted">회원가입수</span><b>${stats.memberCount}</b></div>
    <div class="card"><span class="muted">게시물수</span><b>${stats.boardCount}</b></div>
    <div class="card"><span class="muted">결제건수</span><b>${stats.paymentCount}</b></div></div>`);
}
async function renderMembers() {
  const data = await request(`/admin/members?page=${page}&search=${encodeURIComponent(search)}`);
  shell(`<h1 class="page-title">회원 관리</h1><div class="toolbar"><span class="muted">총 <b>${data.total}</b>명</span>
    <form class="toolbar-group" id="search-form"><input class="field" name="search" placeholder="이메일 또는 닉네임" value="${esc(search)}"/><button class="secondary">검색</button></form></div>
    <div class="table-wrap"><table><thead><tr><th>No</th><th>이메일</th><th>닉네임</th><th>가입방식</th><th>이메일 인증</th><th>가입일시</th></tr></thead><tbody>
    ${data.members.length ? data.members.map((member,index)=>`<tr><td>${(page-1)*20+index+1}</td><td>${esc(member.email||'-')}</td><td><b>${esc(member.nickname)}</b></td><td>${esc(providers(member))}</td><td>${verification(member)}</td><td>${date(member.createdAt)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">회원이 없습니다.</td></tr>'}
    </tbody></table></div><div class="pager"><button class="secondary" id="prev" ${page<=1?'disabled':''}>이전</button><span>${page} / ${Math.max(1,Math.ceil(data.total/20))}</span><button class="secondary" id="next" ${page*20>=data.total?'disabled':''}>다음</button></div>`);
  document.getElementById('search-form').onsubmit = event => { event.preventDefault(); search = event.currentTarget.elements.namedItem('search').value.trim(); page=1; renderMembers().catch(errorPage); };
  document.getElementById('prev').onclick = () => { page--; renderMembers().catch(errorPage); };
  document.getElementById('next').onclick = () => { page++; renderMembers().catch(errorPage); };
}
async function renderBoard(type) {
  if (!kinds[type]) { shell('<div class="error">페이지를 찾을 수 없습니다.</div>'); return; }
  const data = await request(`/admin/board?type=${type}`);
  boardItems = data.items;
  shell(`<h1 class="page-title">${kinds[type]}</h1><div class="toolbar"><span class="muted">총 <b>${data.total}</b>개</span><button class="primary" id="add">신규추가</button></div>
    <div class="table-wrap"><table><thead><tr><th>No</th><th>제목</th><th>내용 미리보기</th><th>공개</th><th>등록일시</th><th>관리</th></tr></thead><tbody>
    ${data.items.length ? data.items.map((item,index)=>`<tr><td>${data.total-index}</td><td><b>${esc(item.title)}</b></td><td>${esc(item.content).slice(0,100)}</td><td><span class="pill ${item.published?'on':''}">${item.published?'공개':'비공개'}</span></td><td>${date(item.createdAt)}</td><td><button class="link-button" data-edit="${esc(item.id)}">수정</button><button class="link-button danger" data-delete="${esc(item.id)}">삭제</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">등록된 게시물이 없습니다.</td></tr>'}
    </tbody></table></div>`);
  document.getElementById('add').onclick = () => openEditor(type);
  document.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => openEditor(type, boardItems.find(item=>item.id===el.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(el => el.onclick = async () => {
    if (!confirm('이 게시물을 삭제하시겠습니까? 삭제한 내용은 복구할 수 없습니다.')) return;
    try { await request(`/admin/board/${encodeURIComponent(el.dataset.delete)}`, { method:'DELETE' }); await renderBoard(type); }
    catch(error) { alert(error.message); }
  });
}
function openEditor(type, item) {
  modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML = `<form class="modal" id="editor"><h2>${item?'게시물 수정':'신규추가'}</h2>
    <div class="form-row"><label>제목</label><input class="field" name="title" maxlength="200" value="${esc(item?.title||'')}" required /></div>
    <div class="form-row"><label>내용</label><textarea name="content" maxlength="20000" required>${esc(item?.content||'')}</textarea></div>
    <div class="form-row"><label><input type="checkbox" name="published" ${item?.published?'checked':''}/> 공개</label></div>
    <div class="modal-actions"><button type="button" class="secondary" id="cancel">취소</button><button class="primary">저장</button></div></form>`;
  document.body.append(modal);
  document.getElementById('cancel').onclick=()=>modal.remove();
  document.getElementById('editor').onsubmit=async event=>{
    event.preventDefault(); const form=event.currentTarget;
    try { await request(`/admin/board${item?'/'+encodeURIComponent(item.id):''}`, { method:item?'PUT':'POST', body:JSON.stringify({type,title:form.elements.namedItem('title').value,content:form.elements.namedItem('content').value,published:form.elements.namedItem('published').checked}) }); modal.remove(); await renderBoard(type); }
    catch(error){alert(error.message);}
  };
}
const policyTitles = { terms: '이용약관', privacy: '개인정보 처리방침' };
const policyTags = new Set(['p','br','strong','em','u','h1','h2','h3','ul','ol','li','table','thead','tbody','tr','th','td']);
function policyHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  let tag = node.tagName.toLowerCase();
  if (tag === 'b') tag = 'strong';
  if (tag === 'i') tag = 'em';
  if (tag === 'div') tag = 'p';
  if (tag === 'span' || tag === 'font') return [...node.childNodes].map(policyHtml).join('');
  const children = [...node.childNodes].map(policyHtml).join('');
  if (!policyTags.has(tag)) return children;
  return tag === 'br' ? '<br/>' : `<${tag}>${children}</${tag}>`;
}
function policyDisplay(content, format) {
  return format === 'html' ? content : esc(content).replace(/\n/g, '<br/>');
}
function policyTable(rows, cols) {
  return `<table><tbody>${Array.from({length:rows},(_,r)=>`<tr>${Array.from({length:cols},()=>`<${r?'td':'th'}><br/></${r?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table><p><br/></p>`;
}
async function renderPolicies(type) {
  if (!policyTitles[type]) { shell('<div class="error">페이지를 찾을 수 없습니다.</div>'); return; }
  const data = await request(`/admin/policies/${type}`);
  shell(`<h1 class="page-title">${policyTitles[type]}</h1>
    <div class="toolbar"><span class="muted">총 <b>${data.versions.length}</b>개 버전</span><button class="primary" id="add-policy">신규 버전 추가</button></div>
    <div class="table-wrap"><table><thead><tr><th>No</th><th>버전 레이블</th><th>시행일</th><th>내용 미리보기</th><th>상태</th><th>등록일시</th><th>관리</th></tr></thead><tbody>
    ${data.versions.length ? data.versions.map((version,index)=>`<tr class="${version.isCurrent?'current-row':''}"><td>${data.versions.length-index}</td><td><b>${esc(version.label)}</b></td><td>${esc(version.effectiveDate)}</td><td>${esc(version.preview)}</td><td><span class="pill ${version.isCurrent?'on':''}">${version.isCurrent?'현행':version.publishedAt?'이전':'미게시'}</span></td><td>${date(version.createdAt)}</td><td class="actions"><button class="link-button" data-view="${esc(version.id)}">보기</button><button class="link-button" data-edit-policy="${esc(version.id)}">수정</button>${version.isCurrent?'':`<button class="link-button" data-publish="${esc(version.id)}">현행설정</button><button class="link-button danger" data-delete-policy="${esc(version.id)}">삭제</button>`}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">등록된 버전이 없습니다.</td></tr>'}
    </tbody></table></div><p class="muted">현행 버전을 수정하면 앱과 공개 페이지에 바로 반영됩니다. 이전 버전은 수정·삭제할 수 있으며, 현행 버전은 삭제할 수 없습니다.</p>`);
  document.getElementById('add-policy').onclick = () => openPolicyEditor(type);
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => openPolicyDetail(type, el.dataset.view));
  document.querySelectorAll('[data-edit-policy]').forEach(el => el.onclick = () => openPolicyEditor(type, el.dataset.editPolicy));
  document.querySelectorAll('[data-publish]').forEach(el => el.onclick = async () => {
    if (!confirm('이 버전을 현행으로 설정하시겠습니까? 앱과 공개 페이지에 바로 반영됩니다.')) return;
    try { await request(`/admin/policies/${type}/${encodeURIComponent(el.dataset.publish)}/publish`, {method:'POST'}); await renderPolicies(type); }
    catch(error) { alert(error.message); }
  });
  document.querySelectorAll('[data-delete-policy]').forEach(el => el.onclick = async () => {
    if (!confirm('이 버전을 삭제하시겠습니까? 삭제한 내용은 복구할 수 없습니다.')) return;
    try { await request(`/admin/policies/${type}/${encodeURIComponent(el.dataset.deletePolicy)}`, {method:'DELETE'}); await renderPolicies(type); }
    catch(error) { alert(error.message); }
  });
}
async function openPolicyDetail(type, id) {
  try {
    const version = await request(`/admin/policies/${type}/${encodeURIComponent(id)}`);
    modal = document.createElement('div'); modal.className = 'modal-backdrop';
    modal.innerHTML = `<div class="modal policy-modal"><h2>${policyTitles[type]} · ${esc(version.label)}</h2><p class="muted">${esc(version.effectiveDate)} 시행 · ${version.isCurrent?'현행':version.publishedAt?'이전':'미게시'}</p><div class="policy-body">${policyDisplay(version.content,version.format)}</div><div class="modal-actions"><button class="secondary" id="close-policy">닫기</button></div></div>`;
    document.body.append(modal);
    document.getElementById('close-policy').onclick = () => modal.remove();
  } catch(error) { alert(error.message); }
}
async function openPolicyEditor(type, id) {
  let version;
  try { if (id) version = await request(`/admin/policies/${type}/${encodeURIComponent(id)}`); }
  catch(error) { alert(error.message); return; }
  modal = document.createElement('div'); modal.className = 'modal-backdrop';
  modal.innerHTML = `<form class="modal policy-modal" id="policy-editor"><h2>${policyTitles[type]} ${id?'수정':'신규 버전 추가'}</h2>
    <div class="form-row"><label>버전 레이블</label><input class="field" name="label" maxlength="120" value="${esc(version?.label||'')}" placeholder="예: 현행 ${policyTitles[type]}" required /></div>
    <div class="form-row"><label>시행일</label><input class="field" name="effectiveDate" type="date" value="${esc(version?.effectiveDate||'')}" required /></div>
    <div class="form-row"><label>내용</label><div class="policy-editor-wrap"><div class="policy-toolbar" aria-label="편집 도구">
      <button type="button" data-command="bold" title="굵게"><b>B</b></button><button type="button" data-command="italic" title="기울임"><i>I</i></button><button type="button" data-command="underline" title="밑줄"><u>U</u></button>
      <button type="button" data-block="h1">H1</button><button type="button" data-block="h2">H2</button><button type="button" data-block="h3">H3</button>
      <button type="button" data-command="insertUnorderedList" title="글머리 기호">• 목록</button><button type="button" data-command="insertOrderedList" title="번호 목록">1. 목록</button>
      <button type="button" id="insert-policy-table" title="표 삽입">▦ 표</button><button type="button" id="add-policy-row" title="현재 표에 행 추가">+행</button><button type="button" id="add-policy-col" title="현재 표에 열 추가">+열</button><button type="button" id="remove-policy-table" title="현재 표 삭제">표 삭제</button>
      </div><div id="policy-content" class="policy-editable" contenteditable="true" role="textbox" aria-multiline="true"></div></div></div>
    ${id?'':'<div class="form-row"><label><input type="checkbox" name="publish" /> 저장 즉시 현행 버전으로 설정</label></div>'}
    <div class="modal-actions"><button type="button" class="secondary" id="cancel-policy">취소</button><button class="primary" type="submit">${id?'수정':'등록'}</button></div></form>`;
  document.body.append(modal);
  const editor = document.getElementById('policy-content');
  editor.innerHTML = version?.format === 'html' ? version.content : esc(version?.content||'').replace(/\n/g,'<br/>');
  document.querySelectorAll('.policy-toolbar button').forEach(button => button.onmousedown = event => event.preventDefault());
  document.querySelectorAll('[data-command]').forEach(button => button.onclick = () => { editor.focus(); document.execCommand(button.dataset.command); });
  document.querySelectorAll('[data-block]').forEach(button => button.onclick = () => { editor.focus(); document.execCommand('formatBlock',false,button.dataset.block); });
  document.getElementById('insert-policy-table').onclick = () => {
    const selection = getSelection();
    const savedRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const rows = Number(prompt('행 수 (1~15)', '3'));
    if (!rows) return;
    const cols = Number(prompt('열 수 (1~10)', '3'));
    if (!cols) return;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || rows > 15 || cols < 1 || cols > 10) { alert('행과 열의 범위를 확인해주세요.'); return; }
    editor.focus();
    if (savedRange) { selection.removeAllRanges(); selection.addRange(savedRange); }
    document.execCommand('insertHTML', false, policyTable(rows, cols));
  };
  const currentCell = () => { const node = getSelection()?.anchorNode; return (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest?.('td,th'); };
  document.getElementById('add-policy-row').onclick = () => { const cell=currentCell(); if (!cell) return alert('표 안에 커서를 놓아주세요.'); const row=cell.closest('tr'); const added=row.cloneNode(true); added.querySelectorAll('td,th').forEach(el=>el.innerHTML='<br/>'); row.after(added); };
  document.getElementById('add-policy-col').onclick = () => { const cell=currentCell(); if (!cell) return alert('표 안에 커서를 놓아주세요.'); const index=[...cell.parentElement.children].indexOf(cell); cell.closest('table').querySelectorAll('tr').forEach(row=>{ const newCell=document.createElement(row.querySelector('th')?'th':'td'); newCell.innerHTML='<br/>'; row.children[index]?.after(newCell); }); };
  document.getElementById('remove-policy-table').onclick = () => { const cell=currentCell(); if (!cell) return alert('표 안에 커서를 놓아주세요.'); cell.closest('table').remove(); };
  editor.onpaste = event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); };
  document.getElementById('cancel-policy').onclick = () => modal.remove();
  document.getElementById('policy-editor').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { label: form.elements.namedItem('label').value.trim(), effectiveDate: form.elements.namedItem('effectiveDate').value,
      content: [...editor.childNodes].map(policyHtml).join('').trim(), format: 'html', publish: !id && form.elements.namedItem('publish').checked };
    if (!editor.textContent.trim()) { alert('본문을 입력해주세요.'); editor.focus(); return; }
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      await request(`/admin/policies/${type}${id?'/'+encodeURIComponent(id):''}`, { method:id?'PUT':'POST', body:JSON.stringify(payload) });
      modal.remove(); await renderPolicies(type);
    } catch(error) { alert(error.message); button.disabled = false; }
  };
}
async function renderPayments() {
  const data = await request('/admin/payments');
  shell(`<h1 class="page-title">결제내역</h1><p class="muted">우리운세 포인트 결제 내역을 확인합니다.</p>
    <div class="table-wrap"><table><thead><tr><th>No</th><th>결제일시</th><th>회원</th><th>상품</th><th>결제금액</th><th>상태</th><th>주문번호</th></tr></thead><tbody>
    ${data.payments.length ? '' : '<tr><td colspan="7" class="empty">결제내역이 없습니다.</td></tr>'}</tbody></table></div>
    <p class="note">포인트 상품과 결제 연동 방식은 아직 정해지지 않았습니다. 결제 연동 후 실제 거래 내역이 이 화면에 표시됩니다.</p>`);
}
async function render() {
  if (!token) { renderLogin(); return; }
  try {
    if (!user) user = await request('/admin/me');
    route = location.hash.slice(1) || '/admin';
    if (route === '/admin') await renderDashboard();
    else if (route === '/admin/members') await renderMembers();
    else if (route.startsWith('/admin/board/')) await renderBoard(route.split('/')[3]);
    else if (route.startsWith('/admin/policies/')) await renderPolicies(route.split('/')[3]);
    else if (route === '/admin/payments') await renderPayments();
    else shell('<div class="error">페이지를 찾을 수 없습니다.</div>');
  } catch(error) { if (token) errorPage(error); }
}
window.addEventListener('hashchange', () => { page=1; render(); });
render();
