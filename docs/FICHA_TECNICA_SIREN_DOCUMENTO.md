FICHA TÉCNICA Y GUÍA DE USUARIO
SIREN — Sistema Inteligente de Regulación Energética

Versión del documento: 1.1
Tipo: Documento técnico-comercial orientado al flujo de usuario y a la arquitectura del software
Público: Operadores de edificio, facility managers, directivos de energía, evaluadores técnicos y jurado de proyecto


================================================================================
RESUMEN EJECUTIVO
================================================================================

SIREN es una plataforma web de regulación energética inteligente pensada para quienes administran infraestructuras grandes: hoteles, hospitales, campus universitarios, torres de oficinas y edificios de uso mixto.

A diferencia de un medidor convencional o de un tablero que solo muestra números, SIREN reúne en un solo lugar el monitoreo en tiempo real por zona, el control operativo, un motor experto con predicciones y recomendaciones, alertas proactivas, reportes exportables y una capa preparada para medidores IoT.

El sistema no se limita a mostrar datos: los interpreta, anticipa picos de demanda y sugiere acciones con impacto medible en pesos mexicanos, considerando el contexto real del mercado eléctrico en México (zonas climáticas de la CFE, subsidios, riesgo de tarifa DAC y tarifas comerciales).

Por qué SIREN puede presentarse como referente en su categoría: combina la visibilidad de un sistema de supervisión moderno, la inteligencia de un gestor energético avanzado y la facilidad de uso de un producto web actual, sin exigir que el operador sea ingeniero eléctrico para tomar buenas decisiones desde el primer día.


================================================================================
PARTE A — TECNOLOGÍAS UTILIZADAS
================================================================================

Esta sección explica con qué está construido SIREN, por qué se eligió cada pieza y cómo participa en el funcionamiento real del proyecto.


ARQUITECTURA GENERAL (en lenguaje claro)

SIREN funciona como una aplicación web clásica pero bien organizada: un servidor hecho con Node.js atiende las peticiones del navegador, expone una API para consultar y modificar datos, sirve la interfaz visual y mantiene una conexión en vivo con el panel mediante WebSockets. Los datos del edificio activo, las zonas, las alertas y parte del estado de la simulación se guardan en archivos del proyecto para que la demo sea portable y no dependa de instalar una base de datos aparte.

Cuando el usuario abre el panel en el navegador, descarga una página HTML con estilos propios y varios módulos de JavaScript. Esos módulos piden información al servidor, dibujan gráficas, escuchan actualizaciones en tiempo real y actualizan todas las pestañas de forma coordinada cuando se cambia de edificio.


NODE.JS (motor del servidor)

Qué es: Node.js es un entorno que permite ejecutar JavaScript fuera del navegador, en el servidor. SIREN requiere Node.js versión 18 o superior.

Por qué se eligió: Con un solo lenguaje (JavaScript) se puede desarrollar tanto el backend como el frontend. Eso acelera el desarrollo en un hackatón o MVP, reduce la curva de aprendizaje del equipo y facilita conectar en el futuro APIs de medidores IoT, que suelen exponerse también vía HTTP o MQTT con librerías disponibles en Node.

Cómo se usa en SIREN: El punto de entrada del programa es el archivo src/index.js. Ahí se crea el servidor HTTP, se conecta Socket.io, se inicia la simulación de consumo eléctrico y se escucha en el puerto configurado (por defecto 3000). El proyecto usa módulos modernos de JavaScript (import y export), lo que hace el código más ordenado y mantenible.

Comando habitual de desarrollo: npm run dev, que ejecuta el servidor con recarga automática cuando se modifican archivos del backend.


EXPRESS (servidor web y API REST)

Qué es: Express es la librería más usada en Node.js para crear servidores HTTP y definir rutas.

Por qué se eligió: Es ligera, estable y muy documentada. Permite en pocas líneas servir la carpeta public con la interfaz, montar todas las rutas bajo /api y devolver JSON de forma sencilla.

