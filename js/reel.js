const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const titlecard = document.querySelector("#titlecard");
const titlecardName = document.querySelector("#titlecard-name");
const frame = document.querySelector("#frame");
const still = document.querySelector("#still");
const flash = document.querySelector("#flash");
const hold = document.querySelector("#hold");
const detail = document.querySelector("#detail");
const watch = document.querySelector("#watch");
const ticks = document.querySelector("#ticks");
const line = document.querySelector("#playhead-line");
const playhead = document.querySelector("#playhead");
const live = document.querySelector("#live");
const about = document.querySelector("#about");
const aboutCopy = document.querySelector("#about-copy");
const aboutOpen = document.querySelector("#about-open");
const aboutClose = document.querySelector("#about-close");
const contact = document.querySelector("#contact");
const year = document.querySelector("#year");

const loadJson = (path) =>
  fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load ${path}`);
    }
    return response.json();
  });

const decodeStill = (src) => {
  const image = new Image();
  image.src = src;
  return image.decode();
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const roleFor = (item, categories) => {
  const match = categories.find((category) => category.id === item.categories[0]);
  if (!match) {
    throw new Error(`No category label for ${item.id}`);
  }
  return match.label;
};

const start = async () => {
  const [site, work] = await Promise.all([loadJson("data/site.json"), loadJson("data/work.json")]);
  const reel = work.filter((item) => Number.isInteger(item.reel)).sort((a, b) => a.reel - b.reel);
  if (!reel.length) {
    throw new Error("No reel pieces in data/work.json");
  }
  reel.forEach((item) => {
    if (!item.still) {
      throw new Error(`Reel piece ${item.id} has no still`);
    }
  });

  document.title = site.title;
  titlecardName.textContent = site.name;
  aboutOpen.textContent = site.name;
  contact.href = site.contactUrl;
  year.textContent = `©${new Date().getFullYear()}`;
  aboutCopy.innerHTML = [
    ...site.about.map((paragraph) => `<p>${paragraph}</p>`),
    `<h2>Clients</h2><p>${site.clients.join(", ")}</p>`,
    `<h2>Services</h2><p>${site.services.join(", ")}</p>`,
    `<p><a href="mailto:${site.email}">${site.email}</a> ${site.location}</p>`,
  ].join("");

  let index = 0;
  let locked = false;
  let pointer = null;

  const setLine = (ratio) => {
    line.style.left = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
  };

  const paint = (next, { cut }) => {
    const item = reel[next];
    index = next;
    still.src = item.still;
    still.alt = item.title;
    hold.textContent = item.title;
    detail.textContent = `${roleFor(item, site.categories)}, ${item.year}`;
    frame.setAttribute("aria-label", `${locked ? "Release" : "Hold"} ${item.title}, ${item.year}`);
    watch.href = item.watchUrl;
    watch.textContent = `Watch ${item.title}`;
    ticks.querySelectorAll("button").forEach((button, buttonIndex) => {
      if (buttonIndex === index) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    live.textContent = `${item.title}, ${item.year}`;
    if (cut) {
      triggerFlash();
    }
  };

  const triggerFlash = () => {
    if (reduceMotion) return;
    flash.classList.remove("is-out");
    flash.classList.add("is-on");
    window.setTimeout(() => {
      flash.classList.remove("is-on");
      flash.classList.add("is-out");
    }, 50);
  };

  const setLocked = (on) => {
    locked = on;
    document.body.classList.toggle("is-locked", on);
    frame.setAttribute("aria-pressed", String(on));
    detail.hidden = !on;
    watch.hidden = !on;
    const item = reel[index];
    frame.setAttribute("aria-label", `${on ? "Release" : "Hold"} ${item.title}, ${item.year}`);
  };

  const step = (delta) => {
    const next = (index + delta + reel.length) % reel.length;
    paint(next, { cut: true });
    setLine((next + 0.5) / reel.length);
  };

  const seek = (clientX, rect) => {
    if (locked) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = Math.min(reel.length - 1, Math.floor(ratio * reel.length));
    setLine(ratio);
    if (next !== index) {
      paint(next, { cut: true });
    }
  };

  ticks.innerHTML = reel
    .map(
      (item, itemIndex) =>
        `<li><button type="button" data-index="${itemIndex}" aria-label="${item.title}">${String(itemIndex + 1).padStart(2, "0")}</button></li>`
    )
    .join("");

  ticks.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const next = Number(button.dataset.index);
    paint(next, { cut: next !== index });
    setLine((next + 0.5) / reel.length);
  });

  const onPointerDown = (event) => {
    if (event.currentTarget === playhead && event.target.closest("button")) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      type: event.pointerType,
      moved: false,
      surface: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!pointer || event.pointerId !== pointer.id || pointer.type === "touch") return;
    if (Math.abs(event.clientX - pointer.x) > 6) pointer.moved = true;
    seek(event.clientX, pointer.surface.getBoundingClientRect());
  };

  const onPointerUp = (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (pointer.type === "touch") {
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
        step(dx < 0 ? 1 : -1);
      } else if (pointer.surface === frame && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        setLocked(!locked);
      }
    } else if (pointer.surface === frame && !pointer.moved) {
      setLocked(!locked);
    }
    pointer = null;
  };

  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerup", onPointerUp);
  frame.addEventListener("pointercancel", () => {
    pointer = null;
  });
  playhead.addEventListener("pointerdown", onPointerDown);
  playhead.addEventListener("pointermove", onPointerMove);
  playhead.addEventListener("pointerup", onPointerUp);

  hold.addEventListener("click", () => setLocked(!locked));

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea")) return;
    if (event.key === "Escape") {
      if (!about.hidden) {
        closeAbout();
        return;
      }
      if (locked) setLocked(false);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  });

  const openAbout = () => {
    setLocked(false);
    about.hidden = false;
    document.body.classList.add("is-about");
    aboutOpen.setAttribute("aria-expanded", "true");
    aboutClose.focus();
  };

  const closeAbout = () => {
    about.hidden = true;
    document.body.classList.remove("is-about");
    aboutOpen.setAttribute("aria-expanded", "false");
    aboutOpen.focus();
  };

  aboutOpen.addEventListener("click", () => {
    if (about.hidden) openAbout();
    else closeAbout();
  });
  aboutClose.addEventListener("click", closeAbout);

  await Promise.all(reel.map((item) => decodeStill(item.still)));
  paint(0, { cut: false });
  setLine(0.5 / reel.length);
  if (!reduceMotion) {
    await wait(680);
    triggerFlash();
  }
  document.body.classList.add("is-live");
  titlecard.setAttribute("aria-hidden", "true");
};

start().catch((error) => {
  document.body.classList.add("is-live");
  const stage = document.querySelector("#stage");
  stage.innerHTML = `<p class="fail">${error.message}</p>`;
});
