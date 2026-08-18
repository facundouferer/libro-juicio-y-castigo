# **EL LIBRO DEL JUICIO Y CASTIGO EN EL CHACO (VOL II)**  **Causa Brigada I, II, III**

# Sobre el libro

Este libro se compone de una selección de crónicas que abarcan tres procesos judiciales realizados en Chaco con eje en el centro clandestino de detención Brigada de Investigaciones de la Policía del Chaco.

Este libro realiza el abordaje de tres juicios en un solo libro, en tanto cada uno de ellos son partes de un todo que los engloba en un mismo proceso de juzgamiento.

Este criterio de recorte y edición de las crónicas seleccionadas responde a la intención de **no reconstruir los juicios completos en tanto eso escapa al alcance del presente formato**, en el cual me propuse ofrecer un mapa legible de lo ocurrido, hoy, en un momento posterior a la finalización de los juicios, en el que esa materia prima escrita ya no es “noticia del día”.

Este nuevo formato reclama otra organización y un marco capaz de dar continuidad a materiales escritos en momentos distintos de más de una década en razón de la extensión de la obra y para asegurar su lectura de un modo fluido y ameno.

Por ello este libro se organiza en tres movimientos: la presente introducción, con la editorial de organismos de DDHH, una declaración de propósitos y antecedentes; luego las crónicas periodísticas de las audiencias, que constituyen la columna vertebral de la obra; y por un último un anexo final con información documental y de contexto.

El bloque central- las crónicas- se divide a su vez en cinco segmentos en los que se presentan crónicas de audiencias judiciales que, más allá de corresponder con uno u otro proceso, guardan afinidad temática.

Por ello, el material se organiza los siguientes capítulos:

1. “**Una casa con una Sala Negra”,** con eje en las crónicas y textos que aluden a las denuncias sobre torturas en la Brigada (13 crónicas), entendida como sitio y como documento histórico, sede del dispositivo del terror.
2. “**La violencia sexual como crimen de lesa humanidad”** (13 crónicas), y en ese marco el desarrollo del Programa de Asistencia a Víctimas del Terrorismo de Estado, así como el modo en que se conjugaron la salud mental y el papel protagónico de los y las sobrevivientes que testimoniaron en los juicios.
3. “**Desaparecer en la Brigada”,** con crónicas y textos sobre los testimonios que aludieron al plan sistemático de desapariciones forzadas.
4. “**La patota de la Brigada”,** con registros de las participaciones de los genocidas imputados y del modo en que les fueron reconocidas todas las garantías judiciales propias de un juicio democrático. Asimismo, se evidencia su nulo arrepentimiento y su rechazo a colaborar con cualquier aporte a la verdad histórica o a brindar información sobre el destino final de las víctimas de desapariciones forzadas.
5. “**Juicio y Castigo”,** el desenlace, con la presentación de los alegatos de las partes y las respectivas condenas, así como una síntesis de los fundamentos de cada uno de los fallos.

A las crónicas se suman, insertados a modo de separadores, una serie de textos cuyo objetivo es funcionar como viñetas situadas complementarias de las respectivas secciones. Siguiendo un formato de mosaico, se agregan textos sobre escenas individuales, análisis macro, perfiles y material judicial.

# Diseño y funcionalidad

EL sitio debe dar la sensación de que es 100% accesible sólo usando el scroll, es decir que uno haciendo scroll puede ir del inicio al final del sitio porque debe ser leído como un libro. 

En todo momento en el sitio en la esquina superior derecha hay 2 botones flotantes, uno dice descargar y el otro dice Contenido. 

### Contenido

El Contenido muestra un modal que tiene la lista de las cada uno de los títulos del libro y el buscador de capítulos y otros elementos especiales del sitio

### Descargar

El botón descargar es para que salga un modal que tiene dos opciones, PDF o EPUB y permiten descargar cada una de las opciones. 

### Elementos especiales

en la esquina inferior derecha del sitio todo el tiempo aparece el dibujo de un mouse flotante que tiene una animación indicando que hagas scroll, esto cambia en la versión mobil donde aparece la imagen de un dedo. 

Como el sitio es de un libro, el sitio debe guardar en la memoria del navegador donde se quedó el usuario para que la próxima vez que ingrese el usuario al sitio sepa donde se quedó. 

## Tipos de página

El sitio posee contenidos que se presentarán en alguno de este tipo de páginas.

### **1.  Landing**

- Se ocupará para la página del inicio. 
- Tiene una imágen de fondo y texto encima. 
- La imagen de fondo ocupa toda la pantalla.
- El archivo /docs/inicio-tapa-y-contratapa.png muestra una aproximación de como sería la landing. 
- La imagen de fondo está en src/iamge/fondo-tapa.png

