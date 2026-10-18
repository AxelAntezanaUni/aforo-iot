# cola en sqlite: lo que no se pudo enviar sigue aqui aunque se corte la luz
import json
import sqlite3
import threading


class Cola:
    def __init__(self, ruta):
        self.db = sqlite3.connect(ruta, check_same_thread=False)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS pendientes (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, datos TEXT NOT NULL)"
        )
        self.db.commit()
        # mqtt escribe desde otro hilo
        self.candado = threading.Lock()

    def agregar(self, tipo, datos):
        with self.candado:
            self.db.execute("INSERT INTO pendientes (tipo, datos) VALUES (?, ?)", (tipo, json.dumps(datos)))
            self.db.commit()

    def tomar(self, limite):
        with self.candado:
            filas = self.db.execute("SELECT id, tipo, datos FROM pendientes ORDER BY id LIMIT ?", (limite,)).fetchall()
        return [(i, tipo, json.loads(datos)) for i, tipo, datos in filas]

    def borrar(self, ids):
        if not ids:
            return
        with self.candado:
            self.db.executemany("DELETE FROM pendientes WHERE id = ?", [(i,) for i in ids])
            self.db.commit()

    def cantidad(self):
        with self.candado:
            return self.db.execute("SELECT COUNT(*) FROM pendientes").fetchone()[0]
