const form = document.getElementById("hwidForm");
const hwidInput = document.getElementById("hwid");
const submitButton = document.getElementById("submitButton");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const tokenValue = document.getElementById("tokenValue");
const copyButton = document.getElementById("copyButton");

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}
function setResult(value) {
  resultBox.textContent = value;
}
function showToken(token) {
  tokenValue.textContent = token || "Token tidak ditemukan.";
}
function extractToken(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const input = doc.querySelector('input[type="hidden"][name="token"]');
  if (!input || !input.value) throw new Error("Hidden token tidak ditemukan dari server.");
  return input.value;
}
async function api(path, options) {
  const r = await fetch(path, options);
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}\n${text || r.statusText}`);
  }
  return text;
}

const params = new URLSearchParams(location.search);
const qHwid = params.get("hwid");
if (qHwid) hwidInput.value = qHwid;

copyButton.addEventListener("click", async () => {
  const token = tokenValue.textContent;
  if (!token || token === "Token belum tersedia." || token === "Token tidak ditemukan.") return;
  try {
    await navigator.clipboard.writeText(token);
    setStatus("Token berhasil disalin.", "success");
  } catch {
    setStatus("Token sudah tampil, tetapi clipboard diblokir browser.", "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const hwid = hwidInput.value.trim();
  if (!hwid) return setStatus("Masukkan HWID.", "error");

  submitButton.disabled = true;
  submitButton.textContent = "Processing...";
  setStatus("Mengambil token...", "success");
  setResult("Waiting for server response...");
  showToken("Token belum tersedia.");

  try {
    // The browser talks only to localhost. The Node server talks to upstream.
    const tokenPage = await api("/api/token", {method:"GET"});
    const token = extractToken(tokenPage);
    showToken(token);

    setStatus("Token diterima. Mengirim HWID...", "success");

    const body = new URLSearchParams({
      generate_token: "true",
      hwid,
      token
    });

    const response = await api("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    });

    setResult(response);
    setStatus("Selesai. Token ditampilkan di bawah.", "success");
  } catch (e) {
    console.error(e);
    setStatus("Request gagal.", "error");
    setResult(e && e.message ? e.message : String(e));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Generate Token";
  }
});
