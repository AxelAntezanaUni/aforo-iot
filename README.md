# Control de aforo IoT

Sistema que cuenta las personas que entran y salen por una puerta con una Raspberry Pi, un sensor infrarrojo y uno ultrasónico, y muestra el aforo en tiempo real en una plataforma web.

Infraestructura TI · Prof. Luis Delgado Ayala · Axel Antezana

- Plataforma: https://aforo-iot.vercel.app
- `dispositivo/`: microservicios que corren en la Raspberry Pi con Docker Compose.
- `web/`: plataforma web y API en Next.js, desplegada en Vercel.

## Cómo funciona

```
Raspberry Pi (Docker Compose)  --HTTPS + token-->  API en Vercel  -->  Cloud Firestore
                               <--configuracion--                          |
Navegador  --historico y gestion-->  API                                    |
Navegador  <------------- aforo en vivo (onSnapshot) -----------------------+
```

Los dos sensores van en el marco de la puerta, uno después del otro en la dirección de paso: el infrarrojo hacia afuera y el ultrasónico hacia adentro. Si se corta primero el infrarrojo y después el ultrasónico, la persona entró; al revés, salió. Lo ideal es separarlos 30-40 cm; en el montaje de prueba quedaron a 5-6 cm por el largo de los cables, y con esa distancia algunas salidas se cuentan como entradas (por eso el aforo vuelve a cero a medianoche).

La Raspberry solo abre conexiones salientes por HTTPS y nunca tiene credenciales de administrador de Firebase. Se identifica ante la API con un token propio que se puede revocar desde la web.

## Hardware

| Sensor | Pin del sensor | Raspberry Pi (pin físico) |
|---|---|---|
| HC-SR04 (ultrasonido) | Vcc / Trig / Gnd | pin 2 (5 V) / pin 16 (GPIO23) / pin 6 (GND) |
| | Echo | divisor de voltaje 1 kΩ y 2 kΩ → pin 18 (GPIO24), tierra del divisor en el pin 14 |
| IR-08H (infrarrojo) | VCC / OUT / GND | pin 1 (3,3 V) / pin 11 (GPIO17) / pin 9 (GND) |

El Echo del HC-SR04 entrega 5 V y los pines GPIO trabajan a 3,3 V, por eso pasa por el divisor (5 × 2/3 ≈ 3,3 V). Se usó una Raspberry Pi 4 Model B con Raspberry Pi OS de 64 bits.

## Microservicios (Raspberry Pi)

| Contenedor | Qué hace | Publica | Escucha |
|---|---|---|---|
| `mosquitto` | Broker MQTT, solo en la red interna de Docker | | |
| `adq-ir` | Lee el infrarrojo y publica cada corte y liberación con su hora | `aforo/eventos/ir` | `aforo/config` |
| `adq-us` | Lee el ultrasonido cada 20 ms y avisa cuando algo baja del umbral (con 5 cm de histéresis) | `aforo/eventos/us` | `aforo/config` |
| `conteo` | Cruza los eventos, decide entrada o salida, lleva el aforo, agrega por minuto y detecta la capacidad superada | `aforo/cruce`, `aforo/minuto`, `aforo/estado`, `aforo/alerta` | `aforo/eventos/#`, `aforo/config` |
| `sync` | Guarda todo en una cola SQLite, lo envía por lotes a la API y trae la configuración | `aforo/config` | los cuatro de `conteo` |

Todos tienen reinicio automático y healthcheck, y el sistema parte solo al encender la Raspberry. Si se corta internet, `sync` guarda lo pendiente y lo reenvía al volver, sin duplicados (cada documento tiene un id que sale de su hora).

**Cómo decide `conteo` la dirección.** Un paso empieza con el primer corte y termina cuando los dos sensores llevan 300 ms libres; manda el sensor que se cortó primero. El ultrasonido avisa más tarde que el infrarrojo, así que antes de comparar se le resta un retraso (`RETARDO_US_MS` en `docker-compose.yml`, 165 ms por defecto, calibrado con pasadas reales). Se puede cambiar sin reconstruir la imagen: editar el valor y correr `docker compose up -d conteo`. Si se desactiva un sensor desde la web, el conteo se detiene, porque un paso necesita los dos (sirve para mantención).

