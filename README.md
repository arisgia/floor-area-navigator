# Floor Area Navigator

A **standalone, self-populating Home Assistant dashboard** that opens like Dwains Dashboard, with three-level navigation:

**Floor → Area → Controls**

It automatically reads the Home Assistant floor, area, device and entity registries. Select a floor, then a room and control its lights, shutters/covers, climate, switches, fans, scenes, scripts and media players. Sensors and cameras are also available.

## Quick installation — no YAML

**Requirements:** Home Assistant **2026.5+** and HACS / Marketplace.

1. Open **Settings → Marketplace** (or **HACS** on earlier versions).
2. Find your installed **Floor Area Navigator** custom repository.
3. **Update / Redownload** it to get the new **standalone dashboard strategy**.
4. Refresh Home Assistant in your browser (Windows: **Ctrl + F5**).
5. Open **Settings → Dashboards → Add dashboard**.
6. Under **Community dashboards**, click **Floor Area Navigator**.
7. Enter a name and click **Create**.

The dashboard generates its own full-width view automatically. You do **not** need a blank dashboard, Raw configuration editor, YAML or Manual card.

> **Already installed the old card-only version?** You must update/re-download the repository first, then reload the Home Assistant frontend. The older 1.x version only provided a card, so it did not appear under Community dashboards.

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

2.2.0 — automatic registry sync + physical floor order. Dashboard strategy introduced in v2.0. Changes have passed syntax and simulated registration/ordering/device-add tests; not yet verified in the user's running instance.
