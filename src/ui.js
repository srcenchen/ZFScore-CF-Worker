export function loadingPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>成绩查询</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui,-apple-system,sans-serif; }
    body { margin: 0; background: #f5f7fb; color: #172033; }
    main { width: min(760px,calc(100% - 32px)); margin: 48px auto; }
    .card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 10px 32px #17203318; }
    h1 { margin: 0 0 20px; font-size: 22px; }
    form { display: flex; gap: 10px; }
    input { min-width: 0; flex: 1; padding: 11px 13px; border: 1px solid #ccd3df; border-radius: 9px; font: inherit; }
    button { border: 0; border-radius: 9px; padding: 11px 18px; background: #2563eb; color: white; font: inherit; cursor: pointer; }
    #loading { display: none; align-items: center; gap: 12px; margin: 18px 0 0; color: #536079; }
    .spinner { width: 20px; height: 20px; border: 3px solid #d9e2f2; border-top-color: #2563eb; border-radius: 50%; animation: spin .75s linear infinite; }
    pre { display: none; margin: 20px 0 0; padding: 18px; border-radius: 10px; background: #f3f5f9; color: #172033; white-space: pre-wrap; word-break: break-word; line-height: 1.65; }
    #error { display: none; margin-top: 16px; color: #b42318; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-color-scheme: dark) {
      body { background: #0f1520; color: #e8edf7; }
      .card { background: #182131; box-shadow: none; }
      input { background: #101826; color: #e8edf7; border-color: #3a4659; }
      pre { background: #101826; color: #e8edf7; }
    }
  </style>
</head>
<body>
  <main><section class="card">
    <h1>正方教务成绩查询</h1>
    <form id="login">
      <input id="token" type="password" autocomplete="current-password" placeholder="访问 Token" required>
      <button type="submit">查询</button>
    </form>
    <div id="loading"><span class="spinner" aria-hidden="true"></span><span>正在登录教务系统并加载数据…</span></div>
    <div id="error" role="alert"></div>
    <pre id="result"></pre>
  </section></main>
  <script>
    const form = document.querySelector('#login');
    const input = document.querySelector('#token');
    const loading = document.querySelector('#loading');
    const errorBox = document.querySelector('#error');
    const result = document.querySelector('#result');

    async function load(token) {
      form.style.display = 'none';
      loading.style.display = 'flex';
      errorBox.style.display = 'none';
      result.style.display = 'none';
      try {
        const response = await fetch('/api/report', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store'
        });
        const text = await response.text();
        if (!response.ok) {
          try { throw new Error(JSON.parse(text).error || text); }
          catch (error) { if (error instanceof SyntaxError) throw new Error(text); throw error; }
        }
        result.textContent = text;
        result.style.display = 'block';
      } catch (error) {
        errorBox.textContent = error.message || String(error);
        errorBox.style.display = 'block';
        form.style.display = 'flex';
      } finally {
        loading.style.display = 'none';
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      load(input.value);
    });
    const queryToken = new URLSearchParams(location.search).get('token');
    if (queryToken) {
      load(queryToken);
    }
  </script>
</body>
</html>`;
}

export function htmlResponse(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    },
  });
}
