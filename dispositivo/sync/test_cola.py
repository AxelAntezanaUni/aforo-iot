from cola import Cola


def test_agregar_tomar_y_borrar(tmp_path):
    cola = Cola(str(tmp_path / "cola.db"))
    cola.agregar("cruce", {"t": 1})
    cola.agregar("estado", {"t": 2})
    items = cola.tomar(10)
    assert [(tipo, datos) for _, tipo, datos in items] == [("cruce", {"t": 1}), ("estado", {"t": 2})]
    cola.borrar([items[0][0]])
    assert cola.cantidad() == 1


def test_sobrevive_a_un_reinicio(tmp_path):
    ruta = str(tmp_path / "cola.db")
    Cola(ruta).agregar("minuto", {"t": 5})
    assert Cola(ruta).tomar(10)[0][2] == {"t": 5}


def test_tomar_respeta_el_limite_y_el_orden(tmp_path):
    cola = Cola(str(tmp_path / "cola.db"))
    for i in range(5):
        cola.agregar("cruce", {"t": i})
    assert [d["t"] for _, _, d in cola.tomar(3)] == [0, 1, 2]


def test_borrar_lista_vacia_no_falla(tmp_path):
    cola = Cola(str(tmp_path / "cola.db"))
    cola.borrar([])
    assert cola.cantidad() == 0
