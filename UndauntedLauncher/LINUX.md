# Linux support

Dauntless Revived Launcher supports x86_64 Linux. The launcher itself is native Electron; the pinned Dauntless 1.4.4 game client is still the original Windows x86_64 build and is started through Proton or Wine.

No game files are included in the Linux packages. The launcher downloads or verifies the same pinned 1.4.4 files as the Windows build.

## Downloads

Each `launcher-v*` GitHub release contains:

- `DauntlessRevivedLauncher-<version>-linux-x86_64.AppImage` — universal option for most desktop distributions.
- `DauntlessRevivedLauncher-<version>-linux-amd64.deb` — Debian, Ubuntu, Linux Mint, Pop!_OS and derivatives.
- `DauntlessRevivedLauncher-<version>-linux-x86_64.rpm` — Fedora, openSUSE and RPM-family distributions.
- `DauntlessRevivedLauncher-<version>-linux-x64.zip` — portable fallback for other glibc-based desktop distributions.

For Arch Linux, Manjaro, EndeavourOS, CachyOS and similar distributions, use the AppImage or portable ZIP. NixOS can run the AppImage through its normal AppImage/FHS support (for example `appimage-run`). Alpine and other musl-only systems are not advertised because Electron's official Linux binaries target glibc.

Check the file against `SHA256SUMS.txt` from the same release before running it.

## Install

AppImage:

```bash
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Debian/Ubuntu:

```bash
sudo apt install ./DauntlessRevivedLauncher-*-linux-amd64.deb
```

Fedora:

```bash
sudo dnf install ./DauntlessRevivedLauncher-*-linux-x86_64.rpm
```

openSUSE:

```bash
sudo zypper install ./DauntlessRevivedLauncher-*-linux-x86_64.rpm
```

The default game folder on Linux is `~/Games/DauntlessRevived`. You can choose another absolute Linux path or point the launcher at an existing Dauntless 1.4.4 folder.

## Proton and Wine

The launcher creates its own compatibility prefix inside its application data directory and automatically sets the native `dxgi` override required by the Dauntless Revived DLLs.

Runtime selection is:

1. `DAUNTLESS_REVIVED_PROTON` when explicitly set.
2. `DAUNTLESS_REVIVED_WINE` when explicitly set.
3. Steam Proton / Proton-GE found under Steam's normal compatibility-tool directories.
4. `wine64` or `wine` from `PATH`.
5. Lutris Wine runners under `~/.local/share/lutris/runners/wine`.

Examples:

```bash
DAUNTLESS_REVIVED_PROTON="$HOME/.local/share/Steam/compatibilitytools.d/GE-Proton10-1/proton" ./DauntlessRevivedLauncher-*.AppImage
```

```bash
DAUNTLESS_REVIVED_WINE=/usr/bin/wine64 ./DauntlessRevivedLauncher-*.AppImage
```

If the Play button reports that no compatibility runtime exists, install Steam with a Proton version, Proton-GE, Wine, or a Lutris Wine runner and try again.

Private/Tailscale servers work on Linux too; the launcher searches the normal Linux Tailscale executable locations and `PATH`.

## Updates and limitations

Windows uses the existing Squirrel self-update feed. Linux packages do not modify that feed: update the Linux launcher through a newer GitHub release or your package format.

The supported game target is x86_64. ARM64 Linux is not advertised because the Windows x86_64 game would need an additional CPU-translation layer that this launcher does not manage.

If Proton or Wine starts but the game does not, check the launcher's log directory under its Electron user-data directory. You can force a known-good runtime with one of the environment variables above.
