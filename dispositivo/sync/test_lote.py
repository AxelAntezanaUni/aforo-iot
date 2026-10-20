from lote import armar_lote, tiene_datos


def items_de_prueba():
    return [
        (1, "cruce", {"t": 1, "dir": "entra", "aforo": 1}),
        (2, "estado", {"t": 1, "aforo": 1, "entradasHoy": 1, "salidasHoy": 0}),
        (3, "cruce", {"t": 2, "dir": "entra", "aforo": 2}),
        (4, "estado", {"t": 2, "aforo": 2, "entradasHoy": 2, "salidasHoy": 0}),
        (5, "minuto", {"minuto": "202610211000", "t": 0, "entradas": 2, "salidas": 0, "aforoFin": 2, "aforoMax": 2}),
        (6, "alerta", {"t": 2, "tipo": "capacidad", "aforo": 2, "capacidad": 1}),
    ]


def test_modo_evento_envia_cruces_y_ultimo_estado():
    cuerpo, borrar = armar_lote(items_de_prueba(), "evento", False)
    assert [c["t"] for c in cuerpo["cruces"]] == [1, 2]
    assert cuerpo["minutos"] == []
    assert cuerpo["estado"]["aforo"] == 2
    assert len(cuerpo["alertas"]) == 1
    assert sorted(borrar) == [1, 2, 3, 4, 5, 6]


def test_modo_minuto_envia_minutos_y_estado():
    cuerpo, borrar = armar_lote(items_de_prueba(), "minuto", True)
    assert cuerpo["latido"] is True
    assert cuerpo["cruces"] == []
    assert len(cuerpo["minutos"]) == 1
    assert cuerpo["estado"]["aforo"] == 2
    assert sorted(borrar) == [1, 2, 3, 4, 5, 6]


def test_modo_minuto_sin_minuto_deja_esperando_el_ultimo_estado():
    items = [it for it in items_de_prueba() if it[1] in ("cruce", "estado")]
    cuerpo, borrar = armar_lote(items, "minuto", False)
    assert cuerpo["estado"] is None
    assert sorted(borrar) == [1, 2, 3]
    assert not tiene_datos(cuerpo)


def test_lote_vacio():
    cuerpo, borrar = armar_lote([], "evento", True)
    assert cuerpo == {"latido": True, "cruces": [], "minutos": [], "estado": None, "alertas": []}
    assert borrar == []
    assert not tiene_datos(cuerpo)


def test_modo_minuto_el_estado_de_medianoche_viaja_con_el_latido():
    # a medianoche conteo publica el estado en cero sin ningun cruce ni minuto
    items = [(1, "estado", {"t": 1, "aforo": 0, "entradasHoy": 0, "salidasHoy": 0})]
    cuerpo, borrar = armar_lote(items, "minuto", True)
    assert cuerpo["estado"]["aforo"] == 0
    assert borrar == [1]
    # sin latido sigue esperando, asi no se gasta un envio extra
    cuerpo, borrar = armar_lote(items, "minuto", False)
    assert cuerpo["estado"] is None
    assert borrar == []


def test_modo_minuto_con_cruces_el_estado_espera_su_minuto():
    # si hay cruces esperando, el estado va con el minuto y no con el latido
    items = [it for it in items_de_prueba() if it[1] in ("cruce", "estado")]
    cuerpo, _ = armar_lote(items, "minuto", True)
    assert cuerpo["estado"] is None


def test_maximo_20_alertas_por_lote():
    items = [(i, "alerta", {"t": i, "tipo": "capacidad", "aforo": 11, "capacidad": 10}) for i in range(1, 26)]
    cuerpo, borrar = armar_lote(items, "evento", False)
    assert len(cuerpo["alertas"]) == 20
    assert borrar == list(range(1, 21))
