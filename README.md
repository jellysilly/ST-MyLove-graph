# MyLove Graph

**A visual map of the bonds between every character and NPC in SillyTavern.**

> *"Love's a game, wanna play?"*

MyLove Graph turns your cast into a living relationship map: who is in love with
whom, who trusts whom, and who cannot stand being in the same room. It lives
behind a floating heart button, works on a phone without melting the battery,
and speaks English and Russian.

[Русская версия](README.ru.md)

---

## Features

- **Force-directed relationship graph** rendered on canvas — smooth with a few
  characters or a few hundred.
- **Four bond types**, each encoded by colour *and* line style so they stay
  readable on a small screen:

  | Bond | Colour | Line |
  | --- | --- | --- |
  | Love / Romantic | hot pink `#ff2d78` | solid, with a travelling heartbeat |
  | Close | violet `#b46bff` | solid, thinner |
  | Friendly / Neutral | aqua `#4fd6c8` | dashed |
  | Tense / Negative | ember `#ff6a3d` | dotted |

- **Strength (1–100) and direction** per bond — mutual, or one-way for the
  unrequited ones. Add a free-text label ("secret", "sworn enemies", …).
- **Everyone on one board**: character cards, your persona, group members, and
  hand-made NPCs who never had a card at all.
- **Floating heart button** — drag it anywhere, it snaps to the nearest edge and
  remembers where you left it.
- **BASIS panel** reading Affection / Devotion / Tension for the selected
  character, derived from their bonds.
- **Two languages**: English (default) and Russian, switchable from the toolbar
  or the settings card.
- **Mobile-first**: bottom sheets instead of popovers, two-row toolbar, pinch to
  zoom, capped pixel ratio, and a render loop that parks itself the moment
  nothing is moving.
- **Import / export** the whole graph as JSON.

## Install

In SillyTavern: **Extensions → Install extension**, paste

```
https://github.com/jellysilly/ST-MyLove-graph
```

Or clone it manually:

```bash
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/jellysilly/ST-MyLove-graph MyLoveGraph
```

Then reload SillyTavern.

## Using it

Open the graph from the floating heart, the wand (extensions) menu, the
**Open the graph** button in Extensions → MyLove Graph, or `/mylove`.

| Gesture | What it does |
| --- | --- |
| Tap / click a node | Select it and open its details |
| Double tap a node | Edit it |
| Tap a bond | Select it |
| Double tap a bond | Edit it |
| Drag a node | Move it (the position is saved) |
| Drag the background | Pan |
| Wheel / pinch | Zoom |
| Double tap the background | Fit everything on screen |

**Toolbar:** sync characters · add (NPC, group, sync) · new bond · fit ·
rebuild layout · filters · data (import/export/clear) · language.

The first time you open the graph it pulls in every character card plus your
persona. After that, new cards are added automatically (switch it off with
*Auto-add new characters*). A card you delete in SillyTavern is **not** removed
from the graph — it is marked with a dashed ring so the bonds around it survive.

## Settings

Found under **Extensions → MyLove Graph**.

| Setting | Meaning |
| --- | --- |
| Language | English or Russian |
| Floating heart button | Show or hide the button |
| Show in the extensions menu | The entry in the wand menu |
| Animations | Pulses, sweeps and the heartbeat along romantic bonds |
| Show names / avatars / curved bonds | What is drawn on the board |
| Auto-add new characters | Keep the board in step with your card list |
| Lite mode | *Auto* (on for touch devices), *Always on*, or *Off* |
| Reset heart position | Send the floating button back to its corner |

**Lite mode** lowers the pixel-ratio cap, drops the glow passes and stops the
per-frame bond animation. On a phone it is on by default.

Animations also respect the system `prefers-reduced-motion` setting.

## Performance notes

- The render loop stops entirely once the layout has settled and nothing is
  animating; interaction restarts it. An idle open window costs nothing.
- Glow is drawn as a wide translucent stroke rather than `shadowBlur`, which is
  far cheaper on mobile GPUs.
- Repulsion is `O(n²)` up to 120 nodes and switches to a spatial grid above that.
- The device pixel ratio is capped at 2.5 (1.75 in lite mode).

## Data

Everything is stored in SillyTavern's own settings under
`extension_settings.mylove_graph` (so it travels with your profile), falling
back to `localStorage` if that store is unavailable.

Export produces:

```json
{
  "format": "mylove-graph",
  "version": 1,
  "nodes": [
    { "id": "char:seraphina.png", "kind": "char", "name": "Seraphina",
      "avatar": "seraphina.png", "role": "", "note": "", "color": "",
      "x": 12.4, "y": -88.1, "pinned": false }
  ],
  "edges": [
    { "id": "e:...", "a": "char:seraphina.png", "b": "npc:...",
      "type": "love", "strength": 82, "dir": "a2b", "note": "unrequited" }
  ]
}
```

`kind` is `char`, `npc` or `persona`. `dir` is `both`, `a2b` or `b2a`.
Importing replaces the current board, so export first if you want a backup.

## For tinkerers

`window.MyLoveGraph` exposes `open()`, `close()`, `toggle()`, `sync()`,
`export()`, `settings()`, `save()` and `instance()` (the live canvas engine).
While the window is open, `<html>` carries the `mlg-open` class, which is handy
for custom CSS.

## Design

The interface follows the *Love Potion* poster language: near-black grounds, hot
magenta light, thin HUD frames with bracket corners, monospaced micro-labels and
a script display face. The BASIS meters and the `528 HZ` / `404-G` marks are a
nod to the same poster.
