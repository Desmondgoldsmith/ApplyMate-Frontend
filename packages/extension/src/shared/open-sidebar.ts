/** Open the extension side panel — must run synchronously in the user-gesture handler chain. */

const SIDE_PANEL_PATH = 'src/sidebar/index.html';

/** Register panel path for a tab (call on navigation so open() works from content scripts). */
export function ensureSidePanelForTab(tabId: number): void {
  try {
    void chrome.sidePanel.setOptions({
      tabId,
      path: SIDE_PANEL_PATH,
      enabled: true,
    });
  } catch {
    void chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true });
  }
}

function tryOpenSidePanel(tabId: number | undefined, windowId: number | undefined): void {
  if (tabId != null) {
    ensureSidePanelForTab(tabId);
    try {
      void chrome.sidePanel.open({ tabId });
      return;
    } catch {
      /* fall through */
    }
  }
  if (windowId != null) {
    try {
      void chrome.sidePanel.open({ windowId });
    } catch {
      /* ignore */
    }
  }
}

export function openSidebarForTab(tab: chrome.tabs.Tab): void {
  tryOpenSidePanel(tab.id, tab.windowId);
}

export function openSidebarFromSender(sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId != null || windowId != null) {
    tryOpenSidePanel(tabId, windowId);
    return;
  }
  chrome.windows.getLastFocused((win) => {
    if (win?.id != null) tryOpenSidePanel(undefined, win.id);
  });
}

export function configureSidePanel(): void {
  void chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true });
  if (chrome.sidePanel.setPanelBehavior) {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
}