### **2. Chapter opening**

- Es para el inicio de cada sección o capítulo.  
- Cuando esto se transforma en un PDF para descarga la imagen aparece en la primer página y el texto en la segunda página

### **3. Split reader**

Es la página La página de contenido es la página donde se puede ver el texto del libro. Es una página que sirve para leer el contenido de cada capítulo o sección y está dividida en dos partes iguales.  Del lado izquierdo tiene el área de la imagen y del lado derecho el área del texto. 

- En esta página se ve el número de página cuando se pasa a formato PDF
- Esta página tiene dos partes.
- Debe tener una barra de scroll personalizada acorde al diseño y el color del sitio. 
- Un título está asociado a la imagen de la izquierda.
- Una imagen de la izquierda está asociada a título  y permanece visible mientras el título es visible en el lado derecho. Cuando no hay títulos que tienen una imagen asociada en la parte de la imagen se ve sólo negro, es decir ni epígrafe ni nada.
- El archivo /docs/mockeup.png muestra una aproximación de como se desea esa parte.

#### La imagen de la izquierda

- La imagen ocupe todo el espacio disponible a la izquierda. 
- Tiene una lupa en la esquina superior izquierda que cuando uno la aprieta la imagen se muestra en un modal que ocupa todo la pantalla y también aparece un más y un menos al lado de la lupa para que pueda hacer zoom en la imagen y el mouse se transforma en una mano para moverse sobre la imagen. 
- En la esquina inferior derecha está el epígrafe de la imagen.
- En la versión móvil la imagen aparece debajo del título al que está relacionada y no se e epígrafe o lupa, y cuando uno la apreta en la versión móvil ahí recién se ve el epígrafe de la imagen que aparece por encima de la imagen.
- Cada imagen de esta parte está asociada a un título has sea h1, h2, h3 o h4 del texto que aparece en la parte derecha. No todos los textos tienen una imagen asociada, por lo que cuando en la pantalla no se ve un texto que tiene una imagen asociada no se muestra imagen. 
- La imagen de la izquierda aparece mientras el título al que se relaciona aparece en la pantalla. 

## Indicaciones generales del diseño:

- Las crónicas  van a ir separadas por imágenes.
- Los textos que no son crónicas  también tienen  imágenes afines.

## Archivos de Descargas

El sitio debe permitir la descarga de archivos PDF y de EPUB y el botón de descarga debe ser visible en todo momento por el usuario. El botón "descargar" da la opción para descargar el libro en su formato PDF o en su formato EPUB. 

## Animación

La animación en el sitio es muy importante y debe ser cada vez que uno realiza una acción.

- Si uno toca un botón que abre un modal, el modal debe aparecer desde el botón que se aprieta. 
- El pasaje del landing a la siguiente parte del sitio hace la animación de que la landing se va para arriba.

# Contenido

## Textos

El contenido del libro está en la carpeta /src/content en el orden que deben aparecer. 

## Imagenes

Las imágenes del libro están en /src/images/content y los epígrafes están en /src/content/[epigrafes-images-contenido.md](http://epigrafes-images-contenido.md) 

### PDF

EL archivo PDF tiene todo el contenido del libro, incluyendo texto e imágenes y ese archivo deberá tener las siguientes características

- Tamaño de impresión y de PDF debe ser A5
- El PDF debe ser práctico y legible en ese formato digital.
- Las imágenes deben ocupar como máximo 1 hojas para que no estén cortadas en la versión PDF.
- No debe haber imágenes en ángulos diferentes para evitar que uno tenga la necesidad de girar el libro o el pdf.
- El diseño debe priorizar Fondo claro con letras oscuras para que tenga lectura fácil y sea barato al imprimir.
- En la versión PDF se debe ver el número de página en las páginas que son del tipo Contenido.
- El archivo PDF no se generará cuando el usuario hace click para descargar sino que ha habrá un archivo PDF que estará guardado.

### EPUB

- Debe haber un formato que permita la lectura en epub
- Debe haber un formato que permita ser leído en un celular sin dificultades, excepto las imágenes.
- El archivo de EPUB no se generará cada vez que uno apreta descargar en el EPUB sino que habrá un archivo EPUB que se descargará.

# Tecnología

- El proyecto debe ser desarrollado en Astro
- EL design system que se usará será [https://claude.ai/design/p/a97d3b78-c9d1-438d-ab11-f47a224379d3](https://claude.ai/design/p/a97d3b78-c9d1-438d-ab11-f47a224379d3) 

