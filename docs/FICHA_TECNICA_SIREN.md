# FICHA TÉCNICA Y GUÍA DE USUARIO  
## SIREN — Sistema Inteligente de Regulación Energética

**Versión del documento:** 1.0  
**Tipo:** Ficha técnica orientada al flujo de usuario  
**Público:** Operadores de edificio, facility managers, directivos de energía, evaluadores técnicos y jurado de proyecto  

**Nota:** Para una versión en prosa continua, con tecnologías explicadas (Node.js, Express, Socket.io, etc.) y sin tablas ni diagramas, usar el archivo **FICHA_TECNICA_SIREN_DOCUMENTO.md** en esta misma carpeta.

---

## 1. Resumen ejecutivo

**SIREN** es una plataforma web de **regulación energética inteligente** diseñada para organizaciones que administran **infraestructuras masivas**: hoteles, hospitales, campus universitarios, torres corporativas y edificios de uso mixto. A diferencia de un simple medidor o un dashboard estático, SIREN integra en un solo entorno:

- **Monitoreo en tiempo real** (kW, kWh, voltaje, factor de potencia) por zona y por piso  
- **Control operativo** (encendido, apagado y límites de demanda)  
- **Motor experto** con predicciones, detección de anomalías y recomendaciones de ahorro  
- **Alertas proactivas** (consumo, red eléctrica, medición, tarifa CFE)  
- **Reportes exportables** (PDF y Excel) con trazabilidad  
- **Capa IoT** preparada para medidores industriales (OpenMeter, Modbus TCP, MQTT)  

SIREN no solo **muestra** datos: **interpreta**, **anticipa** y **sugiere acciones** con impacto económico medible en pesos mexicanos (MXN), alineado con la operación real de edificios en México (zonas climáticas CFE, riesgo DAC, tarifas comerciales).

> **Por qué SIREN se posiciona como referente en su categoría**  
> Combina visibilidad operativa (lo que hace un SCADA ligero), inteligencia de negocio (lo que promete un BMS avanzado) y usabilidad de producto SaaS moderno — sin exigir al usuario conocimientos de ingeniería eléctrica para tomar decisiones el primer día.

---

## 2. Propuesta de valor: qué problema resuelve y por qué importa

### 2.1 El problema en edificios complejos

En un hotel de 12 pisos, un hospital 24/7 o un campus con decenas de aulas, la energía se consume **de forma desigual**: habitaciones vacías con climatización encendida, cocinas industriales en horario pico, laboratorios con carga constante, estacionamientos con iluminación innecesaria. Sin un sistema centralizado:

- El costo eléctrico **crece de forma invisible** hasta la factura CFE.  
- Los picos de demanda **penalizan** tarifas y factor de potencia.  
- El personal operativo **no sabe dónde actuar primero**.  
- Los reportes para gerencia son **manuales, tardíos e incompletos**.

### 2.2 La respuesta SIREN

| Necesidad del mercado | Cómo responde SIREN |
|----------------------|---------------------|
| Ver consumo ahora | WebSocket + KPIs y gráficas en vivo |
| Actuar por zona | Control por área con límites en kW |
| Anticipar picos | Sistema experto con pronóstico horario |
| Cumplir y auditar | Reportes PDF/Excel con logo y tablas |
| Integrar medidores | Módulo IoT multi-protocolo |
| Contexto México | Zonas CFE, subsidio, alertas DAC |
| Sostenibilidad | Vinculación explícita ODS 7, 11 y 12 |

### 2.3 Diferenciadores frente a alternativas genéricas

1. **Modelo por tipo de edificio** — Perfiles distintos para hotel, hospital, universidad, corporativo y uso mixto (equipos, kWh sugeridos, tarifas de referencia).  
2. **Doble modo de medición** — Por habitaciones/áreas o por metros cuadrados (m²), según cómo opere el inmueble.  
3. **Sistema experto rotativo** — Predicciones y recomendaciones que se actualizan cada 30 segundos con el consumo en vivo, no un informe estático.  
4. **Sincronización total** — Al cambiar de edificio, **todas** las pestañas (panel, áreas, experto, alertas, reportes, medidores) reflejan el mismo contexto.  
5. **Automatización demostrable** — Reglas que limitan sobrecarga o reducen carga en picos, con bitácora de acciones.  
6. **Experiencia de producto** — Interfaz oscura profesional, ayudas contextuales (?), sonido de alertas, acceso demo sin fricción.

