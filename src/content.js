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

  // --- interface / page detection ---
  //
  // Claude is rolling out a redesign gradually. The older interface lives at
  // /recents and labels favourite chats "Starred"; the newer one lives at
  // /chats and labels them "Pinned". Both must keep working, so anything that
  // depends on a specific URL or label is handled through these helpers.

  const CHAT_LIST_PATHS = ["/chats", "/recents"];

  function onChatListPage() {
    return CHAT_LIST_PATHS.includes(window.location.pathname);
  }

  function isNewInterface() {
    return (
      !!document.querySelector("[data-sidebar-group-label]") ||
      !!document.querySelector("button[data-row-main-button]") ||
      !!document.querySelector('header[data-testid="page-header"]')
    );
  }

  // Where the full, selectable chat list lives on the active interface.
  function chatListPath() {
    return isNewInterface() ? "/chats" : "/recents";
  }

  // The word Claude currently uses for favourited chats.
  function pinnedTerm() {
    return isNewInterface() ? "pinned" : "starred";
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

  // Prominent, reassuring message shown once Claude actually starts deleting.
  // Bulk deletion can take a long time and occasionally stalls, so we tell the
  // user to sit tight and how to recover if it looks stuck.
  function showDeletionUnderway() {
    showOverlay("");
    const overlay = document.getElementById("claude-cleaner-overlay");
    if (!overlay) return;
    overlay.querySelector(".claude-cleaner-overlay-text").innerHTML =
      'Deletion is underway&hellip;' +
      '<div class="claude-cleaner-overlay-sub">' +
      '<p>This can take a while. Please be patient and keep this tab open.</p>' +
      '<p>If it looks frozen, refresh the page and click &ldquo;Delete all chats&rdquo; again to pick up where it left off.</p>' +
      '</div>';
  }

  // --- choice dialog ---

  function showChoiceDialog() {
    return new Promise((resolve) => {
      const term = pinnedTerm();
      const overlay = document.createElement("div");
      overlay.id = "claude-cleaner-choice";
      overlay.innerHTML = `
        <div class="claude-cleaner-choice-box">
          <div class="claude-cleaner-choice-title">Delete chats</div>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-keep">Keep ${term} chats</button>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-all">Delete all including ${term}</button>
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

  // --- post-deletion feedback ---

  const REVIEW_URL =
    "https://chromewebstore.google.com/detail/claude-cleaner/bphidkhnddpnpnmmbiignjmddficacpi/reviews?hl=en";
  const FEEDBACK_EMAIL = "joe@mornin.org";
  const FEEDBACK_OPTOUT_KEY = "claude-cleaner-no-feedback";

  function feedbackOptedOut() {
    try {
      return localStorage.getItem(FEEDBACK_OPTOUT_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setFeedbackOptOut() {
    try {
      localStorage.setItem(FEEDBACK_OPTOUT_KEY, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function showFeedbackDialog() {
    if (feedbackOptedOut()) return;
    if (document.getElementById("claude-cleaner-feedback")) return;

    const overlay = document.createElement("div");
    overlay.id = "claude-cleaner-feedback";
    const close = () => overlay.remove();

    const renderAsk = () => {
      overlay.innerHTML = `
        <div class="claude-cleaner-choice-box">
          <div class="claude-cleaner-choice-title">Did Claude Cleaner work well?</div>
          <button class="claude-cleaner-choice-btn claude-cleaner-fb-yes">Yes, it worked</button>
          <button class="claude-cleaner-choice-btn claude-cleaner-fb-no">Not really</button>
          <a href="#" class="claude-cleaner-fb-dismiss">Don't ask again</a>
        </div>`;
      overlay.querySelector(".claude-cleaner-fb-yes").addEventListener("click", renderYes);
      overlay.querySelector(".claude-cleaner-fb-no").addEventListener("click", renderNo);
      overlay.querySelector(".claude-cleaner-fb-dismiss").addEventListener("click", (e) => {
        e.preventDefault();
        setFeedbackOptOut();
        close();
      });
    };

    const renderYes = () => {
      overlay.innerHTML = `
        <div class="claude-cleaner-choice-box">
          <div class="claude-cleaner-choice-title">Glad to hear it! 🎉</div>
          <div class="claude-cleaner-fb-text">A quick review on the Chrome Web Store really helps.</div>
          <a class="claude-cleaner-choice-btn claude-cleaner-fb-primary" href="${REVIEW_URL}" target="_blank" rel="noopener noreferrer">Leave a review</a>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-cancel claude-cleaner-fb-close">No thanks</button>
        </div>`;
      overlay.querySelector(".claude-cleaner-fb-primary").addEventListener("click", () => setTimeout(close, 150));
      overlay.querySelector(".claude-cleaner-fb-close").addEventListener("click", close);
    };

    const renderNo = () => {
      const mailto =
        "mailto:" + FEEDBACK_EMAIL + "?subject=" + encodeURIComponent("Claude Cleaner feedback");
      overlay.innerHTML = `
        <div class="claude-cleaner-choice-box">
          <div class="claude-cleaner-choice-title">Sorry about that.</div>
          <div class="claude-cleaner-fb-text">Tell me what went wrong and I'll try to fix it.</div>
          <a class="claude-cleaner-choice-btn claude-cleaner-fb-primary" href="${mailto}">Send feedback</a>
          <button class="claude-cleaner-choice-btn claude-cleaner-choice-cancel claude-cleaner-fb-close">Close</button>
        </div>`;
      overlay.querySelector(".claude-cleaner-fb-primary").addEventListener("click", () => setTimeout(close, 150));
      overlay.querySelector(".claude-cleaner-fb-close").addEventListener("click", close);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    renderAsk();
    document.body.appendChild(overlay);
  }

  // After the user confirms the native dialog, watch the list. Once chats
  // actually start disappearing we show a prominent "deletion underway" notice
  // (bulk deletes are slow and can stall); once the list settles at the
  // expected size we hide it and ask for feedback. If the user cancels the
  // native dialog or navigates away, this quietly times out — and because the
  // notice only appears after deletion has visibly begun, it never blocks the
  // native confirmation dialog.
  async function watchForDeletion(initialCount, expectedRemaining) {
    const maxWait = 15 * 60 * 1000;
    const start = Date.now();
    let underwayShown = false;

    while (Date.now() - start < maxWait) {
      await sleep(700);

      // User left the list page — stop watching and clean up our overlay.
      if (!onChatListPage()) {
        if (underwayShown) hideOverlay();
        return;
      }

      const count = getChatItemCount();

      if (!underwayShown && count < initialCount) {
        showDeletionUnderway();
        underwayShown = true;
      }

      if (underwayShown && count <= expectedRemaining) {
        // Let the list settle, then confirm it really stuck before finishing.
        await sleep(1200);
        if (getChatItemCount() <= expectedRemaining) {
          hideOverlay();
          showFeedbackDialog();
          return;
        }
      }
    }

    if (underwayShown) hideOverlay();
  }

  // --- sidebar / starred detection ---

  function isSidebarOpen() {
    // Newer interface uses "Collapse sidebar"; older uses "Close sidebar". As a
    // fallback, the presence of a rendered section label means the sidebar's
    // chat lists are expanded and readable regardless of the toggle's wording.
    return (
      !!document.querySelector(
        'button[aria-label="Close sidebar"], button[aria-label="Collapse sidebar"]'
      ) || !!document.querySelector("[data-sidebar-group-label]")
    );
  }

  async function ensureSidebarOpen() {
    if (isSidebarOpen()) return;
    const openBtn = document.querySelector(
      'button[aria-label="Open sidebar"], button[aria-label="Expand sidebar"]'
    );
    if (openBtn) {
      openBtn.click();
      await sleep(1000);
    }
  }

  // True when the sidebar's chat sections are actually rendered, so we can tell
  // "no pinned chats exist" apart from "the sidebar isn't readable yet". This
  // guards keep-pinned mode against deleting favourites we simply couldn't see.
  function sidebarChatSectionsReadable() {
    if (document.querySelector("[data-sidebar-group-label]")) return true;
    const SECTIONS = new Set(["Recents", "Starred", "Pinned"]);
    return Array.from(document.querySelectorAll("h2, h3")).some((h) =>
      SECTIONS.has(headingText(h))
    );
  }

  function headingText(h) {
    // Prefer the inner label span (the h2/h3's textContent may include hidden
    // glyph characters from icon fonts that break exact-text matches).
    const label = h.querySelector("span.truncate") || h.querySelector("span") || h;
    return label.textContent.trim();
  }

  function findStarredHeading() {
    // Newer interface: collapsible section label in [data-sidebar-group-label]
    // reading "Pinned". Older interface: an <h2>/<h3> reading "Starred". Match
    // either, and accept either label on either interface for resilience.
    const NAMES = new Set(["Pinned", "Starred"]);
    const candidates = document.querySelectorAll(
      "[data-sidebar-group-label], h2, h3"
    );
    for (const el of candidates) {
      if (NAMES.has(headingText(el))) return el;
    }
    return null;
  }

  function readStarredFromSidebar() {
    const heading = findStarredHeading();
    if (!heading) return null;

    // Walk up from the heading to the section wrapper that holds the starred
    // chat links (the heading and its <ul> of links live in the same section
    // div). Stop at the first ancestor containing chat links so we capture the
    // Starred section only, not the whole sidebar nav (which also holds
    // Recents). Bail before reaching nav/body.
    let container = heading.parentElement;
    while (container) {
      if (container.tagName === "NAV" || container.tagName === "BODY") {
        container = null;
        break;
      }
      if (container.querySelector('a[href*="/chat/"]')) break;
      container = container.parentElement;
    }

    const ids = new Set();
    if (container) {
      for (const link of container.querySelectorAll('a[href*="/chat/"]')) {
        const href = link.getAttribute("href");
        const match = href && href.match(/\/chat\/([^/?#]+)/);
        if (match) ids.add(match[1]);
      }
    }
    return ids;
  }

  // Returns the set of pinned/starred chat IDs, an empty set when there
  // genuinely are none, or null when the sidebar can't be read (so callers can
  // refuse to delete rather than risk wiping favourites they couldn't detect).
  async function getStarredChatIds() {
    if (!isSidebarOpen()) {
      await ensureSidebarOpen();
    }
    if (!sidebarChatSectionsReadable()) return null;
    const ids = readStarredFromSidebar();
    // Sections are readable but there's no Pinned/Starred section => none exist.
    return ids || new Set();
  }

  // --- chat row helpers ---

  function getChatRows() {
    return Array.from(document.querySelectorAll("tr")).filter((tr) =>
      tr.querySelector('a[data-primary="true"][href*="/chat/"]')
    );
  }

  function getChatLink(row) {
    return row.querySelector('a[data-primary="true"][href*="/chat/"]');
  }

  function getRowCheckbox(row) {
    return row.querySelector('[role="checkbox"]');
  }

  function getChatItemCount() {
    return document.querySelectorAll('a[data-primary="true"][href*="/chat/"]').length;
  }

  // --- "Show more" / scroll expansion ---

  function clickShowMore() {
    const btn = findButtonByText("Show more");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  async function scrollLoadMore() {
    const before = getChatItemCount();
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(800);
    return getChatItemCount() > before;
  }

  async function expandAll() {
    updateOverlay("Expanding...");

    while (true) {
      if (clickShowMore()) {
        await sleep(1200);
        continue;
      }
      const loadedMore = await scrollLoadMore();
      if (!loadedMore) break;
    }
  }

  // --- selection & deletion ---

  async function enterSelectionMode() {
    const selectBtn = findLinkByText("Select chats") || findLinkByText("Select");
    if (selectBtn) {
      selectBtn.click();
      await sleep(500);
    }
  }

  async function selectAllChats() {
    await enterSelectionMode();

    const selectAllBtn = findLinkByText("Select all");
    if (selectAllBtn) {
      selectAllBtn.click();
      await sleep(500);
      return;
    }

    updateOverlay("Selecting chats...");
    for (const row of getChatRows()) {
      const cb = getRowCheckbox(row);
      if (cb && cb.getAttribute("aria-checked") !== "true") {
        cb.click();
      }
    }
    await sleep(500);
  }

  async function selectNonStarredChats(starredIds) {
    await enterSelectionMode();

    let selectedCount = 0;
    for (const row of getChatRows()) {
      const link = getChatLink(row);
      if (!link) continue;

      const href = link.getAttribute("href");
      const match = href && href.match(/\/chat\/([^/?#]+)/);
      if (!match) continue;

      const chatId = match[1];
      if (starredIds.has(chatId)) continue;

      const cb = getRowCheckbox(row);
      if (cb && cb.getAttribute("aria-checked") !== "true") {
        cb.click();
        selectedCount++;
      }
    }

    await sleep(500);
    return selectedCount;
  }

  function findToolbarDeleteButton() {
    return (
      document.querySelector('button[aria-label^="Delete"][aria-label*="selected"]') ||
      findButtonByText("Delete") ||
      null
    );
  }

  // Open Claude's native delete confirmation for the current selection, then
  // hand off to the user. The extension does the tedious part (expanding and
  // selecting the right chats) but the actual destructive confirmation is left
  // for the user to click.
  async function deleteSelected() {
    const toolbarDelete = findToolbarDeleteButton();
    if (!toolbarDelete) {
      updateOverlay("Delete button not found");
      await sleep(2000);
      return false;
    }
    // Reveal the native confirmation dialog and step out of the way.
    hideOverlay();
    toolbarDelete.click();
    return true;
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
    const term = pinnedTerm();

    // If not on the chat-list page, navigate to it (the right URL depends on
    // which interface is active) and let the autorun handler resume there.
    if (!onChatListPage()) {
      window.location.href = chatListPath() + "?claude-cleaner-autorun=" + choice;
      return;
    }

    showOverlay("Starting...");

    try {
      // Check if there are any chats
      if (getChatItemCount() === 0) {
        updateOverlay("No chats to delete");
        setTimeout(hideOverlay, 2000);
        return;
      }

      let starredIds = new Set();

      if (keepStarred) {
        // Get pinned/starred chat IDs from the sidebar before expanding.
        updateOverlay("Detecting " + term + " chats...");
        starredIds = await getStarredChatIds();

        // Bail out rather than risk deleting favourites we couldn't detect.
        if (starredIds === null) {
          updateOverlay(
            "Couldn't read your " + term + " chats. Open the sidebar, then try again."
          );
          setTimeout(hideOverlay, 4000);
          return;
        }
      }

      // Step 1: expand all chats
      await expandAll();
      await sleep(500);

      if (keepStarred) {
        // Step 2: select only the chats that aren't pinned/starred.
        updateOverlay("Selecting chats to delete...");
        const selectedCount = await selectNonStarredChats(starredIds);

        if (selectedCount === 0) {
          updateOverlay("No chats to delete (all are " + term + ")");
          setTimeout(hideOverlay, 2000);
          return;
        }
      } else {
        // Step 2: select all
        updateOverlay("Selecting all...");
        await selectAllChats();
      }

      // Record how many chats exist right before deletion so the watcher can
      // tell when the list actually starts shrinking.
      const initialCount = getChatItemCount();

      // Step 3: open Claude's native confirmation and hand off to the user,
      // who confirms the deletion themselves.
      await deleteSelected();

      // Step 4: show the "deletion underway" notice as chats disappear, then
      // ask for feedback once the list settles.
      const expectedRemaining = keepStarred ? starredIds.size : 0;
      await watchForDeletion(initialCount, expectedRemaining);

    } catch (err) {
      updateOverlay("Error!");
      setTimeout(hideOverlay, 2000);
      console.error("Claude Cleaner error:", err);
    }
  }

  // --- inject header button (only on the chat-list page) ---

  function injectButton() {
    if (!onChatListPage()) return;
    if (document.getElementById("claude-cleaner-btn")) return;

    const newChatLink = document.querySelector('header a[href="/new"]');
    if (!newChatLink) return;
    const headerContainer = newChatLink.parentElement;

    // Clone the structure of a sibling text button (e.g., "Select") so we
    // inherit Claude's current sizing, font, and layout classes. Skip the New
    // link and any icon-only square buttons (search), whose cramped shape would
    // make our labelled button look wrong.
    const templates = headerContainer.querySelectorAll(
      'button[data-cds="Button"], a[data-cds="Button"]'
    );
    const template = Array.from(templates).find(
      (el) =>
        el !== newChatLink &&
        el.textContent.trim() !== "" &&
        !el.className.includes("aspect-square")
    );

    const btn = document.createElement("button");
    btn.id = "claude-cleaner-btn";
    btn.type = "button";

    if (template) {
      btn.setAttribute("data-cds", "Button");
      btn.className = template.className;

      const templateBg = template.querySelector('span[aria-hidden="true"]');
      const bgSpan = document.createElement("span");
      bgSpan.setAttribute("aria-hidden", "true");
      if (templateBg) bgSpan.className = templateBg.className;
      btn.appendChild(bgSpan);

      const contentSpan = document.createElement("span");
      contentSpan.className = "inline-flex items-center gap-1";
      contentSpan.textContent = "Delete all chats";
      btn.appendChild(contentSpan);
    } else {
      // Fallback if no sibling button is found
      btn.style.cssText =
        "background:rgb(221,83,83);color:#fff;border:none;height:36px;padding:0 14px;border-radius:6px;font-family:inherit;font-size:14px;font-weight:510;cursor:pointer;display:inline-flex;align-items:center;gap:4px;";
      btn.textContent = "Delete all chats";
    }

    btn.addEventListener("click", () => deleteAllChats());
    headerContainer.insertBefore(btn, newChatLink);
  }

  // --- inject sidebar item (all pages) ---

  function injectSidebar() {
    if (document.getElementById("claude-cleaner-sidebar")) return;

    const sidebar = document.querySelector(
      'nav[aria-label="Sidebar"], [aria-label="Sidebar"]'
    );
    if (!sidebar) return;

    if (injectSidebarNew(sidebar)) return;
    injectSidebarOld(sidebar);
  }

  // Locate a top-level sidebar nav item (New, Chats, Projects...) by its label
  // in the newer interface, where each is a <button data-row-main-button>.
  function findSidebarNavButton(sidebar, label) {
    const buttons = sidebar.querySelectorAll("button[data-row-main-button]");
    for (const b of buttons) {
      const span = b.querySelector("span.truncate, span.min-w-0.truncate");
      if (span && span.textContent.trim() === label) return b;
    }
    return null;
  }

  // Newer interface: clone the "Chats" nav button so we inherit its row styling,
  // then drop a "Delete all chats" button in right after it.
  function injectSidebarNew(sidebar) {
    const chatsBtn = findSidebarNavButton(sidebar, "Chats");
    if (!chatsBtn) return false;

    const btn = document.createElement("button");
    btn.id = "claude-cleaner-sidebar";
    btn.type = "button";
    btn.className = chatsBtn.className;
    btn.setAttribute("aria-label", "Delete all chats");
    btn.innerHTML = `
      <span class="df-leading-slot">
        <span class="claude-cleaner-sidebar-icon flex items-center justify-center">${TRASH_SVG}</span>
      </span>
      <span class="flex min-w-0 flex-1 items-center">
        <span class="min-w-0 truncate">Delete all chats</span>
      </span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      deleteAllChats();
    });

    chatsBtn.after(btn);
    return true;
  }

  // Older interface: the nav items are <a aria-label="..."> inside a
  // .flex.flex-col.px-2 container; append a matching link.
  function injectSidebarOld(sidebar) {
    const chatsLink = sidebar.querySelector('a[aria-label="Chats"]');
    if (!chatsLink) return false;
    const navContainer = chatsLink.closest(".flex.flex-col.px-2");
    if (!navContainer) return false;

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
          ${TRASH_SVG}
        </div>
        <span class="truncate text-sm whitespace-nowrap flex-1">
          <div class="claude-cleaner-sidebar-label">Delete all chats</div>
        </span>
      </div>`;

    wrapper.appendChild(link);
    navContainer.appendChild(wrapper);
    return true;
  }

  // --- styles ---

  function injectStyles() {
    if (document.getElementById("claude-cleaner-style")) return;
    const style = document.createElement("style");
    style.id = "claude-cleaner-style";
    style.textContent = `
      @keyframes claude-cleaner-spin{to{transform:rotate(360deg)}}
      #claude-cleaner-btn{color:#fff!important}
      #claude-cleaner-btn > span[aria-hidden="true"]{background:rgb(221,83,83)!important;box-shadow:none!important}
      #claude-cleaner-btn:hover > span[aria-hidden="true"]{background:rgb(200,70,70)!important}
      #claude-cleaner-sidebar a:hover{background:rgba(220,38,38,0.18)!important}
      #claude-cleaner-overlay{
        position:fixed;inset:0;z-index:2147483647;
        background:rgba(15,15,15,0.97);
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
        max-width:440px;text-align:center;line-height:1.4;padding:0 24px;
      }
      .claude-cleaner-overlay-sub{
        color:#bbb;font-size:14px;font-weight:400;line-height:1.5;margin-top:14px;
      }
      .claude-cleaner-overlay-sub p{
        margin:0 0 10px;
      }
      .claude-cleaner-overlay-sub p:last-child{
        margin-bottom:0;
      }
      #claude-cleaner-sidebar .claude-cleaner-sidebar-icon{
        color:rgb(221,83,83);
      }
      #claude-cleaner-sidebar .claude-cleaner-sidebar-icon svg{
        width:18px;height:18px;
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
      #claude-cleaner-feedback{
        position:fixed;inset:0;z-index:2147483647;
        background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;
      }
      .claude-cleaner-fb-text{
        color:#bbb;font-size:13px;line-height:1.4;text-align:center;margin-bottom:4px;
      }
      .claude-cleaner-fb-primary{
        background:rgb(221,83,83);color:#fff;text-align:center;text-decoration:none;display:block;
      }
      .claude-cleaner-fb-yes{
        background:rgb(221,83,83);color:#fff;
      }
      .claude-cleaner-fb-no{
        background:#3a3a3a;color:#eee;
      }
      .claude-cleaner-fb-dismiss{
        color:#888;font-size:12px;text-align:center;text-decoration:none;margin-top:4px;
      }
      .claude-cleaner-fb-dismiss:hover{color:#aaa;text-decoration:underline}
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
    history.replaceState(null, "", window.location.pathname);
    setTimeout(() => deleteAllChats(autorunParam), 1500);
  } else if (autorunParam === "1") {
    // Legacy support
    history.replaceState(null, "", window.location.pathname);
    setTimeout(() => deleteAllChats("keep-starred"), 1500);
  }

  init();
  new MutationObserver(init).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
