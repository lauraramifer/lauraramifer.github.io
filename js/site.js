const year = new Date().getFullYear();

const params = new URLSearchParams(location.search);
const page = document.body.dataset.page;
const categoryId = params.get("category");
const pieceId = params.get("id");

const loadJson = (path) =>
  fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load ${path}`);
    }
    return response.json();
  });

const byYear = (a, b) => b.year - a.year || a.title.localeCompare(b.title);

const inCategory = (item, id) => item.categories.includes(id);

const watchSrc = (item) => {
  if (item.vimeo) {
    return `https://player.vimeo.com/video/${item.vimeo}?autoplay=1`;
  }
  if (item.youtube) {
    return `https://www.youtube.com/embed/${item.youtube}?autoplay=1`;
  }
  return "";
};

const tileClass = (item) =>
  ["tile", item.span === "tall" ? "tall" : "", item.span === "wide" ? "wide" : ""]
    .filter(Boolean)
    .join(" ");

const tileInner = (item) => {
  const media = item.still
    ? `<img class="tile-media" src="${item.still}" alt="">`
    : `<div class="tile-plate" style="background:${item.plate || "#161616"}"><span>${item.title}</span></div>`;
  return `${media}<div class="tile-meta"><span>${item.title}</span><span>${item.year}</span></div>`;
};

const tileHref = (item) => {
  if (item.vimeo || item.youtube) {
    return `work.html?id=${encodeURIComponent(item.id)}`;
  }
  return item.watchUrl || `work.html?id=${encodeURIComponent(item.id)}`;
};

const renderHeader = (site) => {
  const header = document.querySelector("[data-masthead]");
  if (!header) return;
  header.innerHTML = `
    <span class="masthead-mark">©${year}</span>
    <a class="masthead-name" href="index.html">${site.name}</a>
    <a class="masthead-contact" href="${site.contactUrl}">Contact</a>
  `;
};

const renderFooter = (site) => {
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;
  const links = site.socials
    .map((social) => `<a href="${social.url}">${social.label}</a>`)
    .join("");
  footer.innerHTML = `
    <div>${links}</div>
    <div><a href="mailto:${site.email}">${site.email}</a> ${site.location}</div>
  `;
};

const openPlayer = (item) => {
  const player = document.querySelector("[data-player]");
  const frame = player.querySelector("[data-player-frame]");
  const title = player.querySelector("[data-player-title]");
  const src = watchSrc(item);
  title.textContent = `${item.title}, ${item.year}`;
  if (src) {
    frame.innerHTML = `<iframe src="${src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${item.title}"></iframe>`;
  } else if (item.watchUrl) {
    frame.innerHTML = `<p class="empty">This piece plays on the original portfolio. <a href="${item.watchUrl}">Open ${item.title}</a>. To play it here, paste a Vimeo ID into <code>data/work.json</code>.</p>`;
  } else {
    frame.innerHTML = `<p class="empty">Add a <code>vimeo</code> ID for this piece in <code>data/work.json</code>.</p>`;
  }
  player.hidden = false;
  player.querySelector(".player-close").focus();
};

const closePlayer = () => {
  const player = document.querySelector("[data-player]");
  const frame = player.querySelector("[data-player-frame]");
  frame.innerHTML = "";
  player.hidden = true;
};

const bindPlayer = () => {
  const player = document.querySelector("[data-player]");
  if (!player) return;
  player.querySelector(".player-close").addEventListener("click", closePlayer);
  player.addEventListener("click", (event) => {
    if (event.target === player) closePlayer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !player.hidden) closePlayer();
  });
};

