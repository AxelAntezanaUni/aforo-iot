# lee el IR-08H y publica cada corte y liberacion con su hora
import time

from gpiozero import Button

from comun.latido import latir
from comun.mqtt import conectar, publicar

PIN = 17
activo = True


def al_config(tema, config):
    global activo
    activo = config.get("sensores", {}).get("ir", True)


cliente = conectar("adq-ir", ["aforo/config"], al_config)


def avisar(estado):
    if activo:
        publicar(cliente, "aforo/eventos/ir", {"sensor": "ir", "estado": estado, "t": int(time.time() * 1000)})


# el modulo baja la salida a 0 cuando detecta algo, por eso lo leo como un boton
ir = Button(PIN)
ir.when_pressed = lambda: avisar("corte")
ir.when_released = lambda: avisar("libre")
print("adq-ir listo", flush=True)

while True:
    latir()
    time.sleep(5)
