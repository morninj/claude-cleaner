(function () {
  "use strict";

  const DEFAULT_LABEL = "Delete all chats";
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

  function setStatus(text) {
    const btn = document.getElementById("claude-cleaner-btn");
    if (!btn) return;
    const span = btn.querySelector(".claude-cleaner-label");
    if (span) span.textContent = text;
  }

  function setSpinner(on) {
    const btn = document.getElementById("claude-cleaner-btn");
    if (!btn) return;
    const spinner = btn.querySelector(".claude-cleaner-spinner");
    if (spinner) spinner.style.display = on ? "inline-block" : "none";
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
    setStatus("Expanding...");

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
      setStatus("Selecting chats...");

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

  async function clickDelete() {
    let deleteBtn = document.querySelector('button[aria-label^="Delete"][aria-label*="selected"]');

    if (!deleteBtn) {
      deleteBtn =
        findButtonByAriaLabel("Delete") ||
        findButtonByAriaLabel("Delete selected") ||
        findButtonByText("Delete");
    }

    if (deleteBtn) {
      setStatus("Deleting...");
      deleteBtn.click();
    } else {
      setStatus("Delete button not found");
    }
  }

  // --- main flow ---

  async function deleteAllChats() {
    // If not on /recents, navigate there first
    if (window.location.pathname !== "/recents") {
      window.location.href = "/recents?claude-cleaner-autorun=1";
      return;
    }

    const btn = document.getElementById("claude-cleaner-btn");
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.7";
      setSpinner(true);
    }

    try {
      // Check if there are any chats
      const chatItems = document.querySelectorAll('li [data-dd-action-name="conversation-cell"]');
      if (chatItems.length === 0) {
        if (btn) {
          setSpinner(false);
          setStatus("No chats to delete");
          setTimeout(() => setStatus(DEFAULT_LABEL), 3000);
        }
        return;
      }

      // Step 1: expand all chats
      await expandAll();
      await sleep(500);

      // Step 2: select all
      setStatus("Selecting all...");

      await selectAllChats();

      // Step 3: delete
      await clickDelete();

      // Wait for chats to actually be deleted before declaring done
      const maxWait = 30000;
      const start = Date.now();
      let deleted = false;
      while (Date.now() - start < maxWait) {
        await sleep(500);
        const remaining = document.querySelectorAll('li [data-dd-action-name="conversation-cell"]');
        if (remaining.length === 0) {
          deleted = true;
          break;
        }
      }

      if (btn) {
        setSpinner(false);
        setStatus(deleted ? "Done!" : DEFAULT_LABEL);
      }
      // Refresh to clear stale UI only if chats were actually deleted
      if (deleted) {
        setTimeout(() => window.location.reload(), 1000);
      }

    } catch (err) {
      if (btn) {
        setSpinner(false);
        setStatus("Error!");
      }

      console.error("Claude Cleaner error:", err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
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
      "background:#dc2626;color:#fff;border:none;height:38px;padding:0 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:15px;position:relative;top:-4px;display:inline-flex;align-items:center;gap:8px;";
    btn.addEventListener("click", deleteAllChats);

    const spinner = document.createElement("span");
    spinner.className = "claude-cleaner-spinner";
    spinner.style.cssText =
      "display:none;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:claude-cleaner-spin 0.6s linear infinite;";

    const label = document.createElement("span");
    label.className = "claude-cleaner-label";
    label.textContent = DEFAULT_LABEL;

    btn.appendChild(spinner);
    btn.appendChild(label);

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
  if (new URLSearchParams(window.location.search).get("claude-cleaner-autorun") === "1") {
    history.replaceState(null, "", "/recents");
    setTimeout(deleteAllChats, 1500);
  }

  init();
  new MutationObserver(init).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
