/**
 * Editorial manifest for the book.
 *
 * Maps every original source file to its normalized identity: reading order,
 * slug, section, and page type. Order is global and drives the single-scroll
 * reading sequence; `part` is the roman-numeral movement printed on chapter
 * openings.
 *
 * Page types mirror the three layouts defined in the spec, plus `interlude`
 * for the standalone vignettes that separate the chronicle blocks:
 *   landing         — the cover, full-bleed background image
 *   chapter-opening — a section title page: image, then part + title + standfirst
 *   reader          — the split reader: sticky image left, scrolling text right
 *   interlude       — a short vignette or pull quote used as a separator
 */

export const SECTIONS = [
  {
    id: 'inicio',
    title: 'Inicio',
    part: null,
    blurb:
      'La editorial de los organismos de derechos humanos, la declaración de propósitos y los antecedentes de los tres procesos.',
  },
  {
    id: 'una-casa-con-una-sala-negra',
    title: 'Una casa con una Sala Negra',
    part: 'PRIMERA PARTE',
    partNumber: 1,
    blurb:
      'Las crónicas y los textos que aluden a las denuncias sobre torturas en la Brigada, entendida como sitio y como documento histórico, sede del dispositivo del terror.',
  },
  {
    id: 'violencia-sexual-como-crimen-de-lesa-humanidad',
    title: 'La violencia sexual como crimen de lesa humanidad',
    part: 'SEGUNDA PARTE',
    partNumber: 2,
    blurb:
      'El desarrollo del Programa de Asistencia a Víctimas del Terrorismo de Estado y el modo en que se conjugaron la salud mental y el papel protagónico de las y los sobrevivientes que testimoniaron en los juicios.',
  },
  {
    id: 'desaparecer-en-la-brigada',
    title: 'Desaparecer en la Brigada',
    part: 'TERCERA PARTE',
    partNumber: 3,
    blurb:
      'Crónicas y textos sobre los testimonios que aludieron al plan sistemático de desapariciones forzadas.',
  },
  {
    id: 'la-patota-de-la-brigada',
    title: 'La patota de la Brigada',
    part: 'CUARTA PARTE',
    partNumber: 4,
    blurb:
      'Registros de las participaciones de los genocidas imputados y del modo en que les fueron reconocidas todas las garantías judiciales propias de un juicio democrático, junto a la evidencia de su nulo arrepentimiento.',
  },
  {
    id: 'juicio-y-castigo',
    title: 'Juicio y Castigo',
    part: 'QUINTA PARTE',
    partNumber: 5,
    blurb:
      'El desenlace: los alegatos de las partes, las respectivas condenas y una síntesis de los fundamentos de cada uno de los fallos.',
  },
  {
    id: 'anexo',
    title: 'Anexo informativo',
    part: null,
    blurb:
      'Información documental y de contexto: la historia del edificio y el detalle de tribunales, partes y penas de cada una de las tres causas.',
  },
];

/**
 * `strip` lists heading lines removed from the body because the normalizer
 * promotes them into frontmatter — the chapter-opening layout renders them.
 */
