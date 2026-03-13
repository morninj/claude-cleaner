(function () {
  "use strict";

  const TRASH_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink: 0;"><path d="M11.3232 1.5C11.9365 1.50011 12.4881 1.87396 12.7158 2.44336L13.3379 4H17.5L17.6006 4.00977C17.8285 4.0563 18 4.25829 18 4.5C18 4.7417 17.8285 4.94371 17.6006 4.99023L17.5 5H15.9629L15.0693 16.6152C15.0091 17.3965 14.3578 17.9999 13.5742 18H6.42578C5.6912 17.9999 5.07237 17.4697 4.94824 16.7598L4.93066 16.6152L4.03711 5H2.5C2.22387 5 2.00002 4.77613 2 4.5C2 4.22386 2.22386 4 2.5 4H6.66211L7.28418 2.44336L7.33105 2.33887C7.58152 1.82857 8.10177 1.5001 8.67676 1.5H11.3232ZM5.92773 16.5381C5.94778 16.7985 6.16464 16.9999 6.42578 17H13.5742C13.8354 16.9999 14.0522 16.7985 14.0723 16.5381L14.9609 5H5.03906L5.92773 16.5381ZM8.5 8C8.77613 8 8.99998 8.22388 9 8.5V13.5C9 13.7761 8.77614 14 8.5 14C8.22386 14 8 13.7761 8 13.5V8.5C8.00002 8.22388 8.22387 8 8.5 8ZM11.5 8C11.7761 8 12 8.22386 12 8.5V13.5C12 13.7761 11.7761 14 11.5 14C11.2239 14 11 13.7761 11 13.5V8.5C11 8.22386 11.2239 8 11.5 8ZM8.67676 2.5C8.49802 2.5001 8.33492 2.59525 8.24609 2.74609L8.21289 2.81445L7.73828 4H12.2617L11.7871 2.81445C11.7112 2.62471 11.5276 2.50011 11.3232 2.5H8.67676Z"></path></svg>';

  // --- helpers ---

  function findButtonByText(text) {
    return Array.from(document.querySelectorAll("button")).find(
      (el) => el.textContent.trim() === text
    );
  }

  function findLinkByText(text) {
    return Array.from(document.querySelectorAll("a, button")).find(
      (el) => el.textContent.trim() === text
    );
  }

  function findButtonByAriaLabel(label) {
    return document.querySelector(`button[aria-label="${label}"]`);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // --- overlay ---

  function showOverlay(text) {
    let overlay = document.getElementById("claude-cleaner-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "claude-cleaner-overlay";
      overlay.innerHTML = '<div class="claude-cleaner-overlay-icon">' + TRASH_SVG + '</div><div class="claude-cleaner-overlay-spinner"></div><div class="claude-cleaner-overlay-text"></div>';
      document.body.appendChild(overlay);
    }
    overlay.querySelector(".claude-cleaner-overlay-text").textContent = text;
    overlay.style.display = "flex";
  }

  function updateOverlay(text) {
    const overlay = document.getElementById("claude-cleaner-overlay");
    if (!overlay) return;
    overlay.querySelector(".claude-cleaner-overlay-text").textContent = text;
  }

  function hideOverlay() {
    const overlay = document.getElementById("claude-cleaner-overlay");
    if (overlay) overlay.style.display = "none";
  }

  // --- choice dialog ---

  function showChoiceDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "claude-cleaner-choice";
      overlay.innerHTML = `
        <div class="claude-cleaner-choice-box">
          <div class="claude-cleaner-choice-title">Delete chats</div>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-keep">Keep starred chats</button>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-all">Delete all including starred</button>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-cancel">Cancel</button>
        </div>`;

      const cleanup = (value) => {
        overlay.remove();
        resolve(value);
      };

      overlay.querySelector(".claude-cleaner-choice-keep").addEventListener("click", () => cleanup("keep-starred"));
      overlay.querySelector(".claude-cleaner-choice-all").addEventListener("click", () => cleanup("all"));
      overlay.querySelector(".claude-cleaner-choice-cancel").addEventListener("click", () => cleanup(null));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup(null);
      });

      document.body.appendChild(overlay);
    });
  }

  // --- sidebar / starred detection ---

  function isSidebarOpen() {
    return !!document.querySelector('button[aria-label="Close sidebar"]');
  }

  async function ensureSidebarOpen() {
    if (isSidebarOpen()) return;
    const openBtn = document.querySelector('button[aria-label="Open sidebar"]');
    if (openBtn) {
      openBtn.click();
      await sleep(1000);
    }
  }

  function readStarredFromSidebar() {
    const headings = document.querySelectorAll("h2");
    for (const h2 of headings) {
      if (h2.textContent.trim() === "Starred") {
        const ids = new Set();
        const container = h2.parentElement;
        if (container) {
          const links = container.querySelectorAll('a[href*="/chat/"]');
          for (const link of links) {
            const href = link.getAttribute("href");
            const match = href && href.match(/\/chat\/([^/?#]+)/);
            if (match) ids.add(match[1]);
          }
        }
        return ids;
      }
    }
    return null;
  }

  async function getStarredChatIds() {
    if (!isSidebarOpen()) {
      await ensureSidebarOpen();
    }
    const ids = readStarredFromSidebar();
    return ids || new Set();
  }

  // --- "Show more" expansion ---

  function clickShowMore() {
    const btn = findButtonByText("Show more");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  async function expandAll() {
    updateOverlay("Expanding...");

    while (clickShowMore()) {
      await sleep(1200);
    }
  }

  // --- selection & deletion ---

  async function selectAllChats() {
    const selectBtn = findLinkByText("Select");
    if (selectBtn) {
      selectBtn.click();
      await sleep(500);
    }

    const labels = Array.from(document.querySelectorAll("label"));
    const selectAllLabel = labels.find((label) => {
      const span = label.querySelector("span");
      return span && span.textContent.trim() === "Select all";
    });

    if (selectAllLabel) {
      selectAllLabel.click();
      await sleep(500);
    } else {
      updateOverlay("Selecting chats...");

      const chatLabels = labels.filter((label) => {
        const span = label.querySelector("span");
        return span && span.textContent.trim() === "Select chat";
      });
      for (const label of chatLabels) {
        label.click();
      }
      await sleep(500);
    }
  }

  async function selectNonStarredChats(starredIds) {
    const selectBtn = findLinkByText("Select");
    if (selectBtn) {
      selectBtn.click();
      await sleep(500);
    }

    let selectedCount = 0;
    const chatRows = document.querySelectorAll("li");

    for (const li of chatRows) {
      const link = li.querySelector('a[data-dd-action-name="conversation-cell"]');
      if (!link) continue;

      const href = link.getAttribute("href");
      const match = href && href.match(/\/chat\/([^/?#]+)/);
      if (!match) continue;

      const chatId = match[1];
      if (starredIds.has(chatId)) continue;

      const label = li.querySelector("label");
      if (label) {
        label.click();
        selectedCount++;
      }
    }

    await sleep(500);
    return selectedCount;
  }

  async function clickDelete() {
    let deleteBtn = document.querySelector('button[aria-label^="Delete"][aria-label*="selected"]');

    if (!deleteBtn) {
      deleteBtn =
        findButtonByAriaLabel("Delete") ||
        findButtonByAriaLabel("Delete selected") ||
        findButtonByText("Delete");
    }

    if (deleteBtn) {
      hideOverlay();
      deleteBtn.click();
    } else {
      updateOverlay("Delete button not found");
    }
  }

  // --- main flow ---

  async function deleteAllChats(preselectedChoice) {
    // Guard against event objects being passed as argument
    if (preselectedChoice && typeof preselectedChoice !== "string") {
      preselectedChoice = null;
    }

    // Show choice dialog unless we already have a choice (from autorun redirect)
    let choice = preselectedChoice;
    if (!choice) {
      choice = await showChoiceDialog();
      if (!choice) return;
    }

    const keepStarred = choice === "keep-starred";

    // If not on /recents, navigate there
    if (window.location.pathname !== "/recents") {
      window.location.href = "/recents?claude-cleaner-autorun=" + choice;
      return;
    }

    showOverlay("Starting...");

    try {
      // Check if there are any chats
      const chatItems = document.querySelectorAll('li [data-dd-action-name="conversation-cell"]');
      if (chatItems.length === 0) {
        updateOverlay("No chats to delete");
        setTimeout(hideOverlay, 2000);
        return;
      }

      let starredIds = new Set();

      if (keepStarred) {
        // Get starred chat IDs from sidebar before expanding
        updateOverlay("Detecting starred chats...");
        starredIds = await getStarredChatIds();
      }

      // Step 1: expand all chats
      await expandAll();
      await sleep(500);

      if (keepStarred) {
        // Step 2: select only non-starred chats
        updateOverlay("Selecting non-starred chats...");
        const selectedCount = await selectNonStarredChats(starredIds);

        if (selectedCount === 0) {
          updateOverlay("No non-starred chats to delete");
          setTimeout(hideOverlay, 2000);
          return;
        }
      } else {
        // Step 2: select all
        updateOverlay("Selecting all...");
        await selectAllChats();
      }

      // Step 3: delete (hideOverlay is called inside clickDelete before clicking)
      await clickDelete();

      // Wait for chats to actually be deleted before declaring done
      const expectedRemaining = keepStarred ? starredIds.size : 0;
      const maxWait = 30000;
      const start = Date.now();
      let deleted = false;
      while (Date.now() - start < maxWait) {
        await sleep(500);
        const remaining = document.querySelectorAll('li [data-dd-action-name="conversation-cell"]');
        if (remaining.length <= expectedRemaining) {
          deleted = true;
          break;
        }
        if (!keepStarred) {
          const zeroChatsMsg = Array.from(document.querySelectorAll("p, span, div")).find(
            (el) => /^0\s+chats?\b/.test(el.textContent.trim())
          );
          if (zeroChatsMsg) {
            deleted = true;
            break;
          }
        }
      }

      if (deleted) {
        showOverlay("Done!");
        setTimeout(() => { window.location.href = "/recents"; }, 1000);
      }

    } catch (err) {
      updateOverlay("Error!");
      setTimeout(hideOverlay, 2000);
      console.error("Claude Cleaner error:", err);
    }
  }

  // --- inject header button (only on /recents) ---

  function injectButton() {
    if (window.location.pathname !== "/recents") return;
    if (document.getElementById("claude-cleaner-btn")) return;

    const newChatLink = document.querySelector('header a[href="/new"]');
    if (!newChatLink) return;
    const headerContainer = newChatLink.parentElement;

    const btn = document.createElement("button");
    btn.id = "claude-cleaner-btn";
    btn.style.cssText =
      "background:rgb(221,83,83);color:#fff;border:none;height:38px;padding:0 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:15px;position:relative;top:-4px;display:inline-flex;align-items:center;gap:8px;";
    btn.addEventListener("click", () => deleteAllChats());
    btn.textContent = "Delete all chats";

    headerContainer.insertBefore(btn, newChatLink);
  }

  // --- inject sidebar item (all pages) ---

  function injectSidebar() {
    if (document.getElementById("claude-cleaner-sidebar")) return;

    // Find the sidebar nav item container (the div with Chats, Projects, etc.)
    const chatsLink = document.querySelector('nav[aria-label="Sidebar"] a[aria-label="Chats"]');
    if (!chatsLink) return;
    const navContainer = chatsLink.closest(".flex.flex-col.px-2");
    if (!navContainer) return;

    const wrapper = document.createElement("div");
    wrapper.id = "claude-cleaner-sidebar";
    wrapper.className = "relative group";

    const link = document.createElement("a");
    link.href = "#";
    link.setAttribute("aria-label", "Delete all chats");
    link.setAttribute("data-dd-action-name", "sidebar-nav-item");
    link.className = chatsLink.className.replace(/!bg-bg-300/g, "");
    link.style.cssText = "background:rgba(220,38,38,0.1);";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      deleteAllChats();
    });

    link.innerHTML = `
      <div class="-translate-x-2 w-full flex flex-row items-center justify-start gap-3">
        <div class="flex items-center justify-center text-text-100">
          <div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center">
            ${TRASH_SVG}
          </div>
        </div>
        <span class="truncate text-sm whitespace-nowrap flex-1">
          <div class="claude-cleaner-sidebar-label">Delete all chats</div>
        </span>
      </div>`;

    wrapper.appendChild(link);
    navContainer.appendChild(wrapper);
  }

  // --- styles ---

  function injectStyles() {
    if (document.getElementById("claude-cleaner-style")) return;
    const style = document.createElement("style");
    style.id = "claude-cleaner-style";
    style.textContent = `
      @keyframes claude-cleaner-spin{to{transform:rotate(360deg)}}
      #claude-cleaner-sidebar a:hover{background:rgba(220,38,38,0.18)!important}
      #claude-cleaner-overlay{
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.6);
        display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;
      }
      .claude-cleaner-overlay-icon{
        color:#fff;margin-bottom:4px;
      }
      .claude-cleaner-overlay-icon svg{
        width:48px;height:48px;
      }
      .claude-cleaner-overlay-spinner{
        width:32px;height:32px;
        border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;
        animation:claude-cleaner-spin 0.6s linear infinite;
      }
      .claude-cleaner-overlay-text{
        color:#fff;font-size:18px;font-weight:600;
      }
      #claude-cleaner-choice{
        position:fixed;inset:0;z-index:10000;
        background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;
      }
      .claude-cleaner-choice-box{
        background:#2a2a2a;border-radius:12px;padding:24px;
        display:flex;flex-direction:column;gap:10px;min-width:280px;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
      }
      .claude-cleaner-choice-title{
        color:#fff;font-size:18px;font-weight:600;text-align:center;margin-bottom:6px;
      }
      .claude-cleaner-choice-btn{
        padding:10px 16px;border-radius:8px;border:none;
        font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.15s;
      }
      .claude-cleaner-choice-btn:hover{opacity:0.85}
      .claude-cleaner-choice-keep{
        background:rgb(221,83,83);color:#fff;
      }
      .claude-cleaner-choice-all{
        background:rgb(221,83,83);color:#fff;
      }
      .claude-cleaner-choice-cancel{
        background:transparent;color:#999;border:1px solid #444;
      }
      .claude-cleaner-choice-cancel:hover{color:#ccc;border-color:#666}
    `;
    document.head.appendChild(style);
  }

  // --- init ---

  function init() {
    injectStyles();
    injectButton();
    injectSidebar();
  }

  // Auto-run if redirected from another page
  const autorunParam = new URLSearchParams(window.location.search).get("claude-cleaner-autorun");
  if (autorunParam === "keep-starred" || autorunParam === "all") {
    history.replaceState(null, "", "/recents");
    setTimeout(() => deleteAllChats(autorunParam), 1500);
  } else if (autorunParam === "1") {
    // Legacy support
    history.replaceState(null, "", "/recents");
    setTimeout(() => deleteAllChats("keep-starred"), 1500);
  }

  init();
  new MutationObserver(init).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
