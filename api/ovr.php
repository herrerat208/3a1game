<?php
// 3A1 — OVR final canónico (DER.md). Requiere aliases tj, t, c en la consulta.
// River: base +1 si campeón +3 MVP / +2 estrella.
// Rivales (todos campeones): base +2 MVP / +1 estrella (ya incluye el +1).
function ovr_final_expr() {
    return "(CASE WHEN c.es_river = TRUE THEN "
        . "tj.ovr_base + IF(t.campeon, 1, 0) + IF(tj.es_mvp, 3, IF(tj.es_estrella, 2, 0)) "
        . "ELSE tj.ovr_base + IF(tj.es_mvp, 2, IF(tj.es_estrella, 1, 0)) END)";
}
