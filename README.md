# SIREN – Sistema Inteligente de Regulación Energética

Software inteligente con **sistemas expertos** para empresas que administran infraestructuras masivas (hoteles, hospitales, universidades, corporativos). Control centralizado de la energía por habitación o área, monitoreo en tiempo real y reportes exportables.

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Monitoreo** | Flujo eléctrico por habitación, piso o área en tiempo real (WebSocket) |
| **Control** | Encender, apagar o limitar consumo (kW) desde el panel o API |
| **Reportes** | Desglose diario/semanal/mensual · exportación **PDF** y **Excel** |
| **Sistema experto** | Detección de patrones, predicción de picos y recomendaciones de ahorro |
| **Alertas** | Consumo excesivo y fallas eléctricas con notificación inmediata |
| **Medidores IoT** | Capa de integración con OpenMeter, Modbus TCP y MQTT |

## Beneficios

- Reducción de costos por optimización por área  
- Alineación con **ODS 7, 11 y 12** (Agenda 2030)  
- Escalable a cualquier infraestructura masiva  
- **Licencia única** — sin planes gratuitos ni premium  

## Requisitos

- Node.js 18+

## Instalación y uso

```bash
npm install
npm run dev
```

Abre **http://localhost:3000** para el panel de control.

### API principal

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/monitoring/overview` | Resumen del sitio |
| GET | `/api/monitoring/realtime` | Lecturas en vivo |
| POST | `/api/control/:areaId/power` | `{ "powered": true }` |
| POST | `/api/control/:areaId/limit` | `{ "limitKw": 3.5 }` |
| GET | `/api/reports/export/excel?period=daily` | Descarga Excel |
| GET | `/api/reports/export/pdf?period=daily` | Descarga PDF |
| GET | `/api/expert/analysis` | Análisis del sistema experto |
| GET | `/api/alerts` | Lista de alertas |
| GET | `/api/meters` | Medidores conectados |

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `KWH_PRICE_MXN` | `3.2` | Tarifa para costos estimados |
| `ALERT_THRESHOLD_KW` | `4.5` | Umbral de alerta por área |

## Estructura

```
src/
  data/infrastructure.js   # Modelo del edificio demo
  services/                # Lógica de negocio
  routes/api.js            # REST API
  simulation.js            # Simulador de medidores
public/                    # Panel web
```

## Demo

El proyecto incluye un **hotel de 4 pisos** con 27 áreas (habitaciones, lobby, salas, HVAC) y simulación de consumo cada 2 segundos para demostrar tiempo real en el hackathon.

---

*Hackatec · SIREN v1.0*
