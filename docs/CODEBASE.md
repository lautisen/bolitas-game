# 📖 CODEBASE — Bolitas (Gloop)

> Documentación técnica del código. Actualizada tras la auditoría completa del **2026-07-14** y la corrección integral de sus hallazgos (versión **3.1.4**, versionCode 34).
> Para la guía rápida de proyecto ver [README.md](../README.md). Para cambios futuros ver [ROADMAP.md](ROADMAP.md).

---

## 1. Visión general

**Gloop** (id interno "Bolitas") es un puzzle móvil tipo *SameGame/Collapse*: el jugador toca grupos de 3+ bolitas del mismo color para explotarlos, con gravedad vertical y colapso horizontal de columnas. Un único modo (**Aventura/Career**) con progresión infinita por biomas.

- **Stack:** Vanilla JS (ES Modules) + Vite 7 + Capacitor 8 (Android/iOS) + Firebase (Analytics, Crashlytics, Remote Config) + AdMob.
- **Sin framework de UI:** todo es manipulación directa del DOM sobre un único `index.html` con pantallas superpuestas (`.overlay` + clase `.hidden`).
- **Persistencia:** 100 % `localStorage` (no hay backend ni cloud save). Firestore está bloqueado por reglas y no se usa.
- **Monetización:** AdMob (banner adaptativo, interstitial, 3 unidades rewarded) con flujo de consentimiento UMP y modo COPPA (`tagForChildDirectedTreatment: true`, rating G).

## 2. Estructura de directorios

| Ruta | Contenido |
| :--- | :--- |
| `src/` | Todo el código de la app (JS + CSS). |
| `index.html` | Único HTML: contiene TODAS las pantallas/overlays y los SVG symbols. |
| `public/` | Copiado tal cual a `dist/`: `assets/` (bgm, biomas, iconos), `ads.txt`, `app-ads.txt`, `manifest.webmanifest`. |
| `android/` | Proyecto nativo Android (SDK 24→35, versionCode 34). |
| `ios/` | Proyecto nativo iOS (secundario, sin release publicado). |
| `resources/`, `assets/` | Fuentes de iconos/splash para Capacitor. |
| `promo/` | Material promocional (logo, imágenes, generadores Lottie) — no forma parte de la app. |
| `.github/workflows/deploy.yml` | CI: build + deploy de `dist/` a GitHub Pages en cada push a main. |

## 3. Módulos de `src/`

> Nota: las referencias `archivo:línea` de este documento son anclas aproximadas — la limpieza del 2026-07-14 corrió las líneas unas decenas de posiciones. Los nombres de función son el ancla confiable.

### main.js (~3800 líneas) — Orquestador
El corazón y también el archivo más sobrecargado. Contiene:

