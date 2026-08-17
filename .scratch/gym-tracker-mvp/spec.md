---
title: "MVP Android de seguimiento de cambio físico"
status: ready
labels:
  - ready-for-agent
issue_tracker: local-markdown
---

# MVP Android de seguimiento de cambio físico

## Problem Statement

El usuario necesita una aplicación Android personal, rápida y deliberadamente sencilla para registrar y consultar su constancia en objetivos de cambio físico. Actualmente necesita reunir en un único lugar el estado diario de pasos y ayuno, el progreso semanal de fuerza y HEAT, recordatorios de agua y una biblioteca propia de ejercicios con multimedia local.

La solución debe funcionar sin cuentas, backend, nube ni integraciones deportivas. Toda la información debe permanecer en su teléfono y sobrevivir al cierre y reapertura de la aplicación. El proyecto parte de un directorio vacío, por lo que antes de desarrollar cualquier funcionalidad se necesita completar el entorno base, generar una build de desarrollo de Expo e iniciar una aplicación vacía en el teléfono Android físico del usuario. No se instalarán ni utilizarán emuladores Android en el ordenador.

## Solution

Se construirá un MVP Android con React Native, Expo y TypeScript, optimizado para el uso de una sola persona. La pantalla de Inicio concentrará las acciones frecuentes y mostrará el estado de hoy y de la semana actual. Las secciones Ejercicios, Historial y Ajustes completarán una navegación mínima.

La aplicación almacenará los datos estructurados localmente y conservará dentro del almacenamiento privado de la aplicación las copias de los archivos multimedia que necesite mantener disponibles. Usará APIs oficiales de Expo para notificaciones, selección de multimedia, reproducción de vídeo, archivos y permisos. No necesitará conexión a Internet durante su uso normal.

El desarrollo comenzará con un hito obligatorio de puesta en marcha: crear el proyecto Expo TypeScript, configurar una development build Android mediante EAS Build, instalar el APK resultante en el teléfono físico y comprobar que la aplicación vacía arranca, se conecta al servidor de desarrollo y admite recarga rápida. Solo después de superar este hito se implementarán las funcionalidades del MVP. El ciclo de desarrollo y las pruebas funcionales se realizarán en ese teléfono, sin Android Studio ni emuladores instalados en el PC. Al finalizar se generará una build Android instalable para uso personal.

## User Stories

