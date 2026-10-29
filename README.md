# Dziennik Treningowy

Offline'owa aplikacja (PWA) do planowania i śledzenia treningów. Działa w całości w przeglądarce telefonu, dane trzyma lokalnie, a po pierwszym wczytaniu nie wymaga internetu.

**Otwórz aplikację** https://sebban03.github.io/training-log/

## Instalacja na telefonie

### Android (Chrome)

1. Otwórz link do aplikacji.
2. Chrome sam zaproponuje „Dodaj do ekranu głównego" (albo wybierz menu ⋮ i „Zainstaluj aplikację").
3. Zatwierdź. Pojawi się ikona jak przy zwykłej aplikacji, otwierana na pełnym ekranie.

### iPhone (Safari)

1. Otwórz link w Safari. To tam instalacja działa najpewniej.
2. Stuknij ikonę „Udostępnij" (kwadrat ze strzałką) na dole.
3. Wybierz „Dodaj do ekranu początkowego".
4. Zatwierdź. Ikona pojawi się na ekranie głównym.

Od tego momentu aplikacja działa jak natywna, na pełnym ekranie i bez paska adresu. Po pierwszym wczytaniu działa **całkowicie offline**.

Na iPhonie dane wpisane w karcie Safari i w aplikacji z ikony mogą być oddzielne. Zainstaluj więc aplikację, zanim zaczniesz wpisywać dane, albo przenieś je eksportem i importem kopii.

## Panele aplikacji

* **Start** pokazuje statystyki i skróty.
* **Plan** służy do zarządzania ćwiczeniami, sprzętem, treningami i harmonogramem.
* **Timer** pozwala rozpocząć trening, prowadzić aktywną sesję i odliczać przerwy.
* **Historia** zawiera log treningów, kalendarz i rekordy.
* **Profil** zawiera ustawienia i kopię zapasową.

## Dane i kopia zapasowa

Dane (ćwiczenia, treningi, historia) są trzymane **lokalnie na tym telefonie i w tej przeglądarce**. Nie synchronizują się same między urządzeniami.

W panelu **Profil** znajdziesz trzy opcje.

* **Eksportuj kopię (JSON)** pobiera plik z całą bazą danych. Warto robić to co jakiś czas, bo wyczyszczenie danych przeglądarki bez kopii oznacza utratę wszystkiego.
* **Importuj kopię** wczytuje wcześniej wyeksportowany plik, np. na nowym telefonie.
* **Usuń wszystkie dane** czyści bazę od zera.
