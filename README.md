# Lead balance and secondary lead smelters

A static website from Pure Earth. It maps secondary lead smelters in low- and middle-income countries, shows lead balances built from trade data, and links each located smelter to [ULAB Plume](https://ulabplume.org/) with a **Predict plume** button.

It is the same page as the lead balance dashboard, made standalone: no build step, no server code, and nothing loaded from other sites.

## What is in the repository

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `styles.css` | Its styles |
| `app.js`, `calcs.js` | The map, panels and balance calculations |
| `dash.js` | Loads the files in `data/` and draws the page |
| `config.js` | The ULAB Plume address that **Predict plume** opens |
| `data/` | Smelters, trade, parameters, country notes, trade-flow lines, country outlines |
| `vendor/d3.min.js` | d3 7.9.2 (ISC licence in `vendor/d3-LICENSE.txt`) |
| `_headers`, `netlify.toml` | Netlify settings: security headers, and publish the repository as it is |

## Putting it online with Netlify

1. In Netlify, choose **Add new site → Import an existing project → GitHub**, and pick `lead-smelter-map`.
2. Leave **Build command** empty and set **Publish directory** to `.` (netlify.toml already says this).
3. Choose **Deploy**. Every later push to `main` redeploys the site.
4. Optional: add a custom domain under **Domain management**.

To try it on your own computer, run `python3 -m http.server 8000` in this folder and open http://localhost:8000. Opening `index.html` straight from the file system does not work, because browsers block it from reading `data/`.

## Predict plume

On a smelter's panel, **Predict plume in ULAB Plume** opens ULAB Plume in a new tab with:

- `site_lat`, `site_lon`: the catalogue's map position. Unless the catalogue's location precision is *Compound*, this is a town or area point, and the note under the button says to move the pin onto the plant before a final run.
- `lead_produced_tpy`: the plant's reported lead output, only where a figure for that plant is published: by the company, or (in India) in the plant's lead-scrap import application to the environment ministry's expert committee (MoEFCC). Company totals and capacities are never sent as output.
- `lead_capacity_tpy`: the catalogue's lead capacity, shown in ULAB Plume as a hint only.
- `site_name`, `site_ref` (catalogue ID), `site_precision` and `from=lmic-smelter-map`, for ULAB Plume's notice.

Smelters without a position in the catalogue show the button greyed out.

The button opens ULAB Plume itself (`https://ulabplume.org/`), which reads these links since 16 Nov 2026. To try a change to how they are read before it is released, point `config.js` at ULAB Plume's beta site (`https://ulabplume-beta.netlify.app/`) and push.

## Updating the data

The files in `data/` are built from Pure Earth's secondary lead smelter catalogue and the trade data, with the dashboard's build scripts. Replace them and push to update the site. The catalogue date is given in the page header and footer.

Sources for every figure are in the page: each smelter's panel lists its own sources, and **How the balance works, and its sources** lists the trade, production and parameter sources.