1. Como usuario único, quiero instalar la aplicación en mi teléfono Android físico, para poder desarrollarla y probarla sin un emulador.
2. Como desarrollador, quiero generar una development build Android con Expo/EAS, para probar APIs nativas reales en el dispositivo.
3. Como desarrollador, quiero arrancar una aplicación vacía en el teléfono antes de crear funcionalidades, para validar primero todo el entorno de desarrollo.
4. Como desarrollador, quiero conectar la development build del teléfono al servidor de desarrollo, para recibir cambios durante las iteraciones.
5. Como desarrollador, quiero comprobar la recarga rápida en el teléfono, para mantener un ciclo de desarrollo corto.
6. Como usuario único, quiero una build Android instalable, para usar la aplicación sin publicarla en una tienda.
7. Como usuario único, quiero que la aplicación funcione sin una cuenta, para empezar a usarla inmediatamente.
8. Como usuario único, quiero que el uso normal funcione sin Internet, para no depender de ningún servicio externo.
9. Como usuario único, quiero abrir la aplicación y ver directamente el estado de hoy y de esta semana, para saber rápidamente qué me queda por hacer.
10. Como usuario único, quiero una navegación limitada a Inicio, Ejercicios, Historial y Ajustes, para no perder tiempo buscando funciones.
11. Como usuario único, quiero botones grandes y estados visuales claros, para registrar acciones rápidamente desde el móvil.
12. Como usuario único, quiero distinguir objetivos pendientes, parciales y completados, para interpretar el estado de un vistazo.
13. Como usuario único, quiero que mis datos permanezcan después de cerrar o reiniciar la aplicación, para no perder mi historial.
14. Como usuario único, quiero que los datos permanezcan únicamente en mi dispositivo, para evitar infraestructura y exposición innecesarias.
15. Como usuario único, quiero tener por defecto un objetivo de tres sesiones de fuerza semanales, para empezar con mi planificación actual.
16. Como usuario único, quiero ver cuántas sesiones de fuerza he completado, cuál es el objetivo y cuántas faltan, para conocer mi progreso semanal.
17. Como usuario único, quiero ver cada sesión semanal como pendiente o completada, para usarla como checklist.
18. Como usuario único, quiero marcar una sesión de fuerza como completada desde Inicio, para registrar el entrenamiento con pocos pasos.
19. Como usuario único, quiero desmarcar una sesión marcada por error, para corregir el registro de la semana actual.
20. Como usuario único, quiero asociar grupos musculares a cada sesión, para saber qué corresponde entrenar.
21. Como usuario único, quiero empezar con Pecho/Hombro/Tríceps, Espalda/Bíceps y Piernas, para disponer de una configuración inicial útil.
22. Como usuario único, quiero ver la próxima sesión pendiente y sus grupos musculares, para decidir qué entrenamiento hacer.
23. Como usuario único, quiero abrir los ejercicios de un grupo muscular desde la sesión correspondiente, para consultar rápidamente mi biblioteca.
24. Como usuario único, quiero cambiar el número de sesiones semanales de fuerza, para adaptar el objetivo a mi planificación.
25. Como usuario único, quiero cambiar los grupos musculares de cada sesión, para adaptar la distribución semanal.
26. Como usuario único, quiero que una nueva configuración semanal no reescriba mi historial anterior, para conservar estadísticas coherentes.
27. Como usuario único, quiero introducir manualmente mis pasos del día, para registrar datos sin sensores ni integraciones.
28. Como usuario único, quiero tener un objetivo inicial de 7.000 pasos diarios, para usar la aplicación sin configuración previa.
29. Como usuario único, quiero ver los pasos actuales frente al objetivo, para entender mi avance diario.
30. Como usuario único, quiero ver cuánto me falta para el objetivo cuando aún no lo he alcanzado, para saber qué esfuerzo queda.
31. Como usuario único, quiero ver una indicación clara cuando alcance o supere el objetivo, para reconocer el cumplimiento.
32. Como usuario único, quiero editar los pasos del día, para corregir o actualizar el total conforme avanza el día.
33. Como usuario único, quiero modificar mi objetivo diario de pasos, para adaptarlo a mis necesidades.
34. Como usuario único, quiero que el objetivo usado en días pasados quede preservado, para que un cambio futuro no altere el cumplimiento histórico.
35. Como usuario único, quiero iniciar un ayuno con una sola acción, para guardar automáticamente la fecha y hora de inicio.
36. Como usuario único, quiero que solo pueda existir un ayuno activo, para evitar registros contradictorios.
37. Como usuario único, quiero ver la hora de inicio y el tiempo aproximado transcurrido durante un ayuno, para consultar su estado actual.
38. Como usuario único, quiero finalizar el ayuno activo con una sola acción, para guardar automáticamente la fecha y hora de fin.
39. Como usuario único, quiero que la duración se calcule automáticamente, para no hacer cálculos manuales.
40. Como usuario único, quiero que un ayuno pueda atravesar medianoche, para representar mi comportamiento real.
41. Como usuario único, quiero consultar la duración del último ayuno terminado, para conocer mi resultado más reciente.
42. Como usuario único, quiero consultar la duración media de mis ayunos terminados, para observar mi tendencia.
43. Como usuario único, quiero consultar un historial reciente de ayunos, para revisar inicios, finales y duraciones.
44. Como usuario único, quiero recibir recordatorios locales para beber agua cada dos horas, para mantener el hábito sin un servidor.
45. Como usuario único, quiero que los recordatorios estén limitados inicialmente de 08:00 a 22:00, para no recibir avisos a horas absurdas.
46. Como usuario único, quiero conceder o rechazar el permiso de notificaciones de forma comprensible, para conservar el control del dispositivo.
47. Como usuario único, quiero activar o desactivar los recordatorios de agua, para decidir cuándo utilizarlos.
48. Como usuario único, quiero cambiar la hora inicial y final de los recordatorios, para adaptarlos a mi horario.
49. Como usuario único, quiero cambiar el intervalo de recordatorio, para ajustar la frecuencia sin cambiar de aplicación.
50. Como usuario único, quiero que cambiar la configuración sustituya la programación anterior, para no recibir recordatorios duplicados.
51. Como usuario único, quiero tener por defecto un objetivo de una sesión de HEAT semanal, para empezar con mi planificación actual.
52. Como usuario único, quiero marcar manualmente una sesión de HEAT, para registrar su cumplimiento rápidamente.
53. Como usuario único, quiero desmarcar una sesión de HEAT registrada por error, para corregir la semana actual.
54. Como usuario único, quiero ver las sesiones HEAT realizadas frente al objetivo, para conocer el estado semanal.
55. Como usuario único, quiero cambiar el objetivo semanal de HEAT, para adaptar la planificación.
56. Como usuario único, quiero conservar el historial semanal de HEAT, para revisar mi constancia.
57. Como usuario único, quiero ver mis ejercicios agrupados por grupo muscular, para localizar rápidamente opciones de entrenamiento.
58. Como usuario único, quiero filtrar la biblioteca por grupo muscular, para reducir el listado visible.
59. Como usuario único, quiero disponer inicialmente de los grupos musculares habituales, para no tener que crearlos uno a uno.
60. Como usuario único, quiero añadir nuevos grupos musculares, para cubrir necesidades no previstas en la lista inicial.
61. Como usuario único, quiero crear un ejercicio con nombre y grupo muscular obligatorios, para mantener organizada la biblioteca.
62. Como usuario único, quiero añadir una descripción opcional al ejercicio, para guardar técnica, posición, consejos y errores que evitar.
63. Como usuario único, quiero que se validen los campos obligatorios antes de guardar, para evitar ejercicios incompletos.
64. Como usuario único, quiero abrir el detalle de un ejercicio, para consultar toda su información.
65. Como usuario único, quiero editar el nombre, grupo y descripción de un ejercicio, para mantenerlo actualizado.
66. Como usuario único, quiero eliminar un ejercicio después de una confirmación sencilla, para evitar borrados accidentales.
67. Como usuario único, quiero asociar ninguna, una o varias imágenes a un ejercicio, para conservar referencias visuales.
68. Como usuario único, quiero asociar ninguno, uno o varios vídeos a un ejercicio, para conservar demostraciones de movimiento.
69. Como usuario único, quiero combinar imágenes y vídeos en un ejercicio, para documentarlo como necesite.
70. Como usuario único, quiero seleccionar multimedia existente mediante el selector del sistema, para aprovechar los archivos de mi teléfono.
71. Como usuario único, quiero ver miniaturas sencillas del contenido cuando aporten claridad, para reconocerlo sin abrir cada archivo.
72. Como usuario único, quiero visualizar una imagen asociada, para consultar su detalle.
73. Como usuario único, quiero reproducir un vídeo asociado, para revisar la ejecución del ejercicio.
74. Como usuario único, quiero añadir multimedia desde el detalle del ejercicio, para ampliar su información posteriormente.
75. Como usuario único, quiero eliminar una referencia multimedia sin borrar por error otros elementos del ejercicio, para gestionar el contenido de forma directa.
76. Como usuario único, quiero que la multimedia siga disponible tras reiniciar la aplicación, para que la biblioteca sea fiable.
77. Como usuario único, quiero que al eliminar un ejercicio también se eliminen sus copias multimedia privadas, para no acumular archivos huérfanos.
78. Como usuario único, quiero consultar días anteriores, para revisar pasos y ayunos registrados.
79. Como usuario único, quiero consultar semanas anteriores, para revisar fuerza y HEAT sin que se borren al empezar una semana nueva.
80. Como usuario único, quiero ver cuántos días alcancé mi objetivo de pasos, para medir mi constancia diaria.
81. Como usuario único, quiero ver mi media de pasos, para entender mi actividad habitual.
82. Como usuario único, quiero ver entrenamientos realizados por semana, para comparar semanas recientes.
83. Como usuario único, quiero ver cuántas semanas cumplí el objetivo de fuerza, para medir consistencia.
84. Como usuario único, quiero ver sesiones de HEAT por semana, para revisar su cumplimiento.
85. Como usuario único, quiero ver una media de duración de ayunos completados, para resumir ese hábito sin recomendaciones médicas.
86. Como usuario único, quiero ver porcentajes de cumplimiento claros, para priorizar números útiles sobre gráficos complejos.
87. Como usuario único, quiero que la semana transcurra de lunes a domingo según la hora local del teléfono, para que los registros coincidan con mi calendario.
88. Como usuario único, quiero que el comienzo de una nueva semana cree un periodo nuevo sin borrar el anterior, para conservar todo mi progreso.
89. Como usuario único, quiero poder usar la biblioteca de ejercicios independientemente del día o la semana, para conservarla como información permanente.
90. Como desarrollador, quiero mantener la aplicación ejecutable después de cada iteración, para probar cada incremento inmediatamente en el teléfono.

