# Country occasion photos

The five occasion cards on home (Dinner, Work, Date, Wedding, Party) can show photographs from the visitor's country. This is presentation only: the country never reaches the styling questions, the looks, prices, language or analytics beyond its two letter code.

## How the country is found

| Order | Source | Where | Confidence |
| --- | --- | --- | --- |
| 1 | `manual` | The visitor chose a country in the picker. Kept in `localStorage` as `praxis_country` (two letters only) until they choose Automatic. | high |
| 2 | `hosting` | A country header set by a trusted proxy. Off unless the `COUNTRY_HEADER` environment variable names it (for example `cf-ipcountry` behind Cloudflare). Railway sets no such header today. | high |
| 3 | `ip` | `server/index.mjs` looks the address up in the free DB-IP "IP to Country Lite" tables bundled from npm (`@ip-location-db/dbip-country`, CC BY 4.0). No network call, no key, no cost. The address is looked up and dropped, never logged or stored. | medium |
| 4 | `language` | A region in the browser language, such as `pl-PL`. English tags are ignored because en-US is the default everywhere. | low |
| 5 | `default` | Nothing above. The default (international) photos. | low |

The browser is never asked for its location and nothing uses GPS.

The server writes the result into the page as `<meta name="praxis-country" content="PL" data-source="ip">`, so the right photos are chosen before the first paint: there is no second request and no photo swap. Because the page differs by visitor it is sent `Cache-Control: private, no-cache`; no shared cache can hand one country's page to another. Photos, scripts and styles are the same for everyone and cache publicly (`/assets` for a year, everything else for a week). `GET /api/country` answers `{ countryCode, source, ready }` for checking, never the address.

