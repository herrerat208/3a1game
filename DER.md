# 3A1 — DER (base `3a1`)

Adaptación del modelo de la consigna a 3A1. Tabla de equivalencias:

| Consigna | 3A1 | Nota |
|---|---|---|
| `selecciones` | `clubes` | `es_river` distingue River de rivales |
| `mundiales` | (dentro de `temporadas`) | `anio_orden`; en 3A1 el año es temporada de club, no Mundial |
| `planteles` | `temporadas` | `club_id + etiqueta` UNIQUE (hay Metro+Nacional del mismo club+año); suma `etiqueta, formacion, ovr_equipo, campeon, tecnico_id` |
| `jugadores` | `jugadores` | `nombre` completo + `foto_url` (Wikipedia, fallback sin año) |
| `plantel_jugadores` | `temporada_jugadores` | `posicion_natural, posiciones_secundarias CSV, ovr_base, es_estrella, es_mvp, dorsal NULL, foto_epoca/fuente/anio NULL` (foto DE ESE año vía Commons; ver `db/migracion_foto_epoca.sql`) |
| `partidas` | `partidas` | suma `modo` (copa/liga), `formato` (copa/premier/liga30) |
| `equipo_partida` | `partida_jugadores` | `slot` = XI de la formación + `SUP1..SUP8` (liga) / `SUP1..SUP5` (copa, sin validación posicional) + `dorsal` elegido (1-99, UNIQUE por partida; ver `db/migracion_dorsal.sql`) |
| — | `torneos` | una competencia por partida de liga/copa: `formato, fecha_actual, estado, campeon NULL, valla NULL` (cierre explícito; ver `db/migracion_torneo_cierre.sql`) |
| — | `torneo_equipos` | participantes: `torneo_id, temporada_id, zona (A/B/grupo A-H), es_usuario` |
| — | `calendario` | fixture + resultados fecha a fecha: `fecha_n, fase, local_id, visita_id, gf, gc, jugado, detalle (goles+asistencias+tanda+tarjetas)`; la tabla se calcula con GROUP BY |
| — | `sanciones` | tarjetas por torneo: `temporada_jugador_id, amarillas, roja, suspendido_hasta_fecha` |
| `resultados` | `resultados` | igual |

```mermaid
erDiagram
  clubes ||--o{ temporadas : tiene
  tecnicos ||--o{ temporadas : dirige
  temporadas ||--o{ temporada_jugadores : convoca
  jugadores ||--o{ temporada_jugadores : integra
  partidas ||--o{ partida_jugadores : arma
  temporada_jugadores ||--o{ partida_jugadores : elegido_como
  partidas ||--o{ resultados : simula
  partidas ||--o{ logros : desbloquea
  partidas ||--o{ torneos : compite
  torneos ||--o{ torneo_equipos : participan
  temporadas ||--o{ torneo_equipos : representan
  torneos ||--o{ calendario : programa
  torneos ||--o{ sanciones : sanciona
  temporada_jugadores ||--o{ sanciones : recibe

  clubes {
    INT id PK
    VARCHAR nombre UK
    BOOL es_river
    VARCHAR escudo_NULL
  }
  tecnicos {
    INT id PK
    VARCHAR nombre UK
  }
  temporadas {
    INT id PK
    INT club_id FK
    INT anio_orden
    VARCHAR etiqueta
    VARCHAR formacion
    INT ovr_equipo
    VARCHAR escudo_epoca_NULL
    BOOL campeon
    INT tecnico_id FK_NULL
  }
  jugadores {
    INT id PK
    VARCHAR nombre UK
    VARCHAR foto_url_NULL
  }
  temporada_jugadores {
    INT id PK
    INT temporada_id FK
    INT jugador_id FK
    VARCHAR posicion_natural
    VARCHAR posiciones_secundarias
    INT ovr_base
    BOOL es_estrella
    BOOL es_mvp
    INT dorsal_NULL
    VARCHAR foto_epoca_NULL
    VARCHAR foto_fuente_NULL
    INT foto_anio_NULL
  }
  partidas {
    INT id PK
    VARCHAR nombre_equipo
    VARCHAR formacion
    VARCHAR estilo
    VARCHAR modo
    VARCHAR formato
    DATETIME fecha_inicio
  }
  partida_jugadores {
    INT id PK
    INT partida_id FK
    INT temporada_jugador_id FK
    VARCHAR slot
    INT dorsal_NULL
  }
  resultados {
    INT id PK
    INT partida_id FK
    VARCHAR ronda
    VARCHAR rival
    INT goles_favor
    INT goles_contra
    BOOL avanzo
    TEXT detalle_NULL
    BOOL amistoso
  }
  logros {
    INT id PK
    INT partida_id FK
    VARCHAR codigo
    DATETIME fecha
  }
  torneos {
    INT id PK
    INT partida_id FK
    VARCHAR formato
    INT fecha_actual
    VARCHAR estado
    BOOL campeon_NULL
    BOOL valla_NULL
  }
  torneo_equipos {
    INT id PK
    INT torneo_id FK
    INT temporada_id FK
    VARCHAR zona_NULL
    BOOL es_usuario
  }
  calendario {
    INT id PK
    INT torneo_id FK
    INT fecha_n
    VARCHAR fase
    INT local_id FK
    INT visita_id FK
    INT gf_NULL
    INT gc_NULL
    BOOL jugado
    TEXT detalle_NULL
  }
  sanciones {
    INT id PK
    INT torneo_id FK
    INT temporada_jugador_id FK
    INT amarillas
    BOOL roja
    INT suspendido_hasta_fecha
  }
```