## Implementation Decisions

- **Hito cero obligatorio:** el repositorio parte vacío. Antes de implementar funciones se inicializará una aplicación Expo con TypeScript y una pantalla base mínima. Se configurará una development build Android con EAS Build, se generará en la infraestructura de build de Expo, se descargará e instalará el APK en el teléfono físico y se comprobarán arranque, conexión al servidor de desarrollo y recarga rápida. Este hito bloquea el resto del MVP.
- **Dispositivo de desarrollo:** todo el desarrollo funcional y las pruebas manuales se realizarán en el teléfono Android del usuario. No se instalarán ni utilizarán Android Studio, SDK de emulador ni emuladores en el PC. El ordenador ejecutará el editor, Node, Expo CLI/EAS CLI y el servidor de desarrollo; el código nativo se ejecutará en el teléfono.
- **Tipo de build:** se usará una development build en lugar de depender de Expo Go, porque el MVP requiere validar notificaciones, permisos, archivos y multimedia en una aplicación nativa propia. Para uso personal estable se generará además una build Android instalable tipo preview/APK. No se configurará publicación en Google Play.
- **Orden de entrega:** después del hito cero, el trabajo avanzará en incrementos verticales y ejecutables: navegación y persistencia base; Inicio con pasos/fuerza/HEAT; ayuno; ajustes; notificaciones; ejercicios; multimedia; historial y estadísticas; endurecimiento de persistencia y build final.
- **Stack:** React Native, Expo y TypeScript. Se mantendrá el proyecto dentro del flujo administrado de Expo y se evitarán eject, prebuild manual y código nativo mientras las APIs oficiales cubran las necesidades.
- **Navegación:** se utilizará la opción de navegación mantenida y recomendada por Expo, con cuatro destinos principales: Inicio, Ejercicios, Historial y Ajustes. Las pantallas de creación, edición y detalle serán rutas secundarias, no nuevas secciones principales.
- **Interfaz:** la UI general se construirá con componentes básicos de React Native/Expo. Expo UI solo se introducirá si un control nativo concreto mejora claramente el resultado y es estable para Android. No se añadirá una librería visual grande.
- **Estado:** se usará estado local de React y hooks pequeños. Un Context ligero podrá exponer los datos persistidos y las acciones compartidas si evita prop drilling real. No se usarán Redux, inyección de dependencias ni capas empresariales.
- **Persistencia estructurada:** los ajustes, registros, ejercicios y referencias multimedia se almacenarán como datos JSON locales mediante AsyncStorage, con una versión explícita del esquema para permitir migraciones simples si el modelo cambia. Las escrituras reemplazarán de forma segura la instantánea correspondiente y la UI no confirmará una acción como guardada hasta que la persistencia finalice correctamente.
- **Datos iniciales:** en el primer arranque se crearán ajustes por defecto: 7.000 pasos diarios; tres sesiones de fuerza con la distribución indicada; una sesión HEAT semanal; recordatorios de agua cada dos horas entre 08:00 y 22:00; y los grupos Pecho, Espalda, Hombro, Bíceps, Tríceps, Piernas, Glúteos y Abdomen. Los recordatorios no se programarán hasta obtener permiso y activación efectiva.
- **Identidad y fechas:** las entidades editables usarán identificadores locales únicos. Los días se identificarán con una clave de fecha del calendario local y las semanas con la fecha local de su lunes. Los instantes de ayuno y de acciones relevantes se guardarán como timestamps ISO. Los cálculos se mostrarán en la zona horaria actual del teléfono.
- **Cambio de día/semana:** al abrir la aplicación o volver al primer plano se recalcularán el día y la semana actuales. No se ejecutará un borrado o reinicio físico; se leerá o creará el registro del nuevo periodo y los periodos anteriores permanecerán intactos.
- **Instantáneas de objetivos:** cada registro diario conservará el objetivo de pasos aplicado a ese día y cada registro semanal conservará los objetivos y la configuración de fuerza/HEAT aplicados a esa semana. Los cambios de fuerza, distribución y HEAT entrarán en vigor en la siguiente semana; el objetivo de pasos nuevo se aplicará desde el día del cambio sin reescribir días anteriores. Así, el historial no cambia retroactivamente.
- **Fuerza:** una semana contiene una lista ordenada de sesiones configuradas. Cada sesión tiene un nombre/posición, grupos musculares y estado completado. La próxima sesión será la primera pendiente. Marcar y desmarcar será idempotente y actualizará inmediatamente los conteos visible, objetivo y restante.
- **Acceso a ejercicios desde fuerza:** cada etiqueta de grupo muscular de la sesión permitirá abrir la biblioteca ya filtrada por ese grupo. El MVP no asignará ejercicios concretos a sesiones ni almacenará series, repeticiones o cargas.
- **Pasos:** cada día tendrá un único total manual no negativo. Introducir un nuevo valor reemplazará el anterior. La vista mostrará total, objetivo, diferencia restante limitada a cero y estado completado cuando el total sea igual o superior al objetivo.
- **Ayuno:** solo existirá un ayuno activo global. Empezar guarda el instante actual; finalizar guarda el instante actual y deriva la duración. El contador visible se actualizará aproximadamente una vez por minuto y se recalculará al volver al primer plano. Las medias incluirán únicamente ayunos finalizados; un ayuno activo nunca se contará como completo.
- **HEAT:** el registro semanal almacenará sesiones completadas hasta el objetivo configurable. La interfaz permitirá incrementar mediante “marcar como completado” y revertir la última marca para corregir errores, sin superar el objetivo ni bajar de cero.
- **Notificaciones de agua:** se usará Expo Notifications y un canal Android dedicado. Al activar la función se solicitará permiso; si se deniega, la aplicación explicará el estado y no fingirá que los avisos están activos. Se programará un recordatorio diario por cada hora válida dentro de la ventana, derivada del intervalo. Al cambiar ajustes, desactivar o volver a programar, primero se cancelarán únicamente los recordatorios de agua creados por la aplicación para evitar duplicados.
- **Ventana de agua:** la hora de inicio debe ser anterior a la hora final y el intervalo debe ser positivo. El inicio forma parte de la ventana y no se programará una ocurrencia posterior al final. La configuración inicial produce avisos a las 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 y 22:00. No se requieren recordatorios nocturnos ni un servidor push.
- **Grupos musculares:** serán datos persistentes, no un enum cerrado. Los grupos iniciales se podrán ampliar. No se permitirá crear nombres vacíos ni duplicados ignorando mayúsculas y espacios. Un grupo usado por ejercicios o por la planificación no podrá eliminarse sin resolver primero esas referencias; editar su nombre actualizará su presentación de forma consistente.
- **Ejercicios:** cada ejercicio tendrá identificador, nombre obligatorio normalizado, identificador de grupo obligatorio, descripción opcional, lista ordenada de elementos multimedia y fechas de creación/actualización. Los listados se ordenarán de forma predecible, inicialmente por grupo y nombre.
- **Multimedia:** se usará el selector oficial de Expo para escoger imágenes y vídeos existentes. La selección respetará permisos del sistema y no requerirá acceso indiscriminado a toda la galería.
- **Durabilidad multimedia:** una URI devuelta por el selector puede ser temporal o dejar de ser accesible. Por ello, al asociar un archivo se copiará una única vez al almacenamiento privado y persistente de la aplicación mediante la API oficial de archivos de Expo. Se guardarán solo el identificador, tipo, URI privada y metadatos mínimos necesarios. Esta copia es la excepción necesaria al principio de “no copiar archivos”, porque garantiza que el contenido sobreviva a reinicios y cambios del archivo original.
- **Limpieza multimedia:** eliminar un elemento multimedia borrará su copia privada después de actualizar de forma segura el ejercicio. Eliminar un ejercicio pedirá confirmación y eliminará también sus archivos privados. Se tolerará y comunicará un archivo ausente sin bloquear el resto del detalle.
- **Visualización multimedia:** las imágenes se mostrarán con un visor simple y los vídeos con el reproductor oficial de Expo. No habrá edición, compresión, transformación, subida, galería avanzada ni reproducción remota.
- **Historial:** ofrecerá una vista sencilla de días y semanas recientes, con acceso a sus cifras principales. Se priorizarán listas, totales y porcentajes sobre gráficos. El rango inicial puede limitar la presentación a semanas recientes sin eliminar datos persistidos.
- **Definiciones estadísticas:** “día de pasos cumplido” significa total igual o superior al objetivo guardado para ese día; “semana de fuerza cumplida” significa sesiones completadas iguales o superiores al objetivo guardado para esa semana; HEAT usa la misma regla semanal. La media de pasos usa días con un valor registrado. La media de ayuno usa ayunos finalizados. Los periodos sin registro no se inventan como cero en las medias.
- **Cumplimiento general:** para un rango seleccionado, cada día con objetivo de pasos aporta una unidad posible y cada objetivo semanal de fuerza y HEAT aporta una unidad posible. El porcentaje será unidades cumplidas dividido por unidades evaluables. El ayuno se mostrará como actividad y media, pero no entrará en cumplimiento mientras no exista un objetivo de duración definido.
- **Errores y vacíos:** las pantallas tendrán estados vacíos útiles y mensajes breves ante permisos denegados, archivos ausentes o fallos de almacenamiento. No se añadirá telemetría ni crash reporting; los errores recuperables permanecerán visibles para el usuario.
- **Privacidad:** no se enviará información a servicios externos durante el uso normal. La única conectividad necesaria será la propia del desarrollo/build de Expo. No habrá analítica, autenticación, API ni sincronización.
- **Portabilidad:** desinstalar la aplicación puede borrar AsyncStorage y los archivos privados. Copias de seguridad, exportación, importación y restauración no forman parte del MVP y la interfaz no prometerá recuperación.
- **Calidad del código:** se priorizarán módulos pequeños por capacidad, tipos de dominio directos, funciones puras para cálculos temporales/estadísticos y componentes orientados a comportamiento visible. Solo se extraerán abstracciones cuando reduzcan duplicación real.

