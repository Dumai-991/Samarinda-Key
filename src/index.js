const TOKEN_URL = "https://samarinda.io/redirect/";
const SUBMIT_URL = "https://samarinda.io/samarinda/index.php";

const HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Samarinda Token Generator</title>
<style>
body{font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;background:#f5f5f5;color:#222}
.card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px #0001}
h1{margin-top:0} label{display:block;margin:12px 0 6px;font-weight:600}
input,button{width:100%;box-sizing:border-box;padding:12px;border-radius:9px;border:1px solid #ccc;font-size:16px}
button{margin-top:14px;cursor:pointer;border:0;background:#111;color:#fff}
button:disabled{opacity:.6}
pre{white-space:pre-wrap;word-break:break-word;background:#111;color:#eee;padding:12px;border-radius:9px;min-height:70px}
.token{font-size:18px;font-weight:700;word-break:break-all}
.copy{background:#555}
</style>
</head>
<body>
<div class="card">
<h1>Samarinda Token Generator</h1>
<form id="form">
<label for="hwid">HWID</label>
<input id="hwid" name="hwid" required placeholder="Masukkan HWID">
<button id="btn" type="submit">Generate Token</button>
</form>
<h3>Server Response</h3>
<pre id="response">No response yet.</pre>
<div id="tokenBox" hidden>
<h3>Token</h3>
<pre class="token" id="token"></pre>
<button class="copy" id="copy" type="button">Copy Token</button>
</div>
</div>
<script>
const form=document.getElementById("form");
const hwidInput=document.getElementById("hwid");
const btn=document.getElementById("btn");
const responseBox=document.getElementById("response");
const tokenBox=document.getElementById("tokenBox");
const tokenEl=document.getElementById("token");
const copyBtn=document.getElementById("copy");

const q=new URLSearchParams(location.search).get("hwid");
if(q) hwidInput.value=q;

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const hwid=hwidInput.value.trim();
  if(!hwid) return;
  btn.disabled=true;
  responseBox.textContent="Requesting token...";
  tokenBox.hidden=true;
  try{
    const r=await fetch("/api/token");
    const tokenPage=await r.text();
    if(!r.ok) throw new Error(tokenPage);
    const m=tokenPage.match(/<input[^>]+name=["']token["'][^>]+value=["']([^"']+)["']/i)
      || tokenPage.match(/<input[^>]+value=["']([^"']+)["'][^>]+name=["']token["']/i);
    if(!m) throw new Error("Token awal tidak ditemukan dari server.");
    const token=m[1];

    const body=new URLSearchParams();
    body.set("generate_token","true");
    body.set("hwid",hwid);
    body.set("token",token);

    const s=await fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const text=await s.text();
    responseBox.textContent=text;
    const tm=text.match(/(?:token|generated_token)\s*[:=]\s*["']?([A-Za-z0-9._-]+)/i);
    if(tm){ tokenEl.textContent=tm[1]; tokenBox.hidden=false; }
  }catch(err){
    responseBox.textContent="Error: "+err.message;
  }finally{
    btn.disabled=false;
  }
});

copyBtn.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(tokenEl.textContent);
    copyBtn.textContent="Copied!";
    setTimeout(()=>copyBtn.textContent="Copy Token",1200);
  }catch(e){
    alert("Gagal menyalin token.");
  }
});
</script>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/token" && request.method === "GET") {
      return proxy(TOKEN_URL, request);
    }

    if (url.pathname === "/api/submit" && request.method === "POST") {
      const body = await request.arrayBuffer();
      return proxy(SUBMIT_URL, request, body);
    }

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return new Response(HTML, {
        headers: {"content-type":"text/html; charset=UTF-8"}
      });
    }

    return new Response("Not found", {status:404});
  }
};

async function proxy(target, request, body) {
  try {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    headers.set("User-Agent", "Mozilla/5.0");

    const init = {
      method: request.method,
      headers,
      redirect: "follow"
    };
    if (body) init.body = body;

    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (e) {
    return new Response("Upstream error: " + e.message, {status:502});
  }
}