Cómo se usa en SIREN: En src/app.js se configura Express con soporte para JSON en el cuerpo de las peticiones, habilitación de CORS para que el navegador pueda llamar a la API sin bloqueos, enrutamiento hacia api.js y buildings.js, y entrega de archivos estáticos (HTML, CSS, imágenes, JavaScript del cliente). Cualquier ruta que no sea API devuelve la misma página principal para que la navegación por pestañas funcione sin recargar todo el sitio.

Ejemplos de lo que resuelve Express en el día a día del usuario: cargar el resumen del edificio, guardar cambios en el formulario de gestión, exportar un PDF, listar alertas o pedir el análisis del sistema experto.


SOCKET.IO (tiempo real)

Qué es: Socket.io añade comunicación bidireccional en tiempo real entre el servidor y el navegador, por encima de WebSockets.

Por qué se eligió: Un panel de energía que se actualiza cada pocos segundos no puede depender solo de que el usuario pulse «Actualizar». Socket.io reconecta automáticamente si hay cortes breves de red y simplifica emitir eventos con nombre (realtime, expert, alerts-created, etc.).

Cómo se usa en SIREN: En el servidor, un bucle de simulación (simulation.js) corre a intervalos regulares. En cada ciclo actualiza el consumo de cada zona, evalúa alertas, ejecuta reglas de automatización y emite por Socket.io un paquete «realtime» con todas las lecturas. Cada cierto número de ciclos también emite «expert» con el análisis actualizado. En el navegador, app.js escucha esos eventos y refresca KPIs, gráficas, tabla de áreas y badge de alertas sin parpadeos innecesarios.

Para el usuario esto se traduce en el indicador «En vivo» del menú lateral y en gráficas que avanzan solas mientras la medición está activa.


JAVASCRIPT VANILLA EN EL FRONTEND (sin React ni Angular)

Qué es: La interfaz está escrita en JavaScript estándar del navegador, organizada en módulos ES6 separados por responsabilidad.

Por qué se eligió: Para un MVP demostrable no hace falta un framework pesado. Menos dependencias significa instalación más rápida, menos configuración de compilación y código más fácil de explicar ante un jurado. Los módulos (app.js, expert-ui.js, buildings-ui.js, charts.js, sync-views.js, etc.) mantienen el proyecto ordenado sin la complejidad de un ecosistema grande.

Cómo se usa en SIREN: Cada pestaña del menú tiene lógica asociada. app.js coordina la navegación, la carga inicial y la conexión Socket.io. buildings-ui.js gestiona el formulario de edificios. expert-ui.js pinta el resumen del motor experto, la gráfica de pronóstico y los paneles de predicciones. sync-views.js garantiza que al cambiar de edificio todas las vistas reciban datos coherentes. measurement-ui.js controla la sesión de medición. automation-ui.js las reglas automáticas.

El usuario nota esto como una aplicación fluida por pestañas, con botones que responden al instante y sin pantallas de carga eternas.


HTML5 Y CSS3 (interfaz visual)

Qué es: La estructura de la página está en public/index.html y todo el diseño visual en public/css/styles.css.

Por qué se eligió: Control total sobre la identidad visual (azul marino, oro, tipografía corporativa) sin pelear con temas genéricos de librerías UI. El diseño es responsive: menú lateral tipo drawer en móvil, paneles que se adaptan y fotografías contextuales según tipo de edificio.

Cómo se usa en SIREN: Una sola página contiene todas las «vistas» (panel central, áreas, experto, alertas, reportes, medidores). CSS muestra u oculta la sección activa. Variables en :root definen colores, tamaños de letra, sombras y radios de borde para que el conjunto se vea profesional y coherente.

Fuentes tipográficas cargadas desde Google Fonts: Source Sans 3 para textos de interfaz, Source Serif 4 para títulos y encabezados formales, e IBM Plex Mono para cifras técnicas (kW, kWh, voltaje), lo que mejora la lectura de números en KPIs y tablas.


CHART.JS (gráficas)

Qué es: Librería JavaScript especializada en gráficas de líneas, barras y similares, incluida desde CDN en la página.

Por qué se eligió: Es madura, liviana de integrar y suficiente para demanda, voltaje, factor de potencia y pronóstico del experto sin desarrollar gráficas desde cero.