## Testing Decisions

- **Seam principal:** la prueba de mayor nivel será el comportamiento visible de la aplicación renderizada y operada como usuario: abrir Inicio, ejecutar una acción, observar el nuevo estado, simular cierre/reapertura y comprobar que el estado persiste. Esta única seam cubrirá la mayoría de flujos mediante pruebas de integración de pantalla con una implementación controlada del almacenamiento y adaptadores de dispositivo.
- **Criterio de una buena prueba:** validará resultados observables —texto, estados, navegación, datos recuperados y avisos programados— y no nombres de hooks, estructura de componentes, llamadas internas ni detalles de implementación.
- **Hito cero en dispositivo:** antes de probar funcionalidades se realizará una aceptación manual obligatoria en el teléfono Android: instalar la development build, abrir la pantalla vacía, conectar con el servidor de desarrollo, modificar un texto y confirmar recarga rápida. No se aceptará sustituir esta prueba por un emulador.
- **Flujos de Inicio:** se probarán integración y persistencia para introducir/editar pasos, alcanzar el objetivo, completar/revertir fuerza, calcular restante, mostrar próxima sesión, completar/revertir HEAT e iniciar/finalizar un ayuno.
- **Transiciones temporales:** se probarán lunes/domingo, cambio de día, cambio de semana, ayunos que cruzan medianoche y recálculo al volver al primer plano. El reloj se controlará en las pruebas para evitar dependencia de la hora real.
- **Ajustes e historial:** se probará que los valores iniciales existen, que la validación rechaza configuraciones inválidas, que los nuevos objetivos se aplican al periodo correcto y que las instantáneas históricas no se reescriben.
- **Estadísticas:** las funciones puras de agregación tendrán pruebas dirigidas para periodos vacíos, objetivos cumplidos/no cumplidos, valores superiores al objetivo, medias con datos parciales y exclusión de ayunos activos. Estas pruebas complementan, pero no reemplazan, la seam principal.
- **Ejercicios:** se probará crear, validar, filtrar, abrir, editar y eliminar ejercicios; añadir grupos; impedir duplicados; navegar desde un grupo de la sesión; y mantener datos después de recargar la aplicación.
- **Multimedia:** mediante adaptadores controlados se probará selección, copia persistente, visualización de referencias, eliminación de un archivo y limpieza al borrar un ejercicio. No se afirmará que un mock valida permisos ni codecs reales.
- **Notificaciones:** mediante un adaptador controlado se probarán cálculo de horarios, solicitud/denegación de permisos, creación del canal, programación sin duplicados, reprogramación y cancelación. En el teléfono se comprobará además que una notificación local real aparece con la app en primer y segundo plano según el comportamiento soportado por Android.
- **Pruebas físicas obligatorias:** permisos de notificaciones y multimedia, selector del sistema, apertura de imagen, reproducción de vídeo, persistencia tras forzar cierre/reiniciar, recordatorio local y build final se validarán en el teléfono Android real.
- **Regresión mínima por incremento:** cada entrega conservará un smoke test de arranque, navegación, hidratación desde almacenamiento y acción principal modificada. El proyecto debe permanecer ejecutable en cada paso.
- **Prior art:** no existe código ni suite de pruebas previa en el repositorio. Se establecerá como precedente una suite pequeña basada en pruebas de integración de pantallas para React Native y pruebas unitarias solo para cálculos puros. No se creará una jerarquía extensa de pruebas ni snapshots visuales frágiles.
- **Criterio de aceptación del MVP:** se recorrerán en el dispositivo, de principio a fin, los 21 flujos prioritarios indicados en el prompt, incluyendo cerrar y reabrir sin pérdida, consultar periodos anteriores e instalar la build Android personal.

