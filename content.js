(function () {
  const BLOCK_JSON_URL =
    "https://raw.githubusercontent.com/giamat13/removing_bad_trends_and_curses_chrome_extension/refs/heads/main/block.json";

  const fontUrl = chrome.runtime.getURL("tetrasaim.otf");

  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "Tetrasaim";
      src: url("${fontUrl}") format("opentype");
    }
    .tetrasaim-num {
      font-family: "Tetrasaim" !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  const inputStyle = document.createElement("style");
  inputStyle.textContent = `
    input, textarea, [contenteditable] {
      font-family: "Tetrasaim", sans-serif !important;
    }
  `;
  (document.head || document.documentElement).appendChild(inputStyle);

  // ── Numbers font wrapping ────────────────────────────────────────────────────

  const NUMBERS_RE = /[0-9\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070\u2074-\u2079\u2080-\u2089\u2150-\u218B]+/g;
  const SKIP_TAGS  = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS", "IFRAME"]);

  function wrapTextNode(textNode) {
    try {
      const text = textNode.nodeValue;
      if (!NUMBERS_RE.test(text)) return;
      NUMBERS_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0, match;

      while ((match = NUMBERS_RE.exec(text)) !== null) {
        if (match.index > lastIndex)
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const span = document.createElement("span");
        span.className = "tetrasaim-num";
        span.textContent = match[0];
        frag.appendChild(span);
        lastIndex = NUMBERS_RE.lastIndex;
      }

      if (lastIndex < text.length)
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));

      if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    } catch (e) {}
  }

  function processNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.classList && parent.classList.contains("tetrasaim-num")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(wrapTextNode);
  }

  // ── Bad Trends Replacement ───────────────────────────────────────────────────

  let replacements = [];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applyReplacements(text) {
    if (!replacements.length) return text;
    for (const { pattern, replacement, regex } of replacements) {
      try {
        const re = regex
          ? new RegExp(pattern, "gi")
          : new RegExp(escapeRegex(pattern), "gi");
        text = text.replace(re, replacement);
      } catch (e) {}
    }
    return text;
  }

  // 1. Regular text nodes
  function applyToTextNode(textNode) {
    if (!replacements.length) return;
    const newText = applyReplacements(textNode.nodeValue);
    if (newText !== textNode.nodeValue) textNode.nodeValue = newText;
  }

  // 2. Attributes (title, placeholder, alt, aria-label)
  const WATCHED_ATTRS = ["title", "placeholder", "alt", "aria-label"];

  function applyToAttrs(el) {
    if (!replacements.length) return;
    for (const attr of WATCHED_ATTRS) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      const newVal = applyReplacements(val);
      if (newVal !== val) el.setAttribute(attr, newVal);
    }
  }

  // 3. input / textarea .value (what the user types)
  function applyToInputValue(el) {
    if (!replacements.length || !("value" in el)) return;
    const newVal = applyReplacements(el.value);
    if (newVal !== el.value) {
      const sel = el.selectionStart;
      el.value = newVal;
      try { el.setSelectionRange(sel, sel); } catch (e) {}
    }
  }

  // 4. contenteditable divs (WhatsApp Web, Gmail compose, Notion, etc.)
  function applyToContentEditable(el) {
    if (!replacements.length) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(applyToTextNode);
  }

  // Walk entire subtree applying all replacement types
  function applyToNode(root) {
    if (root.nodeType === Node.ELEMENT_NODE) {
      applyToAttrs(root);
      if (root.tagName === "INPUT" || root.tagName === "TEXTAREA") {
        applyToInputValue(root);
        return;
      }
      if (root.isContentEditable) {
        applyToContentEditable(root);
        return;
      }
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_SKIP;
          }
          const parent = node.parentElement;
          if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [], elementNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) textNodes.push(current);
      else elementNodes.push(current);
    }
    elementNodes.forEach((el) => {
      applyToAttrs(el);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") applyToInputValue(el);
    });
    textNodes.forEach(applyToTextNode);
  }

  // ── Input event listener (fires while user types) ────────────────────────────

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  const handleInput = debounce((e) => {
    const el = e.target;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      applyToInputValue(el);
    } else if (el.isContentEditable) {
      applyToContentEditable(el);
    }
  }, 600); // wait 600ms after user stops typing before replacing

  document.addEventListener("input", handleInput, true);

  // ── Fetch block.json and run ─────────────────────────────────────────────────

  function loadAndApply() {
    fetch(BLOCK_JSON_URL)
      .then((r) => r.json())
      .then((data) => {
        replacements = (data.replacements || []).filter(
          (r) => r.category === "bad_trends"
        );
        applyToNode(document.body || document.documentElement);
      })
      .catch((e) => console.warn("[content.js] Failed to load block.json:", e));
  }

  // ── Numbers font — initial pass ──────────────────────────────────────────────

  processNode(document.body || document.documentElement);

  // ── MutationObserver ─────────────────────────────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        if (mutation.target.nodeType === Node.ELEMENT_NODE)
          applyToAttrs(mutation.target);
      } else if (mutation.type === "characterData") {
        applyToTextNode(mutation.target);
      } else {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node);
            applyToNode(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            wrapTextNode(node);
            applyToTextNode(node);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["title", "placeholder", "alt", "aria-label"],
    characterData: true,
  });

  loadAndApply();
})();