# Árbitros, periodistas e hinchas reales (narrativa)

Estas tablas no modifican resultados, tarjetas ni ratings. Solo permiten que la previa, el relato y el diario mencionen personas reales: árbitros, periodistas/streamers e hinchas.

## Origen de los datos

La lista fue aportada por el dueño del producto el 2026-11-19 y se considera la fuente vigente. No se inventaron nombres ni medios de prensa: cuando no se indicó un medio, el campo queda `NULL`.

- **Árbitros** (28): Darío Herrera, Nazareno Arasa, Yael Falcón Pérez, Luis Lobo Medina, Leandro Rey Hilfer, Andrés Merlos, Nicolás Ramírez, Pablo Dóvalo, Pablo Echavarría, Sebastián Zunino, Hernán Mastrángelo, Carlos Gariano, Sebastián Martínez, Bruno Amiconi, Fernando Echenique, Nicolás Lamolina, Ariel Penel, Facundo Tello, Fernando Espinoza, Jorge Baliño, Juan Pafundi, Felipe Viola, Bryan Ferreyra, Álvaro Carranza, Daniel Zamora, Maximiliano Macheroni, Gonzalo Pereira y Juan Pablo Loustau.
- **Periodistas** (10): Sebastián Vignolo, Diego Latorre, Mariano Closs, Juan Pablo Varsky, Miguel Simón, Gustavo López, Morena Beltrán, Gastón Edul, Horacio Pagani y Pablo Giralt.
- **Solo River** (2): Nicolás Distasio y RiverLPM (`solo_river = 1`).
- **Con preferencia de equipo** (7): DavoXeneixe, La Cobra y Diego Yudcovsky (Boca); Mateo Zawlesky, BenitoSDR y Sensei (River); Flavio Azzaro (Racing). Se muestran con más frecuencia cuando juega su equipo.
- **Hinchas** (7): Francoriverplatense, FrankoBonetto, Facundo Alessandri, Tincho Duella y Leandro Germán Leguizamón (River); Matias Castillo y Kai (Boca).

## Modelo

- `arbitros(id, nombre, activo)`
- `periodistas(id, nombre, medio, equipo_preferido, solo_river, es_streamer, activo)`
- `hinchas(id, nombre, equipo, activo)`

`equipo_preferido` y `equipo` son etiquetas libres (`River`, `Boca`, `Racing`) que se comparan con la etiqueta del rival en la previa. La comparación es solo narrativa: no cambia la simulación.

## Archivos relacionados

- `db/migracion_arbitros_periodistas.sql` — crea y puebla las tres tablas.
- `api/prensa.php` — endpoint de solo lectura (espejo en `C:\xampp\htdocs\3a1-api\prensa.php`).
- `src/services/api.js` — `obtenerPrensa()`, con caché en memoria.
- `src/game/prensa.js` — reglas puras de selección determinista y frases (sin nombres hardcodeados).