## Out of Scope

- Usuarios, perfiles, login, autenticación, recuperación de contraseña o capacidades multiusuario.
- Backend, API propia, servidor, Supabase, Firebase, bases de datos remotas, sincronización cloud o resolución de conflictos entre dispositivos.
- Publicación en Google Play o Apple App Store, versión iOS, monetización, pagos, suscripciones, publicidad o estrategia de producto comercial.
- Android Studio, emuladores Android, eject, módulos nativos propios o mantenimiento de infraestructura móvil nativa, salvo que una limitación demostrada de Expo bloquee un requisito esencial y se acuerde una revisión del alcance.
- CI/CD complejo, analítica, telemetría, crash reporting o panel web.
- Integraciones con Google Fit, Health Connect, smartwatches, wearables, sensores o conteo automático de pasos.
- Push notifications, Firebase Cloud Messaging o programación remota de avisos.
- Nutrición avanzada, calorías, macros, dietas, alimentos, recomendaciones médicas o protocolos de ayuno.
- Peso corporal, medidas, fotografías de progreso físico o seguimiento clínico, porque no forman parte del prompt del MVP.
- Rutinas complejas, asignación de ejercicios concretos a sesiones, series, repeticiones, cargas, descansos, temporizadores de entrenamiento o progresión de marcas.
- Catálogo online, descarga automática de ejercicios, contenido remoto, enlaces públicos o almacenamiento multimedia en la nube.
- Edición, recorte, compresión, transcodificación o gestión avanzada de imágenes y vídeos.
- Gamificación, logros, rachas, rankings, amigos o compartir progreso.
- IA, chat o recomendaciones automáticas.
- Exportación, importación, backup, restauración o migración entre teléfonos.
- Gráficos complejos y analítica avanzada; el MVP priorizará cifras y listados claros.
- Edición manual avanzada del historial de ayunos o recuperación de registros eliminados.

