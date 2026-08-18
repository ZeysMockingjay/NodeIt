# NodeIt (V1 Bootstrap)

Lightweight Node-based visualization shell for Ubuntu, aimed at PureRef-like infinite workspace behavior.

## Current state

- Frameless desktop window with custom top bar.
- `About` button and `Close` button in top bar.
- Top bar buttons resolve Ubuntu/GNOME symbolic icons from system theme when available (with fallback glyphs).
- About dialog shows version `V1`.
- Infinite-style canvas foundation:
  - camera pan/zoom around cursor
  - adaptive fading grid levels for far zoom in/out
  - floating-origin rebasing for large world coordinates
  - spatial culling with grid index
- Right-click menu:
  - Create Node
  - Create Image Node
  - Add Image (file dialog)
  - Frame All (readjust view to all content)
- Node modes:
  - normal text nodes
  - image nodes with rounded corners
- Drag-and-drop image support with sensible initial scaling.
- Node anchor points + connection lines called **strands** with subtle animated flow.
- Selected item has a delete `X` and confirmation dialog.
- Portable packaging config (`AppImage` + `tar.gz`) in `electron-builder`.

## Run (Ubuntu)

1. Install Node.js 20+ and npm.
2. Install dependencies:

```bash
npm install
```

3. Start app:

```bash
npm start
```

## Portable build (no installer)

```bash
npm run pack:linux
```

Output artifacts are generated in `dist/` (including AppImage).

For some Ubuntu setups where AppImage sandbox permissions are restricted, the app auto-applies Electron `--no-sandbox` flags when running from an AppImage environment.

Install a desktop launcher (creates a clickable Desktop icon and app launcher):

```bash
npm run desktop:install
```

This expects a built executable at `dist/linux-unpacked/nodeit`, so run `npm run pack:linux` first.

## Proposed architecture direction (from research)

- Runtime: Electron for fastest MVP + AppImage portability.
- Render path:
  - MVP: Canvas2D (already in place)
  - Scale-up: PixiJS/WebGL when scene size grows
- Data and save file:
  - single portable `.nodeit` file, schema-versioned
  - migrate-on-load strategy
- Spatial performance:
  - current lightweight grid index
  - later replace/augment with R-tree (`rbush`) for large scenes
- Process boundaries:
  - main process: file I/O/persistence/asset pipelines
  - renderer: UI + interaction
  - preload: minimal IPC bridge only

## Near-term roadmap (not implemented yet)

- Node frames and prefab-style text fields.
- Dark gray Blender-like visual theme refinements.
- Node frame style inspired by Blender/Godot.
- Image frame support.
- Sound frame support.
- Full scaling and asset workflow.
