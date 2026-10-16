# The Metaverse Web registry

A public list of worlds on the Metaverse Web (`mvw/0.1`, see [`https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md`](https://github.com/zlisto/metaverse_web/blob/main/PROTOCOL.md)). It plays the role of the early web's "What's New" page: no servers, no accounts, just one JSON file anyone can propose a change to.

**Metaverse Square** (`https://github.com/zlisto/hub_world`) reads this list and puts a portal to every world in a ring around its plaza. Search engines and AI agents can start crawling from here too.

## Add your world

1. **Make sure your world is ready.** It's online at a public address, and its manifest loads at `<your address>/.well-known/metaverse.json`, with a `name` and a `default` spawn point. The quickest way there is to copy `https://github.com/zlisto/world_starter`.
2. **Add one entry** to the `worlds` list in `worlds.json`:

   ```json
   {
     "id": "darul_kebab",
     "name": "Darul Kebab",
     "address": "https://zlisto.github.io/darul_kebab/",
     "owner": "zlisto"
   }
   ```

   | Field | Rules |
   | --- | --- |
   | `id` | Unique, 1–40 lowercase letters, digits or `_`. Metaverse Square uses it for the spawn point next to your portal, so keep it once it's listed. |
   | `name` | Your world's name, the same as in your manifest. |
   | `address` | Your world's public `https://` address, ending in `/`. |
   | `owner` | Your GitHub username, so people know who to ask. |

3. **Check it:** run `node check.js` (Node 18 or newer, no install needed). Every world should show `✓`.
4. **Open a pull request.** If it only adds worlds (up to 5), each with `owner` set to your GitHub username and a public `https://` address, it **merges automatically** as soon as the manifest check passes. Nobody has to approve it. Only changes to existing entries wait for a review.
5. **Walk in.** Metaverse Square reads this list live every time it opens, so your portal appears there within a few minutes of the merge. If your manifest has a `from_square` spawn, the square's portal lands people there, so put it in front of your portal back to the square.

## Checking every world

```bash
node check.js
```

`check.js` runs automatically on every pull request; `auto-merge.js` decides which pull requests can merge without a review (it reads the proposed list as data and never runs the pull request's code). For each world, `check.js` fetches the manifest and reports whether it loads, whether it's valid `mvw/0.1` (a `name`, `spawns.default`, and portals with `http(s)` addresses), and whether other sites are allowed to read it. It exits with code 1 if any world fails, so it can run automatically on every pull request.

## Trying it locally

To try worlds running on your own machine, point their `address` at `http://localhost:<port>/` in a local copy of `worlds.json`, then run `node check.js`. Only public `https://` addresses belong in pull requests.
