# Laura Ramirez F.

GitHub Pages portfolio. The homepage is a scrub reel: move across the picture to cut between pieces, click to hold the credit, arrows and a phone flick do the same. The full catalog stays on `work.html`.

Black slate, Bebas Neue, and the blue contact link stay from the earlier site. Bio, clients, and services open from the name.

Videos stay on Vimeo (or YouTube). This repo only stores pages, stills, and a catalog — GitHub cannot host 50 video files.

## Add a video

1. Upload the piece to [Vimeo](https://vimeo.com/lauraramifer).
2. Copy the number from the URL, e.g. `vimeo.com/123456789` → `123456789`.
3. Open `data/work.json` and add (or edit) an entry:

```json
{
  "id": "client-short-name",
  "title": "Client name",
  "year": 2026,
  "categories": ["commercial"],
  "vimeo": "123456789",
  "watchUrl": "",
  "plate": "#3b0d12"
}
```

4. Save, commit, and push. GitHub Pages will pick it up.

Optional fields:

- `still` — image URL or `assets/stills/name.jpg`
- `youtube` — YouTube video ID if it is not on Vimeo
- `featured` — `true` to pin it on the home feature slot
- `span` — `"wide"` or `"tall"`
- `categories` — `reel`, `commercial`, `music-videos`, `animation`, `photography`, `events`
- `reel` — a number, `1` through `8`, to place it on the homepage scrub. It also needs a `still`.

Bio, clients, services, and links live in `data/site.json`.

## Preview locally

```bash
cd ~/Projects/lauraramirezf.github.io
python3 -m http.server 8080
```

Open http://localhost:8080

## GitHub Pages

This is meant to publish from a private `username.github.io` repo.

- A **private** GitHub Pages site needs GitHub Pro (or a paid org).
- In the repo: Settings → Pages → Deploy from branch `main` / root.
- After that the site is `https://USERNAME.github.io`
