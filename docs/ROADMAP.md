# 🗺️ ROADMAP — Bolitas (Gloop)

> Cambios futuros priorizados. Auditoría completa del código: **2026-07-14**.
> Los hallazgos de esa auditoría se **corrigieron el mismo día** (v3.1.4, versionCode 34) — ver historial al final.
> Referencias técnicas en [CODEBASE.md](CODEBASE.md).

---

## ✅ v3.1.4 — Corregido (2026-07-14)

Todo lo que la auditoría encontró quedó arreglado en esta versión:

**Bugs de lógica**
- Límites de anuncios rewarded que nunca se aplicaban (2/2 pre-nivel y 5/día de monedas): los contadores ahora incrementan dentro del handler `onRewarded`, cuando el premio realmente se otorgó.
- Analytics: `level_complete` registraba el nivel siguiente (corrido +1) y **todos** los eventos mandaban `biome_name: 'unknown'` porque `LevelData` no tiene campo `biome` — nuevo helper `getBiomeNameForLevel()`.
- Animación "bioma completado" apuntaba a la tarjeta del bioma futuro (`nextElementSibling` con `column-reverse`) → `previousElementSibling`.
- `window.t` inexistente → siempre mostraba "Loading ad..." en inglés.
- Doble listener en el botón de re-spin de la ruleta.
- `getDailyQuests()` crasheaba si un questId guardado ya no existía en las plantillas → `repairOrphanQuests()`.
- Día UTC vs. local: calendario, ruleta y racha ahora usan el día calendario local (antes cambiaban a las 21:00 en UTC-3).
- Vidas: la vida se consume **al perder** (en `showGameOver`), no en los botones — cerrar la app en el game over ya no la salva. Con revive no se cobra dos veces. Retry/Menú/botón atrás ya no descuentan.
- `initGame` re-rolleaba recursivamente sin límite → cap de 20 intentos.
- Botón atrás de Android: el overlay superior ahora se decide por z-index real, no por orden del DOM.
- Toast de quest completada mostraba siempre "Misión completada" (`q.description` no existía) → usa `getQuestDescription()`.

**CSS / UI**
- Barra de powerups sin fondo/borde/sombra: las 8 variables CSS que referenciaba no existían — definidas en `:root`.
- ~40 bloques de CSS muerto eliminados (menú viejo, modos, leaderboard, time-bonus, etc.). El CSS de los 7 skins se **conservó** para la feature de cosméticos.
- Status bar Android ahora oscura (`#0f172a`) acorde al tema, en styles.xml y capacitor.config.

**i18n (paridad verificada por script: 246 claves × 4 idiomas, 0 faltantes)**
- 12 claves faltantes en alemán (incluidas las `diff_*` visibles en cada nivel) y 6 en francés — añadidas.
- 4 claves `data-i18n` inexistentes (`boosters`, `xp`, `revive`, `ranks`) — corregidas o eliminadas con su elemento.
- Todos los strings hardcodeados pasados a `t()`: toasts de estrellas y racha, motivación del game over, ¡GENIAL!/¡INCREÍBLE!, límites de ads, error de login, splash, celebración, y las 8 notificaciones de retención (ahora se agendan en el idioma del jugador).
- Errores de traducción: "Glaciar de Tritio" en francés → "Glacier de Tritium", "Gemas" en alemán → "Edelsteine", "cian" en francés → "cyan".
- Claves duplicadas dentro del mismo objeto eliminadas (`tutorial_buy_booster` ×2 en los 4 idiomas, `change_name`, `ad_loading`/`ad_unavailable`).

**Arquitectura / higiene**
- Import circular `shop.js ↔ tutorial.js` roto con el nuevo `src/tutorialState.js`.
- Código muerto eliminado: `startGame()`, `checkShopReminderTutorial` (~105 líneas), `tipKey` en biomes.js, `counter.js`, `javascript.svg`, pantalla y botones de leaderboard, `startTimer` comentado, 10+ imports sin uso.
- `console.*` deshabilitado en producción (`disableConsoleOutput: true` en el obfuscator).
- Fuente Outfit **self-hosteada** (`public/assets/fonts/`) — cero requests a terceros en el arranque; antes cargaba de Google Fonts (relevante con COPPA).
- Rutas absolutas → relativas (imágenes de biomas, favicon): ya no rompen bajo subruta de GitHub Pages.
- `manifest.webmanifest` completado (name/start_url/display/theme_color, tipo `image/webp` correcto).
- Repo: `android-resources/admob-keys.txt` y `google-services (1).json` borrados, `dataconnect/` eliminado (era plantilla), material promocional movido a `promo/`, `firebase.json` sin dataconnect.
- `npm audit fix`: 0 vulnerabilidades (protobufjs crítica/alta/moderada resueltas).
- iOS `Info.plist`: añadidos `GADApplicationIdentifier`, `NSUserTrackingUsageDescription` y `SKAdNetworkItems` (Google). ⚠️ El GAD id es el de Android como placeholder: **antes de publicar en iOS hay que crear la app iOS en la consola de AdMob y reemplazarlo**.
- **Assets nativos re-sincronizados** (`npm run build && npx cap sync`): el APK ya no empaqueta el juego de abril. Regla permanente: correr ese comando antes de cada build de release.

