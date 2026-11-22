# Floor Area Navigator

Automatically builds a **Floor → Area → Controls** navigation card from the Home Assistant floor, area, device and entity registries.

- Floor buttons: choose the floor
- Area buttons: see only rooms assigned to that floor
- Controls: lights, covers/shutters, switches, fans, climate, scenes, scripts, cameras, media players, sensors and more
- Works entirely via your local Home Assistant frontend, no cloud or external login
- Existing dashboards are left unchanged

## Install (Home Assistant 2026.11+)

1. **Settings → Marketplace → Add from link**.
2. Paste `https://github.com/arisgia/floor-area-navigator`.
3. Select **Dashboard** and install, then refresh your browser.
4. **Settings → Dashboards → Add dashboard**. Create a new dashboard.
5. Edit it, **Add card → Manual**, and paste:

```yaml
type: custom:floor-area-navigator
title: Το σπίτι μου
```

For a full-width dashboard, use a Panel view. Marketplace will register the JavaScript resource automatically unless you manage dashboard resources in YAML.

## Install on older Home Assistant with HACS

HACS → top-right menu → **Custom repositories** → add this URL as **Dashboard** → install → refresh browser → add the manual card above.

## Important

Assign Areas to Floors under **Settings → Areas, labels & zones**, and assign devices/entities to their relevant Area. Floor/Area buttons and devices are discovered automatically. No entity IDs or token needed.

The install adds **a card**, not a complete preconfigured dashboard. You create the new dashboard once; the Floors/Areas and device controls then populate automatically.

## Update

Update from Marketplace or HACS and refresh the browser. No changes are required to existing dashboards.

## Notes

- Control buttons operate the real Home Assistant entities; do not use them until you are ready to control the devices.
- For climate, buttons adjust target temperature using the entity's configured step.
- Clicking **⋯** opens the standard Home Assistant more-info dialog.
