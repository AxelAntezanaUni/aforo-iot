# guarda lo que llega por mqtt en la cola y lo envia a la api por https
import os
import time

import requests

from cola import Cola
from comun.latido import latir
from comun.mqtt import conectar, publicar
from lote import armar_lote, tiene_datos

API_URL = os.environ["API_URL"].rstrip("/") + "/api/ingesta"
TOKEN = os.environ["DEVICE_TOKEN"]
TIPOS = {"aforo/cruce": "cruce", "aforo/minuto": "minuto", "aforo/estado": "estado", "aforo/alerta": "alerta"}

cola = Cola("/datos/cola.db")
config = {"modoEnvio": "evento", "envioSeg": 15, "latidoSeg": 60}
ultima_config = None
token_ok = True


def al_mensaje(tema, datos):
    cola.agregar(TIPOS[tema], datos)


cliente = conectar("sync", list(TIPOS), al_mensaje)


def enviar(latido):
    global ultima_config, token_ok
    items = cola.tomar(400)
    cuerpo, borrar = armar_lote(items, config["modoEnvio"], latido)
    if not latido and not tiene_datos(cuerpo):
        return True
    r = requests.post(API_URL, json=cuerpo, headers={"Authorization": "Bearer " + TOKEN}, timeout=15)
    if r.status_code == 200:
        token_ok = True
        cola.borrar(borrar)
        nueva = r.json().get("config")
        if nueva and nueva != ultima_config:
            ultima_config = nueva
            config.update(nueva)
            # retenida para que los servicios que se reinician la reciban altiro
            publicar(cliente, "aforo/config", nueva, retener=True)
            print("config nueva:", nueva, flush=True)
        return True
    if r.status_code == 400:
        # el lote no paso la validacion, lo descarto para no trabar la cola
        print("lote rechazado:", r.text, flush=True)
        cola.borrar([i for i, _, _ in items])
        return True
    if r.status_code == 401:
        token_ok = False
        print("token rechazado, revisa DEVICE_TOKEN", flush=True)
    else:
        print("error de la api:", r.status_code, flush=True)
    return False


ultimo_envio = 0
ultimo_latido = 0
fallos = 0
espera_hasta = 0
print("sync listo, enviando a", API_URL, flush=True)

while True:
    ahora = time.time()
    if ahora >= espera_hasta:
        toca_latido = ahora - ultimo_latido >= config["latidoSeg"]
        toca_envio = ahora - ultimo_envio >= config["envioSeg"] and cola.cantidad() > 0
        if toca_latido or toca_envio:
            try:
                ok = enviar(toca_latido)
            except requests.RequestException as e:
                print("sin conexion:", e, flush=True)
                ok = False
            if ok:
                fallos = 0
                ultimo_envio = ahora
                if toca_latido:
                    ultimo_latido = ahora
            else:
                fallos += 1
                # espero cada vez mas, hasta 5 minutos
                espera_hasta = ahora + min(300, 5 * 2 ** fallos)
    # con el token rechazado dejo de latir y el healthcheck lo marca
    if token_ok:
        latir()
    time.sleep(1)
