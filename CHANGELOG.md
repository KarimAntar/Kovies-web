# Changelog

## [0.2.12] - 2026-10-23
### Features
- Add an "Auto" quality option that plays the HLS master playlist with hls.js adaptive bitrate selection. Auto is ranked first and selected by default when the API offers it; fixed qualities remain in the source menu.
- The quality badge and the selected menu entry show the rendition currently playing on Auto (for example "Auto · 1080p").
- Landing page: fallback downloads point to desktop 0.2.12 and Android 1.1.0, the web player version is read from package.json at build time, and the feature list mentions SubSource and Auto quality.
### Design Rationale
- ABR uses `abrBandWidthFactor: 0.8` and `abrBandWidthUpFactor: 0.6`, so hls.js switches up to 1080p/4K only when measured bandwidth leaves headroom. This reduces rebuffering on connections near the 4K bitrate.
- Auto never locks a level (`currentLevel = -1`). Viewers who want a fixed rendition select a fixed-quality source.
- Sources without a quality label now read "Default", because "Auto" refers to the adaptive source.
### Notes & Caveats
- On native HLS playback (Safari without MSE) the resolution label comes from the video element's decoded size.
- Desktop uses the same renderer and plays Auto through the relay URL.

## [0.2.11] - 2026-10-23
### Features
- Desktop plays sources through the Kovies API relay when one is offered, falling back to the direct URL with registered headers.
### Design Rationale
- stellar.rip serves uncached segments slowly (7–10 s to first byte) and intermittently returns HTTP 500. The relay now reads segments ahead and retries upstream failures, which hides those delays at 1080p.
### Notes & Caveats
- Only HTTPS relay URLs are accepted. 4K can still buffer when the home connection is slower than about 20 Mbps.

## [0.2.10] - 2026-10-22
### Features
- Add keyboard-accessible player menus with focus restoration and outside-pointer dismissal that preserves playback and seek position.
- Add a viewport-clamped watch-progress context menu with a Clear Progress action.
- Record bounded, allowlisted playback diagnostics without stream URLs or arbitrary payloads.
### Design Rationale
- Share menu focus and interaction handling between web and the Electron renderer.
- Keep web and desktop versions synchronized so installed desktop clients detect the new release.
### Notes & Caveats
- Windows updates use the existing installer metadata; macOS updates link to the existing DMG download flow and require manual installation.
- Existing macOS distribution uses ad-hoc signing rather than Apple notarization.
