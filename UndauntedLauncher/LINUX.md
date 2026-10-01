# Linux support

Dauntless Revived Launcher supports x86_64 Linux. The launcher itself is native Electron; the pinned Dauntless 1.4.4 game client is still the original Windows x86_64 build and is started through Proton or Wine.

No game files are included in the Linux packages. The launcher downloads or verifies the same pinned 1.4.4 files as the Windows build.

Full distro-by-distro instructions are on the project site:

- [Linux launcher guide (English)](https://mixutin.github.io/dauntless-revived/setup/linux.html)
- [Linux-käynnistimen ohje (suomeksi)](https://mixutin.github.io/dauntless-revived/fi/setup/linux.html)

## Downloads

Each `launcher-v*` GitHub release contains:

- `DauntlessRevivedLauncher-<version>-linux-x86_64.AppImage` — universal option for most desktop distributions.
- `DauntlessRevivedLauncher-<version>-linux-amd64.deb` — Debian, Ubuntu, Linux Mint, Pop!_OS and derivatives.
- `DauntlessRevivedLauncher-<version>-linux-x86_64.rpm` — Fedora, openSUSE and RPM-family distributions.
- `DauntlessRevivedLauncher-<version>-linux-x64.tar.gz` — portable fallback for Arch/Gentoo and other glibc-based desktops.
- `DauntlessRevivedLauncher-<version>-linux-x64.zip` — the same portable application in ZIP form.

| Distribution | Recommended package |
|---|---|
| Ubuntu, Debian, Linux Mint, Pop!_OS | `.deb` |
| Fedora, Nobara, Rocky, AlmaLinux | `.rpm` on mutable systems; AppImage on Atomic/immutable systems |
| openSUSE Tumbleweed / Leap | `.rpm` |
| Arch, EndeavourOS, CachyOS, Manjaro | AppImage or `.tar.gz` |
| NixOS | AppImage through `appimage-run` |
| Gentoo / Void / other glibc distros | AppImage or `.tar.gz` |

Alpine and other musl-only systems are not advertised because Electron's official Linux binaries target glibc. ARM64 is not supported because the game itself is Windows x86_64.

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

Arch-family / Gentoo / Void portable install:

```bash
mkdir -p ~/.local/opt/dauntless-revived
tar -xzf DauntlessRevivedLauncher-*-linux-x64.tar.gz -C ~/.local/opt/dauntless-revived
~/.local/opt/dauntless-revived/DauntlessRevivedLauncher
```

NixOS one-off AppImage run:

```bash
nix-shell -p appimage-run --run 'appimage-run ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage'
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

### Flatpak Steam

Native Steam locations are auto-detected. Flatpak Steam normally keeps Proton under
`~/.var/app/com.valvesoftware.Steam/data/Steam`, which is not currently searched automatically.
Point the launcher at the actual Proton script, for example:

```bash
DAUNTLESS_REVIVED_PROTON="$HOME/.var/app/com.valvesoftware.Steam/data/Steam/steamapps/common/Proton - Experimental/proton" \
  ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Private/Tailscale servers work on Linux too; the launcher searches the normal Linux Tailscale executable locations and `PATH`.

## Updates and limitations

The Linux launcher now checks the latest stable GitHub launcher release at startup and every hour. When an update is available, the existing update banner appears. AppImage installs replace and relaunch themselves; .deb and .rpm installs download the matching package and request administrator approval through PolicyKit before handing the update to the system package manager. Prereleases are not offered automatically.

Windows continues to use the existing Squirrel self-update feed.

The supported game target is x86_64. ARM64 Linux is not advertised because the Windows x86_64 game would need an additional CPU-translation layer that this launcher does not manage.

If Proton or Wine starts but the game does not, check the launcher's log directory under its Electron user-data directory. You can force a known-good runtime with one of the environment variables above.