**Verificación:** build de producción OK (948 ms), paridad i18n por script, sync nativo confirmado por fechas y contenido. ⚠️ Pendiente de prueba manual en dispositivo: flujo de vidas nuevo, animación de bioma completado y barra de powerups.

---

## 🟠 v3.2 — Calidad restante

- **Modularizar main.js (~3700 líneas):** extraer `ads.js` (consent + interstitial/rewarded/banner), `notifications.js`, `mapScreen.js`, `gameBoard.js` y `winFlow.js`. Prerequisito para todo lo grande. Al hacerlo, migrar los flags `window._*` a un módulo de estado/event-bus.
- **Unificar claves de localStorage** bajo un solo prefijo (`gloop_*`) con migración one-shot y versión de esquema. Probar la migración en dispositivo con datos reales.
- **Tooling:** ESLint + Prettier, y tests unitarios de los módulos puros (`economy.js`, `biomes.js`, `livesManager.js`, `dailyCalendar.js`). El script de paridad i18n (`i18n_check`) merece vivir en `scripts/` y correr en CI.
- **Actualizar Capacitor/Firebase a las últimas minor** (Capacitor 8.1 → 8.4, @capacitor-firebase 8.1-8.2 → 8.3) + `npx cap sync` + prueba en dispositivo.
- **Purga opcional de claves i18n sin uso** (~20 seguras: `career`, `zen`, `time`, `dark_mode`, `select_level`, `ad_error`, `prestart_*_rec`, `revive_ad_time`, etc.). Las `skin_*` NO — las usa la feature de cosméticos.

## 🟡 v3.3 — Economía y retención

- **Cosméticos como sumidero de monedas:** el CSS de 7 skins ya existe ([style.css](../src/style.css), buscar "SKIN VARIANTS") y las claves i18n `skin_*`/`equip`/`equipped` están en los 4 idiomas; falta solo el JS de compra/equipar (aplicar clase `skin-X` a las bolitas y persistir).
- **Rebalancear la ruleta diaria:** probabilidades uniformes 1/10 regalan 1000🪙 demasiado seguido; pasar a pesos por premio.
- **Misiones de boosters** (ya se trackea `booster_used`) y pase semanal simple.
- **UI de racha de días:** hoy solo hay badge + toast; mostrar la próxima recompensa.
- Considerar "vida infinita 30 min" como recompensa de ads.

## 🟢 v4.0 — Features grandes

- **Cloud save / cuentas:** el progreso vive solo en localStorage; desinstalar = perderlo todo. Google Play Games Services o Firebase Auth anónimo + Firestore (las reglas están en lock total; abrirlas por-usuario).
- **Leaderboards:** implementar sobre Play Games o Firestore una vez haya cuentas (la UI vestigial ya fue eliminada; hacer una nueva).
- **Nuevos modos:** Zen sin vidas, contrarreloj, desafío diario con seed compartida (`currentMode` sigue preparado).
- **Release iOS:** falta el AdMob App ID real de iOS (el actual es placeholder), `GoogleService-Info.plist`, ampliar `SKAdNetworkItems` con la lista completa de Google, flujo ATT en runtime, y pipeline de build/firma.
- **IAP:** "quitar anuncios" + packs de monedas (RevenueCat o StoreKit/Billing). Revisar elegibilidad con audiencia infantil (COPPA).
- **Mecánicas nuevas de nivel:** obstáculos (piedra, hielo), objetivos alternativos — `LevelData` admite extensión limpia.

## 🔵 Backlog técnico

- Reintento/backoff unificado para ads fallidos (hoy hay un `setTimeout(15000)` solo para revive).
- Rendimiento en tableros 12×12 en gama baja (partículas + reflows); medir antes de optimizar.
- Accesibilidad: tamaños táctiles mínimos 44px, `aria-label` en botones de icono.
- Lazy-load de `translations.js` por idioma (46 KB podría dividirse).
- Test E2E básico del flujo nivel-completo (Playwright contra `npm run dev`).

---

### Historial de hitos

- **3.1.4 (2026-07-14)** — corrección integral post-auditoría: límites de ads, analytics de biomas/niveles, vidas al perder, día local, i18n completo 4 idiomas, fuente self-hosteada, ciclo de imports, CSS de powerups, código muerto, `npm audit`, re-sync nativo. Detalle arriba.
- **3.1.2/3.1.3** — fixes de rewarded ads, doble consentimiento, sonidos muteados, skip de tutorial; targets redondeados.
- **1.2.x** — compliance Play Store (sin exact alarms), notificaciones locales de retención, dificultad adaptativa invisible, 100+ niveles, botón "pasar nivel".
