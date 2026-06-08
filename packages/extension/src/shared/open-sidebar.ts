/** Open the extension side panel — must run synchronously in the user-gesture handler chain. */

export function openSidebarForTab(tab: chrome.tabs.Tab): void {
  if (tab.id != null) {
    void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
      if (tab.windowId != null) {
        void chrome.sidePanel.open({ windowId: tab.windowId });
      }
    });
    return;
  }
  if (tab.windowId != null) {
    void chrome.sidePanel.open({ windowId: tab.windowId });
  }
}

export function openSidebarFromSender(sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId != null) {
    void chrome.sidePanel.open({ tabId }).catch(() => {
      if (windowId != null) void chrome.sidePanel.open({ windowId });
    });
    return;
  }
  if (windowId != null) {
    void chrome.sidePanel.open({ windowId });
    return;
  }
  chrome.windows.getLastFocused((win) => {
    if (win?.id != null) void chrome.sidePanel.open({ windowId: win.id });
  });
}

export function configureSidePanel(): void {
  void chrome.sidePanel.setOptions({ enabled: true });
  if (chrome.sidePanel.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}
