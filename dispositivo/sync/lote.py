# arma el cuerpo que va a la api segun el modo de envio


def armar_lote(items, modo, latido):
    cuerpo = {"latido": latido, "cruces": [], "minutos": [], "estado": None, "alertas": []}
    borrar = []
    estados = []
    for id_, tipo, datos in items:
        if tipo == "alerta":
            cuerpo["alertas"].append(datos)
            borrar.append(id_)
        elif tipo == "cruce":
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
        # en modo minuto el estado viaja solo junto con un minuto
        if modo == "evento" or cuerpo["minutos"]:
            cuerpo["estado"] = ultimo
            borrar.append(ultimo_id)
    return cuerpo, borrar


def tiene_datos(cuerpo):
    return bool(cuerpo["cruces"] or cuerpo["minutos"] or cuerpo["alertas"] or cuerpo["estado"])