- **Boot** (`DOMContentLoaded`, [main.js:103](../src/main.js#L103)): i18n → oculta splash nativo → Crashlytics → `checkAppVersion()` (bloquea si hay update forzado) → permisos de notificaciones → StatusBar → registro de ~40 listeners de UI → vidas → `checkExistingSession()` → `initAdMob()` → oculta splash HTML propio a los 3 s.
- **Ads** ([main.js:563-1046](../src/main.js#L563-L1046)): `handleConsentFlow()` (UMP; deshabilita Analytics si no hay consentimiento), `initAdMob()`, `prepareInterstitial/prepareRewarded` (pre-carga con tracker global `window._rewardedAdsReady`), `showInterstitialAd`, `showRewardedAd(type, data)` y el handler central `onRewarded` que despacha por tipo: `revive`, `pity_revive`, `get_life`, `get_xp`, `shop_coins`, `double_coins`, `prestart_buff`, `swap_quest`, `swap_weekly_quest`, `daily_spin_respin`.
  - **Política de interstitial:** cada 10 niveles o cada 7 min, disparado al pulsar "Continuar" en la pantalla de victoria ([main.js:487](../src/main.js#L487)).
  - IDs de AdMob hardcodeados: banner [main.js:47](../src/main.js#L47), interstitial [main.js:808](../src/main.js#L808), rewarded revive/shop/pity [main.js:830-835](../src/main.js#L830-L835).
- **Gameplay**: `initGame()` ([main.js:1380](../src/main.js#L1380)) genera el tablero limitando clusters iniciales a ≤5 y re-rollea hasta tener ≥3 grupos válidos; `handleBolitaClick()` (selección DFS → 2.º tap explota), `applyGravity()`, `applyHorizontalShift()`, combo x1.5–x3 con ventana de 2.5 s, hint automático a los 5 s, `calculatePoints()` (100/300/800/1500/3000), estrellas 1/2/3 = target ×1 / ×1.10 / ×1.25 y 4.ª estrella dorada por limpiar el tablero.
- **Boosters** ([main.js:3433-3759](../src/main.js#L3433-L3759)): shuffle e hint instantáneos; bomb (3×3), color_bomb, sniper y magic_brush (picker de color inline) requieren objetivo. Un solo uso de cada booster por nivel (`boostersUsedInLevel`).
- **Fin de nivel**: `handleLevelComplete()` ([main.js:2389](../src/main.js#L2389)) — guarda progreso (`bolitasLevel`, `bolitasStarsMap`), monedas por dificultad (easy 10-15 → extreme 25-30, boss ×15 50-80), XP (100 + nivel×10; 10 en replay), milestone de booster gratis cada 5 niveles de jugador, win-screen con animaciones pausadas. `showGameOver()` con revive por ad (1/nivel) y **pity reward** (revive + color bomb) tras 4 derrotas acumuladas (`bolitasLevelFails`).
- **Mapa de biomas**: `showLevelSelect()` ([main.js:3092](../src/main.js#L3092)) — tarjetas de 15 niveles (grid 5×3) en contenedor `column-reverse` (bioma 1 abajo), fog-of-war +3 biomas, animación de desbloqueo y overlay "bioma completado".
- **Retención**: notificaciones locales de inactividad (24 h→10 d, `getInactivityNotifications()` — se construyen al agendar, en el idioma del jugador), notif. de quests diarias/semanales (9 AM), notif. de vidas llenas (id 301), racha de días activos con premios (3/7/14/30 días, día calendario local).
- **Navegación**: botón atrás Android con stack de overlays + doble-tap para salir ([main.js:380](../src/main.js#L380)); footer con 3 tabs (Mapa/Misiones/Tienda).

### economy.js — Economía y misiones
Estado único en `localStorage['gloop_economy']`.
- **Monedas** (`getCoins/addCoins/spendCoins`) y **XP/nivel de jugador** (`addXP`, umbral = nivel × 500 XP).
- **100 plantillas de quests diarias** (5 activas, reset 9 AM local) y **20 semanales** (3 activas, reset lunes 9 AM local). El progreso se recalcula desde contadores agregados (`sessionStats` / `weeklyStats`) vía `trackPop/trackLevelComplete/trackBoardClear/trackScore/trackSingleGameScore/trackGamePlayed`. `repairOrphanQuests()` reemplaza quests guardadas cuyo template desapareció entre versiones (evita crash al enriquecer).
- Swap de quest = gratis viendo un rewarded ad.
- **SHOP_BOOSTERS** (fuente de verdad de boosters): sniper 100🪙 (nivel 6), shuffle 150 (10), magic_brush 250 (16), bomb 350 (21), color_bomb 500 (26). `unlockLevel` controla tienda, barra de powerups y tutoriales.

### biomes.js — Progresión infinita
- 10 biomas base (nombre i18n, gradiente, imagen `/assets/biomes/*.png`); a partir del bloque 11 se reciclan visuales cíclicamente.
- Cada bloque = 15 niveles con patrón de dificultad en onda (`WAVE_PATTERN_15`, nivel 12 = respiro, nivel 15 = extreme/boss).
- Tamaño de grilla progresivo `(5+bloque)…(6+bloque)` cap 12; colores 3→6 según dificultad.
- **Target por densidad**: `D = celdas/colores` determina puntos-por-movimiento estimados; multiplicador por dificultad (0.6/1.0/1.4/1.8), redondeo a 50. Bloque 1 con −40 % de target.
- `getLevelData(nivelGlobal)` (1-indexed, infinito) con cache de bloques (`_blockCache`).

### livesManager.js — Vidas
5 vidas máx, +1 cada 10 min (recuperación offline calculada por timestamp). `getFullRestoreTime()` alimenta la notificación 301. El descuento ocurre en main.js: en `showGameOver()` al perder (1 por intento, revive no cobra de nuevo) y en `abandonLevel()` al abandonar.

### shop.js — UI de tienda
3 tabs: boosters (con candado por `unlockLevel`), calendario diario, monedas por ad (100🪙, límite 5/día). `getCoinAdState()` / `registerCoinAdWatched()` gestionan el contador diario — el registro lo llama el handler `onRewarded` de main.js cuando el premio se otorga de verdad. Respeta `window._mandatoryBoosterPurchase` durante tutoriales. Al abrir la tienda dispara la ruleta diaria si está disponible.

### dailyCalendar.js — Calendario de login
7 días (100/200/shuffle/300/bomb/500/1000🪙), racha con reset si se salta un día. Estado en `gloop_calendar`. Usa el día calendario **local** (`localDayString`), igual que ruleta y racha.

### dailySpin.js — Ruleta diaria
Rueda canvas de 10 segmentos (monedas 100/500/1000, boosters, trío jackpot). 1 giro gratis/día + re-spin dorado (premios ×2) viendo un ad. Estado en `gloop_spin`. Callback global `window._dailySpinOnRespinAdRewarded` conecta con el handler de rewarded de main.js.

### tutorial.js — Tutoriales
- **Tutorial inicial** (nivel 1): grilla 3×3 fija con grupo verde, diálogos + mano indicadora, fases select→pop, auto-salida por timeout.
- **Tutoriales estrictos de booster** (niveles 6/10/16/21/26): regalan las monedas exactas, interceptan todos los clicks (`capture: true`) salvo el elemento objetivo, guían tienda→compra→uso. Timeout de 10 s por paso. Cleanup global en `window._currentTutorialCleanup` / `abortActiveTutorial()`.
- El flag activo vive en **tutorialState.js** (tutorial.js lo re-exporta); shop.js lo lee de ahí para no cerrar el ciclo de imports.

### tutorialState.js — Flag compartido
Módulo mínimo con `isTutorialActive()` / `setTutorialActive()`. Existe únicamente para que shop.js pueda consultar el estado sin importar tutorial.js (que a su vez importa shop.js).

### audio.js — Sonido sintetizado
Todos los SFX se generan con Web Audio API (osciladores + ruido + envolventes ADSR); no hay archivos de audio salvo `bgm.mp3` (loop, volumen 0.4, instanciado en main.js). 9 sonidos exportados: select, pop (4 capas, escala con tamaño), error, gameOver, win, unlock, levelUnlock, coin, purchase, dailyClaim.

### translations.js — i18n
4 idiomas: `en`, `es`, `fr`, `de`. `t(key, params)` con interpolación `{{param}}` y pluralización por sufijo `_plural`; fallback a inglés → clave. `updateLanguageUI()` traduce nodos con `data-i18n` (respetando iconos SVG embebidos). Idioma inicial: `bolitasLang` → idioma del navegador → en.

**Estado de cobertura (verificado por script el 2026-07-14, post-fix):** **246 claves × 4 idiomas, paridad perfecta**, 0 claves usadas sin definir, 0 duplicados. Los strings que antes estaban hardcodeados (toasts, motivación de game over, notificaciones de retención, límites de ads) ahora pasan por `t()`. Quedan ~20 claves definidas sin uso (`career`, `zen`, `prestart_*_rec`, etc. — purga opcional en ROADMAP) y las `skin_*` se conservan a propósito para la feature de cosméticos.

### analyticsManager.js — Analytics
Singleton sobre `@capacitor-firebase/analytics` con registro central de eventos (`Events`) y parámetros (`Params`), sanitización de claves y ejecución no bloqueante. Eventos clave: `level_start/complete/fail/retry`, `ad_impression/ad_failed/ad_reward_watched`, `economy_sink`, `booster_used`, `daily_feature_used`, `shop_opened`.

### versionCheck.js — Update forzado
Lee `minimum_version_required` de Remote Config (fetch con timeout 5 s, fail-open), compara semver contra `App.getInfo().version` y bloquea la app con pantalla de update → Play Store (`market://details?id=com.dreaminraw.bolitas`).

### style.css (~2900 líneas)
Tema oscuro forzado (`body.dark-theme`), glassmorphism, variables CSS (`--rows/--cols/--banner-height/--safe-bottom/--footer-offset`), animaciones (pop, shuffle, confetti, combo, tutorial hand), modo daltónico (`body.color-blind-mode` añade un símbolo distinto por color vía `::after`), safe-areas + `dvh`, media queries para pantallas bajas (max-height 650/550) y tablet (min-width 600).

Notas (post-fix 2026-07-14):
- La **fuente Outfit está self-hosteada** vía `@font-face` al inicio del archivo (woff2 variable en `public/assets/fonts/`, pesos 400-900) — no tocar los `unicode-range`.
- Las variables de superficie glass (`--bg-glass`, `--radius-lg`, etc.) que usa la barra de powerups están definidas en `:root` con comentario de advertencia — **no borrarlas**: una `var()` inexistente se descarta en silencio.
- **Sistema de skins listo a nivel CSS** (7 skins: `skin-neon/gems/stars/hearts/candy/pixel/fruits`, buscar "SKIN VARIANTS") + claves i18n `skin_*` en los 4 idiomas; falta solo el JS de compra/equipar (feature v3.3 del ROADMAP).
- El CSS muerto de la UI antigua (menú, modos, leaderboard, time-bonus, ~40 bloques) fue eliminado en la limpieza del 2026-07-14.

## 4. Flujos importantes

### Arranque
`DOMContentLoaded` → splash HTML propio visible → `SplashScreen.hide()` (nativo) → `checkAppVersion()` (puede cortar el boot) → listeners → `checkExistingSession()`: si hay `bolitasUser` va directo al mapa; si no, pantalla de alias local (sin auth real) → `initAdMob()` → consentimiento → precarga de ads → banner.

### Partida (Aventura)
Mapa → tap en nivel → `showLevelPreStartScreen()` (target, dificultad, quests, botón "ad → booster gratis", límite teórico 2/intento) → `startLevelFromSelect()` (chequea vidas; muestra out-of-lives si 0) → `initGame()` → juego → sin movimientos: si `score ≥ target` pasa, si no `showGameOver()` (revive/pity) → `handleLevelComplete()` → win-screen (monedas, x2 por ad, XP, milestone) → "Continuar" (posible interstitial) → mapa con animación de desbloqueo.

### Estados de una bolita
Objeto `{ color, el, r, c }` en `grid[r][c]` + `elementPositionMap` (WeakMap DOM→objeto) + dataset/CSS vars (`--row/--col`) para la posición visual. Gravedad y shift mutan `r/c` y el dataset en sincronía.

## 5. Persistencia (localStorage)

| Clave | Módulo | Contenido |
| :--- | :--- | :--- |
| `bolitasUser` | main | Alias del jugador. |
| `bolitasLevel` | main | Máximo nivel desbloqueado (0-indexed = niveles completados). |
| `bolitasStarsMap` | main | `{ levelIdx: estrellas(1-4) }`. |
| `bolitasTotalLevelsCompleted` | main | Contador acumulado. |
| `bolitasLevelFails` | main | Derrotas seguidas (dispara pity a las 4). |
| `bolitasTutorialDone` | tutorial | Tutorial inicial visto. |
| `boosterTutorial_<id>_done` | tutorial | Tutorial de cada booster. |
| `shopReminderDone` | — | Residual: la feature se eliminó el 2026-07-14; clave inofensiva en instalaciones viejas. |
| `bolitasAudioEnabled` / `bolitasColorblindEnabled` / `bolitasLang` | main / translations | Ajustes. |
| `bolitas_coinAdDate` / `bolitas_coinAdCount` | shop | Límite diario de ads de monedas. |
| `lastBoosterRewardLevel` | main | Último milestone XP premiado. |
| `gloop_economy` | economy | Monedas, XP, boosters, quests, stats. |
| `gloop_calendar` | dailyCalendar | Racha de login. |
| `gloop_spin` | dailySpin | Giro diario. |
| `gloop_active_streak` | main | Racha de días jugados. |

⚠️ Prefijos inconsistentes (`bolitas*`, `bolitas_*`, `gloop_*`, sin prefijo) y sin versionado de esquema — ver ROADMAP.

## 6. Estado del árbol de trabajo

**Regla permanente antes de compilar cualquier release** (las carpetas nativas empaquetan una copia de `dist/` que NO se actualiza sola — en abril-mayo estuvieron un mes desfasadas):
```bash
npm run build && npx cap sync   # SIEMPRE, en este orden
```
Estado al 2026-07-14 (post-fix): assets nativos re-sincronizados y verificados por contenido, build de producción limpio (~0.9 s, bundle 208 kB / 72 kB gzip), ofuscación aplicada, sin sourcemaps, `console.*` deshabilitado en runtime por el obfuscator (`disableConsoleOutput: true` — las menciones que quedan en el bundle son de vendors y el stub global las silencia), `npm audit` en 0 vulnerabilidades.

## 7. Build, deploy y nativo

- `npm run dev` / `npm run build` (Vite, base `./`). En producción se aplica **javascript-obfuscator** (string array + base64, sin control-flow flattening) — [vite.config.js](../vite.config.js).
- `npx cap sync` copia `dist/` a `android/`/`ios/`.
- **Android:** minSdk 24, target/compile 35, **versionCode 34 = 3.1.4**, Gradle 8.13 + AGP 8.13.2, Java 21, google-services 4.4.4, crashlytics-gradle 3.0.1. Release con minify+proguard (reglas para Capacitor/Firebase/AdMob) y símbolos nativos `SYMBOL_TABLE`. Permisos: INTERNET, AD_ID, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED (sin exact alarms, removidos por compliance). Splash nativo vía `androidx.core:core-splashscreen`. [MainActivity.java](../android/app/src/main/java/com/dreaminraw/bolitas/MainActivity.java) inyecta la CSS var `--safe-bottom` con la altura real de la barra de navegación en cada focus. Status bar oscura (`#0f172a`) acorde al tema, en styles.xml y capacitor.config.
- **iOS:** proyecto presente (CapApp-SPM, iOS ≥ 15, Capacitor 8.1.0 exact, portrait-only). [Info.plist](../ios/App/App/Info.plist) ya tiene `GADApplicationIdentifier`, `NSUserTrackingUsageDescription` y `SKAdNetworkItems` (Google). ⚠️ El GAD id es el de Android como **placeholder**: antes de publicar en iOS, crear la app iOS en la consola de AdMob y reemplazarlo; faltan también `GoogleService-Info.plist` y el pipeline de build.
- **GitHub Pages:** `deploy.yml` publica `dist/` en cada push a main. Rutas de assets ahora relativas (funcionan bajo subruta de Pages y en Capacitor). Fuente Outfit self-hosteada — sin requests externos en el arranque. `manifest.webmanifest` completo (name/start_url/display, `image/webp`).
- **Firebase:** proyecto `bolitas-game`. Requiere `google-services.json` (Android, presente) / `GoogleService-Info.plist` (iOS, pendiente) en las carpetas nativas. Remote Config: clave `minimum_version_required`. Firestore bloqueado (`allow read, write: if false`). `google-services.json` se mantiene commiteado: contiene identificadores de cliente públicos por diseño (van dentro de cada APK), no secretos. Los redundantes (`admob-keys.txt`, `google-services (1).json`) fueron borrados el 2026-07-14.
- **Material promocional:** vive en `promo/` (logo, imágenes, generadores Lottie `gen_anim*`); no forma parte de la app.

### Grafo de dependencias entre módulos (acíclico desde 2026-07-14)

```
main ──> analyticsManager, biomes, audio, versionCheck, shop, economy,
         translations, livesManager, tutorial, dailySpin
economy ──> analyticsManager
dailyCalendar ──> economy, translations, analyticsManager, audio
dailySpin ──> economy, translations, analyticsManager
shop ──> economy, translations, audio, dailyCalendar, dailySpin, tutorialState
tutorial ──> translations, economy, shop, tutorialState
tutorialState ──> (nada)
biomes ──> (nada)
```

El antiguo ciclo `shop ↔ tutorial` se rompió extrayendo el flag activo a **tutorialState.js**: shop lee `isTutorialActive` de ahí, y tutorial.js lo re-exporta para que main.js conserve un único punto de import. Regla: si un módulo nuevo necesita saber si hay tutorial activo, importa `tutorialState.js`, nunca `tutorial.js`.

## 8. Convenciones y gotchas

1. **Pantallas** = divs `.overlay` en index.html + toggling de `.hidden`; z-index manual por pantalla (login 200, win 300→50000 inline, prestart 25000, reward 30000, tutorial 100000+). Cuidado al añadir overlays nuevos: el botón atrás recorre `.overlay:not(.hidden)` en orden DOM, no por z-index.
2. **Comunicación entre módulos vía `window._*`**: `_rewardedAdsReady`, `_winCoinsEarned`, `_justUnlockedLevel`, `_pendingLevelIndex`, `_levelCompleteHandled`, `_mandatoryBoosterPurchase`, `_dailySpinOnRespinAdRewarded`, `_currentTutorialCleanup`. Es el patrón establecido (aunque frágil); documentar cualquier flag nuevo aquí.
3. **`bolitasLevel` es la fuente de progreso** (0-indexed): "nivel actual a jugar" = `bolitasLevel + 1` (1-indexed global).
4. Los rewards de ads llegan por **eventos del plugin** (`rewardVideoAdReward`), no por la promesa de `showRewardedAd()` — la promesa siempre resuelve `undefined`. Cualquier lógica que dependa de "el premio se otorgó" va dentro del handler `onRewarded` de main.js (así funcionan los contadores de límites: `prestartAdsThisTry` y `registerCoinAdWatched()`).
5. El tamaño de grilla se calcula en JS (`sizeGrid()`) leyendo el contenedor estable para evitar bucles de ResizeObserver; no medir `.game-area` directamente.
6. Textos nuevos SIEMPRE por `t('clave')` **en los 4 idiomas** (paridad verificada por script — mantenerla). Cuidado: `updateLanguageUI()` reescribe el texto de cualquier nodo con `data-i18n`, así que un `data-i18n` con clave inexistente termina mostrando la clave cruda al cambiar de idioma.
7. Sonidos: usar los exports de audio.js y respetar `isAudioEnabled` en el call-site (audio.js no lo chequea).
8. Variables CSS nuevas: definirlas en `:root` de style.css. Una `var(--inexistente)` no falla en build ni en consola — la declaración entera se descarta en runtime (le pasó a la barra de powerups durante meses).
9. **Vidas:** la vida se consume en `showGameOver()` al momento de perder (una sola vez por intento; con revive no se cobra de nuevo) y en `abandonLevel()` al abandonar a mitad de nivel. Los botones Retry/Menú y el botón atrás NO descuentan — no agregar `useLife()` ahí.
10. **Días "diarios"**: usar siempre el día calendario **local** (helpers en dailyCalendar/dailySpin/main), nunca `toISOString()`. Las quests usan reset a las 9 AM local — es la única feature con hora de corte distinta, a propósito.
