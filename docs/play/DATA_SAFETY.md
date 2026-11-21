# Play Console Data safety checklist: Angle Lens 1.0.0-rc1

Answers reflect the code in `release/rc-01` (AI assist compiled out). Re-check before each release.

| Question | Answer | Evidence |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | **No** | No network requests in the release bundle (`scripts/check-release-bundle.mjs`, source audit); no analytics/ads/crash SDKs in `package.json` or `android/app/build.gradle` |
| Photos and videos: collected? | No. Processed on-device only (ephemeral, never leaves the device) | `components/CameraAngleDetector.tsx`, `src/render/exportAnnotated.ts` |
| Files and docs: collected? | No. Saved image goes to the share sheet the user controls | `src/platform/saveImage.ts` |
| Location, contacts, identifiers, app activity, device IDs | Not accessed | No such permissions or APIs |
| Is data encrypted in transit? | Not applicable (no data transmitted) | |
| Can users request deletion? | Not applicable (no data stored off-device; uninstall removes the cache) | |
| Independent security review | No | |

## Permissions declared (merged manifest)

| Permission | Why | Notes |
| --- | --- | --- |
| `CAMERA` | Live view and freeze-frame | Requested at runtime when the user taps Start Camera |
| `INTERNET` | Present from the Capacitor template | Not used by 1.0.0-rc1. Removing it is tracked in RELEASE_READINESS (needs a device test first) |

Also fill in: **Target audience** (18+ / general tool, not for children), **Ads: No**, **App access: no login needed**,
**Content rating** questionnaire (utility, no user-generated content shared).
