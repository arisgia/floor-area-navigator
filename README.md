# Floor Area Navigator

A **standalone, self-populating Home Assistant dashboard** that opens like Dwains Dashboard, with three-level navigation:

**All scripts → Floor → Area → Controls**

It automatically reads the Home Assistant floor, area, device and entity registries. Select a floor, then a room and control its lights, shutters/covers, climate, switches, fans, scenes, scripts and media players. Sensors and cameras are also available.

## Quick installation — no YAML

**Requirements:** Home Assistant **2026.5+** and HACS / Marketplace.

1. Open **Settings → Marketplace** (or **HACS** on earlier versions).
2. Find your installed **Floor Area Navigator** custom repository.
3. **Update / Redownload** it to install the latest version (Scripts + Visual Editor).
4. Refresh Home Assistant in your browser (Windows: **Ctrl + F5**).
5. Open **Settings → Dashboards → Add dashboard**.
6. Under **Community dashboards**, click **Floor Area Navigator**.
7. Enter a name and click **Create**.

The dashboard generates its own full-width view automatically. You do **not** need a blank dashboard, Raw configuration editor, YAML or Manual card.

> **Already installed the old card-only version?** You must update/re-download the repository first, then reload the Home Assistant frontend. The older 1.x version only provided a card, so it did not appear under Community dashboards.

## New in 2.3 — Global scripts and Visual Editor

### Scripts above all floors

An **all-house Scripts** section now appears before the floor buttons. It discovers **all active `script.*` entities** in Home Assistant, even when a script isn't assigned to an Area. Scripts are alphabetically sorted by their display names.

- Each script displays as a **single button containing only its name** (no icon, MDI text, ellipsis or secondary label). Click anywhere on the button to call `script.turn_on`.
- Click **⋯** on its tile for Home Assistant's More Info panel.
- Scripts created, renamed, or removed while the dashboard is open update automatically as the Home Assistant entity states change. The existing registry event listeners and 30-second fallback continue to handle device and area changes.
- Scripts unavailable to Home Assistant cannot be run and their buttons are disabled.
- If a script requires input fields or variables, use Home Assistant's own execution UI or edit the script to provide defaults.

### Visual editor

The standalone **dashboard strategy** and the optional **manual card** now each expose a visual configuration editor:

- Dashboard/card title
- Show/hide the global Scripts section (enabled by default)
- Customize Scripts heading
- Initially collapse/expand Scripts (expanded by default)
- Require confirmation before running a script (disabled by default)

Open **Edit dashboard → Dashboard settings / Edit strategy** to find the strategy editor when supported by your Home Assistant frontend. For the manual card, choose **Edit card → Visual**. Edit options and click Save. No YAML is needed for these settings.

The visual editor is for dashboard-wide options; it **does not yet support dragging individual entity buttons or repositioning arbitrary Lovelace cards**. Floor and area ordering comes from Home Assistant's Floor/Area assignments.

## How it works

- **Floor:** select from existing floors in **physical ascending order**: basement(s) → ground → 1st → 2nd → roof. Uses explicit Home Assistant numeric floor level when configured; falls back to recognized Greek/English floor names when levels are missing or identical.
- **Area:** choose a room assigned to the selected floor.
- **Controls:** auto-discovered Home Assistant entities in that room; grouping by domain.
- Devices inherit their Area assignments; explicit entity Area assignments take priority.
- Rooms without a floor can be found under **Χωρίς όροφο**.
- **Live sync:** watches HA registry update events for floors, areas, devices and entities. A fallback refresh runs every 30 seconds while the dashboard is open, plus on tab focus. The selected floor/area stays selected whenever possible.
- The manual **refresh** button is optional.
- Uses only local Home Assistant APIs and authenticated frontend calls. No eWeLink cloud or API tokens required.

### First-time configuration

In Home Assistant, go to **Settings → Areas, labels & zones**, define Floors, assign Areas to the right floor, and make sure entities or their devices belong to the appropriate Area. This is what drives the menu — it is **not hardcoded**.

## Compatibility and backward support

- **Native community dashboard**: added in v2.0 through `ll-strategy-dashboard-floor-area-navigator` and `window.customStrategies` (Home Assistant 2026.5+).
- **Dashboard strategy YAML fallback**:
  ```yaml
  strategy:
    type: custom:floor-area-navigator
  ```
- **Old custom card remains available**:
  ```yaml
  type: custom:floor-area-navigator
  title: Το σπίτι μου
  ```
- HACS / Marketplace installs the single `dist/floor-area-navigator.js` resource (from `hacs.json`). No manual files or additional dependencies.
- Your existing dashboards and all Home Assistant configuration remain untouched.

## Troubleshooting

**Not shown under Community dashboards**
1. Confirm the installed resource is the latest version after an Update / Redownload (initial old installs still load the old JS until updated).
2. Refresh the Home Assistant tab with **Ctrl+F5** or reopen the app.
3. Ensure the JS module appears under Dashboard Resources and loads without 404 errors.
4. Home Assistant 2026.5 or newer is required for the Community dashboards picker.

**Dashboard created but empty**: Assign Areas to Floors and devices/entities to Areas; reload.

**Cannot load strategy**: Check browser console for `ll-strategy-dashboard-floor-area-navigator`, verify dashboard resource loaded, and refresh.

## Source layout

- `dist/floor-area-navigator.js` — self-contained dashboard strategy + UI card
- `hacs.json` — Dashboard resource metadata
- `examples/dashboard.yaml` — optional legacy/manual example
- `ΟΔΗΓΙΕΣ_ΕΛΛΗΝΙΚΑ.md` — Greek instructions

## Version

2.4.0 — name-only full-width script action buttons. v2.3 global auto-updating scripts and visual editor, v2.2 automatic registry sync and floor ordering are retained. Syntax and simulated frontend action tests passed; real-device verification still needed.
