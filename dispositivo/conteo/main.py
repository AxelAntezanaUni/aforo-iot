# une los eventos de mqtt con el contador y publica cruces, minutos, estado y alertas
import threading
import time

from comun.latido import latir
from comun.mqtt import conectar, publicar
from logica import Contador

TEMAS = {"cruce": "aforo/cruce", "minuto": "aforo/minuto", "estado": "aforo/estado", "alerta": "aforo/alerta"}

contador = Contador()
candado = threading.Lock()
restaurado = False


def ahora_ms():
    return int(time.time() * 1000)


def emitir(resultados):
    for r in resultados:
        tema = r.pop("tema")
        # el estado queda retenido para recuperarlo si este servicio se reinicia
        publicar(cliente, TEMAS[tema], r, retener=(tema == "estado"))


def al_mensaje(tema, datos):
    global restaurado
    resultados = []
    with candado:
        if tema == "aforo/config":
            contador.configurar(datos.get("capacidad"), datos.get("ventanaMs"))
        elif tema == "aforo/estado":
            # solo me sirve el primero, que es el retenido de antes del reinicio
            if not restaurado:
                contador.restaurar(datos, ahora_ms())
                restaurado = True
        else:
            resultados = contador.evento(datos["sensor"], datos["estado"], datos["t"])
    emitir(resultados)


cliente = conectar("conteo", ["aforo/eventos/#", "aforo/config", "aforo/estado"], al_mensaje)

# si en 3 s no llego un estado retenido, parto de cero
time.sleep(3)
restaurado = True
print("conteo listo", flush=True)

while True:
    with candado:
        resultados = contador.tick(ahora_ms())
    emitir(resultados)
    latir()
    # reviso seguido para cerrar los pasos apenas los sensores quedan libres
    time.sleep(0.2)
