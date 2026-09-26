const MENU_ID = "ai-translate-selection";

function createContextMenu() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Translate selection",
      contexts: ["selection"],
    });
  });
}

browser.runtime.onInstalled.addListener(createContextMenu);

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const text = (info.selectionText || "").trim();
  if (!text) return;

  browser.storage.local
    .get(["targetLang", "model", "apiKey", "modelPrefs"])
    .then((settings) => {
      if (!settings.apiKey) {
        browser.runtime.openOptionsPage();
        return;
      }

      return browser.storage.local.set({
        pendingTranslation: {
          text,
          targetLang: settings.targetLang || "English",
          model: settings.model || "deepseek/deepseek-v4.1-flash",
          modelPrefs: settings.modelPrefs || {},
        },
      }).then(() => {
      return browser.windows.create({
        url: browser.runtime.getURL("translate.html"),
        type: "popup",
        width: 460,
        height: 460,
      });
    });
  });
});