## Modelo de datos (Firestore)

```
orgs/{orgId}                                   nombre
orgs/{orgId}/usuarios/{uid}                    email, rol
orgs/{orgId}/dispositivos/{devId}              nombre, config, activo, ultimaConexion
orgs/{orgId}/secretos/{devId}                  tokenHash (no se puede leer desde el navegador)
orgs/{orgId}/estado/{devId}                    aforo, entradasHoy, salidasHoy, actualizado
orgs/{orgId}/dispositivos/{devId}/cruces/{t}   dir, aforo, t, dtMs  (modo evento; dtMs = cuánto después del IR se cortó el ultrasonido)
orgs/{orgId}/dispositivos/{devId}/minutos/{AAAAMMDDHHmm}  entradas, salidas, aforoFin, aforoMax, t  (modo minuto)
orgs/{orgId}/alertas/{devId-t}                 devId, tipo, aforo, capacidad, t
```

Todo cuelga de la organización, así las Security Rules (`web/firestore.rules`) aíslan cada organización con una sola condición. El rol y la organización van como claims en el token del usuario. Desde el navegador no se escribe nada: todas las escrituras pasan por la API.

**Índices.** Todas las consultas filtran u ordenan por un solo campo, así que bastan los índices automáticos de Firestore y no hay índices compuestos (`web/firestore.indexes.json` queda vacío a propósito):

| Consulta | Dónde | Índice que usa |
|---|---|---|
| Últimas 5 alertas de la organización (`orderBy t desc, limit 5`) | dashboard | automático de `alertas.t` |
| Cruces de un rango (`t >= desde, t < hasta`) | histórico | automático de `cruces.t` |
| Minutos de un rango (`t >= desde, t < hasta`) | histórico | automático de `minutos.t` |
| Colecciones `dispositivos`, `estado` y `usuarios` completas | dashboard y gestión | ninguno (se leen enteras) |

## API

Los endpoints del dispositivo usan su token (`Authorization: Bearer <orgId>.<devId>.<secreto>`). Los de la web usan el token de sesión de Firebase (`Authorization: Bearer <ID token>`).

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/ingesta` | dispositivo | Recibe un lote de datos y devuelve la configuración vigente |
| `GET /api/historico?devId=&desde=&hasta=` | cualquier usuario | Entradas y salidas por hora de un rango (máximo 7 días) |
| `POST /api/dispositivos` | admin | Da de alta un dispositivo y devuelve su token una sola vez |
| `POST /api/dispositivos/{devId}/token` | admin | Genera un token nuevo (el anterior deja de servir) |
| `POST /api/dispositivos/{devId}/revocar` | admin | Revoca el dispositivo |
| `PATCH /api/dispositivos/{devId}/config` | admin | Cambia la configuración (solo los campos enviados) |

Ejemplo de ingesta:

```bash
curl -X POST https://aforo-iot.vercel.app/api/ingesta \
  -H "Authorization: Bearer biblioteca.puerta-1.<secreto>" \
  -H "Content-Type: application/json" \
  -d '{"latido":true,"cruces":[{"t":1792364000000,"dir":"entra","aforo":1}],"minutos":[],"estado":{"t":1792364000000,"aforo":1,"entradasHoy":1,"salidasHoy":0},"alertas":[]}'
```

Respuesta: `{"ok":true,"config":{"capacidad":10,"umbralCm":60,"ventanaMs":1500,"modoEnvio":"evento","envioSeg":15,"latidoSeg":60,"sensores":{"ir":true,"us":true}}}`

Ejemplo de histórico:

```bash
curl "https://aforo-iot.vercel.app/api/historico?devId=puerta-1&desde=2026-10-21&hasta=2026-10-21" \
  -H "Authorization: Bearer <ID token>"
