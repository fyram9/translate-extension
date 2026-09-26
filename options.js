const LANGUAGES = [
  "English",
  "Indonesian",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Russian",
  "Arabic",
  "Hindi",
  "Thai",
  "Vietnamese",
  "Malay",
  "Turkish",
  "Polish",
];

const MODELS = [
  { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", provider: "deepseek" },
  { id: "xiaomi/mimo-v2.6-flash", label: "MiMo 2.6 Flash (Xiaomi)", provider: "xiaomi" },
  { id: "qwen/qwen3.7-flash", label: "Qwen 3.7 Flash (Alibaba Cloud)", provider: "alibaba" },
  { id: "__custom__", label: "Custom…" },
];

const CUSTOM_VALUE = "__custom__";

const modelPrefs = new Map();

const langSelect = document.getElementById("targetLang");
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const customModel = document.getElementById("customModel");
const saveBtn = document.getElementById("saveBtn");
const savedMsg = document.getElementById("savedMsg");

for (const lang of LANGUAGES) {
  const opt = document.createElement("option");
  opt.value = lang;
  opt.textContent = lang;
  langSelect.appendChild(opt);
}

for (const m of MODELS) {
  const opt = document.createElement("option");
  opt.value = m.id;
  opt.textContent = m.label;
  modelSelect.appendChild(opt);
}

function updateCustomVisibility() {
  customModel.classList.toggle("hidden", modelSelect.value !== CUSTOM_VALUE);
}

modelSelect.addEventListener("change", () => {
  const meta = MODELS.find((m) => m.id === modelSelect.value);
  if (meta?.provider) modelPrefs.set(modelSelect.value, { provider: meta.provider });
  updateCustomVisibility();
});

async function load() {
  const saved = await browser.storage.local.get([
    "targetLang",
    "apiKey",
    "model",
    "modelPrefs",
  ]);

  if (saved.targetLang) langSelect.value = saved.targetLang;

  apiKeyInput.value = saved.apiKey || "";

  for (const [id, pref] of Object.entries(saved.modelPrefs || {})) {
    modelPrefs.set(id, pref);
  }

  const savedMeta = MODELS.find((m) => m.id === saved.model);
  if (savedMeta) {
    modelSelect.value = savedMeta.id;
    modelPrefs.set(savedMeta.id, { provider: savedMeta.provider });
  } else if (saved.model) {
    modelSelect.value = CUSTOM_VALUE;
    customModel.value = saved.model;
  } else {
    modelSelect.value = MODELS[0].id;
  }
  updateCustomVisibility();
}

saveBtn.addEventListener("click", async () => {
  const meta = MODELS.find((m) => m.id === modelSelect.value);
  if (meta?.provider) modelPrefs.set(meta.id, { provider: meta.provider });
  const model =
    modelSelect.value === CUSTOM_VALUE ? customModel.value.trim() : modelSelect.value;

  if (!model) {
    alert("Please enter a model ID, or choose a preset.");
    customModel.focus();
    return;
  }

  await browser.storage.local.set({
    targetLang: langSelect.value,
    apiKey: apiKeyInput.value.trim(),
    model,
    modelPrefs: Object.fromEntries(modelPrefs),
  });

  savedMsg.classList.remove("hidden");
  setTimeout(() => savedMsg.classList.add("hidden"), 2000);
});

load();