export const ENTRIES = [
  {
    source: 'section00_inicio/00.tapa y contratapa.md',
    slug: 'tapa',
    title: 'Juicio y Castigo en el Chaco (Vol II)',
    section: 'inicio',
    pageType: 'landing',
    // Title, subtitle and kicker are rendered by the landing layout itself, so
    // all five cover headings come out and only the back-cover prose remains.
    strip: 5,
  },
  {
    source: 'section00_inicio/00b.primera pagina.md',
    slug: 'primera-pagina',
    title: 'Primera página',
    section: 'inicio',
    pageType: 'interlude',
  },
  {
    source: 'section00_inicio/01. DOC ORGANISMOS. La memoria y la palabra.md',
    slug: 'la-memoria-y-la-palabra',
    title: 'La memoria y la palabra: los juicios al genocidio',
    section: 'inicio',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section00_inicio/02.INTRODUCCIÓN.md',
    slug: 'introduccion',
    title: 'Introducción',
    section: 'inicio',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section00_inicio/03. TRES PROCESOS, UN JUICIO Y CASTIGO.md',
    slug: 'tres-procesos-un-juicio-y-castigo',
    title: 'La Brigada: tres procesos, un juicio y castigo',
    section: 'inicio',
    pageType: 'reader',
    strip: 1,
  },

  {
    source: 'section01-una-casa-con-una-sala-negra/04. EN EL LUGAR SIN LÍMITES.md',
    slug: 'en-el-lugar-sin-limites',
    title: 'En el lugar sin límites',
    section: 'una-casa-con-una-sala-negra',
    pageType: 'chapter-opening',
    strip: 2,
  },
  {
    source: 'section01-una-casa-con-una-sala-negra/05. CRÓNICAS 1.md',
    slug: 'cronicas-una-casa-con-una-sala-negra',
    title: 'Crónicas: una casa con una Sala Negra',
    section: 'una-casa-con-una-sala-negra',
    pageType: 'reader',
  },
  {
    source: 'section01-una-casa-con-una-sala-negra/06. CHACHI.md',
    slug: 'chachi',
    title: 'Chachi',
    section: 'una-casa-con-una-sala-negra',
    pageType: 'interlude',
  },

  {
    source: 'section02-la-violencia-sexual-como-crimen-de-lesa-humanidad/07. De víctimas a sobrevivientes.md',
    slug: 'de-victimas-a-sobrevivientes',
    title: 'De víctimas a sobrevivientes',
    section: 'violencia-sexual-como-crimen-de-lesa-humanidad',
    pageType: 'chapter-opening',
    strip: 2,
  },
  {
    source: 'section02-la-violencia-sexual-como-crimen-de-lesa-humanidad/08. SALUD MENTAL Y JUICIO Y CASTIGO.md',
    slug: 'salud-mental-y-juicio-y-castigo',
    title: 'Salud mental y juicio y castigo',
    section: 'violencia-sexual-como-crimen-de-lesa-humanidad',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section02-la-violencia-sexual-como-crimen-de-lesa-humanidad/09. CRONICAS 2 VIOLENCIA SEXUAL.md',
    slug: 'cronicas-violencia-sexual',
    title: 'Crónicas: la violencia sexual como crimen de lesa humanidad',
    section: 'violencia-sexual-como-crimen-de-lesa-humanidad',
    pageType: 'reader',
  },

  {
    source: 'section03-desaparecer-en-la-brigada/10.DESAPARECER.md',
    slug: 'desaparecer',
    title: 'Desaparecer',
    section: 'desaparecer-en-la-brigada',
    pageType: 'chapter-opening',
    strip: 2,
  },
  {
    source: 'section03-desaparecer-en-la-brigada/11. CRÓNICAS 3 DESAPARECER.md',
    slug: 'cronicas-desaparecer',
    title: 'Crónicas: desaparecer en la Brigada',
    section: 'desaparecer-en-la-brigada',
    pageType: 'reader',
  },
  {
    source: 'section03-desaparecer-en-la-brigada/12. ARGAÑARÁZ TORTURA META FÍSICA FALLO 232.md',
    slug: 'arganaraz-la-tortura-metafisica',
    title: 'Argañaráz: la tortura metafísica',
    section: 'desaparecer-en-la-brigada',
    pageType: 'interlude',
  },

  {
    source: 'section04-la-patota-de-la-brigada/13. UNA PATOTA PARA LA MISERIA PLANIFICADA.md',
    slug: 'una-patota-para-la-miseria-planificada',
    title: 'Una patota para la miseria planificada',
    section: 'la-patota-de-la-brigada',
    pageType: 'chapter-opening',
    strip: 2,
  },
  {
    source: 'section04-la-patota-de-la-brigada/14. GENOCIDAS AL FRENTE.2.md',
    slug: 'genocidas-al-frente',
    title: 'Genocidas al frente',
    section: 'la-patota-de-la-brigada',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section04-la-patota-de-la-brigada/15. CÁRCEL COMUN.md',
    slug: 'carcel-comun',
    title: 'Cárcel común',
    section: 'la-patota-de-la-brigada',
    pageType: 'interlude',
    strip: 1,
  },

  {
    source: 'section05-juicio-y-castigo/16. CONDENADOS.md',
    slug: 'condenados',
    title: 'Condenados',
    section: 'juicio-y-castigo',
    pageType: 'chapter-opening',
    strip: 2,
  },
  {
    source: 'section05-juicio-y-castigo/17.ALEGATOS.md',
    slug: 'alegatos',
    title: 'Alegatos',
    section: 'juicio-y-castigo',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section05-juicio-y-castigo/18. LAS CONDENAS.md',
    slug: 'las-condenas',
    title: 'Las condenas',
    section: 'juicio-y-castigo',
    pageType: 'reader',
  },
  {
    source: 'section05-juicio-y-castigo/19.LOS FALLOS.md',
    slug: 'los-fallos',
    title: 'Los fallos: fundamentos de las sentencias',
    section: 'juicio-y-castigo',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section05-juicio-y-castigo/20. JUICIO Y CASTIGO A LA BRIGADA. PASADO Y PORVENIR.md',
    slug: 'juicio-y-castigo-ayer-y-hoy',
    title: 'Juicio y castigo a la Brigada: ayer y hoy',
    section: 'juicio-y-castigo',
    pageType: 'reader',
    strip: 1,
  },

  {
    source: 'section05-juicio-y-castigo/21.UNA CASA CON HISTORIA.md',
    slug: 'una-casa-con-historia',
    title: 'Una casa con historia',
    section: 'anexo',
    pageType: 'reader',
    strip: 1,
  },
  {
    source: 'section05-juicio-y-castigo/22.PARTES Y PENAS.md',
    slug: 'tribunal-partes-y-penas',
    title: 'Tribunal, partes y penas',
    section: 'anexo',
    pageType: 'reader',
    strip: 1,
  },
];