---

## 3. Flujo general del usuario (customer journey)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│   ACCESO    │────▶│  BARRA SUPERIOR  │────▶│  NAVEGACIÓN POR MÓDULO (sidebar)   │
│  (login)    │     │  edificio, piso, │     │  Panel │ Áreas │ Experto │ …      │
└─────────────┘     │  alertas, sync   │     └─────────────────────────────────────┘
                    └──────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   Configurar            Operar en              Analizar y
   edificio              tiempo real              decidir
   (Panel central)       (Áreas + KPIs)          (Experto + Reportes)
```

### Paso a paso recomendado (primer uso)

1. **Entrar** con nombre opcional (demo sin contraseña).  
2. En **Panel central**, revisar o crear el edificio activo (tipo, pisos, equipos, tarifa).  
3. **Iniciar medición** (manual o por horario) para acumular kWh y costo del día.  
4. Observar **KPIs y gráficas** mientras el sistema simula lecturas en vivo.  
5. Ir a **Áreas y control** para encender/apagar zonas o fijar topes de kW.  
6. Consultar **Sistema experto** para predicciones y recomendaciones.  
7. Revisar **Alertas** ante consumo anómalo o riesgo tarifario.  
8. Generar **Reportes** diarios, semanales o mensuales en PDF/Excel.  
9. Validar en **Medidores IoT** la capa de integración por zona.

---

## 4. Acceso e interfaz global

### 4.1 Pantalla de acceso

- **Qué es:** Puerta de entrada al panel (vista de demostración).  
- **Qué hace:** Permite identificarse con un nombre opcional y entrar sin registro complejo.  
- **Cómo:** Botón «Entrar al panel».  
- **Por qué:** Reduce fricción en hackathons, demos comerciales y capacitación; el foco está en la capacidad del sistema, no en la gestión de cuentas.

### 4.2 Barra superior (toolbar)

| Elemento | Función | Cómo usarlo |
|----------|---------|-------------|
| **Selector de edificio** | Cambia el edificio activo en todo el sistema | Desplegable → elegir edificio → datos se recargan en todas las vistas |
| **Filtro de piso** | Acota tarjetas y tablas al piso elegido | «Todos los pisos» o un piso concreto |
| **Campana de alertas** | Acceso rápido a la pestaña Alertas | Clic en icono; badge con número de alertas activas |
| **Sonido** | Activa/desactiva aviso sonoro ante alertas nuevas | Clic en icono de bocina |
| **Actualizar** | Fuerza sincronización de todas las vistas | Clic en «Actualizar» |
| **Editar edificio** | Salta al formulario de gestión en Panel central | Clic → scroll al panel de edificios |
| **Estado de sync** | Hora de última actualización | Referencia de datos frescos |

**Por qué importa:** Un solo punto de control evita que el usuario «se pierda» entre pestañas con datos de edificios distintos.

### 4.3 Menú lateral

- **Panel central** — Operación y configuración del día a día.  
- **Áreas y control** — Acciones por zona.  
- **Sistema experto** — Inteligencia y pronósticos.  
- **Alertas** — Eventos que requieren atención.  
- **Reportes** — Exportación gerencial.  
- **Medidores IoT** — Capa de dispositivos y protocolos.  

Indicador **«En vivo»** (punto verde): confirma que el backend emite actualizaciones por WebSocket.

---

## 5. MÓDULO: Panel central

El **Panel central** es el corazón operativo de SIREN. Aquí se define **qué** se monitorea, **cómo** se factura y **qué** ocurre en este instante en todo el edificio.

### 5.1 Gestión de edificios

#### Qué hace
Permite crear, editar, eliminar y seleccionar edificios. Cada edificio es un modelo completo: nombre, tipo, medición, tarifa, zona CFE, equipos instalados y estructura de pisos con áreas.

#### Cómo hacerlo

| Acción | Pasos |
|--------|--------|
| **Nuevo edificio** | «+ Nuevo edificio» → completar formulario → «Guardar edificio» |
| **Editar** | Seleccionar edificio en barra superior o editar en el mismo formulario |
| **Eliminar** | «Eliminar» (con edificio cargado en el formulario) |
| **Cambiar activo** | Selector en barra superior (no requiere guardar de nuevo) |

#### Secciones del formulario

1. **Identificación** — Nombre libre del inmueble.  
2. **Configuración**  
   - **Tipo de edificio:** Hotel, Hospital, Universidad/campus, Corporativo, Uso mixto.  
   - **Medición:** Por habitaciones/áreas **o** por m² totales.  
   - **Zona climática CFE:** Impacta estimación de subsidio y proximidad a tarifa DAC.  
3. **Parámetros energéticos**  
   - Tarifa eléctrica (MXN/kWh) con botón **«Usar sugerida»** según tipo.  
   - kWh promedio por área/día o kWh por m²/día, también con sugerencia automática.  
4. **Equipos eléctricos** — Lista desplegable por tipo de edificio (HVAC, cocina, elevadores, laboratorios, etc.); el sistema ajusta el factor de consumo.  
5. **Pisos y áreas** — Agregar pisos, definir si miden por habitaciones o m², número de áreas o superficie, y tipos de zona (habitación, oficina, común, servicios, etc.).

#### Por qué funciona así
SIREN **no obliga** a adivinar parámetros: las sugerencias provienen de perfiles por industria (hospital consume más por área que una oficina). El operador puede afinar con datos reales de facturas CFE. La imagen lateral del panel **cambia según el tipo de edificio** para reforzar el contexto visual.

---

### 5.2 Medición en tiempo real

#### Qué hace
Controla **cuándo** se acumulan kWh y costo estimado en gráficas y KPIs del día. La **potencia (kW)** se muestra siempre en vivo; la acumulación de energía depende del estado de medición.

#### Cómo hacerlo

| Control | Efecto |
|---------|--------|
| **Reiniciar e iniciar** | Pone el contador del día en cero y comienza a acumular |
| **Iniciar** | Continúa acumulando sin reiniciar |
| **Detener** | Detiene acumulación (kW sigue visible) |
| **Horario automático** | Activa medición en días/horas definidos (ej. Lun–Vie 08:00–20:00) |

#### Por qué funciona así
Separar **potencia instantánea** de **energía acumulada** replica la operación real: el gerente quiere ver demanda ahora, pero el costo del día solo tiene sentido si la sesión de medición está activa. El horario automático evita olvidos al inicio del turno.

---

### 5.3 Automatización

#### Qué hace
Ejecuta **reglas** sobre el consumo simulado/en vivo:

- **Limitar zonas en sobrecarga** — Si una zona supera ~135 % de lo esperado, ajusta su tope de kW.  
- **Apagar servicios en pico** — Si la demanda total supera ~130 % del baseline, puede apagar una zona de servicios.

#### Cómo hacerlo
Activar o desactivar cada regla en el panel. Las acciones quedan registradas en el **log de automatización** con marca de tiempo.

#### Por qué funciona así
Demuestra que SIREN no es solo visualización: puede **cerrar el ciclo** hacia el control. En producción, estas reglas se conectarían a relés, variadores o sistemas BMS.

---

### 5.4 Indicadores clave (KPIs)

Muestran de un vistazo (actualizados en vivo):

- Áreas totales y activas  
- Demanda total (kW)  
- kWh del día y costo estimado (MXN)  
- Referencias semanales/mensuales  
- Estado **CFE** (subsidio, intermedio, riesgo DAC, DAC activa) cuando aplica  

**Por qué:** El directivo necesita números grandes y claros antes de entrar al detalle de gráficas.

---

### 5.5 Gráficas de demanda

| Gráfica | Información | Utilidad |
|---------|-------------|----------|
| **Potencia total + costo** | kW (naranja) y MXN acumulados (verde) | Correlacionar demanda con dinero en el mismo eje temporal |
| **Voltaje de red** | Promedio en voltios | Detectar subidas/bajadas de red (~127 V en México) |
| **Factor de potencia** | FP agregado | Anticipar penalizaciones CFE por bajo FP |
| **Por piso** | Barras kW y costo por nivel | Localizar pisos problemáticos |

Leyendas **(?):** al pasar el cursor sobre el icono de ayuda se explica cada serie sin saturar la interfaz.

---

### 5.6 Tarjetas por piso

Resumen compacto por nivel: nombre del piso, kW total, pastillas por zona con estado. Complementa las gráficas con lectura **geográfica** del edificio.

---

## 6. MÓDULO: Áreas y control

### Qué hace
Es la **consola de operación**: cada fila representa una zona (habitación, oficina, comedor, cuarto eléctrico, etc.) con controles directos.

### Cómo hacerlo

Por cada área en la tabla:

| Control | Acción |
|---------|--------|
| **Encendido / Apagado** | Interruptor de energía a la zona |
| **Límite kW** | Tope máximo de demanda permitido |
| **Lecturas** | kW, voltaje, factor de potencia en tiempo real |

Los cambios se propagan **al instante** a medidores, gráficas del panel y motor experto (vía sincronización y WebSocket).

### Por qué funciona así
En hoteles y hospitales la unidad de decisión es la **habitación o el departamento**, no solo el edificio completo. SIREN baja el nivel de granularidad donde realmente se ahorra energía. La foto contextual del módulo refleja el **tipo de edificio activo** (oficina, hotel, etc.).

### Casos de uso típicos

- Apagar alas vacías en temporada baja.  
- Limitar kW en cocina industrial en horario de comida.  
- Reducir carga en laboratorio fuera de horario escolar.  
- Probar escenarios antes de aplicar automatización global.

---

## 7. MÓDULO: Sistema experto

El **Sistema experto** es el diferenciador intelectual de SIREN: transforma datos en **conocimiento accionable**.

### Qué hace (capas)

1. **Resumen del motor** — Edificio activo, demanda vs baseline, ratio de carga, tendencia (↑ ↓ →), calidad de datos (muestras y confianza).  
2. **Pronóstico de demanda** — Gráfica de kW previstos para próximas horas vs línea base habitual.  
3. **Predicciones** — Escenarios probabilísticos (picos, sobrecostos, ventanas de riesgo) en rotación cada **30 segundos**.  
4. **Insights detectados** — Anomalías: desbalance entre pisos, FP bajo, zonas fuera de perfil horario.  
5. **Recomendaciones de ahorro** — Acciones concretas con impacto estimado en MXN.  
6. **Alineación ODS 2030** — Objetivos 7, 11 y 12 con explicación de cómo SIREN contribuye (imagen y texto oficial ONU).

### Cómo usarlo

1. Abrir pestaña **Sistema experto** (los datos se cargan y refrescan al entrar).  
2. Leer el **estado del motor** y la tendencia.  
3. Analizar la **gráfica de pronóstico** para planificar el turno siguiente.  
4. Revisar **predicciones** y **recomendaciones** (rotan para mostrar el pool completo).  
5. Desplegar cada **ODS** para vincular el proyecto con sostenibilidad corporativa o informes ESG.

### Por qué funciona así (base técnica, lenguaje claro)

- **Perfiles de carga** por tipo de edificio y hora del día.  
- **Observación continua** del consumo en vivo alimenta promedios horarios.  
- **Reglas expertas** comparan real vs esperado, costo marginal y riesgo tarifario.  
- **Rotación** evita una UI estática: en operación real siempre hay algo nuevo que evaluar.

> **Defensa del proyecto:** Muchos competidores muestran gráficas; pocos explican *qué hacer mañana a las 18:00* cuando sube la demanda. SIREN une **predicción + recomendación + costo en pesos**, que es lo que convence a gerencia.

---

## 8. MÓDULO: Alertas

### Qué hace
Centraliza **eventos** que requieren atención humana o revisión del experto. No espera a que el usuario abra cada módulo.

### Tipos de alerta

| Tipo | Ejemplo | Severidad típica |
|------|---------|------------------|
| **Consumo** | Zona por encima del límite o patrón anómalo | Advertencia / urgente |
| **Red eléctrica** | Voltaje o factor de potencia fuera de rango | Advertencia |
| **Control SIREN** | Acciones del sistema o límites alcanzados | Información |
| **Sistema experto** | Insight crítico del motor | Información |
| **Medición** | Sesión detenida o no iniciada | Información |
| **Tarifa CFE / DAC** | Proximidad o activación de tarifa DAC | Urgente |
| **Subsidio CFE** | Cambios de temporada tarifaria | Información |

### Cómo hacerlo

1. Revisar el **resumen** («X alertas activas»).  
2. Leer cada ítem: título, mensaje, severidad, hora.  
3. Usar **acciones enlazadas** (ej. «Ver recomendaciones del experto», «Abrir Sistema experto») cuando aparezcan.  
4. Gestionar desde la **campana** en la barra superior (badge numérico).  
5. Opcional: **sonido** para alertas nuevas sin mirar la pantalla.

### Banner CFE
Si el edificio se acerca o supera umbrales de consumo mensual proyectado, un **banner destacado** advierte sobre riesgo **DAC** (tarifa de alto consumo en México).

### Por qué funciona así
En facility management, **el tiempo de reacción** define el ahorro. SIREN prioriza por severidad y conecta alertas con el módulo correcto, reduciendo clics y errores de interpretación.

---

## 9. MÓDULO: Reportes

### Qué hace
Genera **informes periódicos** del edificio activo con desglose temporal y exportación profesional.

### Períodos disponibles

- **Diario** — Detalle por horas o franjas del día  
- **Semanal** — Agregación por días  
- **Mensual** — Visión de tendencia y totales  

Los datos incorporan **variación realista** según perfil del edificio (no filas duplicadas artificiales).

### Cómo hacerlo

1. Ir a **Reportes**.  
2. Elegir período en el desplegable.  
3. Revisar la **vista previa** en pantalla (tablas y totales).  
4. **Exportar Excel** — Hoja de cálculo para análisis financiero.  
5. **Exportar PDF** — Documento con logo SIREN, formato multipágina y tablas completas (paginación corregida para filas largas).

### Por qué funciona así
Gerencia y auditoría exigen **evidencia fuera del sistema**. PDF para presentaciones; Excel para CFO y conciliación con CFE. La vista previa evita descargas a ciegas.

> **Defensa del proyecto:** SIREN cierra el ciclo **operación → análisis → reporte ejecutivo**, algo que muchas demos IoT no incluyen.

---

## 10. MÓDULO: Medidores IoT

### Qué hace
Representa la **capa de campo**: un medidor lógico por zona del edificio activo, con lecturas en vivo y proveedor según tipo de área.

### Información mostrada

- **Resumen** — Totales de medidores, en línea, sin lectura.  
- **Formas de conexión** — Protocolos soportados (demo):  
  - **OpenMeter API** — Integración cloud de medición.  
  - **Modbus TCP** — Industrial, PLCs y medidores de planta.  
  - **MQTT** — Sensores y gateways IoT modernos.  
- **Lista por zona** — ID, piso, kW, V, FP, proveedor; **buscador** por nombre o ID.

### Cómo usarlo

1. Confirmar edificio correcto en barra superior.  
2. Revisar resumen de conectividad.  
3. Filtrar con el campo de búsqueda si hay muchas zonas.  
4. Cruzar lecturas con **Áreas y control** (deben coincidir en kW).

### Por qué funciona así
Demuestra **escalabilidad industrial**: SIREN no está cerrado a un fabricante. La asignación de protocolo por tipo de zona (habitación vs servicios vs oficina) refleja cómo se despliega en proyectos reales.

---

## 11. Sincronización, tiempo real y coherencia de datos

### WebSocket (`realtime`)
El servidor emite paquetes con lecturas por área. El panel actualiza KPIs, gráficas y filas de áreas **sin recargar la página**.

### Sincronización entre vistas (`connected views`)
Al cambiar edificio, guardar configuración o recibir eventos relevantes, **todas las pestañas** recargan su contexto en paralelo. El usuario nunca ve el experto de un hotel y las alertas de otro edificio.

### Eventos adicionales
- `expert` — Actualiza predicciones en vivo.  
- `measurement-session` — Reinicia contexto de gráficas al cambiar sesión.  
- Alertas — Refresco de lista y badge.

**Por qué es ventaja competitiva:** La percepción de «sistema único» depende de esta coherencia; SIREN la implementa de forma explícita.

---

## 12. Contexto México: CFE, DAC y zonas climáticas

SIREN incorpora lógica orientada al mercado eléctrico mexicano:

- **Zonas climáticas 1, 1A–1F** en configuración del edificio.  
- Estimación de **subsidio estacional** y consumo mensual proyectado.  
- **Alertas** cuando el consumo se acerca o supera el umbral **DAC** (Doméstico de Alto Consumo adaptado a contexto comercial en la demo).  
- KPIs con escalón tarifario y tarifa efectiva vs DAC en reportes y panel.

Esto posiciona el producto como **listo para despliegue nacional**, no como un clon genérico importado.

---

## 13. Alineación con sostenibilidad (ODS)

| ODS | Título | Rol de SIREN |
|-----|--------|--------------|
| **7** | Energía asequible y no contaminante | Medición, pronóstico y ahorro sin sacrificar servicio |
| **11** | Ciudades sostenibles | Gestión de edificios complejos y desbalance entre zonas |
| **12** | Consumo responsable | Recomendaciones cuantificadas y reducción de desperdicio |

Visible en el módulo **Sistema experto** con contenido desplegable e imágenes oficiales ONU — ideal para memorias técnicas, concursos y clientes con agenda ESG.

---

## 14. Público objetivo y casos de éxito narrados

| Sector | Uso principal de SIREN |
|--------|------------------------|
| **Hotelería** | Habitaciones, alberca, cocina, lavandería; picos check-in/out |
| **Salud** | Áreas críticas 24/7, equipos médicos, esterilización |
| **Educación** | Aulas, laboratorios, deportes; vacíos en vacaciones |
| **Corporativo** | Pisos de oficinas, data center, cafetería |
| **Uso mixto** | Retail + oficinas + estacionamiento en un solo campus |

---

## 15. Requisitos técnicos y despliegue

| Requisito | Detalle |
|-----------|---------|
| **Servidor** | Node.js 18+ |
| **Instalación** | `npm install` |
| **Ejecución** | `npm run dev` → http://localhost:3000 |
| **Cliente** | Navegador moderno; conexión para fotos Unsplash (opcional) |
| **API REST** | `/api/monitoring`, `/api/control`, `/api/expert`, `/api/reports`, `/api/meters`, etc. |

---

## 16. Conclusión: por qué SIREN es la mejor propuesta en su clase

1. **Integral** — Configuración, operación, inteligencia, alertas, reportes e IoT en una sola interfaz.  
2. **Inteligente** — Motor experto con predicción, no solo históricos.  
3. **Accionable** — Control por zona, automatización y enlaces desde alertas.  
4. **Local** — CFE, DAC, MXN, zonas climáticas.  
5. **Profesional** — UI pulida, exportables, ayudas contextuales, tiempo real.  
6. **Escalable** — Multi-edificio, multi-tipo, multi-protocolo IoT.  
7. **Defendible** — ODS, narrativa de ahorro y demostración en vivo sin fricción de login.

SIREN no compite como «otro dashboard de energía»: compite como **plataforma de decisión energética** para infraestructuras que no pueden permitirse apagar a ciegas ni pagar de más en la factura del mes próximo.

---

*Documento generado para el proyecto SIREN — Hackatec. Para actualizaciones de funcionalidad, consultar el código fuente en `public/`, `src/services/` y `README.md`.*