Cómo se usa en SIREN: El módulo charts.js centraliza opciones de estilo (colores legibles sobre fondo claro en el área de gráfica, escalas automáticas). En el panel central alimenta las curvas de potencia y costo; en el sistema experto la gráfica de pronóstico de demanda. Las gráficas se actualizan cuando llegan datos por Socket.io o cuando el usuario cambia de edificio.


EXCELJS Y PDFKIT (reportes exportables)

Qué es: ExcelJS genera archivos Excel en el servidor; PDFKit genera documentos PDF.

Por qué se eligieron: Gerencia y auditoría piden archivos que se puedan adjuntar a correos o imprimir. Hacerlo en el servidor garantiza tablas completas, logo y paginación correcta sin depender de la impresora del navegador.

Cómo se usa en SIREN: El servicio reports.js arma filas diarias, semanales o mensuales con variación realista según el perfil del edificio. Las rutas de exportación en la API devuelven el archivo listo para descargar. En la pestaña Reportes el usuario elige el periodo, ve una vista previa y pulsa Exportar Excel o Exportar PDF.


CORS (acceso entre origen y API)

Qué es: Mecanismo de seguridad de los navegadores; el paquete cors en Express lo configura de forma permisiva en desarrollo.

Por qué se usa: Evita errores si en el futuro el frontend se sirve desde otro dominio o puerto durante pruebas.

Cómo afecta al usuario: En la práctica, no se nota; la API y el panel funcionan juntos sin mensajes de bloqueo en consola.


ALMACENAMIENTO EN ARCHIVOS JSON

Qué es: Los edificios configurados y parte del estado en ejecución se guardan en archivos dentro de la carpeta data del proyecto.

Por qué se eligió: Para una demo o entrega de hackatón no es obligatorio montar PostgreSQL o MongoDB. Los JSON son legibles, fáciles de respaldar y de editar en caso de prueba. En una versión productiva se sustituirían por base de datos sin cambiar la lógica de negocio de forma drástica.

Cómo se usa en SIREN: buildingsStore.js lee y escribe la configuración de edificios (pisos, áreas, tarifas, equipos). runtimeStore.js persiste áreas en vivo, historial de consumo y alertas al cerrar el servidor de forma ordenada.


MÓDULOS DE LÓGICA DE NEGOCIO (servicios en src/services)

Estos no son «tecnologías externas» pero sí el corazón del producto:

energyStore.js — Simula y mantiene el estado eléctrico de cada zona (encendida, kW actual, kWh del día, voltaje, factor de potencia).

buildingsStore.js — Traduce la configuración del edificio en un «sitio» con pisos y áreas para el resto del sistema.

billing.js — Calcula kWh y costos según tarifa, modo de medición (habitaciones o m²) y factor de equipos instalados.

expertSystem.js — Motor experto: perfiles horarios, predicciones, recomendaciones, insights y alineación ODS.

alerts.js — Genera y clasifica alertas por consumo, red, CFE, medición y experto.

cfeBilling.js — Estima escalón tarifario y proximidad a DAC según zona climática.

automation.js — Aplica reglas como limitar sobrecarga o apagar servicios en pico.

measurementSession.js y measurementSchedule.js — Controlan cuándo acumula energía la sesión del día.

meters.js — Describe medidores y protocolos IoT por zona.

reports.js — Construye datos y archivos de reporte.

monitoring.js — Arma el «overview» que alimenta el panel central.

simulation.js — Orquesta el tick periódico y los eventos Socket.io.

La separación en servicios permite defender el proyecto ante jurado técnico: cada capacidad visible en la interfaz tiene un responsable claro en el backend.


IMÁGENES DESDE UNSPLASH (CDN externo)

Qué es: Fotografías reales de edificios cargadas por URL según el tipo de edificio activo (hotel, hospital, etc.).

Por qué se usa: Refuerza el contexto visual sin almacenar cientos de megabytes en el repositorio. building-photos.js actualiza las imágenes cuando el usuario cambia el tipo en el formulario.

Requisito: conexión a internet en la demo para ver las fotos; el resto del sistema funciona en local.


RESUMEN DE DEPENDENCIAS (package.json)