The address comes from `X-Forwarded-For` (the first entry, which Railway's proxy sets), then `X-Real-IP`, then the socket. A visitor who forges that header changes only their own photos. VPN users see the VPN's country, which is why the picker exists.

The IP tables take about two seconds to load when the server starts; until then every visitor gets the default photos. They are updated by bumping `@ip-location-db/dbip-country` in package.json. The licence asks for a link to db-ip.com where results are used: it is in the country picker.

## Choosing photos

`src/a/lib/country.ts` turns the country into a collection:

- the country's own five photos when its entry in `src/config/occasionCollections.ts` has `status: "active"`;
- otherwise the default collection. Never a neighbour's: Poland never borrows Germany, Lebanon never borrows Saudi Arabia.
- If one photo fails to load, that card alone swaps to the default photo for the same occasion. The card keeps its size and still works, and nothing shows a broken image.

Only the five photos for the chosen collection are requested, at 480 or 960 wide depending on the screen.

## The picker

The small "Location" line at the foot of home opens a searchable list of every country, with Automatic at the top (showing what was detected). A choice applies at once, survives a reload, and changes the photos only. Keyboard: Tab to the line, Enter to open, type to search, Escape to close.

## Analytics

| Event | Properties |
| --- | --- |
| `country_collection_loaded` | `country` (code or `none`), `source`, `collection` (code or `default`), `version`, `localized`; once per visit per country |
| `country_manually_changed` | `previous`, `next`, `automatic` |
| `occasion_selected` | now also `collection`, the set that was showing |

No address, coordinates or city is ever recorded.

## Adding or activating a country

1. Add or find its entry in `src/config/occasionCollections.ts` (code, English name, cities). New entries start `pending`; a pending country shows the default photos.
2. Put five photos in `public/images/occasions/<CODE>/`: `dinner`, `work`, `date`, `wedding`, `party`, each as `-480.webp` and `-960.webp`, portrait at about 2:3 (480 x 720 and 960 x 1440), WebP quality about 80. Keep faces and key architecture inside the middle 70 percent so the phone crop keeps them.
3. Write `CREDITS.md` in that folder: for each photo, the source page, photographer, licence, and where it was taken.
4. Preview with `/?photos=<CODE>` on any build. That shows a pending set without activating it.
5. Look at every photo against the brief below and the quality rules. File names prove nothing.
6. Add `alt` text for all five, set `status: "active"`, bump `version` if photos changed, then run `npm run photos:check`. It fails if any file is missing, the wrong size, landscape, without alt text, or without credits.
7. `npm run build`, `npm run e2e`, push.

Home code does not change when a country is added.

## Quality rules (every country)

Premium editorial lifestyle photography: natural light, warm neutral grading, controlled contrast, elegant composition, real places and real people where people appear. No flags, no postcard landmarks as the subject, no embedded text or logos, no visible brand names, no over-saturation, no artificial looking faces, no costume or wrong dress for the place. The five should read as one set and still feel like Praxis beside the champagne palette. Licensed for commercial use, with credits.

## Creative briefs

Each card: Dinner is a restaurant or table, Work a well dressed man in a business setting, Date an intimate evening setting, Wedding the celebration or its setting with locally right dress, Party a refined night out.

| Code | Country | Cities | Direction |
| --- | --- | --- | --- |
| PL | Poland | Warsaw, Kraków, Gdańsk, Wrocław | Warm historic interiors and modern Warsaw. Vaulted Kraków restaurants, Powiśle and Mokotów business streets, a candlelit Kazimierz evening, a manor or palace wedding, a Warsaw cocktail bar. Modern Polish, not a postcard of the Old Town. |
| LB | Lebanon | Beirut, Byblos, Batroun, Mount Lebanon | Mediterranean light. Gemmayzeh and Mar Mikhael restaurants, downtown Beirut offices, a sea view evening in Batroun or Byblos, a garden or mountain wedding with Lebanese scale and style, a Beirut rooftop or club. |
| AE | United Arab Emirates | Dubai, Abu Dhabi | Contemporary luxury architecture, DIFC business, fine dining with a skyline, a hotel ballroom wedding, a refined lounge. Not desert clichés. |
| SA | Saudi Arabia | Riyadh, Jeddah, AlUla | Modern Riyadh (KAFD, Diriyah), Jeddah's waterfront and Al Balad, AlUla's landscape used sparingly. Hospitality, professional dress that is right for the setting, an elegant celebration, a social gathering or cultural evening. Respectful, contemporary, accurate. |
| FR | France | Paris, Lyon, Bordeaux, Nice | Bistros and brasseries, understated tailoring, a café terrace, a château or vineyard wedding, a Paris evening. No Eiffel Tower as the subject. |
| NL | Netherlands | Amsterdam, Rotterdam, The Hague, Utrecht | Canal houses used lightly, Rotterdam's modern architecture, refined restaurants, understated urban style. No windmills, tulips or a sea of bicycles. |
| CN | China | Shanghai, Beijing, Shenzhen, Hangzhou | The Bund and Lujiazui, Beijing courtyards turned restaurants, West Lake evenings, a contemporary Chinese wedding (red and gold where right), Shanghai nightlife. Recognisably Chinese, not generic East Asian. |
| AT | Austria | Vienna, Salzburg, Innsbruck | Viennese cafés and restaurants, imperial interiors used lightly, Alpine light for weddings. |
| DE | Germany | Berlin, Munich, Hamburg, Düsseldorf | Berlin modernism, Munich restaurants, Hamburg harbour light, a refined club or bar. |
| GB | United Kingdom | London, Edinburgh, Manchester | Mayfair dining, City offices, a country house wedding, a members' club evening. |
| IT | Italy | Milan, Rome, Florence, Lake Como | Milan tailoring and offices, a Roman trattoria evening, a Como or Tuscan villa wedding. |
| ES | Spain | Madrid, Barcelona, Seville, Marbella | Late dinners, Madrid business, an Andalusian courtyard wedding, a Barcelona terrace night. |
| CH | Switzerland | Zurich, Geneva, Lausanne, St. Moritz | Lakeside light, Zurich finance, an Alpine or lake wedding, a quiet hotel bar. |
| QA | Qatar | Doha, Lusail | West Bay and Msheireb architecture, fine dining, a hotel wedding, a refined lounge. |
| KW | Kuwait | Kuwait City | Modern towers and the Gulf, family style dining, an elegant hall wedding, a social evening. |
| BH | Bahrain | Manama, Muharraq | Muharraq's restored houses, Manama's bay, a refined dinner and gathering. |
| OM | Oman | Muscat, Salalah | Muscat's low white architecture and sea, elegant hospitality, an Omani wedding setting. |
| JO | Jordan | Amman, Aqaba | Amman's stone city and Jabal Al Weibdeh restaurants, a garden wedding, a rooftop evening. |
| EG | Egypt | Cairo, Alexandria, El Gouna | Zamalek dining, New Cairo business, a Nile evening, an Egyptian wedding hall, a Red Sea night. |
| MA | Morocco | Marrakech, Casablanca, Rabat, Tangier | Riad interiors, Casablanca business, a courtyard dinner, a Moroccan wedding setting. |
| TR | Türkiye | Istanbul, Bodrum, Izmir | Bosphorus dining, Levent offices, a waterside wedding, an Istanbul rooftop. |
| US | United States | New York, Los Angeles, Chicago, Miami | New York restaurants and offices, a West Coast evening, a city or estate wedding. |
| CA | Canada | Toronto, Montreal, Vancouver | Toronto business, Montreal bistros, a Vancouver waterfront evening. |
| IN | India | Mumbai, New Delhi, Bengaluru, Jaipur | Mumbai dining, Bengaluru offices, a Jaipur palace evening, an Indian wedding with local dress. |
| IQ | Iraq | Baghdad, Erbil, Basra | Contemporary Baghdad and Erbil hospitality, a family celebration, a refined dinner. |
| SY | Syria | Damascus, Aleppo, Latakia | Damascene courtyard houses and restaurants, a celebration in that setting, a coastal evening. |
| PS | Palestine | Ramallah, Bethlehem, Nablus | Ramallah cafés and restaurants, stone architecture, a Palestinian wedding setting. |
| YE | Yemen | Sana'a, Aden | Sana'a's tower houses as setting, hospitality and a celebration, handled with care. |
| DZ | Algeria | Algiers, Oran, Constantine | Algiers' white city and bay, a dinner, an Algerian wedding setting. |
| TN | Tunisia | Tunis, Sidi Bou Said, Sousse | Blue and white Sidi Bou Said used lightly, Tunis restaurants, a seaside wedding. |
| LY | Libya | Tripoli, Benghazi | Tripoli's old city and waterfront, a dinner and a celebration. |
| SD | Sudan | Khartoum, Omdurman | The Nile at Khartoum, a family celebration, a dinner. |
| MR | Mauritania | Nouakchott | Hospitality and a celebration in Nouakchott. |
| SO | Somalia | Mogadishu, Hargeisa | Mogadishu's coast and restaurants, a celebration. |
| DJ | Djibouti | Djibouti City | The city and its coast, hospitality. |
| KM | Comoros | Moroni | Moroni's coast and old town, a celebration. |

Next European countries (Belgium, Portugal, Greece, Sweden, Norway, Denmark, Finland, Ireland, Czechia, Slovakia, Hungary, Romania, Bulgaria, Croatia, Slovenia, Serbia, Ukraine) are added the same way, starting with a row here and an entry in the registry.

## Status

No country is active yet; every visitor sees the default collection until a country's five photos are sourced, reviewed and activated. `npm run photos:check` lists the active ones.
