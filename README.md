# Gym Tracker

Aplicación Android personal para registrar la constancia en objetivos relacionados con el cambio físico.

## Stack

- React Native
- Expo SDK 57
- TypeScript
- Development builds y APK mediante EAS Build

El desarrollo y las pruebas se realizan en un teléfono Android físico. No hacen falta Android Studio, `adb` ni emuladores en el ordenador.

## Preparar el proyecto

Requisitos:

- Node compatible con React Native (el proyecto recomienda Node 24 mediante `.nvmrc`).
- Una cuenta gratuita de [Expo](https://expo.dev/signup).
- El teléfono y el ordenador conectados a una red que les permita comunicarse.
- Permiso de Android para instalar el APK descargado desde el navegador.

Instala las dependencias y comprueba el proyecto:

```bash
npm ci
npm run check
npx expo-doctor
```

## Vincular el proyecto con Expo

La vinculación requiere autenticación personal y solo se realiza una vez:

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

`eas init` añadirá al proyecto el identificador público asignado por Expo. Las credenciales privadas y el keystore no deben guardarse en Git.

## Generar e instalar la development build

Crea un APK de desarrollo en la infraestructura de Expo:

```bash
npx eas-cli@latest build --platform android --profile development
```

La build incluye `expo-notifications`; en Android 12 o posterior también declara
`SCHEDULE_EXACT_ALARM` para que los avisos locales diarios puedan respetar sus horas.
En la primera build, permite que EAS genere y administre el keystore Android. Cuando termine:

1. Abre en el teléfono el enlace mostrado por EAS.
2. Pulsa **Install** y descarga el APK.
3. Autoriza la instalación desde el navegador si Android lo solicita.
4. Instala y abre **Gym Tracker**.

No es necesario conectar el teléfono por USB. El APK se genera en EAS Build y se instala directamente desde su enlace.

## Arrancar el servidor de desarrollo

Con la development build instalada:

```bash
npm start
```

Abre Gym Tracker en el teléfono y selecciona el servidor detectado o escanea el QR. Debe aparecer la tarjeta:

> Gym Tracker — Entorno preparado. Ya podemos empezar a construir.

Para comprobar Fast Refresh, modifica ese texto y guarda el archivo. El cambio debe aparecer en el teléfono sin reinstalar el APK.

Si la conexión LAN no funciona, se puede intentar un túnel:

```bash
npm start -- --tunnel
```

En una development build, Ajustes incluye un panel técnico temporal para validar el flujo
Mi Fitness → Health Connect → Gym Tracker con permiso de lectura de pasos. El procedimiento,
las limitaciones y la decisión para la siguiente integración están en
[la nota de validación de Health Connect](docs/health-connect-validation.md).

## Generar un APK independiente

El perfil `preview` produce un APK que arranca sin Metro y sirve para pruebas instalables:

```bash
npx eas-cli@latest build --platform android --profile preview --wait
```

Después abre en el teléfono el enlace `artifacts.buildUrl` que muestra EAS, instala el
APK y comprueba que **Gym Tracker** abre sin `npm start`. Para actualizaciones, incrementa
`expo.android.versionCode` en `app.json` antes de generar la siguiente build.

La [guía de build y smoke test Android](docs/android-release-checklist.md) contiene el
preflight, la instalación y la lista mínima de comprobaciones físicas. No requiere
Android Studio, emuladores ni publicación en Google Play.

## Comandos útiles

```bash
npm start          # Metro para la development build
npm run typecheck  # Comprobación de TypeScript
npm run lint       # ESLint con la configuración de Expo
npm run check      # TypeScript y ESLint
npm test           # Pruebas de integración y persistencia local
npx expo-doctor    # Compatibilidad del proyecto Expo
```

## Base de la aplicación

La app ofrece las cuatro secciones principales —Inicio, Ejercicios, Historial y Ajustes— mediante navegación inferior. Los datos estructurados se guardan en AsyncStorage bajo un esquema versionado y se inicializan una sola vez con los objetivos y grupos musculares predeterminados. Si una lectura o escritura local falla, la interfaz conserva el estado anterior y muestra un mensaje recuperable.

## Especificación

La [especificación del MVP](.scratch/gym-tracker-mvp/spec.md) describe el alcance completo del proyecto.

## Referencias oficiales

- [Crear una build con EAS](https://docs.expo.dev/build/setup/)
- [Generar e instalar APKs Android](https://docs.expo.dev/build-reference/apk/)
