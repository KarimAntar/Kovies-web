# Changelog

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
