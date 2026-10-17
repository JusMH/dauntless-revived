# Launcher/client integration: PRs 59, 62, 63, 66–69

Integrated into `integrate/pr59-69`; production services and the separate Rams-shop pilot were not changed.

| PR | Contribution | Credit |
| --- | --- | --- |
| 59 | Explain locked settings while game/tasks run | anxo0 |
| 62 | Brazilian Portuguese translation, included by 68 (455 original entries; partner-label punctuation differs) | LupesHk |
| 63 | Offline play, local services/account persistence, portable save backup/restore; includes prerequisite 61 | JusMH runtime; anxo0 UI |
| 66 | Remove vendor tab bar that exposed a crashing native purchase path | anxo0 |
| 67 | Animated streamer-mode switch | anxo0 |
| 68 | Launcher/game language options and responsive step labels | anxo0; Portuguese by LupesHk |
| 69 | Native DualSense input, rumble and PS5 prompts | anxo0; modified icons by Zacksly, CC BY 3.0 |

Original contributor commit authorship is retained. Credits and third-party notices include the people and licensed artwork. Missing offline strings in the six newly introduced dictionaries fall back to English; they are not represented as completed translations.

Integration preserves device/account checks for online play, existing server RPC protections and the server locale fix. DualSense processing is client-only. Additional checks cover malformed HID reports, stale icon-table references, reconnect rumble and foreground-window input.

## Verification and rollout gate

Individual offline integration: launcher 297 passed/3 skipped; backend 768 passed; deploy server 98 passed; database helper 2 passed. Combined launcher: 297 passed/3 skipped. Combined native Release x64 builds with MSVC 14.44.35207; DualSense, console visibility, locale and RPC guard native tests pass. Source hygiene checks pass after updating both launcher and server-kit DLL pins.

No public launcher release or production deployment is implied by source integration. Before release, validate the packaged offline flow, account reuse, backup/restore and a hunt, and test a physical DualSense over USB/Bluetooth. Keep the current live launcher available for rollback. The local shop test occupies offline-play ports; do not terminate it just to run packaging smoke tests.

Bundled combined DLL SHA-256: `4dd12196876aadbcd37f42184e60f974e375d224f8d5ba1bbd0683a914585fc3`.
