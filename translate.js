const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const output = document.getElementById("output");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info");
const errorEl = document.getElementById("error");
const copyBtn = document.getElementById("copyBtn");
const retryBtn = document.getElementById("retryBtn");
const settingsBtn = document.getElementById("settingsBtn");

let running = false;

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  statusEl.textContent = "Error";
  retryBtn.classList.remove("hidden");
}

async function streamTranslate({ text, targetLang, model, modelPrefs, apiKey }) {
  const systemPrompt =
    "You are a translation engine. Translate the user's text into " +
    targetLang +
    ". Output only the translation. Do not add any explanation, commentary, notes, or quotation marks. Preserve the original meaning, tone, and formatting as closely as possible.";

  const requestBody = {
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  };

  if (modelPrefs?.provider) {
    requestBody.provider = {
      order: [modelPrefs.provider],
      allow_fallbacks: false,
    };
  }

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch (e) {
      // ignore parse failure
    }
    throw new Error(`HTTP ${resp.status}${detail ? ": " + detail : ""}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  function flush() {
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          result += delta;
          output.textContent = result;
          copyBtn.classList.remove("hidden");
        }
      } catch (e) {
        // Incomplete JSON split across chunks; keep buffering.
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
  flush();
  return result;
}

async function run() {
  if (running) return;
  running = true;

  errorEl.classList.add("hidden");
  retryBtn.classList.add("hidden");
  output.textContent = "";

  try {
    const { pendingTranslation, apiKey } = await browser.storage.local.get([
      "pendingTranslation",
      "apiKey",
    ]);

    if (!pendingTranslation) {
      showError("No text to translate. Select text on a page, then right-click → Translate selection.");
      return;
    }
    if (!apiKey) {
      showError("OpenRouter API key is not set. Open Settings to add one.");
      return;
    }

    const targetLang = pendingTranslation.targetLang || "English";
    const model = pendingTranslation.model || "deepseek/deepseek-v4.1-flash";
    const modelPrefs = pendingTranslation.modelPrefs || {};

    infoEl.textContent = `→ ${targetLang} · ${model}${modelPrefs?.provider ? " · " + modelPrefs.provider : ""}`;
    statusEl.textContent = "Translating…";

    const result = await streamTranslate({
      text: pendingTranslation.text,
      targetLang,
      model,
      modelPrefs,
      apiKey,
    });

    statusEl.textContent = "Done";
    if (!result) {
      showError("Empty response from the model.");
    }
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    running = false;
  }
}

copyBtn.addEventListener("click", async () => {
  const text = output.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  copyBtn.textContent = "Copied";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

retryBtn.addEventListener("click", run);
settingsBtn.addEventListener("click", () => browser.runtime.openOptionsPage());

run();