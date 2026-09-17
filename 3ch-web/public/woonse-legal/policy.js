const type = document.body.dataset.policy;
const status = document.getElementById('status');
const effective = document.getElementById('effective');
const content = document.getElementById('content');
fetch(`https://0ynohfoee9.execute-api.ap-southeast-2.amazonaws.com/dev/api/public/policies/${type}`)
  .then(async response => {
    if (response.status === 404) throw new Error('게시된 문서가 없습니다.');
    if (!response.ok) throw new Error('문서를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    return response.json();
  })
  .then(policy => {
    effective.textContent = `${policy.label} · ${policy.effectiveDate} 시행`;
    content.textContent = policy.content;
    status.hidden = true;
    effective.hidden = false;
    content.hidden = false;
  })
  .catch(error => { status.textContent = error.message; });
