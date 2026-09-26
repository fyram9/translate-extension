const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOKENS = 30000;
const SINGLE_REQUEST_LIMIT = 30000;
const CHUNK_MAX_LEN = 10000;

const output = document.getElementById("output");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info");
const finishInfoEl = document.getElementById("finishInfo");
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

function setFinishReason(reason) {
  if (!reason) return;
  finishInfoEl.textContent = "finish: " + reason;
  finishInfoEl.classList.remove("hidden");
}

const systemPromptFor = (targetLang) =>
  "You are a translation engine. Translate the user's text into " +
  targetLang +
  ". Output only the translation. Do not add any explanation, commentary, notes, or quotation marks. Preserve the original meaning, tone, and formatting as closely as possible.";

async function requestTranslation({ messages, model, modelPrefs, apiKey, onText }) {
  const requestBody = {
    model,
    stream: true,
    max_tokens: MAX_TOKENS,
    messages,
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
  let finishReason = null;
  let streamError = null;

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
        if (json?.error) {
          streamError = json.error?.message || JSON.stringify(json.error);
          continue;
        }
        const choice = json?.choices?.[0];
        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          result += delta;
          onText(result);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
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
    if (streamError) {
      try {
        await reader.cancel();
      } catch (e) {
        // ignore cancel failure
      }
      break;
    }
  }
  if (!streamError) {
    buffer += decoder.decode();
    flush();
  }

  if (streamError) {
    throw new Error(`Stream error: ${streamError}`);
  }

  return { result, finishReason };
}

const SENTENCE_BREAK_CHARS = new Set([".", "!", "?", "。", "！", "？", "…", "\n"]);
const CLOSING_CHARS = new Set([
  '"', "'", "”", "’", "」", "』", "）", ")", "]", "›", "»",
]);

function splitIntoSentences(text) {
  const sentences = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    if (!SENTENCE_BREAK_CHARS.has(text[i])) {
      i++;
      continue;
    }
    let end = i + 1;
    while (end < text.length && CLOSING_CHARS.has(text[end])) {
      end++;
    }
    sentences.push(text.slice(start, end));
    start = end;
    i = end;
  }
  if (start < text.length) {
    sentences.push(text.slice(start));
  }
  return sentences;
}

function splitOversized(sentence, maxLen) {
  const parts = [];
  let start = 0;
  while (sentence.length - start > maxLen) {
    const window = sentence.slice(start, start + maxLen + 1);
    let cut = -1;
    for (const re of [/[,;:、，；：]\s*/g, /[ \t]+/g]) {
      let m;
      let last = -1;
      while ((m = re.exec(window)) !== null) {
        const end = m.index + m[0].length;
        if (end <= maxLen) last = end;
      }
      if (last > 0) {
        cut = last;
        break;
      }
    }
    if (cut <= 0) {
      cut = maxLen;
    }
    parts.push(sentence.slice(start, start + cut));
    start += cut;
  }
  if (start < sentence.length) {
    parts.push(sentence.slice(start));
  }
  return parts;
}

function buildChunks(text) {
  if (text.length <= SINGLE_REQUEST_LIMIT) {
    return [text];
  }
  const chunks = [];
  let current = "";
  for (const sentence of splitIntoSentences(text)) {
    const pieces =
      sentence.length > CHUNK_MAX_LEN
        ? splitOversized(sentence, CHUNK_MAX_LEN)
        : [sentence];
    for (const piece of pieces) {
      if (current && current.length + piece.length > CHUNK_MAX_LEN) {
        chunks.push(current);
        current = "";
      }
      current += piece;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

async function run() {
  if (running) return;
  running = true;

  errorEl.classList.add("hidden");
  retryBtn.classList.add("hidden");
  output.textContent = "";
  finishInfoEl.classList.add("hidden");
  finishInfoEl.textContent = "";

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
    const text = pendingTranslation.text;

    infoEl.textContent = `→ ${targetLang} · ${model}${modelPrefs?.provider ? " · " + modelPrefs.provider : ""}`;

    const chunks = buildChunks(text);
    const systemPrompt = systemPromptFor(targetLang);
    const translations = [];
    let fullResult = "";

    for (let i = 0; i < chunks.length; i++) {
      const messages = [{ role: "system", content: systemPrompt }];
      for (let j = 0; j < i; j++) {
        messages.push({ role: "user", content: chunks[j] });
        messages.push({ role: "assistant", content: translations[j] });
      }
      messages.push({ role: "user", content: chunks[i] });

      statusEl.textContent =
        chunks.length > 1
          ? `Translating… (${i + 1}/${chunks.length})`
          : "Translating…";

      const { result, finishReason } = await requestTranslation({
        messages,
        model,
        modelPrefs,
        apiKey,
        onText: (partial) => {
          output.textContent = fullResult + partial;
          copyBtn.classList.remove("hidden");
        },
      });

      translations.push(result);
      fullResult += result;
      setFinishReason(finishReason);
    }

    statusEl.textContent = "Done";
    if (!fullResult) {
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
