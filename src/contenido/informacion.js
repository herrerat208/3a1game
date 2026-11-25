// Información factual del proyecto, en texto visible y sin detalles internos.
// `grupo` separa la pestaña General de la de Privacidad y seguridad.
// El render de negritas y enlaces lo hace DocumentoBloques.vue.

export const informacion = [
  {
    titulo: 'Qué es 3A1',
    resumen: 'El juego, la idea y los formatos.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: '3A1 es un juego de draft de fútbol histórico en el que construís tu propio equipo con jugadores reales de River Plate y competís contra planteles campeones de distintos equipos y épocas.' },
      { tipo: 'p', texto: 'Cada partida comienza con un draft: seleccionás jugadores a partir de temporadas históricas de River, definís tu formación y preparás un equipo para afrontar una competición completa. Podés jugar en tres formatos: Mundial, Premier y Argentina.' }
    ]
  },
  {
    titulo: '¿Necesito registrarme?',
    resumen: 'Cómo empezar a jugar.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'No. 3A1 funciona directamente en el navegador: no hay cuenta ni registro. Podés armar una partida corta desde el celular o la computadora, elegir tu formación, probar el modo de almanaque y empezar de nuevo cuando quieras.' },
      { tipo: 'p', texto: 'Tus elecciones, logros y preferencias se guardan en este dispositivo, así que podés volver después sin ingresar datos personales.' }
    ]
  },
  {
    titulo: '¿Necesito saber mucho de fútbol?',
    resumen: 'Aprender jugando.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'No. Si conocés mucho, 3A1 te permite encontrar detalles de época y futbolistas menos obvios. Si estás empezando, la cancha muestra la posición y la valoración de cada jugador para que aprendas mientras armás un equipo competitivo.' },
      { tipo: 'p', texto: 'El modo de almanaque es una opción para probar tus conocimientos cuando quieras un desafío extra.' }
    ]
  },
  {
    titulo: 'Modos de juego',
    resumen: 'Cinco experiencias dentro de 3A1.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'El juego cuenta con diferentes experiencias:' },
      { tipo: 'ul', items: [
        '**Mundial:** competí contra clubes campeones de distintas partes del mundo hasta llegar a la final.',
        '**Premier:** enfrentá una liga de clubes campeones y buscá terminar en lo más alto de la tabla.',
        '**Argentina:** disputá una competición con zonas, fecha interzonal, clásico y playoffs.',
        '**De Memoria:** poné a prueba cuánto sabés sobre los jugadores y planteles históricos.',
        '**Carrera:** progresá a través de una experiencia de juego basada en tus resultados.'
      ] }
    ]
  },
  {
    titulo: 'Estado del proyecto',
    resumen: 'Qué está disponible hoy.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'Las tres competiciones principales están implementadas y cuentan con sus respectivos sistemas de disputa y resolución de partidos.' },
      { tipo: 'p', texto: 'También están disponibles los logros, el ranking, el historial de partidas, el palmarés y las estadísticas por temporada.' },
      { tipo: 'p', texto: 'Las fotografías de los jugadores rivales continúan en proceso de incorporación. Mientras tanto, se utilizan imágenes alternativas disponibles. Esto no afecta el funcionamiento ni los resultados de las simulaciones.' }
    ]
  },
  {
    titulo: 'Datos y fuentes',
    resumen: 'Planteles, participaciones y valoraciones.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'La base histórica de 3A1 reúne información de planteles reales de River Plate y de equipos campeones de distintas épocas.' },
      { tipo: 'p', texto: 'La información de River se recopiló y organizó a partir de documentos históricos. Para los equipos rivales se consultaron páginas y sitios especializados de cada club, buscando información sobre sus formaciones, planteles, escudos y temporadas.' },
      { tipo: 'p', texto: 'Las fotografías de los jugadores se recopilaron a partir de diarios, publicaciones y búsquedas en Google, priorizando imágenes que permitieran identificar a los futbolistas y sus respectivas épocas.' },
      { tipo: 'p', texto: 'Las valoraciones finales de los equipos y jugadores se calculan mediante el sistema propio del juego.' }
    ]
  },
  {
    titulo: 'Fuentes de inspiración',
    resumen: 'Referencias para la investigación y el diseño.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'Una de las principales referencias para la investigación histórica y el diseño visual de 3A1 fue [La Historia de River](https://lahistoriariver.com/).' },
      { tipo: 'p', texto: 'Su contenido y presentación sirvieron como referencia para organizar la información histórica y construir la identidad visual de la página.' }
    ]
  },
  {
    titulo: 'Accesibilidad y rendimiento',
    resumen: 'Cómodo en computadora y celular.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: '3A1 busca ofrecer una experiencia cómoda tanto en computadoras como en dispositivos móviles.' },
      { tipo: 'ul', items: [
        'Interfaz adaptable a diferentes tamaños de pantalla.',
        'Tablas y elementos de navegación optimizados para dispositivos móviles.',
        'Elementos interactivos accesibles mediante teclado y con indicadores de foco visibles.',
        'Animaciones adaptadas a la preferencia del sistema de reducir movimiento.',
        'Recursos visuales optimizados para mejorar los tiempos de carga.'
      ] }
    ]
  },
  {
    titulo: 'Créditos',
    resumen: 'Autoría, agradecimientos y recursos.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: '3A1 es un juego de draft histórico de River Plate, armado con planteles y rivales reales de distintas épocas.' },
      { tipo: 'ul', items: [
        '**Autoría:** proyecto 3A1.',
        '**Agradecimientos:** a quienes aportaron escudos, fotografías y datos históricos usados en el juego.',
        '**Recursos:** documentos históricos de planteles, escudos de época y retratos del archivo del proyecto.',
        '**Posibles errores:** por la cantidad de jugadores y fotos de muchas épocas, pueden existir errores o datos incompletos. Si encontrás uno, avisá por el canal de contacto.'
      ] },
      { tipo: 'nota', texto: 'Los nombres y datos de jugadores pertenecen a sus respectivos clubes y fuentes históricas.' }
    ]
  },
  {
    titulo: 'Contacto',
    resumen: 'Soporte, errores y sugerencias.',
    grupo: 'general',
    bloques: [
      { tipo: 'p', texto: 'Si tenés una consulta sobre cómo jugar, encontraste un error en un plantel o una foto, o querés proponer una mejora, escribinos directamente por correo.' },
      { tipo: 'h3', texto: 'En qué podemos ayudarte' },
      { tipo: 'ul', items: [
        'Consultas generales y problemas para jugar o continuar una partida.',
        'Correcciones de planteles, nombres, fotos o escudos.',
        'Novedades sobre enlaces compartidos y resultados guardados.',
        'Preguntas sobre privacidad, permisos de imágenes y uso de marcas.',
        'Comentarios sobre la experiencia de juego.'
      ] },
      { tipo: 'p', texto: 'Para dudas de privacidad o sobre los datos técnicos del sitio, también podés escribir al mismo correo.' },
      { tipo: 'contacto', correo: 'kouvah26@gmail.com', texto: 'Escribinos a' }
    ]
  },
  {
    titulo: 'Privacidad y datos',
    resumen: 'Qué se guarda y para qué.',
    grupo: 'privacidad',
    bloques: [
      { tipo: 'p', texto: '3A1 almacena la información necesaria para ofrecer sus funcionalidades, como el progreso de las partidas, las estadísticas, los logros y el historial de juego.' },
      { tipo: 'p', texto: 'Los datos se utilizan exclusivamente para el funcionamiento de las características del juego y no deben compartirse con terceros sin una finalidad informada.' }
    ]
  },
  {
    titulo: 'Cookies y almacenamiento',
    resumen: 'Preferencias y continuidad entre sesiones.',
    grupo: 'privacidad',
    bloques: [
      { tipo: 'p', texto: '3A1 puede utilizar mecanismos de almacenamiento local para conservar preferencias y datos de navegación entre sesiones.' },
      { tipo: 'p', texto: 'La información almacenada permite mejorar la continuidad de la experiencia y evitar que el usuario tenga que configurar nuevamente determinados elementos.' },
      { tipo: 'nota', texto: 'Este almacenamiento vive en tu dispositivo. Podés borrarlo cuando quieras desde la configuración del navegador.' }
    ]
  },
  {
    titulo: 'Seguridad',
    resumen: 'Protección de tus datos y de las partidas.',
    grupo: 'privacidad',
    bloques: [
      { tipo: 'p', texto: 'La seguridad de los datos y de las partidas es una parte importante del funcionamiento de 3A1.' },
      { tipo: 'p', texto: 'Se aplican medidas para proteger la información almacenada, controlar el acceso a las funcionalidades y evitar modificaciones no autorizadas.' },
      { tipo: 'h3', texto: 'Seguridad del usuario' },
      { tipo: 'p', texto: 'No hay acceso con cuenta ni formularios de datos personales: tu progreso, tus preferencias y tus logros quedan guardados en este dispositivo.' },
      { tipo: 'h3', texto: 'Seguridad de la página' },
      { tipo: 'p', texto: 'Las partidas, los resultados y los catálogos del juego se controlan para que una acción desde la página no modifique información ajena a esa partida.' }
    ]
  }
]
