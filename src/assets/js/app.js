(async () => {
  const $status = document.getElementById('status');
  const $content = document.getElementById('content');

  const b64urlToBytes = (b64url) => {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  };
  const bytesToUtf8 = (ab) => new TextDecoder().decode(new Uint8Array(ab));

  const getParams = () => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const params = new URLSearchParams(hash);
    return { q: params.get('q') || '', sig: params.get('sig') || '', k: params.get('k') || '' };
  };

  const setError = (msg) => {
    $status.classList.add('err');
    $status.textContent = msg;
    $content.innerHTML = '';
  };

  try {
    const { q, sig, k } = getParams();
    if (!q || !sig) return setError('잘못된 접근입니다. (파라미터 누락)');
    $status.textContent = '코드 확인 중…';

    const manifest = await (await fetch('./data/manifest.json', { cache: 'no-store' })).json();
    const entry = manifest.find(x => x.q === q && x.sig === sig);
    if (!entry) return setError('유효하지 않은 코드이거나 만료된 링크입니다.');

    $status.textContent = '해설 로딩 중…';
    const blobJson = await (await fetch(`./${entry.path}`, { cache: 'no-store' })).json();
    if (!k) return setError('복호화 키가 없습니다. (QR을 통해 접속해주세요)');

    const iv = b64urlToBytes(blobJson.iv);
    const ct = b64urlToBytes(blobJson.ct);
    const rawKey = b64urlToBytes(k);

    const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
    let plain;
    try {
      plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    } catch {
      return setError('복호화에 실패했습니다. (키가 올바르지 않음)');
    }

    const html = bytesToUtf8(plain);
    $status.textContent = '해설이 준비되었습니다.';
    $content.innerHTML = html; // 신뢰된 빌드 산출물 가정
    if (window.MathJax && window.MathJax.typesetPromise) await window.MathJax.typesetPromise([$content]);
  } catch (e) {
    console.error(e);
    setError('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
})();