const renderHome = (site, work) => {
  document.querySelector("[data-lede]").textContent = site.lede;
  const featured = work.find((item) => item.id === "bland-native-triggers") || work.find((item) => item.featured);
  const homeFeature = document.querySelector("[data-home-feature]");
  if (featured) {
    homeFeature.innerHTML = `<a class="${tileClass(featured)} tall" href="${tileHref(featured)}" data-piece="${featured.id}">${tileInner(featured)}</a>`;
  }

  const rest = document.querySelector("[data-home-categories]");
  rest.innerHTML = site.categories
    .map((category) => {
      const sample =
        work.find((item) => inCategory(item, category.id) && item.still) ||
        work.find((item) => inCategory(item, category.id));
      const visual = sample?.still
        ? `<img class="tile-media" src="${sample.still}" alt="">`
        : `<div class="tile-plate" style="background:${sample?.plate || "#161616"}"></div>`;
      return `<a class="tile" href="work.html?category=${category.id}">
        ${visual}
        <div class="tile-meta"><span>${category.label}</span><span>${category.blurb}</span></div>
      </a>`;
    })
    .join("");

  document.querySelector("[data-about]").innerHTML = site.about.map((p) => `<p>${p}</p>`).join("");
  document.querySelector("[data-clients]").innerHTML = site.clients.map((c) => `<li>${c}</li>`).join("");
  document.querySelector("[data-services]").innerHTML = site.services.map((s) => `<li>${s}</li>`).join("");
  document.querySelector("[data-cta]").textContent = site.cta;

  homeFeature.addEventListener("click", (event) => {
    const link = event.target.closest("[data-piece]");
    if (!link) return;
    const item = work.find((piece) => piece.id === link.dataset.piece);
    if (item && (item.vimeo || item.youtube)) {
      event.preventDefault();
      openPlayer(item);
    }
  });
};

const renderWork = (site, work) => {
  const intro = document.querySelector("[data-work-intro]");
  const grid = document.querySelector("[data-work-grid]");
  const category = site.categories.find((entry) => entry.id === categoryId);
  let items = work.slice().sort(byYear);

  if (pieceId) {
    const item = work.find((piece) => piece.id === pieceId);
    intro.innerHTML = item
      ? `<h2>${item.title}</h2><p>${item.year}</p>`
      : `<h2>Work</h2><p class="empty">That piece is not in the catalog yet.</p>`;
    if (item) {
      openPlayer(item);
      items = work.filter((piece) => piece.categories.some((id) => item.categories.includes(id)));
    }
  } else if (category) {
    intro.innerHTML = `<h2>${category.label}</h2><p>${category.blurb}</p>`;
    items = items.filter((item) => inCategory(item, category.id));
  } else {
    intro.innerHTML = `<h2>Work</h2><p>Selected production, post, and motion.</p>`;
  }

  intro.insertAdjacentHTML(
    "beforeend",
    `<p class="filters">${[{ id: "", label: "All" }, ...site.categories]
      .map((entry) => {
        const href = entry.id ? `work.html?category=${entry.id}` : "work.html";
        const active = entry.id === (categoryId || "") ? " is-active" : "";
        return `<a class="${active.trim()}" href="${href}">${entry.label}</a>`;
      })
      .join(" ")}</p>`
  );

  if (!items.length) {
    grid.innerHTML = `<p class="empty">No pieces in this category yet. Add one in data/work.json.</p>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (item) =>
        `<a class="${tileClass(item)}" href="${tileHref(item)}" data-piece="${item.id}">${tileInner(item)}</a>`
    )
    .join("");

  grid.addEventListener("click", (event) => {
    const link = event.target.closest("[data-piece]");
    if (!link) return;
    const item = work.find((piece) => piece.id === link.dataset.piece);
    if (item && (item.vimeo || item.youtube)) {
      event.preventDefault();
      openPlayer(item);
    }
  });
};

const start = async () => {
  const [site, work] = await Promise.all([loadJson("data/site.json"), loadJson("data/work.json")]);
  document.title = site.title;
  renderHeader(site);
  renderFooter(site);
  bindPlayer();
  const hero = document.querySelector(".hero-frame video");
  if (hero && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.pause();
    hero.removeAttribute("autoplay");
  }
  if (page === "home") renderHome(site, work);
  if (page === "work") renderWork(site, work);
};

start().catch((error) => {
  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `<p class="wrap empty">${error.message}</p>`;
  }
});