```

Respuesta: `{"horas":[{"hora":"2026-10-21 00","entradas":0,"salidas":0},...],"totalEntradas":42,"totalSalidas":40,"horaPunta":"2026-10-21 13"}`

Errores: `401` token o sesión inválida, `403` sin permiso, `404` el dispositivo no existe en tu organización, `400` datos inválidos (incluye datos con una hora de hace más de 7 días o de más de 1 hora en el futuro), `409` id repetido, `429` demasiados pedidos (más de 120 por minuto desde una IP, 30 por minuto por dispositivo o 20 consultas al histórico por minuto por usuario).

## Cuentas de prueba

| Cuenta | Organización | Rol |
|---|---|---|
| admin@biblioteca.test | Biblioteca | admin |
| consulta@biblioteca.test | Biblioteca | consulta |
| admin@laboratorio.test | Laboratorio | admin |

Las contraseñas se entregan aparte.

## Desplegar desde cero

### 1. Firebase (plan Spark, sin tarjeta)

1. Crear un proyecto en https://console.firebase.google.com.
2. Crear la base de datos Firestore (edición Estándar, modo producción).
3. Activar Authentication con correo y contraseña.
4. Generar una clave de cuenta de servicio y guardarla fuera del repo.
5. Registrar una app web y copiar su configuración.

### 2. Web

```bash
cd web
npm install
```

Crear `web/.env.local` (no se sube al repo):

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
SEED_EMAIL_ADMIN=admin@biblioteca.test
SEED_CLAVE_ADMIN=...
SEED_EMAIL_CONSULTA=consulta@biblioteca.test
SEED_CLAVE_CONSULTA=...
SEED_EMAIL_LAB=admin@laboratorio.test
SEED_CLAVE_LAB=...
```

```bash
npm run seed      # organizaciones, cuentas de prueba y el dispositivo puerta-1 (muestra su token una vez)
npm run reglas    # publica firestore.rules
npm run indices   # crea los indices compuestos de firestore.indexes.json (hoy no hay ninguno)
npm test          # pruebas de la api
```

### 3. Vercel (plan Hobby)

Importar el repo desde GitHub con **Root Directory** `web` y cargar las variables `FIREBASE_*` y `NEXT_PUBLIC_FIREBASE_*`. Las `NEXT_PUBLIC_FIREBASE_*` hacen falta también al compilar: sin ellas `npm run build` falla con `auth/invalid-api-key`. Cada push a `main` despliega solo. Las funciones corren en São Paulo (`web/vercel.json`).

### 4. Raspberry Pi

Desde el computador, crear `dispositivo/.env` a partir de `dispositivo/.env.example` con la URL de Vercel y el token del dispositivo, y copiar la carpeta:

```bash
rsync -av dispositivo/ usuario@raspberrypi.local:~/aforo/
```

En la Raspberry:

```bash
cd ~/aforo
bash instalar.sh            # instala docker y lo deja partiendo con la raspberry
exit                        # salir y volver a entrar por ssh
docker compose up -d --build
docker compose ps           # los 5 servicios deben quedar healthy
swapon --show               # revisar que la raspberry tenga swap (lo pide el enunciado)
```

## Pruebas

```bash
cd web && npm test                                 # api: tokens, ingesta, limites, sesion, historico, dispositivos (40)
cd dispositivo/conteo && python3 -m pytest -q      # logica de conteo, con tiempos reales (20)
cd dispositivo/sync && python3 -m pytest -q        # cola y armado de lotes (8)
```

## Seguridad

- Token propio por dispositivo, guardado como hash y revocable.
- Las credenciales de Firebase solo existen como variables de entorno en Vercel.
- Security Rules por organización y rol; el navegador no puede escribir.
- La Raspberry no abre puertos: el broker MQTT solo existe dentro de la red de Docker.
- Sin secretos en el repo: `.env`, `.env.local` y la clave de la cuenta de servicio están en `.gitignore`.
- Límite de pedidos por IP, por dispositivo y por usuario, para que un token robado no agote la cuota diaria de Firestore.
- Encabezados de seguridad en la web: no se puede meter en un iframe de otro sitio (`frame-ancestors 'none'`), `nosniff` y `Referrer-Policy`.
