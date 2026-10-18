from datetime import datetime

from logica import ZONA, Contador


def ms(h, m, s=0, dia=21):
    return int(datetime(2026, 10, dia, h, m, s, tzinfo=ZONA).timestamp() * 1000)


def pasar(c, primero, segundo, t, dt=300):
    # simula una persona: corta un sensor, despues el otro, y libera los dos
    r = []
    r += c.evento(primero, "corte", t)
    r += c.evento(segundo, "corte", t + dt)
    r += c.evento(primero, "libre", t + dt + 100)
    r += c.evento(segundo, "libre", t + dt + 300)
    return r


def de(resultados, tema):
    return [r for r in resultados if r["tema"] == tema]


def test_entrada():
    c = Contador()
    r = pasar(c, "ir", "us", ms(10, 0, 10))
    cruces = de(r, "cruce")
    assert len(cruces) == 1
    assert cruces[0]["dir"] == "entra"
    assert c.aforo == 1
    assert c.entradas_hoy == 1


def test_salida():
    c = Contador()
    c.aforo = 3
    r = pasar(c, "us", "ir", ms(10, 0, 10))
    assert de(r, "cruce")[0]["dir"] == "sale"
    assert c.aforo == 2
    assert c.salidas_hoy == 1


def test_se_devuelve_no_cuenta():
    c = Contador(ventana_ms=1500)
    t = ms(10, 0, 10)
    r = c.evento("ir", "corte", t)
    r += c.evento("ir", "libre", t + 400)
    r += c.evento("us", "corte", t + 2000)
    r += c.evento("us", "libre", t + 2300)
    assert de(r, "cruce") == []
    assert c.aforo == 0


def test_dos_personas_seguidas():
    c = Contador()
    t = ms(10, 0, 10)
    r = pasar(c, "ir", "us", t) + pasar(c, "ir", "us", t + 1500)
    assert len(de(r, "cruce")) == 2
    assert c.aforo == 2


def test_rebote_del_mismo_sensor_no_cuenta_doble():
    c = Contador()
    t = ms(10, 0, 10)
    r = c.evento("ir", "corte", t)
    r += c.evento("ir", "libre", t + 30)
    r += c.evento("ir", "corte", t + 60)
    r += c.evento("us", "corte", t + 300)
    r += c.evento("ir", "libre", t + 400)
    r += c.evento("us", "libre", t + 600)
    assert len(de(r, "cruce")) == 1


def test_aforo_no_baja_de_cero():
    c = Contador()
    pasar(c, "us", "ir", ms(10, 0, 10))
    assert c.aforo == 0
    assert c.salidas_hoy == 1


def test_cada_cruce_publica_estado():
    c = Contador()
    r = pasar(c, "ir", "us", ms(10, 0, 10))
    estado = de(r, "estado")[-1]
    assert estado["aforo"] == 1
    assert estado["entradasHoy"] == 1
    assert estado["salidasHoy"] == 0


def test_minuto_se_cierra_solo_con_movimiento():
    c = Contador()
    pasar(c, "ir", "us", ms(10, 0, 10))
    pasar(c, "ir", "us", ms(10, 0, 40))
    minutos = de(c.tick(ms(10, 1, 5)), "minuto")
    assert len(minutos) == 1
    m = minutos[0]
    assert m["minuto"] == "202610211000"
    assert m["t"] == ms(10, 0)
    assert (m["entradas"], m["salidas"], m["aforoFin"], m["aforoMax"]) == (2, 0, 2, 2)
    # el minuto 10:01 no tuvo movimiento, no se publica
    assert de(c.tick(ms(10, 2, 5)), "minuto") == []


def test_reinicio_a_medianoche():
    c = Contador()
    pasar(c, "ir", "us", ms(23, 59, 30, dia=21))
    r = c.tick(ms(0, 0, 10, dia=22))
    assert c.entradas_hoy == 0
    assert c.aforo == 1
    assert de(r, "estado")[-1]["entradasHoy"] == 0


def test_alerta_solo_al_superar_capacidad():
    c = Contador(capacidad=2)
    t = ms(10, 0, 10)
    r = []
    for i in range(4):
        r += pasar(c, "ir", "us", t + i * 2000)
    alertas = de(r, "alerta")
    assert len(alertas) == 1
    assert (alertas[0]["tipo"], alertas[0]["aforo"], alertas[0]["capacidad"]) == ("capacidad", 3, 2)
    # bajo a 2 y vuelvo a 3: avisa de nuevo
    r = pasar(c, "us", "ir", t + 10000) + pasar(c, "us", "ir", t + 12000)
    r += pasar(c, "ir", "us", t + 14000)
    assert len(de(r, "alerta")) == 1


def test_configurar_cambia_ventana_y_capacidad():
    c = Contador()
    c.configurar(capacidad=1, ventana_ms=200)
    t = ms(10, 0, 10)
    assert de(pasar(c, "ir", "us", t, dt=500), "cruce") == []
    r = pasar(c, "ir", "us", t + 2000, dt=100) + pasar(c, "ir", "us", t + 4000, dt=100)
    assert len(de(r, "cruce")) == 2
    assert len(de(r, "alerta")) == 1


def test_restaurar_mismo_dia():
    c = Contador()
    c.restaurar({"t": ms(9, 0), "aforo": 4, "entradasHoy": 10, "salidasHoy": 6}, ms(10, 0))
    assert (c.aforo, c.entradas_hoy, c.salidas_hoy) == (4, 10, 6)


def test_restaurar_otro_dia_solo_aforo():
    c = Contador()
    c.restaurar({"t": ms(22, 0, dia=20), "aforo": 4, "entradasHoy": 10, "salidasHoy": 6}, ms(10, 0))
    assert (c.aforo, c.entradas_hoy, c.salidas_hoy) == (4, 0, 0)
