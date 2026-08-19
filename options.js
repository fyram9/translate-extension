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
  { id: "openrouter/free", label: "OpenRouter Free (auto-select)" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash (cheap)" },
  { id: "deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash 0731" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B (free)" },
  { id: "__custom__", label: "Custom…" },
];

const CUSTOM_VALUE = "__custom__";

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

modelSelect.addEventListener("change", updateCustomVisibility);

async function load() {
  const saved = await browser.storage.local.get(["targetLang", "apiKey", "model"]);

  if (saved.targetLang) langSelect.value = saved.targetLang;

  apiKeyInput.value = saved.apiKey || "";

  const known = MODELS.find((m) => m.id === saved.model);
  if (known && known.id !== CUSTOM_VALUE) {
    modelSelect.value = saved.model;
  } else if (saved.model) {
    modelSelect.value = CUSTOM_VALUE;
    customModel.value = saved.model;
  } else {
    modelSelect.value = "openrouter/free";
  }
  updateCustomVisibility();
}

saveBtn.addEventListener("click", async () => {
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
  });

  savedMsg.classList.remove("hidden");
  setTimeout(() => savedMsg.classList.add("hidden"), 2000);
});

load();