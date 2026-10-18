# logica del conteo: recibe eventos de los sensores y devuelve lo que hay que publicar
from datetime import datetime
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Santiago")


def minuto_de(t):
    return datetime.fromtimestamp(t / 1000, ZONA).strftime("%Y%m%d%H%M")


def dia_de(t):
    return datetime.fromtimestamp(t / 1000, ZONA).strftime("%Y%m%d")


def inicio_minuto(clave):
    return int(datetime.strptime(clave, "%Y%m%d%H%M").replace(tzinfo=ZONA).timestamp() * 1000)


class Contador:
    def __init__(self, capacidad=10, ventana_ms=1500):
        self.capacidad = capacidad
        self.ventana_ms = ventana_ms
        self.aforo = 0
        self.entradas_hoy = 0
        self.salidas_hoy = 0
        self.cortados = {"ir": False, "us": False}
        self.primero = None
        self.esperando_libres = False
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
        # al reiniciar recupero lo que habia, los contadores solo si es el mismo dia
        self.aforo = estado["aforo"]
        self.min_max = self.aforo
        self.dia = dia_de(ahora)
        if dia_de(estado["t"]) == self.dia:
            self.entradas_hoy = estado["entradasHoy"]
            self.salidas_hoy = estado["salidasHoy"]

    def tick(self, t):
        return self._avanzar(t)

    def evento(self, sensor, estado, t):
        salida = self._avanzar(t)
        self.cortados[sensor] = estado == "corte"
        if self.esperando_libres:
            # despues de contar espero que la persona termine de pasar
            if not any(self.cortados.values()):
                self.esperando_libres = False
            return salida
        if estado != "corte":
            return salida
        if self.primero is None:
            self.primero = (sensor, t)
            return salida
        sensor_inicial = self.primero[0]
        if sensor == sensor_inicial:
            return salida
        self.primero = None
        # si el ir se corto primero la persona venia de afuera
        direccion = "entra" if sensor_inicial == "ir" else "sale"
        salida += self._contar(direccion, t)
        self.esperando_libres = True
        return salida

    def _contar(self, direccion, t):
        if direccion == "entra":
            self.aforo += 1
            self.entradas_hoy += 1
            self.min_entradas += 1
        else:
            self.aforo = max(0, self.aforo - 1)
            self.salidas_hoy += 1
            self.min_salidas += 1
        self.min_max = max(self.min_max, self.aforo)
        salida = [{"tema": "cruce", "t": t, "dir": direccion, "aforo": self.aforo}, self._estado(t)]
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
        if self.primero is not None and t - self.primero[1] > self.ventana_ms:
            self.primero = None
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
            self.dia = dia
            self.entradas_hoy = 0
            self.salidas_hoy = 0
            salida.append(self._estado(ahora))
        return salida
