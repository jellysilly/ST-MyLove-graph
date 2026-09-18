# MyLove Graph

**A visual map of the bonds between every character and you in SillyTavern.**

> *"Love's a game, wanna play?"*

MyLove Graph turns your cast into a living relationship map: who is in love with
whom, who trusts whom, and who cannot stand being in the same room. It lives
behind a floating heart button.

**The map is not drawn up front — it is written by the roleplay.** A character
appears on the board the first time they walk into a scene, and the bonds
between them start as faint sparks that grow, change colour and settle as the
story goes on.

Two engines fill it in, and you can run either or both:

- the **chronicle**, which counts words in the chat and never leaves your
  browser;
- the **director**, which hands the new scenes to a language model and lets it
  write the cast itself — who walked in, what they are like, and what is going
  on between them. It can run on **a second connection profile**, so a small
  fast model keeps the map while your good model keeps telling the story.

Every chat gets its own board, so one story's cast never wanders into another.

[Русская версия](README.ru.md)

---

## Features

- **Story mode** — the board fills in behind your roleplay instead of being
  dumped on you at once:

  | Stage | What it means | How it looks |
  | --- | --- | --- |
  | *spark* | two souls keep sharing scenes | a short stub with a glowing tip |
  | *forming* | the bond is taking shape | the line reaches further across |
  | *bond* | it has settled | the line closes the gap and brightens |

  Souls appear the first time they speak or are named. What the two of them go
  through decides the kind of bond, so a friendship that turns romantic becomes
  a romance on the board too, and a pair nobody writes about any more slowly
  cools off.
- **The director** — the same job done by a model instead of a word counter:

  | It writes | From |
  | --- | --- |
  | new souls, with a role and a short profile | whoever actually walks into the scenes |
  | bonds, with a type, a strength and a label | what the scenes say about the pair |
  | a story log | what changed, scene by scene |
  | a full dossier on demand | appearance, character, what they want, what they hide |

  It reads every few messages, never while SillyTavern is answering, and writes
  only what the chat supports. Anything you edited by hand it leaves alone.
- **A model of your choosing**: SillyTavern's current connection, a **separate
  connection profile** (a different, cheaper model — the point of the feature),
  or a bare OpenAI-compatible endpoint.
- **A board per chat** — each roleplay writes its own map. One shared board is
  still one toggle away.
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
  remembers where you left it, rotation and on-screen keyboard included.
- **BASIS panel** reading Affection / Devotion / Tension for the selected
  character, derived from their bonds.
- **Two languages**: English (default) and Russian, switchable from the toolbar
  or the settings card.
- **Mobile-first**: bottom sheets instead of popovers, a toolbar that wraps
  instead of scrolling out of reach, menus that follow the *visible* viewport
  (browser chrome and keyboard included), pinch to zoom, capped pixel ratio, and
  a render loop that parks itself the moment nothing is moving.
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

**Toolbar:** sync characters · add (NPC, group, sync) · new bond · chronicle ·
**director** · fit · rebuild layout · filters · data (import/export/clear) ·
language.

With **story mode** on (the default) the graph starts empty and fills itself in
as you play: the chronicle reads each new message, brings a soul onto the board
the first time they appear, and grows the bonds between whoever keeps sharing
scenes. The BASIS panel shows how far it has read — chapter, messages, and how
many bonds are still forming.

Switch story mode off (or press **Sync characters**) and the old behaviour is
right there: every character card plus your persona, all at once, with bonds you
draw yourself. A card you delete in SillyTavern is **not** removed from the
graph — it is marked with a dashed ring so the bonds around it survive.

### How the chronicle reads a scene

- **Who is in it** — whoever speaks, plus every cast name it finds in the text
  (declensions and possessives included: *Борису* and *Boris's* both find
  Boris). If the story calls someone by a nickname, add it under *Also known as*
  in their card.
- **What happens** — a small word-stem lexicon (English and Russian) votes on
  love / close / friendly / tense. No model calls, so it costs a millisecond per
  message and works offline.
- **How much it counts** — naming someone counts most, two names in one message
  less, simply answering each other least of all. One word never decides
  anything: a bond is the sum of dozens of scenes.
- **Who reaches out** — if only one of the two ever brings the other up, the
  bond is drawn one-way. Unrequited feelings show up on their own.

Anything you edit by hand is yours: the chronicle stops steering that bond and
marks it *yours*. The bond card has a button to hand it back.

## The director

The chronicle can tell that two people keep sharing scenes. It cannot tell that
"the innkeeper" from chapter one is the woman the party now calls Marta, that
she is frightened rather than hostile, or write down who she is. That is what
the director is for.

Switch it on in **Extensions → MyLove Graph → Director**, or from the ✧ button
in the toolbar. Then every few messages it hands the new scenes to a model,
along with the cast and bonds already on the board, and asks for JSON back:

```json
{
  "characters": [
    { "name": "Marta", "aka": ["the innkeeper"], "role": "innkeeper",
      "summary": "Runs the tavern and knows the road north.",
      "traits": ["watchful", "warm"] }
  ],
  "relations": [
    { "a": "Marta", "b": "Boris", "type": "love", "strength": 62,
      "dir": "b2a", "label": "lingering looks", "confidence": 0.8 }
  ],
  "events": ["Marta lingers near Boris."]
}
```

New names walk onto the board with their role and profile; known ones are
matched against the cast (aliases and Russian declensions included) and updated
rather than duplicated. A relation the model is unsure about is dropped, and a
bond the scenes say is over gets cut.

### Which model writes it

