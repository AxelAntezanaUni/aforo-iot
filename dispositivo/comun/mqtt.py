# conexion al broker que usan todos los servicios
import json
import os
import time

import paho.mqtt.client as mqtt

BROKER = os.environ.get("MQTT_HOST", "mosquitto")


def _cliente(nombre):
    # paho 2 pide la version de los callbacks, paho 1.6 no la conoce
    try:
        return mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=nombre)
    except AttributeError:
        return mqtt.Client(client_id=nombre)


def conectar(nombre, temas=(), al_mensaje=None):
    cliente = _cliente(nombre)

    def on_connect(c, userdata, flags, rc):
        # me vuelvo a suscribir cada vez que se reconecta
        for tema in temas:
            c.subscribe(tema, qos=1)

    def on_message(c, userdata, msg):
        if al_mensaje is None:
            return
        try:
            datos = json.loads(msg.payload)
        except ValueError:
            print("mensaje no es json en", msg.topic, flush=True)
            return
        al_mensaje(msg.topic, datos)

    cliente.on_connect = on_connect
    cliente.on_message = on_message
    while True:
        try:
            cliente.connect(BROKER, 1883, keepalive=30)
            break
        except OSError:
            print("broker no disponible, reintento en 3 s", flush=True)
            time.sleep(3)
    cliente.loop_start()
    return cliente


def publicar(cliente, tema, datos, retener=False):
    cliente.publish(tema, json.dumps(datos), qos=1, retain=retener)
