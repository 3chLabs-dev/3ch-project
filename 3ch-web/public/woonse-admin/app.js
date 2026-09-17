const app = document.getElementById('app');
const API = window.WOONSE_API_BASE_URL;
const kinds = { notice: '공지사항', faq: '자주 하는 질문', inquiry: '1:1 문의', guide: '이용방법' };
let token = sessionStorage.getItem('woonse_admin_token') || '';
let user = null;
let route = location.hash.slice(1) || '/admin';
let page = 1;
let search = '';
let boardItems = [];
let modal = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '-';
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
  const boardActive = route.startsWith('/admin/board/');
  const paymentActive = route === '/admin/payments';
  app.innerHTML = `<div class="layout"><header class="header"><div class="header-brand" data-route="/admin">우리운세<span>관리자페이지</span></div><div class="header-right"><span>${esc(user?.nickname || user?.email)}</span><button class="secondary" id="logout">로그아웃</button></div></header>
    <div class="body"><aside class="sidebar">${nav('/admin','대시보드')}${nav('/admin/members','회원 관리')}<hr />
    <div class="nav-heading ${boardActive?'active':''}">게시판 관리</div>
    ${Object.entries(kinds).map(([key,label]) => nav(`/admin/board/${key}`,label,true)).join('')}
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
    ${data.members.length ? data.members.map((member,index)=>`<tr><td>${(page-1)*20+index+1}</td><td>${esc(member.email||'-')}</td><td><b>${esc(member.nickname)}</b></td><td>${member.provider==='EMAIL'?'이메일':'소셜'}</td><td><span class="pill ${member.emailVerifiedAt?'on':''}">${member.emailVerifiedAt?'인증':'미인증'}</span></td><td>${date(member.createdAt)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">회원이 없습니다.</td></tr>'}
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
    else if (route === '/admin/payments') await renderPayments();
    else shell('<div class="error">페이지를 찾을 수 없습니다.</div>');
  } catch(error) { if (token) errorPage(error); }
}
window.addEventListener('hashchange', () => { page=1; render(); });
render();