| Source | What it means |
| --- | --- |
| **Main connection** | Whatever SillyTavern is connected to right now. Nothing to set up, but every pass competes with the roleplay for the same backend. |
| **Separate profile** | A saved **connection profile** (SillyTavern's Connection Manager: API, model and preset in one). Point it at something small and fast and your main model is never interrupted. |
| **Custom endpoint** | Any OpenAI-compatible URL — llama.cpp, Ollama, LM Studio, a proxy. It has to accept requests from the SillyTavern page (CORS), and the key is stored in plain SillyTavern settings, so use a local backend or a key you can revoke. |

The profile picker is also in the toolbar menu, so switching the scribe mid-chat
is two taps.

### What it is allowed to do

Every one of these is a toggle, in the settings card and in the toolbar menu:

- *Read new scenes by itself* — off means it only ever runs when you ask.
- *Bring in new souls* / *Draw new bonds* / *Write roles and profiles*.
- *Read every N messages*, *Messages per pass*, *Re-read depth*, *Answer
  budget*, *New souls per pass* — how often it runs and how much it may spend.
- *Writes in* — the language of everything it writes (defaults to the
  interface language).

**Write a dossier** on a selected character asks for a close-up built only from
the scenes they appear in: appearance, character, what they want, what they
keep to themselves. **Re-read this chat** rebuilds its work one window at a
time, and says up front how many requests that is.

Nothing the director writes is precious: *Forget what it wrote* drops all of it
and leaves your own work untouched.

## A board for every chat

By default each chat keeps its own board, which is what makes a self-writing map
usable at all — a cast generated inside one roleplay has no business turning up
in the next one. Turn *A board for every chat* off for a single shared board,
the way older versions worked (installs upgrading from 1.1 keep their shared
board, and there is a button to copy it into the current chat).

Boards are pruned to the ten most recently used, except ones you have worked on
by hand, which are always kept.

## Settings

Found under **Extensions → MyLove Graph**.

| Setting | Meaning |
| --- | --- |
| Language | English or Russian |
| A board for every chat | Per-chat boards, or one shared map |
| Let a model write the map | The director on or off |
| Which model writes it | Main connection · separate profile · custom endpoint |
| Read new scenes by itself | Automatic passes, or only when you ask |
| Bring in new souls / Draw new bonds / Write roles and profiles | What the director may write |
| Read every N messages · Messages per pass · Re-read depth · Answer budget · New souls per pass | How often it runs and how much it spends |
| Writes in | The language the director writes in |
| Test the connection | One tiny request that proves the wire works |
| Grow bonds from the chat | Story mode on or off |
| Only souls the story met | Keep the board to the cast that has actually appeared |
| Count names in the text | Also read who is *mentioned*, not only who speaks |
| Let quiet bonds cool | Bonds nobody writes about slowly fade |
| Pace | *Slow burn*, *Steady* or *Whirlwind* — how fast a bond fills in |
| Re-read the chat | Rebuild every story bond from the chat, from its first line |
| Forget the story | Drop everything the chronicle wrote (hand-made bonds stay) |
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
back to `localStorage` if that store is unavailable. Per-chat boards live under
`boards[chatId]`, the shared one under `graph`, and the director's reading
progress and story log under `ai.chats[chatId]`.

Export produces:

```json
{
  "format": "mylove-graph",
  "version": 2,
  "nodes": [
    { "id": "char:seraphina.png", "kind": "char", "name": "Seraphina",
      "avatar": "seraphina.png", "role": "", "aliases": "", "note": "",
      "color": "", "x": 12.4, "y": -88.1, "pinned": false,
      "origin": "ai", "seen": 42, "bio": "Runs the tavern.",
      "traits": ["watchful"], "dossier": { "appearance": "…" },
      "edited": false }
  ],
  "edges": [
    { "id": "e:...", "a": "char:seraphina.png", "b": "npc:...",
      "type": "love", "strength": 82, "dir": "a2b", "note": "unrequited",
      "origin": "ai", "progress": 64, "locked": false, "hits": 19,
      "since": 51, "lastAt": 128, "confidence": 0.8 }
  ]
}
```

`kind` is `char`, `npc` or `persona`. `dir` is `both`, `a2b` or `b2a`.
`origin` is `story` for whatever the chronicle wrote, `ai` for the director,
and `manual` for the rest; `progress` is how far a bond has come (0–100),
`seen`/`since` are the message it started from, and `edited` marks a soul you
have written yourself (the director then fills in blanks only). A version 1 export still imports — its bonds simply
come back finished. Importing replaces the current board, so export first if you
want a backup.

## For tinkerers

`window.MyLoveGraph` exposes `open()`, `close()`, `toggle()`, `sync()`,
`export()`, `settings()`, `save()` and `instance()` (the live canvas engine),
plus the chronicle:

```js
MyLoveGraph.story.status();    // { applied, total, chapter, sparks, settled }
MyLoveGraph.story.read();      // fold whatever is new in the chat
MyLoveGraph.story.rebuild();   // re-read the chat from the start
MyLoveGraph.story.forget();    // drop every story bond
```

…and the director:

```js
MyLoveGraph.director.status();     // { enabled, target, analyzed, total, souls, bonds, … }
MyLoveGraph.director.test();       // prove the connection works
MyLoveGraph.director.read();       // one pass over whatever is new
MyLoveGraph.director.rebuild();    // re-read this chat, window by window
MyLoveGraph.director.dossier(id);  // a close-up on one soul
MyLoveGraph.director.log();        // the story log of this chat
MyLoveGraph.director.forget();     // drop everything it wrote here
```

While the window is open, `<html>` carries the `mlg-open` class, which is handy
for custom CSS.
