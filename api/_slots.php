<?php
// 3A1 — Mapa de formaciones: slot => código de posición requerido.
// Fuente ÚNICA de verdad (el frontend la consume vía ?json=1).
// Los slots son VARCHAR(10). Los códigos son los canónicos de la DB.
function formaciones_3a1() {
    return [
        '4-4-2' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'LI' => 'LI', 'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC',
            'MI' => 'MI', 'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '4-3-3' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'LI' => 'LI', 'MC1' => 'MC', 'MC2' => 'MC', 'MC3' => 'MC',
            'ED' => 'ED', 'DC' => 'DC', 'EI' => 'EI',
        ],
        '4-2-3-1' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'LI' => 'LI', 'MCD1' => 'MCD', 'MCD2' => 'MCD', 'ED' => 'ED',
            'MCO' => 'MCO', 'EI' => 'EI', 'DC' => 'DC',
        ],
        '4-2-4' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'LI' => 'LI', 'MC1' => 'MC', 'MC2' => 'MC',
            'ED' => 'ED', 'DC1' => 'DC', 'DC2' => 'DC', 'EI' => 'EI',
        ],
        '3-5-2' => [
            'ARQ' => 'ARQ', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'DFC3' => 'DFC',
            'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC', 'MC3' => 'MC',
            'MI' => 'MI', 'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '5-3-2' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'DFC3' => 'DFC', 'LI' => 'LI', 'MC1' => 'MC', 'MC2' => 'MC',
            'MC3' => 'MC', 'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '4-5-1' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'LI' => 'LI', 'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC',
            'MC3' => 'MC', 'MI' => 'MI', 'DC' => 'DC',
        ],
        '3-4-3' => [
            'ARQ' => 'ARQ', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'DFC3' => 'DFC',
            'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC', 'MI' => 'MI',
            'ED' => 'ED', 'DC' => 'DC', 'EI' => 'EI',
        ],
        // Históricas (solo display de rivales y validación si se habilitan).
        '2-3-5' => [
            'ARQ' => 'ARQ', 'DFC1' => 'DFC', 'DFC2' => 'DFC',
            'MD' => 'MD', 'MC' => 'MC', 'MI' => 'MI',
            'ED' => 'ED', 'DC1' => 'DC', 'DC2' => 'DC', 'DC3' => 'DC', 'EI' => 'EI',
        ],
        '3-2-5' => [
            'ARQ' => 'ARQ', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'DFC3' => 'DFC',
            'MC1' => 'MC', 'MC2' => 'MC',
            'ED' => 'ED', 'DC1' => 'DC', 'DC2' => 'DC', 'DC3' => 'DC', 'EI' => 'EI',
        ],
        '4-3-1-2' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'LI' => 'LI',
            'MC1' => 'MC', 'MC2' => 'MC', 'MC3' => 'MC', 'MCO' => 'MCO',
            'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '4-1-2-1-2' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'LI' => 'LI',
            'MCD' => 'MCD', 'MC1' => 'MC', 'MC2' => 'MC', 'MCO' => 'MCO',
            'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '4-2-2-2' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'LI' => 'LI',
            'MCD1' => 'MCD', 'MCD2' => 'MCD', 'MD' => 'MD', 'MI' => 'MI',
            'DC1' => 'DC', 'DC2' => 'DC',
        ],
        '4-3-2-1' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'LI' => 'LI',
            'MC1' => 'MC', 'MC2' => 'MC', 'MC3' => 'MC', 'MCO1' => 'MCO', 'MCO2' => 'MCO',
            'DC' => 'DC',
        ],
        '3-4-2-1' => [
            'ARQ' => 'ARQ', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'DFC3' => 'DFC',
            'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC', 'MI' => 'MI',
            'MCO1' => 'MCO', 'MCO2' => 'MCO', 'DC' => 'DC',
        ],
        '4-1-4-1' => [
            'ARQ' => 'ARQ', 'LD' => 'LD', 'DFC1' => 'DFC', 'DFC2' => 'DFC', 'LI' => 'LI',
            'MCD' => 'MCD', 'MD' => 'MD', 'MC1' => 'MC', 'MC2' => 'MC', 'MI' => 'MI',
            'DC' => 'DC',
        ],
    ];
}

function estilos_3a1() {
    return ['ofensivo', 'equilibrado', 'defensivo'];
}

// Solo estas 10 se pueden elegir en el pre-draft (tienen coordenadas de cancha).
function elegibles_3a1() {
    return ['4-4-2', '4-3-3', '4-2-3-1', '4-2-4', '3-5-2', '5-3-2', '4-5-1', '3-4-3', '4-2-2-2', '4-3-2-1'];
}