Node.js — entorno de ejecución
Express — servidor y API
Socket.io — tiempo real
cors — compatibilidad de API con navegadores
exceljs — exportación Excel
pdfkit — exportación PDF

En el cliente, además: Chart.js (gráficas) y Google Fonts (tipografía), cargados desde la red en index.html.


================================================================================
PARTE B — FLUJO DEL USUARIO Y MÓDULOS DEL SOFTWARE
================================================================================


ACCESO A LA PLATAFORMA

Al abrir la dirección del servidor (por ejemplo localhost puerto 3000), aparece una pantalla de bienvenida donde el operador puede escribir su nombre de forma opcional y entrar sin contraseña. Esto facilita demostraciones ante jurado o clientes.

Tras entrar, la pantalla principal muestra el menú lateral con las secciones del sistema, la barra superior con el edificio activo, filtros y accesos rápidos, y el contenido de la pestaña seleccionada.


BARRA SUPERIOR (herramientas siempre visibles)

Selector de edificio: cambia todo el contexto del sistema de un solo golpe.
Filtro de piso: acota tarjetas y tablas a un nivel del inmueble.
Campana de alertas: abre la sección de alertas; muestra cuántas hay pendientes.
Sonido: activa o silencia el aviso audible ante alertas nuevas.
Actualizar: fuerza la sincronización de todas las pestañas.
Editar edificio: lleva al formulario de gestión en el panel central.
Estado de sincronización: indica la hora de la última actualización de datos.


MÓDULO: PANEL CENTRAL

Qué hace: Es el centro de operaciones diarias. Aquí se configura el edificio, se controla la medición del día, se ven los indicadores clave, las gráficas y el detalle por piso.

Gestión de edificios — El usuario puede crear un edificio nuevo, editarlo o eliminarlo. Se define nombre, tipo (hotel, hospital, universidad o campus, corporativo, uso mixto), forma de medición por habitaciones o por metros cuadrados, zona climática CFE, tarifa eléctrica, consumo estimado con botones de valor sugerido, equipos instalados y estructura de pisos con sus áreas. La fotografía lateral cambia según el tipo elegido.

Medición en tiempo real — La potencia en kW siempre se ve en vivo. La energía acumulada del día y el costo en pesos dependen de que la sesión de medición esté iniciada; se puede reiniciar, pausar o programar horarios automáticos por días de la semana.

Automatización — Reglas de demostración que limitan zonas en sobrecarga o reducen carga en picos; cada acción queda en un registro con hora.

Indicadores y gráficas — Muestran áreas activas, demanda total, kWh y costo del día, referencias semanales y mensuales, y estado tarifario CFE cuando aplica. Las gráficas cubren potencia con costo, voltaje, factor de potencia y consumo por piso.

Por qué es clave: Sin una configuración correcta del edificio, el resto del sistema perdería sentido; por eso el panel central va primero en el flujo recomendado.


MÓDULO: ÁREAS Y CONTROL

Qué hace: Permite actuar sobre cada zona del edificio de forma individual.

Cómo se usa: En la tabla aparece cada área con su piso, estado encendido o apagado, límite de kW y lecturas en tiempo real. Cualquier cambio se refleja al instante en el panel y en el sistema experto.

Por qué importa: El ahorro energético real ocurre habitación por habitación, oficina por oficina o departamento por departamento, no solo a nivel edificio completo.


MÓDULO: SISTEMA EXPERTO

Qué hace: Convierte datos en conocimiento. Muestra el estado del motor experto, un pronóstico de demanda para las próximas horas, predicciones que rotan cada treinta segundos, insights sobre anomalías, recomendaciones de ahorro con lógica de negocio y la vinculación con los Objetivos de Desarrollo Sostenible 7, 11 y 12.

Cómo se usa: Abrir la pestaña Sistema experto; los datos se cargan y actualizan solos. Conviene leer primero el resumen y la tendencia, luego la gráfica de pronóstico y después las listas de predicciones y recomendaciones.

Por qué es el diferenciador del proyecto: Muchas soluciones solo grafican el pasado; SIREN sugiere qué puede pasar y qué conviene hacer, con lenguaje orientado a operación y costos.


MÓDULO: ALERTAS

