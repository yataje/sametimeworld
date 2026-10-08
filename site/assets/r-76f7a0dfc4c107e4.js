const q = new URLSearchParams(location.search);
const phone = /iPhone|iPod|Android.+Mobile|Windows Phone/i.test(navigator.userAgent);
const pc = q.get('spaceScreen') === '1' || q.get('view') === 'desktop';
const mobile = !pc && (q.get('view') === 'mobile' || phone);
const target = new URL(mobile ? 'index-mobile.html' : 'index-pc.html', location.href);
q.delete('view');
target.search = q.toString();
target.hash = location.hash;
if (!mobile) {
  location.replace(target);
} else {
  // Keep the owner's permanent entry URL, but bypass cached mobile HTML.
  // Its content-hashed assets then select exactly the matching release.
  target.searchParams.set('_fresh', String(Date.now()));
  fetch(target, {cache: 'no-store', credentials: 'same-origin'})
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then(html => {
      document.open();
      document.write(html);
      document.close();
    })
    .catch(() => {
      const message = document.createElement('p');
      message.textContent = '최신 모바일 화면을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '다시 시도';
      retry.onclick = () => location.reload();
      document.body.replaceChildren(message, retry);
    });
}
