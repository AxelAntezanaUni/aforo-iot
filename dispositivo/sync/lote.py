# arma el cuerpo que va a la api segun el modo de envio


# la api acepta hasta 20 alertas por lote; las demas quedan para el siguiente
MAX_ALERTAS = 20


def armar_lote(items, modo, latido):
    cuerpo = {"latido": latido, "cruces": [], "minutos": [], "estado": None, "alertas": []}
    borrar = []
    estados = []
    hay_cruces = False
    for id_, tipo, datos in items:
        if tipo == "alerta":
            if len(cuerpo["alertas"]) < MAX_ALERTAS:
                cuerpo["alertas"].append(datos)
                borrar.append(id_)
        elif tipo == "cruce":
            hay_cruces = True
            if modo == "evento":
                cuerpo["cruces"].append(datos)
            borrar.append(id_)
        elif tipo == "minuto":
            if modo == "minuto":
                cuerpo["minutos"].append(datos)
            borrar.append(id_)
        elif tipo == "estado":
            estados.append((id_, datos))
    if estados:
        # del estado solo importa el ultimo
        ultimo_id, ultimo = estados[-1]
        borrar += [i for i, _ in estados[:-1]]
        # en modo minuto el estado viaja junto con un minuto; si no hay cruces esperando
        # (por ejemplo el estado en cero de medianoche) viaja con el latido
        if modo == "evento" or cuerpo["minutos"] or (latido and not hay_cruces):
            cuerpo["estado"] = ultimo
            borrar.append(ultimo_id)
    return cuerpo, borrar


def tiene_datos(cuerpo):
    return bool(cuerpo["cruces"] or cuerpo["minutos"] or cuerpo["alertas"] or cuerpo["estado"])