Qué hace: Centraliza eventos que requieren atención: consumo excesivo, problemas de red eléctrica, avisos del control, insights del experto, estado de la medición y riesgos tarifarios CFE o DAC.

Cómo se usa: Revisar la lista, priorizar por severidad y seguir los enlaces que llevan al módulo correspondiente. La campana superior muestra el conteo sin tener que entrar primero a la pestaña.

Por qué importa: En operación 24 horas, el tiempo de reacción define cuánto se paga al final del mes.


MÓDULO: REPORTES

Qué hace: Genera informes diarios, semanales o mensuales del edificio activo con vista previa en pantalla y descarga en Excel o PDF con identidad SIREN.

Cómo se usa: Elegir periodo, revisar tablas en pantalla y exportar el formato que necesite finanzas o dirección.

Por qué importa: Cierra el ciclo hacia la gerencia y la auditoría fuera del panel en vivo.


MÓDULO: MEDIDORES IoT

Qué hace: Presenta la capa de campo: un medidor lógico por zona, resumen de conectividad, protocolos soportados en la demo (OpenMeter API, Modbus TCP, MQTT) y tabla buscable por zona o identificador.

Cómo se usa: Confirmar el edificio correcto, revisar el resumen y cruzar lecturas con la pestaña de áreas.

Por qué importa: Demuestra que SIREN no es un juguete de pantalla sino una plataforma preparada para integrarse con hardware real.


================================================================================
PARTE C — COHERENCIA DE DATOS Y TIEMPO REAL
================================================================================

Cuando el usuario cambia de edificio o guarda la configuración, un mecanismo interno (sync-views.js en el cliente) pide al servidor que actualice en paralelo el panel, las áreas, el experto, las alertas, los reportes y los medidores. Así nunca se mezclan datos de dos hoteles distintos en pantallas diferentes.

El servidor emite actualizaciones periódicas por Socket.io. El cliente actualiza números grandes, gráficas y filas de tabla sin recargar la página entera. Esa sensación de «sistema vivo» es parte central de la propuesta de valor.


================================================================================
PARTE D — CONTEXTO MÉXICO Y SOSTENIBILIDAD
================================================================================

SIREN incorpora zonas climáticas de la CFE, estimación de subsidio, proyección de consumo mensual y alertas cuando el edificio se acerca a tarifas de alto consumo (DAC). Los costos se expresan en pesos mexicanos y las tarifas se pueden ajustar por tipo de inmueble.

En el sistema experto se explica cómo el producto contribuye a los ODS 7 (energía), 11 (ciudades sostenibles) y 12 (consumo responsable), útil para memorias técnicas, concursos y clientes con agenda ambiental.


================================================================================
PARTE E — REQUISITOS E INSTALACIÓN
================================================================================

Se necesita Node.js versión 18 o superior instalado en el equipo servidor.

Pasos: instalar dependencias con npm install, arrancar con npm run dev, abrir el navegador en la dirección que indique la consola (habitualmente puerto 3000).

Para ver las fotografías por tipo de edificio hace falta conexión a internet; el resto puede funcionar en red local.


================================================================================
CONCLUSIÓN
================================================================================

SIREN está construido con tecnologías web modernas, probadas y adecuadas para un producto demostrable que puede evolucionar a instalación real: Node.js y Express en el servidor, Socket.io para el tiempo real, JavaScript modular en el cliente, Chart.js para visualización y generación profesional de reportes en Excel y PDF.

La elección deliberada de evitar frameworks pesados en el frontend y bases de datos complejas en esta etapa permite entregar valor funcional rápido sin sacrificar la arquitectura por servicios en el backend, donde vive la inteligencia del sistema experto, la facturación simulada, las alertas CFE y la automatización.

Para el usuario final, todo eso se traduce en una sola experiencia: configurar el edificio, ver el consumo en vivo, controlar zonas, recibir consejos del experto, atender alertas, exportar reportes y visualizar la capa IoT, con la confianza de usar una plataforma pensada para el mercado mexicano y para infraestructuras que de verdad importan.


Documento elaborado para el proyecto SIREN — Hackatec.
Versión ampliada con stack tecnológico y redacción orientada a lectura humana (sin diagramas de código ni tablas técnicas).
