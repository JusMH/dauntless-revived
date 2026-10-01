---
title: Asennus
parent: Dauntless Revived suomeksi
nav_order: 2
has_children: true
has_toc: false
description: "Näin Dauntless Revived otetaan käyttöön: oma palvelin Windows-koneelle, kavereiden liittyminen, palvelin ryhmälle ja yleisimpien ongelmien korjaus."
lang: fi
ref: setup/index
locale: fi_FI
---

{% assign host_page = site.pages | where: "path", "fi/setup/host.md" | first %}
{% assign friends_page = site.pages | where: "path", "fi/setup/friends.md" | first %}
{% assign linux_page = site.pages | where: "path", "fi/setup/linux.md" | first %}
{% assign admin_page = site.pages | where: "path", "fi/setup/admin.md" | first %}
{% assign trouble_page = site.pages | where: "path", "fi/setup/troubleshooting.md" | first %}
{% assign winserver_page = site.pages | where: "path", "fi/setup/windows-server.md" | first %}
{% assign upgrade_page = site.pages | where: "path", "fi/setup/upgrading.md" | first %}
{% assign verification_page = site.pages | where: "path", "fi/findings/verification.md" | first %}
{% assign legal_page = site.pages | where: "path", "fi/legal.md" | first %}
{% assign reference_page = site.pages | where: "path", "fi/reference/index.md" | first %}

# Asennus

