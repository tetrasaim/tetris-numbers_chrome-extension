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
    input, textarea {
      font-family: "Tetrasaim", sans-serif !important;
    }
  `;
  (document.head || document.documentElement).appendChild(inputStyle);

  const NUMBERS_RE = /[0-9\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070\u2074-\u2079\u2080-\u2089\u2150-\u218B]+/g;

  function wrapTextNode(textNode) {
    try {
      const text = textNode.nodeValue;
      if (!NUMBERS_RE.test(text)) return;
      NUMBERS_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = NUMBERS_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement("span");
        span.className = "tetrasaim-num";
        span.textContent = match[0];
        frag.appendChild(span);
        lastIndex = NUMBERS_RE.lastIndex;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
    } catch (e) {}
  }

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS", "IFRAME"]);

  function processNode(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.classList && parent.classList.contains("tetrasaim-num")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(wrapTextNode);
  }

  // --- Bad Trends Replacement ---

  let badTrendsReplacements = [];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applyBadTrendsToTextNode(textNode) {
    if (!badTrendsReplacements.length) return;
    let text = textNode.nodeValue;
    let changed = false;

    for (const { pattern, replacement, regex } of badTrendsReplacements) {
      let re;
      try {
        re = regex
          ? new RegExp(pattern, "gi")
          : new RegExp(escapeRegex(pattern), "gi");
      } catch (e) {
        continue;
      }
      const newText = text.replace(re, replacement);
      if (newText !== text) {
        text = newText;
        changed = true;
      }
    }

    if (changed) textNode.nodeValue = text;
  }

  function applyBadTrendsToNode(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(applyBadTrendsToTextNode);
  }

  function loadAndApply() {
    fetch(BLOCK_JSON_URL)
      .then((r) => r.json())
      .then((data) => {
        badTrendsReplacements = (data.replacements || []).filter(
          (r) => r.category === "bad_trends"
        );

        applyBadTrendsToNode(document.body || document.documentElement);
      })
      .catch((e) => console.warn("[content.js] Failed to load block.json:", e));
  }

  // --- Numbers font processing ---

  processNode(document.body || document.documentElement);

  // --- MutationObserver for dynamic content ---

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processNode(node);
          applyBadTrendsToNode(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          wrapTextNode(node);
          applyBadTrendsToTextNode(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  loadAndApply();
})();