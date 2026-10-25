// Visual-density and editorial metrics for one rendered page state (UX acceptance tests B and E).
// Used for the before/after comparison of the UX simplification pass. Pure measurement: no assertions.
//
//   fold.*     text the user sees in the first viewport (no scrolling, disclosures as rendered)
//   visible.*  everything rendered on the page in its default state (closed disclosures excluded)
//   all.*      every text node in the DOM, including collapsed details (shows information is still available)

export const BANNED_PHRASES = [
  "delve", "leverage", "unlock", "empower", "seamless", "robust", "cutting-edge", "cutting edge", "revolutionary",
  "transformative", "comprehensive insights", "navigate with confidence", "financial journey", "actionable insights",
  "tailored to your needs", "data-driven", "in today's world", "it's important to note", "it is important to note",
  "at the end of the day", "let's explore", "here's what you need to know", "whether you're", "not just",
  "game-changer", "game changer", "peace of mind", "rest assured", "elevate", "harness", "unleash", "supercharge",
  "intelligent", "ai-powered", "powered by ai", "effortless", "dive into", "deep dive",
];

export async function measure(page) {
  return page.evaluate((banned) => {
    const vh = window.innerHeight;
    const shown = (el) =>
      !!el && (typeof el.checkVisibility === "function" ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest("script,style,noscript,template")) return NodeFilter.FILTER_REJECT;
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const all = [], visible = [], fold = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      all.push(t);
      if (!shown(n.parentElement)) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
      if (!rects.length) continue;
      visible.push(t);
      if (rects.some((x) => x.top < vh && x.bottom > 0)) fold.push(t);
    }
    const words = (xs) => xs.join(" ").split(/\s+/).filter(Boolean).length;
    const money = (xs) => (xs.join(" ").match(/[−-]?\$\d[\d,]*(?:\.\d+)?/g) || []).length;
    const dashes = (xs) => (xs.join(" ").match(/[–—]/g) || []).length;
    const phrases = (xs) => {
      const s = xs.join(" ").toLowerCase();
      return banned.filter((b) => s.includes(b));
    };
    const inFold = (el) => {
      if (!shown(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0;
    };
    const controls = [...document.querySelectorAll("a[href],button,input,select,textarea,summary,[role=radio],[role=tab]")];
    return {
      url: location.pathname,
      viewport: { width: window.innerWidth, height: vh },
      pageHeight: document.documentElement.scrollHeight,
      fold: {
        words: words(fold),
        moneyFigures: money(fold),
        controls: controls.filter(inFold).length,
        headings: [...document.querySelectorAll("h1,h2,h3")].filter(inFold).length,
        primaryActions: [...document.querySelectorAll("[data-primary-action]")].filter(inFold).length,
      },
      visible: {
        words: words(visible),
        moneyFigures: money(visible),
        controls: controls.filter(shown).length,
        cards: [...document.querySelectorAll("section,article,[data-card]")].filter(shown).length,
        charts: [...document.querySelectorAll("svg.recharts-surface")].filter(shown).length,
        tableRows: [...document.querySelectorAll("table tr")].filter(shown).length,
        primaryActions: [...document.querySelectorAll("[data-primary-action]")].filter(shown).length,
        dashes: dashes(visible),
        bannedPhrases: phrases(visible),
      },
      all: {
        words: words(all),
        moneyFigures: money(all),
        dashes: dashes(all),
        bannedPhrases: phrases(all),
        disclosures: document.querySelectorAll("details").length,
      },
    };
  }, BANNED_PHRASES);
}
