# Dziennik Treningowy

Offline'owa aplikacja (PWA) do planowania i śledzenia treningów. Działa w całości
w przeglądarce telefonu, dane trzyma lokalnie (IndexedDB), instaluje się jako
ikona na ekranie głównym i po pierwszym wczytaniu działa bez internetu.

## Struktura projektu

```
index.html          — szkielet appki, wszystkie 5 paneli
manifest.json        — konfiguracja PWA (nazwa, ikony, kolory)
sw.js                 — service worker: cache offline
css/style.css          — style
js/db.js                — warstwa IndexedDB (baza danych)
js/utils.js              — statystyki, kalendarz, formatowanie (czyste funkcje)
js/ui.js                  — wspólne elementy UI (sheet, toast, kalendarz)
js/planner.js              — panel „Plan”: ćwiczenia, sprzęt, treningi, harmonogram
js/timer.js                 — panel „Timer”: start treningu, aktywna sesja, timer przerwy
js/dashboard.js               — panel „Start”: statystyki i skróty
js/history.js                  — panel „Historia”: log, kalendarz, rekordy
js/profile.js                    — panel „Profil”: ustawienia, backup
js/app.js                         — nawigacja i inicjalizacja
icons/                              — ikony PWA
tests/                                — testy automatyczne (Node.js)
```

## 1. Wystawienie na GitHub Pages

1. Załóż nowe repozytorium na GitHubie (może być publiczne, np. `dziennik-treningowy`).
2. Wgraj do niego **całą zawartość tego folderu** (bez `node_modules`, `package.json`,
   `package-lock.json` i `tests/` — te są potrzebne tylko do testów, nie do działania appki).
3. W ustawieniach repo: **Settings → Pages → Source** wybierz branch `main` i folder `/ (root)`.
4. Po chwili GitHub poda adres w stylu:
   `https://twoja-nazwa.github.io/dziennik-treningowy/`
5. To jest link, który otwierasz na telefonie.

Jeśli wolisz zrobić to z terminala:

```bash
git init
git add index.html manifest.json sw.js css js icons README.md
git commit -m "Dziennik treningowy"
git branch -M main
git remote add origin https://github.com/TWOJA-NAZWA/dziennik-treningowy.git
git push -u origin main
```

Potem włącz GitHub Pages jak w kroku 3.

## 2. Instalacja na telefonie

**Android (Chrome):**
1. Otwórz link z GitHub Pages.
2. Chrome sam zaproponuje „Dodaj do ekranu głównego” (albo: menu ⋮ → „Zainstaluj aplikację”).
3. Zatwierdź — pojawi się ikona jak przy zwykłej appce, otwiera się na pełnym ekranie.

**iPhone (Safari):**
1. Otwórz link w Safari (must być Safari, nie Chrome — tylko Safari na iOS potrafi instalować PWA).
2. Stuknij ikonę „Udostępnij” (kwadrat ze strzałką) na dole.
3. Wybierz „Dodaj do ekranu początkowego”.
4. Zatwierdź — ikona pojawi się na ekranie głównym.

Od tego momentu appka działa jak natywna: pełny ekran, bez paska adresu, i — po
pierwszym wczytaniu — **całkowicie offline** (dzięki `sw.js`, który cache'uje
wszystkie pliki appki).

## 3. Dane i backup

Dane (ćwiczenia, treningi, historia) są trzymane w IndexedDB **lokalnie na tym
telefonie i w tej przeglądarce**. Nie synchronizują się same między urządzeniami.

W panelu **Profil** znajdziesz:
- **Eksportuj kopię (JSON)** — pobiera plik z całą bazą danych. Warto robić to
  co jakiś czas, bo wyczyszczenie danych przeglądarki = utrata wszystkiego bez kopii.
- **Importuj kopię** — wczytuje wcześniej wyeksportowany plik (np. na nowym telefonie).
- **Usuń wszystkie dane** — czyści bazę od zera.

## 4. Testy automatyczne

W folderze `tests/` są testy (baza danych, statystyki/kalendarz, oraz pełny
test integracyjny klikający przez prawdziwy interfejs). Żeby je uruchomić lokalnie:

```bash
npm install
npm test
```

Wymaga Node.js (18+). To jest tylko dla programistycznej weryfikacji — nie jest
potrzebne do korzystania z gotowej appki na telefonie.

## 5. Drobne dostosowania

- **Kolory / motyw** — zmienne w `css/style.css` w bloku `:root` (i `body.theme-light`
  dla jasnego motywu).
- **Nazwa appki na ekranie głównym** — pole `short_name` w `manifest.json`.
- **Ikona** — podmień pliki w `icons/` (192×192, 512×512, oraz wersja „maskable” 512×512).