## Regla OVR final (no se almacena, se calcula)

```sql
CASE WHEN c.es_river = TRUE THEN
  tj.ovr_base + IF(t.campeon, 1, 0)
             + IF(tj.es_mvp, 3, IF(tj.es_estrella, 2, 0))
ELSE
  tj.ovr_base + IF(tj.es_mvp, 2, IF(tj.es_estrella, 1, 0))
END AS ovr_final
```

Verificación: Armani 2018 `88+1+3=92` ✓ · Pity `86+1+2=89` ✓ · Roma 1962 `86+1=87` ✓ · Rattín `89+2=91` ✓.

## Consultas de control (probar en phpMyAdmin antes de Vue)

```sql
-- Planteles disponibles (JOIN triple, como pide la consigna)
SELECT t.id, c.nombre AS club, t.anio_orden, t.etiqueta, t.formacion
FROM temporadas t
JOIN clubes c ON c.id = t.club_id
LEFT JOIN tecnicos tec ON tec.id = t.tecnico_id
ORDER BY c.nombre, t.anio_orden;

-- Jugadores de un plantel con OVR final
SELECT tj.id AS temporada_jugador_id, j.nombre,
       tj.posicion_natural, tj.posiciones_secundarias, tj.ovr_base,
       (CASE WHEN c.es_river = TRUE THEN tj.ovr_base + IF(t.campeon,1,0)
          + IF(tj.es_mvp,3,IF(tj.es_estrella,2,0))
        ELSE tj.ovr_base + IF(tj.es_mvp,2,IF(tj.es_estrella,1,0)) END) AS ovr_final
FROM temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
JOIN clubes c ON c.id = t.club_id
WHERE tj.temporada_id = 1
ORDER BY ovr_final DESC;

-- Sorteo
SELECT t.id AS temporada_id, t.etiqueta, t.anio_orden
FROM temporadas t ORDER BY RAND() LIMIT 1;

-- Equipo guardado (JOIN x5)
SELECT pj.slot, j.nombre, tj.posicion_natural, c.nombre AS club, t.anio_orden
FROM partida_jugadores pj
JOIN temporada_jugadores tj ON tj.id = pj.temporada_jugador_id
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
JOIN clubes c ON c.id = t.club_id
WHERE pj.partida_id = 1 ORDER BY pj.id;
```
