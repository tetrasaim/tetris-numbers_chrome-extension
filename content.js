(function () {
  const fontUrl = chrome.runtime.getURL("tetrasaim.otf");

  // Inject @font-face
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

  // Regex: digits 0-9, superscript/subscript digits, fractions ½ ¼ ¾ etc.
  const NUMBERS_RE = /[0-9\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070\u2074-\u2079\u2080-\u2089\u2150-\u218B]+/g;

  function wrapTextNode(textNode) {
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

    textNode.parentNode.replaceChild(frag, textNode);
  }

  // Apply font to input/textarea typed content via CSS
  const inputStyle = document.createElement("style");
  inputStyle.textContent = `
    input, textarea {
      font-family: "Tetrasaim", sans-serif !important;
    }
  `;
  (document.head || document.documentElement).appendChild(inputStyle);

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

  processNode(document.body || document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processNode(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          wrapTextNode(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();