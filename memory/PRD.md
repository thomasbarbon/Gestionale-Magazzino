# GommaGest – App Autofficina Magazzino Pneumatici

## Overview
App mobile responsive (phone / tablet / desktop web) in italiano per la gestione del magazzino pneumatici di un'autofficina. Nessuna autenticazione (uso singolo officina).

## Features
- **Dashboard**: statistiche (totale gomme, voci in catalogo, pollici diversi), accesso rapido al Magazzino, cronologia movimenti (create/add/remove/delete) con delta e quantità risultante.
- **Magazzino**: pneumatici raggruppati per pollici del cerchio (14", 15", 16"...), gruppi espandibili. Ogni voce mostra sigla/misura, marchio, stagione (chip colorati), quantità con +/- diretti e pulsante elimina.
- **Nuove gomme (modal)**: form con sigla/misura (free text), marchio (dropdown dei 20 marchi consentiti), stagione (All Season / Invernali / Estive), quantità. Validazione lato client + backend.
- **Deduplica automatica**: inserendo uno pneumatico con stessi size+brand+season di uno esistente, la quantità viene sommata invece di creare una voce duplicata. Differenze su qualsiasi campo (sigla, marchio o stagione) generano voci distinte.
- **Ricerca/filtro**: ricerca testuale (misura/marchio/stagione) + chip per filtrare per pollice del cerchio.
- **Responsive**: layout a griglia su tablet/desktop, singola colonna su phone; stesso design per non confondere l'utente.

## Tech
- **Backend**: FastAPI + MongoDB (`motor`). Endpoints prefissati `/api`:
  - `GET /api/brands` – 20 marchi + 3 stagioni
  - `GET /api/tires` – lista pneumatici
  - `POST /api/tires` – crea o incrementa (merge su size+brand+season)
  - `PATCH /api/tires/{id}/quantity` – `{delta}` +/- aggiorna quantità e logga movimento
  - `DELETE /api/tires/{id}` – elimina + logga movimento
  - `GET /api/movements?limit=50` – cronologia desc
- **Frontend**: Expo Router (file-based routing), React Query, Ionicons.
  - `app/(tabs)/index.tsx` Dashboard
  - `app/(tabs)/magazzino.tsx` Magazzino + modal Nuove gomme
  - `src/api.ts` client API tipizzato
  - `src/theme.ts` tema (automotive blu `#0F4C81` + arancio `#FF6B00`)
  - `src/responsive.ts` hook `useResponsive()` (phone/tablet/desktop)

## Marchi consentiti (20)
Michelin, Pirelli, Continental, Bridgestone, Goodyear, Dunlop, Hankook, Firestone, Yokohama, Falken, Kleber, BFGoodrich, Vredestein, Nokian, Kumho, Toyo, Nexen, Uniroyal, Fulda, Barum.

## Stato Test
- Backend: 14/14 pytest PASSED.
- Frontend: Dashboard, Magazzino, +/- qty, delete, search, chip filtro, modal Nuove gomme con dropdown e salvataggio: verificati.
