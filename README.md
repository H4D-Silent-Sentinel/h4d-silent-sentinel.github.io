# Silent Sentinel site

Static site served by GitHub Pages at https://h4d-silent-sentinel.github.io/.

| Path | Content |
|---|---|
| `data/milestones.json` | Milestone timeline, target and deadline dates |
| `data/briefings.json` | Weekly Google Slides decks, newest first. `published`: Publish-to-web embed URL, or `null` |
| `data/activity.json` | Generated hourly by `.github/workflows/update.yml` from the organization's public repositories |

Local preview: `python3 -m http.server` in this folder.