## Further Notes

- La pregunta rectora de cada decisión será: “¿Cuál es la forma más sencilla de conseguir que esta funcionalidad funcione bien en mi móvil?”.
- El teléfono Android físico es tanto el objetivo de distribución como el dispositivo principal de validación. La ausencia de emuladores es una restricción deliberada, no una tarea pendiente.
- La build se genera con el servicio de Expo/EAS y se instala directamente en el dispositivo; no significa compilar el binario dentro del propio teléfono.
- Se necesitarán una cuenta de Expo/EAS, acceso temporal a Internet para generar/descargar builds y habilitar la instalación de APK desde la fuente elegida en Android.
- Para el ciclo de desarrollo, ordenador y teléfono deberán poder comunicarse con el servidor de Expo, normalmente mediante la misma red local o el modo de conexión disponible que resulte fiable.
- La aplicación no debe prometer recuperación tras desinstalación. En Android, los datos privados de la app pueden eliminarse junto con ella.
- Si una API necesaria se comporta de forma distinta en Expo Go y en una build propia, prevalecerá el comportamiento comprobado en la development build instalada.
- Esta especificación se ha creado antes de existir implementación. Las decisiones favorecen el flujo administrado de Expo y podrán ajustarse solo ante una limitación real observada en el teléfono, manteniendo el alcance y la simplicidad.
