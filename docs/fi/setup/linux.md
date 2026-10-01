---
title: Linux-käynnistin
parent: Asennus
nav_order: 3
description: "Dauntless Revived Linuxissa: Ubuntu, Debian, Mint, Pop!_OS, Fedora, openSUSE, Arch, EndeavourOS, CachyOS, Manjaro, NixOS, Gentoo, Void ja muut x86_64-jakelut."
lang: fi
ref: setup/linux
locale: fi_FI
---

{% assign friends_page = site.pages | where: "path", "fi/setup/friends.md" | first %}
{% assign trouble_page = site.pages | where: "path", "fi/setup/troubleshooting.md" | first %}

# Linux-käynnistin
{: .no_toc }

Dauntless Revived Launcher toimii natiivisti **x86_64-Linuxissa**. Itse Dauntless 1.4.4 on edelleen
alkuperäinen Windowsin x86_64-versio, joten käynnistin ajaa pelin **Protonin tai Winen** kautta.
Kutsu, tili ja palvelin ovat samat kuin Windows-pelaajilla.

Linux-paketeissa ei ole pelitiedostoja. Käynnistin lataa tai tarkistaa saman kiinnitetyn 1.4.4-version
kuin Windowsissa, asentaa kaksi kiinnitettyä DLL-tiedostoa, luo oman yhteensopivuusprefiksin ja asettaa
tarvittavan natiivin `dxgi`-ohituksen automaattisesti.

<details open markdown="block">
  <summary>Sisältö</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

## Ennen aloittamista

Tarvitset:

- **x86_64**-Linux-työpöydän, joka käyttää glibc:tä;
- toimivat näytönohjaimen ajurit ja Vulkan-tuen Proton/DXVK-polulle;
- yhden yhteensopivuusympäristön: Steam Proton, Proton-GE, Wine tai Lutris Wine;
- noin 11 Gt pelille sekä vapaata tilaa latauksille ja yhteensopivuusprefiksille;
- Tailscalen vain, jos ylläpitäjä antoi yksityisen/v1-kutsun.

ARM64 ei ole tuettu, koska itse peli on Windows x86_64. Alpinea ja muita pelkästään musl-libc:tä
käyttäviä järjestelmiä ei tällä hetkellä luvata tuetuiksi, koska Electronin virallinen Linux-versio
on tehty glibc:lle.