Nämä sivut ovat ohjeita niille, jotka haluavat pystyttää palvelimen tai liittyä kaverin
palvelimelle. Ne kertovat, miten me pyöritämme Dauntless Revivedia: aito **Dauntless 1.4.4**
-peliohjelma (lokakuu 2020, UE4 eli Unreal Engine 4 -pelimoottori, pak v9) keskustelee meidän
muokatun [Undaunted](https://github.com/SyST3MDeV/Undaunted)-versiomme kanssa, ja kaikki pyörii
yhdellä Windows-tietokoneella. Kaikki tämän osion tieto koskee versiota **1.4.4**. Pelin viimeinen
versio, 2.1.1, ei toimi tällä kokoonpanolla, koska Undauntedin palvelin-DLL (peliin ladattava
ohjelmakirjasto) muokkaa kiinteitä muistiosoitteita 1.4.4:n ohjelmatiedoston sisällä.

Tarvitset **oman kopion** 1.4.4-peliohjelmasta. Tällä sivustolla ja lähdekoodissa ei ole
pelitiedostoja eikä linkkejä niiden latauksiin.

**Tilanne (22.9.2026).** Isännän kokoonpano on se, mitä ajamme omistajan koneella: vain koneen
sisällä (loopback) ja pelkästään omistajalle. Kavereita varten käytämme
[Windows-palvelinpakettia]({{ winserver_page.url | relative_url }}) julkisessa tilassa: se on asennettu
vuokratulle Windows Server 2019 -virtuaalipalvelimelle, jolla omistaja pelasi internetin yli
22.9.2026, ja testi toisen pelaajan kanssa on seuraavana vuorossa. Isännän koneen avaaminen
kavereille Tailscalen kautta (ohjelma, joka tekee salatun, yksityisen yhteyden koneiden välille) on
kirjoitettu auki, mutta sitä ei ole vielä ajettu alusta loppuun, ja sivuilla kerrotaan se aina siellä,
missä sillä on merkitystä.

## Sivut {#pages}

| Sivu | Kenelle | Mitä se kattaa |
|---|---|---|
| [Pystytä palvelin]({{ host_page.url | relative_url }}) | Palvelinta pyörittävälle | Version tarkistus, asennus lyhyeen polkuun, kahden DLL-tiedoston asennus kiinnitettyjä tiivisteitä vasten, asetustiedostot, metagamen ja deploy-palvelimen käynnistys, ensimmäisen käynnistyksen tarkistukset, peliohjelman käynnistys ja kaiken pysäyttäminen. Lopussa on yhden sivun käynnistyslista. |
| [Liity kaverina]({{ friends_page.url | relative_url }}) | Kutsutulle pelaajalle | Tailscale, pelitiedostojen tarkistus, kahden DLL-tiedoston kopiointi, rekisteröityminen henkilökohtaista tiliavainta varten, käynnistys ja se, mikä toimii juuri nyt. |
| [Linux-käynnistin]({{ linux_page.url | relative_url }}) | Linux-pelaajalle | Jakelukohtaiset ohjeet Ubuntulle/Debianille/Mintille/Pop!_OS:lle, Fedoralle, openSUSElle, Arch-sukuisille jakeluille, NixOS:lle, Gentoolle, Voidille sekä AppImage- ja tar-paketeille, mukaan lukien Proton/Wine. |
| [Palvelin ryhmälle]({{ admin_page.url | relative_url }}) | Isännälle, kun kokonaisuus toimii jo paikallisesti | Tailscale-jako, Tailscale-liitäntään rajatut palomuurisäännöt, osoitteiden vaihtaminen, kutsukoodit ja tilit, ylläpitorajapinta, kapasiteetti ja tietokannan varmuuskopiot. Tavoitekokoonpano, jota ei ole vielä testattu alusta loppuun. |
| [Windows-palvelin]({{ winserver_page.url | relative_url }}) | Isännälle, jatkuvasti päällä olevaa vuokrapalvelinta varten | Yksi komento omalta koneelta asentaa kaiken Windows Server 2019 -virtuaalipalvelimelle SSH-avaimella. Julkinen tila: yksi salattu portti kiinnitetyllä varmenteella, ja peliportit auki vain kirjautuneille pelaajille. Kutsut, päivitykset paluumahdollisuudella, varmuuskopiot ja poistaminen. Asennettu vuokratulle palvelimelle julkiseen tilaan 21.–22.9.2026; yksi pelaaja pelasi siellä internetin yli 22.9.2026, ja testi toisen pelaajan kanssa on seuraavana vuorossa. |
| [Vianetsintä]({{ trouble_page.url | relative_url }}) | Kaikille | Ongelmat, joihin oikeasti törmäsimme, syineen ja korjauksineen. Muutama kohta on peräisin koodin lukemisesta, ja ne on merkitty sellaisiksi. |
| [Päivitysohjeet]({{ upgrade_page.url | relative_url }}) | Isännälle ennen sellaisen palvelimen päivitystä, jolla on jo pelaajia | Mitä kukin päivitys muuttaa pelaajille ja mitä pitää päättää ensin. Nyt: oikea eteneminen on oletuksena päällä, joten aiemmin pelanneet aloittavat Slayer-tasolta 1, ellet pidä heidän maksimitasojaan tai jatka tyngällä. |

## Suositeltu järjestys {#suggested-order}

1. Isäntä: käy läpi sivu [Pystytä palvelin]({{ host_page.url | relative_url }}), kunnes seisot
   Ramsgatessa omalla koneellasi.
2. Isäntä: seuraa sivua [Palvelin ryhmälle]({{ admin_page.url | relative_url }}) päästääksesi
   kaverit sisään.
3. Linux-kaveri: asenna käynnistin sivun [Linux-käynnistin]({{ linux_page.url | relative_url }}) mukaan.
4. Jokainen kaveri: seuraa sivua [Liity kaverina]({{ friends_page.url | relative_url }}).

Näiden ohjeiden taustalla olevat tarkat tiedot (jokainen asetus, portti, HTTP-reitti, tiedosto ja
skriptin parametri oletusarvoineen) ovat [Tekninen viite]({{ reference_page.url | relative_url }}) -osiossa.

Sivulla [Pelitiedostojen tarkistaminen]({{ verification_page.url | relative_url }}) kerrotaan
yksityiskohtaisesti, miten tarkistimme, että oma pelikopiomme on aito, täydellinen ja puhdas. Jos
pyörität muokattua versiota muille ihmisille, lue ensin [Kiitokset ja lisenssi]({{ legal_page.url | relative_url }}):
AGPL-lisenssi vaatii, että tarjoat heille lähdekoodin.
