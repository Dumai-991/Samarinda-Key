const ORIGIN = "https://samarinda.io";
const REDIRECT_URL = `${ORIGIN}/redirect/`;
const TOKEN_PAGE = `${ORIGIN}/token/index.php`;
const SUBMIT_URL = `${ORIGIN}/samarinda/index.php`;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/token" && request.method === "GET") {
      return getTokenPage(request);
    }

    if (url.pathname === "/api/submit" && request.method === "POST") {
      return submitToken(request);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(INDEX_HTML, {
        headers: {"content-type": "text/html; charset=UTF-8", "cache-control": "no-store"}
      });
    }

    return new Response("Not found", {status: 404});
  }
};

async function getTokenPage(request) {
  try {
    // Do NOT let fetch automatically follow /redirect/.
    // We need the Set-Cookie and Location returned by the redirect endpoint.
    const first = await fetch(REDIRECT_URL, {
      method: "GET",
      redirect: "manual",
      headers: browserHeaders(request, {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      })
    });

    const setCookie = first.headers.get("set-cookie") || "";
    const location = first.headers.get("location");

    // Some upstreams return the token page directly.
    if (!location && first.ok) {
      const html = await first.text();
      return responseWithCORS(html, first.status);
    }

    if (!location) {
      const body = await first.text();
      return new Response(
        `Upstream /redirect/ returned HTTP ${first.status}\n${body}`,
        {status: 502, headers: {"content-type":"text/plain; charset=UTF-8"}}
      );
    }

    // Follow the Location ourselves and explicitly carry the cookie.
    const nextUrl = new URL(location, REDIRECT_URL).toString();

    const second = await fetch(nextUrl, {
      method: "GET",
      redirect: "manual",
      headers: browserHeaders(request, {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": REDIRECT_URL,
        ...(setCookie ? {"Cookie": cookieHeader(setCookie)} : {})
      })
    });

    // If the first redirect did not set a cookie, try the target with
    // the common browser-style Referer anyway.
    let html = await second.text();

    // Follow one additional redirect while preserving cookies, if present.
    let finalResponse = second;
    let hops = 0;
    while ([301,302,303,307,308].includes(finalResponse.status) &&
           finalResponse.headers.get("location") && hops < 4) {
      const next = new URL(finalResponse.headers.get("location"), nextUrl).toString();
      const extraCookie = finalResponse.headers.get("set-cookie") || "";
      const cookies = [setCookie, extraCookie].filter(Boolean).map(cookieHeader).join("; ");
      finalResponse = await fetch(next, {
        method: "GET",
        redirect: "manual",
        headers: browserHeaders(request, {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": TOKEN_PAGE,
          ...(cookies ? {"Cookie": cookies} : {})
        })
      });
      html = await finalResponse.text();
      hops++;
    }

    if (!finalResponse.ok) {
      return new Response(
        `Token page HTTP ${finalResponse.status}\n${html}`,
        {status: 502, headers: {"content-type":"text/plain; charset=UTF-8"}}
      );
    }

    return responseWithCORS(html, 200);
  } catch (e) {
    return new Response("Token upstream error: " + e.message, {
      status: 502,
      headers: {"content-type":"text/plain; charset=UTF-8"}
    });
  }
}

async function submitToken(request) {
  try {
    const body = await request.arrayBuffer();

    const headers = browserHeaders(request, {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "*/*",
      "Referer": TOKEN_PAGE,
      "Origin": ORIGIN
    });

    const upstream = await fetch(SUBMIT_URL, {
      method: "POST",
      redirect: "manual",
      headers,
      body
    });

    const text = await upstream.text();
    return responseWithCORS(text, upstream.status, "text/plain; charset=UTF-8");
  } catch (e) {
    return new Response("Submit upstream error: " + e.message, {
      status: 502,
      headers: {"content-type":"text/plain; charset=UTF-8"}
    });
  }
}

function browserHeaders(request, extra = {}) {
  const h = new Headers();
  h.set("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/154.0.0.0 Mobile Safari/537.36");
  for (const [k,v] of Object.entries(extra)) h.set(k, v);
  return h;
}

function cookieHeader(setCookie) {
  return setCookie
    .split(/,(?=[^;,=]+=[^;,]+)/)
    .map(v => v.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function responseWithCORS(body, status, contentType="text/html; charset=UTF-8") {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

const INDEX_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Samarinda Token Generator</title>
<style>
body{font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;background:#f5f5f5;color:#222}
.card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px #0001}
h1{margin-top:0}label{display:block;margin:12px 0 6px;font-weight:600}
input,button{width:100%;box-sizing:border-box;padding:12px;border-radius:9px;border:1px solid #ccc;font-size:16px}
button{margin-top:14px;cursor:pointer;border:0;background:#111;color:#fff}
button:disabled{opacity:.6}pre{white-space:pre-wrap;word-break:break-word;background:#111;color:#eee;padding:12px;border-radius:9px;min-height:70px}
.token{font-size:18px;font-weight:700}.copy{background:#555}
</style>
</head>
<body><div class="card">
<h1>Samarinda Token Generator</h1>
<form id="form"><label for="hwid">HWID</label>
<input id="hwid" required placeholder="Masukkan HWID">
<button id="btn" type="submit">Generate Token</button></form>
<h3>Server Response</h3><pre id="response">No response yet.</pre>
<div id="tokenBox" hidden><h3>Token</h3><pre class="token" id="token"></pre>
<button class="copy" id="copy" type="button">Copy Token</button></div>
</div>
<script>
const form=document.getElementById("form"),hwid=document.getElementById("hwid"),
btn=document.getElementById("btn"),resp=document.getElementById("response"),
box=document.getElementById("tokenBox"),tok=document.getElementById("token"),copy=document.getElementById("copy");
const q=new URLSearchParams(location.search).get("hwid"); if(q) hwid.value=q;

function extractToken(html){
 const doc=new DOMParser().parseFromString(html,"text/html");
 const input=doc.querySelector('input[name="token"]');
 if(!input || !input.value) throw new Error("Hidden token tidak ditemukan. Response token page: "+html.slice(0,1000));
 return input.value;
}
form.addEventListener("submit",async e=>{
 e.preventDefault(); const id=hwid.value.trim(); if(!id)return;
 btn.disabled=true; resp.textContent="Mengambil token..."; box.hidden=true;
 try{
  const r=await fetch("/api/token",{cache:"no-store"}), html=await r.text();
  if(!r.ok) throw new Error(html);
  const token=extractToken(html); tok.textContent=token; box.hidden=false;
  const b=new URLSearchParams({generate_token:"true",hwid:id,token});
  const s=await fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:b});
  const text=await s.text(); resp.textContent=text;
 }catch(err){resp.textContent="Error: "+err.message}
 finally{btn.disabled=false}
});
copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(tok.textContent);copy.textContent="Copied!";setTimeout(()=>copy.textContent="Copy Token",1000)}catch{}});
</script></body></html>`;
