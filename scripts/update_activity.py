"""Writes data/activity.json from the GitHub organization's public repositories."""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import urllib.request

ORG = "H4D-Silent-Sentinel"
SKIP = {f"{ORG.lower()}.github.io"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "activity.json"
API = "https://api.github.com"


def get(path: str):
    req = urllib.request.Request(API + path, headers={"Accept": "application/vnd.github+json",
                                                      "User-Agent": "silent-sentinel-site"})
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    now = dt.datetime.now(dt.timezone.utc)
    since = (now - dt.timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
    week = now - dt.timedelta(days=7)
    repos, events = [], []
    for r in get(f"/orgs/{ORG}/repos?per_page=100&type=public"):
        if r["name"].lower() in SKIP or r.get("archived"):
            continue
        name = r["name"]
        commits = get(f"/repos/{ORG}/{name}/commits?since={since}&per_page=100")
        for c in commits:
            msg = c["commit"]["message"].splitlines()[0]
            if msg.startswith("Merge pull request"):
                continue
            events.append({"type": "commit", "repo": name, "title": msg[:140],
                           "date": c["commit"]["author"]["date"], "url": c["html_url"]})
        for p in get(f"/repos/{ORG}/{name}/pulls?state=closed&per_page=50"):
            if p.get("merged_at"):
                events.append({"type": "merge", "repo": name, "title": p["title"][:140],
                               "date": p["merged_at"], "url": p["html_url"]})
        recent = sum(1 for c in commits
                     if dt.datetime.fromisoformat(c["commit"]["author"]["date"].replace("Z", "+00:00")) >= week)
        repos.append({"name": name, "description": r.get("description") or "", "url": r["html_url"],
                      "pushed_at": r["pushed_at"], "commits_7d": recent, "commits_60d": len(commits)})
    events.sort(key=lambda e: e["date"], reverse=True)
    repos.sort(key=lambda r: r["pushed_at"], reverse=True)
    data = {"org": ORG, "repos": repos, "events": events[:60],
            "totals": {"commits_7d": sum(r["commits_7d"] for r in repos),
                       "commits_60d": sum(r["commits_60d"] for r in repos),
                       "merges_60d": sum(1 for e in events if e["type"] == "merge")}}
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    old.pop("generated_at", None)
    if old == data:
        print("no change")
        return
    data["generated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {len(data['events'])} events from {len(repos)} repos")


if __name__ == "__main__":
    main()
