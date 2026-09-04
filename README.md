# Laura Ramirez F.

Private GitHub Pages portfolio. The live site should match [the Framer reference](https://lauraramirezf.framer.website/): black slate, Bebas Neue masthead, blue Contact, cinematic stills.

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
