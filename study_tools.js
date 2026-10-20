export function studyPointHtml(earnedPoints) {
  return "";
}

export function studySearchHtml() {
  return `
        <form class="study-search-form" aria-label="問題をGoogleで検索">
            <input class="study-search-input" type="search" placeholder="この問題をGoogleで検索" aria-label="この問題をGoogleで検索">
            <button class="study-search-button" type="submit">検索</button>
        </form>`;
}

export function setupStudyTools(root) {
  const form = root.querySelector(".study-search-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = form.querySelector(".study-search-input")?.value.trim();
      if (!query) return;
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        "_blank",
        "noopener",
      );
    });
  }
}

export async function refreshTotalPoints(root) {
  // The legacy export remains for answer screens; points were retired.
}
