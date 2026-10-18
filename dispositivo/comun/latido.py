# el healthcheck de docker revisa que este archivo sea reciente
import pathlib

ARCHIVO = pathlib.Path("/tmp/vivo")


def latir():
    ARCHIVO.touch()