Lataa uusin käynnistin
[GitHub Releases -sivulta](https://github.com/mixutin/dauntless-revived/releases/latest). Jokaisessa
käynnistinjulkaisussa on:

| Tiedosto | Suositus |
|:--|:--|
| `DauntlessRevivedLauncher-<versio>-linux-x86_64.AppImage` | Yleispaketti useimmille työpöytäjakeluille |
| `DauntlessRevivedLauncher-<versio>-linux-amd64.deb` | Debian, Ubuntu, Mint, Pop!_OS ja johdannaiset |
| `DauntlessRevivedLauncher-<versio>-linux-x86_64.rpm` | Fedora, openSUSE ja tavalliset RPM-järjestelmät |
| `DauntlessRevivedLauncher-<versio>-linux-x64.tar.gz` | Siirrettävä varavaihtoehto esimerkiksi Archille ja Gentoolle |
| `DauntlessRevivedLauncher-<versio>-linux-x64.zip` | Sama siirrettävä sovellus ZIP-muodossa |

Lataa myös `SHA256SUMS.txt` ja tarkista lataus:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Lataamasi tiedoston kohdalla pitää lukea **OK**.

## Ubuntu, Debian, Linux Mint ja Pop!_OS

Käytä `.deb`-pakettia:

```bash
cd ~/Downloads
sudo apt install ./DauntlessRevivedLauncher-*-linux-amd64.deb
```

APT ratkaisee riippuvuudet, kun paikallinen DEB asennetaan näin.

Pelin ajamiseen helpoin vaihtoehto on yleensä natiivisti asennettu Steam + Proton. Asenna Steam
jakelusi tavallisesta pakettilähteestä tai sovelluskaupasta, käynnistä se kerran ja varmista, että
ainakin yksi Proton-versio on asennettu. Käynnistin löytää tavalliset natiivin Steamin Proton-polut
automaattisesti.

Wine käy myös. Asenna jakelun tarjoama Wine/Wine64 APT:n kautta ja käynnistä Dauntless Revived
normaalisti.

Oletuspelikansio Linuxissa on:

```text
~/Games/DauntlessRevived
```

Päivitä lataamalla uudempi DEB ja ajamalla sama `apt install ./...` -komento. Poista vain käynnistin:

```bash
sudo apt remove dauntless-revived-launcher
```

Käynnistimen poistaminen ei tarkoituksella poista ladattua peliä tai käyttäjätietoja.

## Fedora, Nobara, Rocky Linux, AlmaLinux ja muut DNF-järjestelmät

Tavallisessa muokattavassa Fedora/RHEL-sukuisessa järjestelmässä käytä RPM:ää:

```bash
cd ~/Downloads
sudo dnf install ./DauntlessRevivedLauncher-*-linux-x86_64.rpm
```

Fedora tarjoaa Winen `wine`-metapakettina:

```bash
sudo dnf install wine
```

Steam Proton käy myös. Natiivisti asennettu Steam tunnistetaan automaattisesti. Fedora-käyttäjät
asentavat Steamin usein RPM Fusionista; Nobarassa pelikäyttöön tarvittavia osia on yleensä valmiiksi.

**Bazzite-, Fedora Silverblue-, Kinoite- ja muissa immutable/Atomic-järjestelmissä** käytä mieluummin
AppImagea kuin kerrostat RPM-paketin perusjärjestelmään:

```bash
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Jos Steam on Flatpak, katso [Flatpak Steam ja Proton](#flatpak-steam-ja-proton).

RPM-asennuksen poistaminen:

```bash
sudo dnf remove dauntless-revived-launcher
```

## openSUSE Tumbleweed ja Leap

Asenna RPM Zypperillä:

```bash
cd ~/Downloads
sudo zypper install ./DauntlessRevivedLauncher-*-linux-x86_64.rpm
```

Jos et käytä Steam Protonia, asenna Wine:

```bash
sudo zypper install wine
```

Päivitä asentamalla uudempi RPM samalla komennolla. Poista käynnistin:

```bash
sudo zypper remove dauntless-revived-launcher
```

## Arch Linux, EndeavourOS, CachyOS ja Manjaro

Käytä AppImagea tai siirrettävää tar-pakettia. Projektilla ei vielä ole omaa AUR-pakettia.

AppImage:

```bash
cd ~/Downloads
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Siirrettävä tar.gz:

```bash
mkdir -p ~/.local/opt/dauntless-revived
tar -xzf DauntlessRevivedLauncher-*-linux-x64.tar.gz -C ~/.local/opt/dauntless-revived
~/.local/opt/dauntless-revived/DauntlessRevivedLauncher
```

Steam Protonia varten ota Archissa `multilib` käyttöön ja asenna Steam:

```bash
sudo pacman -Syu
sudo pacman -S steam
```

Käynnistä Steam kerran ja asenna/ota käyttöön Proton. Käynnistin etsii natiivin Steamin tavalliset
yhteensopivuustyökalujen kansiot automaattisesti.

Wine-vaihtoehto:

```bash
sudo pacman -S wine
```

CachyOS, EndeavourOS ja Manjaro voivat tarjota omia Wine/Proton-pakettejaan. Niitä voi käyttää; jos
ajoympäristö on epästandardissa kansiossa, käytä alla kuvattuja ympäristömuuttujia.

## NixOS

Tavallinen AppImage ei toimi NixOS:ssa suoraan, koska tavallisia FHS-kirjastopolkuja ei ole. Käytä
`appimage-run`-työkalua.

Kertaluonteisesti:

```bash
nix-shell -p appimage-run --run 'appimage-run ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage'
```

Pysyvä AppImage- ja Steam-tuki `/etc/nixos/configuration.nix`-tiedostoon:

```nix
programs.appimage = {
  enable = true;
  binfmt = true;
};

programs.steam.enable = true;
```

Ota asetukset käyttöön:

```bash
sudo nixos-rebuild switch
```

NixOS tukee myös GE-Protonin deklaratiivista asennusta:

```nix
programs.steam.extraCompatPackages = with pkgs; [
  proton-ge-bin
];
```

Jos käynnistin ei löydä sitä automaattisesti, osoita `DAUNTLESS_REVIVED_PROTON` oikeaan
`proton`-skriptiin.

## Gentoo

Siirrettävä tar.gz on yksinkertaisin vaihtoehto:

```bash
mkdir -p ~/.local/opt/dauntless-revived
tar -xzf DauntlessRevivedLauncher-*-linux-x64.tar.gz -C ~/.local/opt/dauntless-revived
~/.local/opt/dauntless-revived/DauntlessRevivedLauncher
```

AppImage käy myös sopivasti määritetyllä työpöydällä.

Gentoo tarjoaa Valven Wine-haaran amd64:lle paketilla `app-emulation/wine-proton`:

```bash
sudo emerge --ask app-emulation/wine-proton
```

Jos Wine ei tule `PATH`-muuttujaan nimellä `wine` tai `wine64`, aseta
`DAUNTLESS_REVIVED_WINE` Winen ohjelmatiedostoon ennen käynnistystä.

## Void Linux

Käytä AppImagea:

```bash
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

tai tar-pakettia:

```bash
mkdir -p ~/.local/opt/dauntless-revived
tar -xzf DauntlessRevivedLauncher-*-linux-x64.tar.gz -C ~/.local/opt/dauntless-revived
~/.local/opt/dauntless-revived/DauntlessRevivedLauncher
```

Jos et käytä Steam Protonia, asenna Wine Voidin pakettilähteestä:

```bash
sudo xbps-install -S wine
```

## Solus, Mageia, OpenMandriva ja muut glibc-jakelut

Aloita **AppImagella**, koska se ei riipu jakelun omasta pakettimuodosta:

```bash
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Jos AppImage ei sovi järjestelmään, käytä siirrettävää `.tar.gz`-pakettia.

Mageia, OpenMandriva ja muut tavalliset RPM-järjestelmät voivat kokeilla myös RPM-pakettia omalla
paketinhallinnallaan. Pelin ei tarvitse olla Steam-kirjastossa: käynnistin tarvitsee vain Proton- tai
Wine-ajoympäristön, kun painat **PELAA**.

## Flatpak Steam ja Proton

Käynnistin etsii Protonia automaattisesti natiivin Steamin tavallisista paikoista:

```text
~/.local/share/Steam
~/.steam/root
~/.steam/steam
```

Flatpak Steam käyttää tavallisesti:

```text
~/.var/app/com.valvesoftware.Steam/data/Steam
```

Tätä polkua ei tällä hetkellä tutkita automaattisesti. Osoita käynnistin Protonin `proton`-skriptiin
itse. Esimerkki Proton Experimentalista:

```bash
DAUNTLESS_REVIVED_PROTON="$HOME/.var/app/com.valvesoftware.Steam/data/Steam/steamapps/common/Proton - Experimental/proton" \
  ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Muuta kansion nimi siihen Proton-versioon, joka koneellasi oikeasti on.

## Protonin tai Winen valinta

Valintajärjestys on:

1. `DAUNTLESS_REVIVED_PROTON`, jos se on asetettu;
2. `DAUNTLESS_REVIVED_WINE`, jos se on asetettu;
3. Steam Proton / Proton-GE natiivin Steamin tavallisissa kansioissa;
4. `wine64` tai `wine` `PATH`-muuttujasta;
5. Lutris Wine kansiosta `~/.local/share/lutris/runners/wine`.

Esimerkkejä:

```bash
DAUNTLESS_REVIVED_PROTON="$HOME/.local/share/Steam/compatibilitytools.d/GE-Proton10-1/proton" \
  ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

```bash
DAUNTLESS_REVIVED_WINE=/usr/bin/wine64 \
  ./DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

Käynnistin tekee oman Wine/Proton-prefiksinsä Electronin käyttäjätietokansioon. Älä osoita sitä
olemassa olevan Steam-pelin prefiksiin.

## Liittyminen ja pelin asennus

Kun käynnistin on auki, käyttö on sama kaikissa Linux-jakeluissa:

1. Avaa tai liitä ylläpitäjän `dauntless-revived://join?...`-kutsu.
2. Paina **LIITY**.
3. Rekisteröi käyttäjänimi tai tuo olemassa oleva tiliavain.
4. Tallenna tarjottu avaimen varmuuskopio yksityiseen paikkaan.
5. Paina **ASENNA**. Oletuspelikansio on `~/Games/DauntlessRevived`.
6. Jos sinulla on jo täsmälleen oikeat 1.4.4-tiedostot, valitse **Minulla on jo pelitiedostot** ja
   osoita niiden Linux-kansio.
7. Paina **PELAA**. Käynnistin valmistelee Wine/Proton-prefiksin, kirjoittaa pelin asetukset ja
   käynnistää `Dauntless-Win64-Shipping.exe`-tiedoston valitulla ajolla.

Yksityinen/v1-kutsu tarvitsee Tailscalen Linux-koneelle ja ylläpitäjän jaon hyväksymisen. Julkinen/v2
-kutsu ei tarvitse Tailscalea.

Muu pelaajan käyttö löytyy sivulta
[Liity kaverina]({{ friends_page.url | relative_url }}).

## Yleisiä Linux-ongelmia

### "Linux needs Proton or Wine"

Käynnistin ei löytänyt yhteensopivaa ajoympäristöä. Asenna natiivi Steam + Proton, Wine tai Lutris
Wine. Jos se on epästandardissa polussa, aseta `DAUNTLESS_REVIVED_PROTON` tai
`DAUNTLESS_REVIVED_WINE`.

### AppImage ei käynnisty

Varmista ensin, että tiedosto on suoritettava:

```bash
chmod +x DauntlessRevivedLauncher-*-linux-x86_64.AppImage
```

NixOS:ssa käytä `appimage-run`-työkalua. Jos AppImage/FUSE ei sovi muuhun jakeluun, käytä
siirrettävää tar-pakettia.

### Käynnistin avautuu mutta PELAA epäonnistuu

Käynnistä sovellus kerran terminaalista ja tarkista käynnistimen lokit Electronin käyttäjätietokansion
alta. Tavallisia syitä ovat:

- puuttuva tai rikkinäinen Vulkan-ajuri;
- Proton/Wine on siirretty asennuksen jälkeen;
- Flatpak Steamin Proton tarvitsee käsin annetun polun;
- valitun pelikansion käyttöoikeudet;
- pelikansio ei ole täsmälleen kiinnitetty 1.4.4-versio.

Kokeile toista asennettua Proton- tai Wine-versiota ennen kuin muutat pelitiedostoja.

### Yksityinen palvelin ei yhdistä

Tarkista Tailscale:

```bash
tailscale status
tailscale ping <palvelimen-nimi-tai-100.x.y.z>
```

Käynnistin etsii `/usr/bin/tailscale`, `/usr/local/bin/tailscale`, `/snap/bin/tailscale` ja
`PATH`-muuttujan.

Muut ongelmat löytyvät
[Vianetsinnästä]({{ trouble_page.url | relative_url }}).

## Päivitykset

Linux ei käytä Windowsin Squirrel-automaattipäivitystä. Uuden version ilmestyessä:

- DEB: lataa uusi tiedosto ja aja `sudo apt install ./uusi.deb`;
- RPM: asenna uusi RPM DNF:llä tai Zypperillä;
- AppImage: korvaa vanha AppImage;
- ZIP/tar.gz: korvaa sovelluskansio.

Ladattu peli ja käynnistimen käyttäjätiedot ovat erillään itse käynnistinpaketista.
