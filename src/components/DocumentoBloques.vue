<script setup>
// Renderizador genérico de los bloques de contenido de src/contenido/*.js.
// No contiene datos: solo pinta p, h3, nota, ol y ul.
// Las negritas se escriben con **texto** y los enlaces con [texto](url),
// para no meter HTML en el contenido.
defineProps({ bloques: { type: Array, required: true } })

function partes(texto) {
  return String(texto ?? '')
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean)
    .map((trozo) => {
      if (trozo.startsWith('**') && trozo.endsWith('**')) {
        return { tipo: 'fuerte', texto: trozo.slice(2, -2) }
      }
      const enlace = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trozo)
      if (enlace) return { tipo: 'enlace', texto: enlace[1], url: enlace[2] }
      return { tipo: 'texto', texto: trozo }
    })
}
</script>

<template>
  <template v-for="(b, j) in bloques" :key="j">
    <h3 v-if="b.tipo === 'h3'">{{ b.texto }}</h3>
    <p v-else-if="b.tipo === 'p'">
      <template v-for="(parte, k) in partes(b.texto)" :key="k">
        <strong v-if="parte.tipo === 'fuerte'">{{ parte.texto }}</strong>
        <a v-else-if="parte.tipo === 'enlace'" :href="parte.url" target="_blank" rel="noopener noreferrer">{{ parte.texto }}</a>
        <template v-else>{{ parte.texto }}</template>
      </template>
    </p>
    <div v-else-if="b.tipo === 'nota'" class="doc-nota">
      <template v-for="(parte, k) in partes(b.texto)" :key="k">
        <strong v-if="parte.tipo === 'fuerte'">{{ parte.texto }}</strong>
        <a v-else-if="parte.tipo === 'enlace'" :href="parte.url" target="_blank" rel="noopener noreferrer">{{ parte.texto }}</a>
        <template v-else>{{ parte.texto }}</template>
      </template>
    </div>
    <a v-else-if="b.tipo === 'contacto'" class="doc-contacto" :href="`mailto:${b.correo}`">
      <span class="doc-contacto-icono" aria-hidden="true">✉</span>
      <span class="doc-contacto-texto">{{ b.texto }}</span>
      <strong>{{ b.correo }}</strong>
      <span class="doc-contacto-flecha" aria-hidden="true">→</span>
    </a>
    <ol v-else-if="b.tipo === 'ol'">
      <li v-for="(item, k) in b.items" :key="k">
        <template v-for="(parte, l) in partes(item)" :key="l">
          <strong v-if="parte.tipo === 'fuerte'">{{ parte.texto }}</strong>
          <a v-else-if="parte.tipo === 'enlace'" :href="parte.url" target="_blank" rel="noopener noreferrer">{{ parte.texto }}</a>
          <template v-else>{{ parte.texto }}</template>
        </template>
      </li>
    </ol>
    <ul v-else-if="b.tipo === 'ul'">
      <li v-for="(item, k) in b.items" :key="k">
        <template v-for="(parte, l) in partes(item)" :key="l">
          <strong v-if="parte.tipo === 'fuerte'">{{ parte.texto }}</strong>
          <a v-else-if="parte.tipo === 'enlace'" :href="parte.url" target="_blank" rel="noopener noreferrer">{{ parte.texto }}</a>
          <template v-else>{{ parte.texto }}</template>
        </template>
      </li>
    </ul>
  </template>
</template>

<style scoped>
h3 {
  margin: 22px 0 8px;
  color: var(--rojo);
  font: 600 14px var(--display);
  letter-spacing: .03em;
  text-transform: uppercase;
}
p, li {
  color: var(--tinta);
  font: 400 14.5px/1.7 var(--texto);
}
p { margin: 0 0 14px; }
p:last-child { margin-bottom: 0; }
ol, ul { margin: 0 0 12px; padding-left: 21px; }
li { margin: 0 0 8px; padding-left: 2px; }
li:last-child { margin-bottom: 0; }
li::marker { color: var(--rojo); }
strong { color: var(--tinta); font-weight: 600; }
a { color: var(--rojo); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: var(--tinta); }
.doc-nota {
  margin: 16px 0 4px;
  padding: 13px 16px;
  border-left: 3px solid var(--oro);
  border-radius: 0 3px 3px 0;
  background: var(--superficie-dorada);
  color: var(--texto-suave);
  font: 400 13.5px/1.65 var(--texto);
}
.doc-nota strong { color: var(--tinta); }
.doc-contacto {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 16px 0 4px;
  padding: 13px 16px;
  border: 1px solid var(--linea-roja);
  border-left: 3px solid var(--rojo);
  border-radius: 0 4px 4px 0;
  background: var(--superficie-roja);
  color: var(--tinta);
  text-decoration: none;
}
.doc-contacto:hover { background: var(--superficie-roja); }
.doc-contacto-icono { font-size: 18px; color: var(--rojo); }
.doc-contacto-texto { font-size: 12px; color: var(--texto-suave); }
.doc-contacto strong { color: var(--rojo); font-size: 15px; word-break: break-all; }
.doc-contacto-flecha { margin-left: auto; color: var(--rojo); font-size: 18px; }

@media (max-width: 720px) {
  p, li { font-size: 15px; line-height: 1.72; }
  p { margin-bottom: 15px; }
  ol, ul { padding-left: 19px; }
  li { margin-bottom: 9px; }
  .doc-nota { padding: 13px 14px; font-size: 14px; }
}

@media print {
  h3 { font-size: 13px !important; break-after: avoid; }
  p, li { font-size: 11px !important; line-height: 1.5 !important; }
  .doc-nota { background: #fff !important; color: #333 !important; font-size: 10px !important; }
}
</style>
