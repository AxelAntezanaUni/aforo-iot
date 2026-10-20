# logica del conteo: recibe eventos de los sensores y devuelve lo que hay que publicar
from datetime import datetime
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Santiago")
# tiempo con los dos sensores libres para dar por terminado un paso
QUIETO_MS = 300


def minuto_de(t):
    return datetime.fromtimestamp(t / 1000, ZONA).strftime("%Y%m%d%H%M")


def dia_de(t):
    return datetime.fromtimestamp(t / 1000, ZONA).strftime("%Y%m%d")


def inicio_minuto(clave):
    return int(datetime.strptime(clave, "%Y%m%d%H%M").replace(tzinfo=ZONA).timestamp() * 1000)


class Contador:
    def __init__(self, capacidad=10, ventana_ms=1500, retardo_us_ms=165):
        self.capacidad = capacidad
        self.ventana_ms = ventana_ms
        # el ultrasonido avisa mas tarde que el ir; con los sensores juntos las salidas se veian
        # como entradas, asi que para decidir quien se corto primero le resto ese retraso.
        # 165 ms sale de 40 pasadas reales del 20-10: en las entradas el ultrasonido llego
        # entre 172 y 537 ms despues del ir, y en las salidas entre 35 y 164 ms
        self.retardo_us_ms = retardo_us_ms
        self.aforo = 0
        self.entradas_hoy = 0
        self.salidas_hoy = 0
        self.cortados = {"ir": False, "us": False}
        self.en_paso = False
        self.vistos = {}
        # hora real del primer corte de cada sensor, sin restar el retraso
        self.crudos = {}
        self.ultimo_cambio = 0
        self.sobre_capacidad = False
        self.ultimo_t = 0
        self.dia = None
        self.minuto = None
        self.min_entradas = 0
        self.min_salidas = 0
        self.min_max = 0

    def configurar(self, capacidad=None, ventana_ms=None):
        if capacidad is not None:
            self.capacidad = capacidad
        if ventana_ms is not None:
            self.ventana_ms = ventana_ms

    def restaurar(self, estado, ahora):
        # al reiniciar recupero lo que habia, pero solo si es el mismo dia
        self.dia = dia_de(ahora)
        if dia_de(estado["t"]) == self.dia:
            self.aforo = estado["aforo"]
            self.entradas_hoy = estado["entradasHoy"]
            self.salidas_hoy = estado["salidasHoy"]
        self.min_max = self.aforo

    def tick(self, t):
        return self._avanzar(t)

    def evento(self, sensor, estado, t):
        salida = self._avanzar(t)
        self.cortados[sensor] = estado == "corte"
        if estado == "corte":
            if not self.en_paso:
                self.en_paso = True
                self.vistos = {}
                self.crudos = {}
            if sensor not in self.vistos:
                t_real = t - self.retardo_us_ms if sensor == "us" else t
                # si el otro sensor se corto hace mucho, no era la misma persona
                if self.vistos and t_real - min(self.vistos.values()) > self.ventana_ms:
                    self.vistos = {}
                    self.crudos = {}
                self.vistos[sensor] = t_real
                self.crudos[sensor] = t
        self.ultimo_cambio = t
        return salida

    def _cerrar_paso(self):
        self.en_paso = False
        # si se corto un solo sensor alguien se asomo y se devolvio
        if len(self.vistos) < 2:
            return []
        # la direccion la da el sensor que se corto primero: el ir esta afuera y el
        # ultrasonido adentro. los parpadeos que vienen despues no cambian nada
        primero = min(self.vistos, key=self.vistos.get)
        direccion = "entra" if primero == "ir" else "sale"
        # cuanto despues del ir se corto el ultrasonido: queda en firestore como dato de los dos sensores
        # y sirve para revisar el retraso con las pasadas reales
        dt = self.crudos["us"] - self.crudos["ir"]
        return self._contar(direccion, self.ultimo_cambio, dt)

    def _contar(self, direccion, t, dt=None):
        if direccion == "entra":
            self.aforo += 1
            self.entradas_hoy += 1
            self.min_entradas += 1
        else:
            self.aforo = max(0, self.aforo - 1)
            self.salidas_hoy += 1
            self.min_salidas += 1
        self.min_max = max(self.min_max, self.aforo)
        cruce = {"tema": "cruce", "t": t, "dir": direccion, "aforo": self.aforo}
        if dt is not None:
            cruce["dtMs"] = dt
        salida = [cruce, self._estado(t)]
        if self.aforo > self.capacidad:
            if not self.sobre_capacidad:
                self.sobre_capacidad = True
                salida.append({"tema": "alerta", "t": t, "tipo": "capacidad", "aforo": self.aforo, "capacidad": self.capacidad})
        else:
            self.sobre_capacidad = False
        return salida

    def _estado(self, t):
        return {"tema": "estado", "t": t, "aforo": self.aforo, "entradasHoy": self.entradas_hoy, "salidasHoy": self.salidas_hoy}

    def _avanzar(self, t):
        salida = []
        # el paso se cierra cuando los dos sensores llevan un rato libres
        if self.en_paso and not any(self.cortados.values()) and t - self.ultimo_cambio >= QUIETO_MS:
            salida += self._cerrar_paso()
        # si llega un evento atrasado no retrocedo el reloj
        ahora = max(t, self.ultimo_t)
        self.ultimo_t = ahora
        minuto = minuto_de(ahora)
        if self.minuto is None:
            self.minuto = minuto
        elif minuto != self.minuto:
            if self.min_entradas or self.min_salidas:
                salida.append({
                    "tema": "minuto",
                    "minuto": self.minuto,
                    "t": inicio_minuto(self.minuto),
                    "entradas": self.min_entradas,
                    "salidas": self.min_salidas,
                    "aforoFin": self.aforo,
                    "aforoMax": self.min_max,
                })
            self.minuto = minuto
            self.min_entradas = 0
            self.min_salidas = 0
            self.min_max = self.aforo
        dia = dia_de(ahora)
        if self.dia is None:
            self.dia = dia
        elif dia != self.dia:
            # a medianoche parto de cero, asi un error de direccion no se arrastra al dia siguiente
            self.dia = dia
            self.aforo = 0
            self.entradas_hoy = 0
            self.salidas_hoy = 0
            self.sobre_capacidad = False
            salida.append(self._estado(ahora))
        return salida
