# lee el HC-SR04 y avisa cuando algo corta el haz
import time

from gpiozero import DistanceSensor

from comun.latido import latir
from comun.mqtt import conectar, publicar

# margen chico porque el marco de la puerta queda cerca del umbral
HISTERESIS_CM = 5
config = {"umbralCm": 60, "sensores": {"us": True}}


def al_config(tema, nueva):
    config.update(nueva)


def avisar(estado):
    publicar(cliente, "aforo/eventos/us", {"sensor": "us", "estado": estado, "t": int(time.time() * 1000)})


cliente = conectar("adq-us", ["aforo/config"], al_config)
# promedio corto para que responda rapido
us = DistanceSensor(echo=24, trigger=23, max_distance=2, queue_len=2, partial=True)
cortado = False
ultimo_latido = 0
print("adq-us listo", flush=True)

while True:
    if config.get("sensores", {}).get("us", True):
        cm = us.distance * 100
        umbral = config["umbralCm"]
        # con histeresis no parpadea cuando la distancia queda justo en el borde
        if not cortado and cm < umbral:
            cortado = True
            avisar("corte")
        elif cortado and cm > umbral + HISTERESIS_CM:
            cortado = False
            avisar("libre")
    if time.time() - ultimo_latido > 5:
        latir()
        ultimo_latido = time.time()
    time.sleep(1 / 15)
