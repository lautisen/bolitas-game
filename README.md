# 🕹️ Bolitas - Guía de Proyecto

Bienvenido al repositorio de **Bolitas** (Gloop). Este documento sirve como guía rápida para desarrolladores, explicando la estructura del proyecto, las tecnologías utilizadas y dónde encontrar el código clave.

> 📖 Documentación técnica detallada: [CODEBASE.md](CODEBASE.md) · 🗺️ Cambios futuros: [ROADMAP.md](ROADMAP.md)

## 🚀 Información General
Bolitas es un juego móvil multiplataforma desarrollado con tecnologías web modernas y adaptado para dispositivos móviles mediante **Capacitor**.

- **Versión actual:** 3.1.4
- **Framework base:** Vanilla JavaScript + [Vite](https://vitejs.dev/)
- **Plataformas:** Web, Android (Capacitor), iOS (Capacitor)

---

## 📂 Estructura de Directorios

| Carpeta | Descripción |
| :--- | :--- |
| `src/` | **Núcleo del proyecto.** Contiene toda la lógica del juego, estilos y módulos. |
| `android/` | Código nativo y configuración para la plataforma Android. |
| `ios/` | Código nativo y configuración para la plataforma iOS. |
| `assets/` / `public/` | Imágenes, sonidos y otros recursos estáticos. |
| `dist/` | Carpeta generada después del build de producción (optimizado y obfusquado). |
| `resources/` | Recursos específicos de Capacitor (iconos y splash screens). |

---

## 🧩 Guía del Código (`src/`)

Aquí es donde ocurre la magia. A continuación, el detalle de los archivos principales:

- **`main.js`**: El corazón del juego. Contiene el bucle principal, la lógica de colisiones y la gestión de niveles.
- **`style.css`**: Todos los estilos visuales y animaciones CSS del juego.
- **`economy.js`**: Gestión de monedas, diamantes y transacciones dentro del juego.
- **`shop.js`**: Lógica de la tienda, compra de cosméticos o mejoras.
- **`biomes.js`**: Definición de los diferentes biomas o mundos con sus propiedades visuales y mecánicas.
- **`translations.js`**: Sistema multi-idioma.
- **`audio.js`**: Motor de sonido y música de fondo.
- **`tutorial.js`**: Secuencia de aprendizaje para nuevos jugadores.
- **`dailySpin.js` / `dailyCalendar.js`**: Sistemas de retención (premios diarios y ruleta).
- **`analyticsManager.js`**: Integración con Firebase Analytics para seguimiento de eventos.
- **`livesManager.js`**: Control de las vidas del jugador y tiempos de espera.

---

## 🛠️ Tecnologías Principales

- **Capacitor:** Para acceder a APIs nativas (Notificaciones, AdMob, Splash Screen).
- **Firebase:** Utilizado para Analytics, Crashlytics y Remote Config.
- **AdMob:** Integración de anuncios para monetización.
- **JS Obfuscator:** Protege el código fuente en las versiones de producción.

---

## 🏃 Scripts Disponibles

Para trabajar en el proyecto, usa los siguientes comandos:

- `npm install`: Instala las dependencias necesarias.
- `npm run dev`: Inicia el servidor de desarrollo local (Vite).
- `npm run build`: Genera la versión de producción optimizada en `/dist`.
- `npx cap sync`: Sincroniza los cambios web con las carpetas nativas (`android`/`ios`).

---

## 📝 Notas para Desarrolladores

1.  **Firebase:** Los archivos de configuración de Firebase (`google-services.json` para Android y `GoogleService-Info.plist` para iOS) deben estar correctamente ubicados en sus respectivas carpetas nativas para que las analíticas funcionen.
2.  **Producción:** Siempre utiliza `npm run build` antes de realizar un `npx cap copy` o `npx cap sync` para asegurar que el código en el dispositivo sea el más reciente y esté optimizado.
3.  **Localización:** Si decides añadir un nuevo idioma, asegúrate de actualizar `translations.js`.

---
*Este proyecto es de uso privado y local.*
