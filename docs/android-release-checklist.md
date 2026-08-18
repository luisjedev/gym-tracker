# Build preview y smoke test Android

La build `preview` es un APK independiente: arranca sin Metro, no necesita autenticación y el uso normal no requiere Internet, backend ni servicios cloud.

## Preflight local

Desde la raíz del repositorio:

```bash
npm ci
npm run check
npm test -- --runInBand
npx expo-doctor
npx expo export --platform android
```

Si se publica una actualización de una build instalada, incrementa
`expo.android.versionCode` en `app.json`. No guardes credenciales ni keystores en Git.

## Generar el APK

Autentica EAS solo si la sesión local no está iniciada y comprueba el proyecto:

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile preview --wait
npx eas-cli@latest build:list --platform android --limit 1
```

La salida de EAS contiene el enlace `artifacts.buildUrl`. El perfil `preview` está
configurado en `eas.json` con `android.buildType: apk` y distribución interna.

## Instalar sin Android Studio, emulador ni Google Play

1. Abre `artifacts.buildUrl` en el navegador del teléfono Android.
2. Descarga el APK y permite la instalación desde ese navegador si Android lo solicita.
3. Instala o actualiza **Gym Tracker** y abre la aplicación.
4. Comprueba que aparece **Inicio** sin arrancar `npm start` ni conectar el teléfono por USB.

## Smoke test en el teléfono físico

Ejecuta esta lista con cada APK final y anota la fecha, el `versionCode` y el enlace de
la build:

- [ ] Navegar por **Inicio**, **Ejercicios**, **Historial** y **Ajustes**.
- [ ] Registrar pasos, completar y revertir fuerza/HEAT, e iniciar y finalizar un ayuno.
- [ ] Cerrar la aplicación desde recientes, abrirla de nuevo y comprobar que esos datos y los ajustes siguen presentes.
- [ ] Crear un ejercicio, seleccionar una imagen y un vídeo, abrir ambos, eliminar uno y comprobar el resultado tras reabrir la app.
- [ ] Cancelar el selector multimedia y comprobar que no se presenta como guardado.
- [ ] Activar recordatorios, aceptar el permiso, comprobar una notificación local y desactivar la función; repetir denegando el permiso y confirmar que no se muestra activa.
- [ ] Cambiar el día y el lunes de prueba; comprobar que el historial anterior y las instantáneas de objetivos no cambian.
- [ ] Activar el modo avión y repetir navegación, registro y lectura de datos; no debe aparecer ninguna petición de login o backend.
- [ ] Revisar el estado vacío de Historial, un permiso denegado, un archivo multimedia ausente y un fallo recuperable de almacenamiento.

No sustituyas esta comprobación física por un emulador. Las pruebas automatizadas cubren
la misma seam visible con adaptadores controlados, pero permisos, selector, codecs,
notificaciones y persistencia del APK solo quedan aceptados después de este recorrido
en el dispositivo real.
