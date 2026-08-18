# Validación de Health Connect (#22)

## Estado de la validación

La ruta nativa y el panel de validación están preparados en la development build, pero la
comprobación física de este documento sigue pendiente. El 18/08/2026 el ordenador no tenía
ningún teléfono Android conectado: `adb devices -l` y `adb mdns services` no devolvieron
ningún dispositivo. Por tanto, no se afirma todavía que el Redmi Watch 5 Active haya
sincronizado datos con Mi Fitness y Health Connect.

El panel aparece únicamente en una development build, dentro de **Ajustes**, y no forma parte
del flujo de producción. Solo se ejecuta al pulsar el botón; no solicita permisos al arrancar,
no persiste el resultado y no sincroniza en segundo plano.

## Dependencia y configuración elegidas

- `react-native-health-connect@4.1.3`: integración Android con soporte de Expo mediante config
  plugin. La documentación del paquete indica que no funciona en Expo Go, sí en una aplicación
  gestionada personalizada y que la integración Expo se incluye en el propio paquete desde la
  versión 4 ([README de la dependencia](https://github.com/matinzd/react-native-health-connect/blob/v4.1.3/README.md)).
- `expo-build-properties@57.0.12`: fija `minSdkVersion: 26`, requisito declarado por el paquete
  de Health Connect. El proyecto mantiene Expo SDK 57 y React Native 0.86.2, las mismas
  versiones nativas que usa el ejemplo de la dependencia publicada en esta validación
  ([metadatos de la versión instalada](https://registry.npmjs.org/react-native-health-connect/4.1.3)).
- `android.permission.health.READ_STEPS`: único permiso de Health Connect declarado en
  `app.json`. No se declara `WRITE_STEPS`, ni permiso de lectura en segundo plano, ni permiso
  de histórico ampliado. Android define `READ_STEPS` y `WRITE_STEPS` por separado
  ([Track steps, permisos requeridos](https://developer.android.com/health-and-fitness/guides/health-connect/develop/steps#permissions)).
- El config plugin `react-native-health-connect` se aplica al generar la app nativa; no se
  usa Expo Go. Expo documenta que las development builds permiten incluir librerías nativas y
  config plugins ([Develop an app with Expo](https://docs.expo.dev/workflow/overview)).

## Vía validada en código

`src/healthConnect/steps.ts` contiene la seam que reutilizarán las siguientes issues:

1. Consulta `getSdkStatus()` antes de inicializar. Distingue proveedor no disponible de
   proveedor que necesita instalación/actualización, siguiendo los estados documentados por la
   dependencia ([getSdkStatus](https://matinzd.github.io/react-native-health-connect/docs/api/methods/getSdkStatus)).
2. Inicializa Health Connect y comprueba los permisos concedidos.
3. Si falta el permiso, solicita exactamente `{ accessType: 'read', recordType: 'Steps' }`.
   La API permite combinar accesos de lectura y escritura, pero esta validación solo envía el
   acceso de lectura ([requestPermission](https://matinzd.github.io/react-native-health-connect/docs/api/methods/requestPermission)).
4. Consulta `Steps` de forma agregada con `aggregateGroupByPeriod`, con un intervalo de hasta
   30 días y un bucket de un día. Health Connect documenta la agregación por periodos y que los
   buckets pueden ser dispersos ([Read aggregated data](https://developer.android.com/health-and-fitness/guides/health-connect/develop/aggregate-data),
   [API aggregateGroupByPeriod](https://matinzd.github.io/react-native-health-connect/docs/api/methods/aggregateGroupByPeriod)).
5. Construye los límites de cada día a medianoche local y rellena con cero los buckets ausentes.
   La clave que se muestra es la fecha local del teléfono, no una fecha UTC convertida para la
   presentación.
6. No aplica `dataOriginFilter`: el Aggregate API calcula los totales de actividad evitando
   duplicados según la prioridad elegida por el usuario en Health Connect
   ([deduplicación de actividad](https://developer.android.com/health-and-fitness/guides/health-connect/develop/aggregate-data#aggregate-data-affected-by-user-selected-apps-priorities)).

El panel `src/healthConnect/HealthConnectValidationCard.tsx` muestra los días devueltos y los
estados de proveedor, permiso y error. Los tests de `src/healthConnect/steps.test.ts` cubren la
fecha local, el día actual y días anteriores, histórico vacío, rechazo de permiso y proveedor
no disponible.

## Limitaciones observadas y conocidas

- Health Connect requiere Android 9/API 28 o superior con Google Play services. En Android 14
  forma parte del sistema; en Android 13 y anteriores se distribuye como aplicación de Google
  Play ([disponibilidad](https://developer.android.com/health-and-fitness/guides/health-connect/plan/availability)).
  La API expone “no disponible” o “actualización requerida”, pero no garantiza que la razón
  “paquete ausente” pueda separarse de cualquier otra incompatibilidad sin información del
  dispositivo.
- Sin el permiso de histórico ampliado, la lectura está limitada por defecto a los 30 días
  anteriores a la concesión del permiso. Esta validación consulta como máximo esos 30 días y no
  solicita `PERMISSION_READ_HEALTH_DATA_HISTORY` ([restricciones de lectura](https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data#read-data-older-than-30-days)).
- Mi Fitness puede actualizarse al volver al primer plano o mediante la sincronización manual,
  y Xiaomi advierte de retrasos de sincronización de pasos. La aplicación no puede garantizar
  que un paso recién medido por el reloj ya esté disponible en Health Connect
  ([FAQ oficial del Redmi Watch 5 Active](https://www.mi.com/global/support/faq/details/KA-483511)).
- La FAQ de Xiaomi documenta la sincronización reloj → Mi Fitness, pero no certifica que cada
  versión de Mi Fitness o cada teléfono escriba pasos en Health Connect. Esa compatibilidad es
  precisamente la comprobación física pendiente de esta issue.
- Esta validación lee en primer plano. No declara lectura en segundo plano ni programa tareas
  periódicas. Las siguientes issues deben conservar esa decisión salvo que cambie el alcance.

## Procedimiento manual pendiente en el teléfono real

Con el Redmi Watch 5 Active enlazado al teléfono:

1. Actualizar firmware del reloj y Mi Fitness; mantener Mi Fitness autorizado para funcionar en
   segundo plano. En **Mi Fitness → Salud**, sincronizar manualmente y confirmar que aparecen
   pasos del día y de un día anterior.
2. Abrir Health Connect y confirmar que Mi Fitness aparece como aplicación/origen con datos de
   pasos. Confirmar que Gym Tracker todavía no tiene permiso de escritura.
3. Instalar la nueva development build, abrir **Ajustes → Validación de Health Connect** y pulsar
   **Solicitar permiso y leer pasos**.
4. Conceder únicamente **leer pasos**. Comparar el día actual y al menos dos días anteriores
   del panel con Health Connect/Mi Fitness; comprobar que cada fila mantiene la fecha local.
5. Repetir rechazando el permiso: el panel debe mostrar **Permiso denegado** y no debe intentar
   consultar datos.
6. Repetir en un teléfono sin proveedor disponible o con el proveedor pendiente de
   actualización: el panel debe mostrar **No disponible** sin bloquear el resto de Ajustes.
7. Confirmar que no aparece ningún permiso de escritura, que no se modifica el registro manual
   de pasos y que no se realiza ninguna petición de red de la app.

## Decisión para #23 y #24

- **#23:** reutilizar `react-native-health-connect@4.1.3`, pedir solo `READ_STEPS`, consultar en
  primer plano y usar el intervalo local del día actual. Si el permiso se pierde o la consulta
  falla, conservar el último valor local.
- **#24:** usar la misma agregación por periodos y las mismas claves de fecha local para el
  histórico. Inicialmente importar como máximo 30 días sin pedir permiso ampliado; decidir una
  solicitud separada para datos más antiguos solo si el usuario la necesita y después de revisar
  las obligaciones de publicación de Google Play.
- Mi Fitness → Health Connect → Gym Tracker será una lectura local. No se escribirán pasos en
  Health Connect, no se enviarán datos fuera del teléfono y no habrá sincronización periódica
  en segundo plano.

La integración de código y la documentación están listas para la comprobación manual, pero la
issue no debe considerarse cerrada hasta registrar los resultados de los siete pasos en un
dispositivo Android real.
