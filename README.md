# Estratos que piensan

**Generador poético-pixelado de paisajes, sistemas vivos y conciencia mineral.**

`Estratos que piensan` es un boceto generativo en JavaScript que produce láminas verticales donde paisaje, diagrama, poema e interfaz aparecen como el mismo sistema. Cada composición mezcla nubes, montañas, árboles, costa, mar, fósiles, cables, raíces, circuitos, grietas y vacíos abisales con fragmentos textuales en español.

El texto no funciona como pie de foto: se comporta como otra especie del dibujo. Se incrusta entre símbolos, raíces, olas, organismos y estructuras técnicas.

---

## Archivos del proyecto

| Archivo | Función |
|---|---|
| `index.html` | Estructura de la página y panel de controles |
| `styles.css` | Estilos de la interfaz |
| `estratos.js` | Motor generativo (dibujo, paletas, series, capas, animación) |

No requiere instalación, servidor, build ni dependencias externas. Abre `index.html` directamente en Chrome, Firefox, Edge o cualquier navegador moderno.

---

## Cómo usarlo

1. Abre `index.html` en un navegador.
2. Escribe una palabra o frase en el campo **semilla**.
3. Presiona **Enter** o **reordenar mundo**.
4. Elige un **territorio** y una **paleta**.
5. Exporta la imagen resultante como PNG.

Una misma semilla, territorio y paleta producen la misma composición. Cambiar cualquiera de los tres genera otro mundo.

---

## Controles

| Acción | Control |
|---|---|
| Generar una nueva semilla | `R` |
| Mostrar / ocultar texto | `T` |
| Activar / detener animación | `A` |
| Cambiar de paleta | `P` |
| Exportar PNG | `S` |
| Mutar una semilla con un clic | clic sobre el mapa |
| Cargar una lámina de la serie | clic sobre su miniatura |
| Regenerar con la semilla actual | botón **reordenar mundo** |

---

## Modos de territorio

### Continuo completo
Recorre el paisaje desde el aire hasta la región tectónica: nubes, montaña, bosque, costa, mar, abismo, sedimento, raíz, archivo y falla.

### Aire / montaña / bosque
Privilegia nubes lenticulares, espirales de aire, relieve, árboles y frases sobre percepción, altura, piedra y crecimiento.

### Litoral / mar / abismo
Se concentra en orillas, olas, peces, medusas, corales, corrientes y memoria submarina.

### Subsuelo / falla / núcleo
Genera fósiles, raíces-cable, circuitos, moléculas, grietas, archivos enterrados y vacíos oscuros.

---

## Paletas cromáticas

El código de dibujo nunca usa colores literales: pide "slots" semánticos (`blue`, `red`, `green`, `yellow`, `ink`, `paper`, `white`), de modo que cambiar de paleta reordena todo el mundo cromático sin tocar el motor.

Paletas incluidas: **riso clásico**, **tierra**, **mineral frío**, **abismo oscuro** (fondo oscuro), **neón nocturno** (fondo oscuro) y **monocromo**.

Para añadir una paleta, agrega una entrada al objeto `PALETTES` en `estratos.js` con los siete slots.

---

## Series

Genera varias láminas que comparten una misma **ecología** (territorio + paleta) pero **mutan de semilla** en semilla. Indica la cantidad (2–12) y pulsa **generar serie**: aparece una tira de miniaturas. Un clic sobre cualquiera la carga en el lienzo principal; **exportar serie** descarga todas como PNG.

---

## Capas por territorio

**Exportar capas** descarga varios PNG con fondo transparente, listos para componer en otro programa:

- Una capa por territorio activo (`aire`, `mar`, `tectonica`), o sólo el territorio elegido.
- Una capa de **texto**: las especies gráficas se calculan para anclar las frases, pero no se pintan; sólo quedan las palabras.

---

## Animación lenta

La tecla `A` (o el botón) activa una capa superpuesta y transparente con **corrientes, nubes y signos** que derivan despacio. Se siembra con la semilla activa para mantenerse estable y no altera el lienzo estático. Si está activa al exportar PNG, queda integrada en la imagen.

---

## Sistema visual

- Lienzo vertical de **720 × 1000 px**.
- Exportación PNG a **1440 × 2000 px**.
- Colores planos definidos por paleta.
- Formas de baja resolución: puntos, contornos escalonados, espirales, nodos, líneas y diagramas incompletos.
- Semillas reproducibles mediante una función hash y un generador pseudoaleatorio.
- Texto distribuido como parte del ecosistema gráfico, evitando márgenes, captions o listas laterales.

---

## Familias de símbolos

El sistema se compone de pequeñas “especies” gráficas. Cada una devuelve un punto de anclaje que permite que las frases aparezcan cerca de la forma que las provoca.

- Nubes lenticulares y espirales atmosféricas
- Montañas quebradas y relieves
- Árboles, ramas y raíces
- Litorales y olas
- Peces, medusas y corales
- Fósiles y conchas
- Cables orgánicos y circuitos
- Moléculas, grietas y vacíos abisales

---

## Lexicón poético

Las frases están organizadas por zonas del mundo: `sky`, `mountain`, `forest`, `shore`, `sea`, `abyss`, `tectonic`.

Ejemplos:

> nube que deriva  
> la montaña emerge  
> el árbol escucha  
> la corriente piensa  
> memoria abisal  
> cables como algas  
> conciencia mineral  
> el sistema sueña sin centro

Para agregar nuevos textos, edita el objeto `lexicon` dentro de `estratos.js`.

---

## Personalización rápida

Dentro de `estratos.js`, busca el objeto `CFG`:

```js
const CFG = {
  baseTextSize: 16,
  baseLeading: 18,
  textMaxChars: 20,
  extraNoise: 1.7,
  densityBoost: 1.9,
  symbolScale: 1.55,
  exportScale: 2
};
```

Puedes modificar:

- `baseTextSize`: tamaño de las frases.
- `baseLeading`: distancia entre líneas de una frase partida.
- `textMaxChars`: cantidad máxima de caracteres por línea.
- `extraNoise`: cantidad de puntos y signos sueltos.
- `symbolScale`: tamaño general de las especies gráficas.
- `exportScale`: resolución de exportación del PNG.

También puedes cambiar el tamaño físico del lienzo en `index.html`:

```html
<canvas id="world" width="720" height="1000"></canvas>
```

---

## Próximas posibilidades

- Sliders para densidad, escala de texto, cantidad de frases y caos.
- Registro de semillas favoritas como archivo JSON.
- Modo impresión: formato A4, póster o tira vertical.
- Exportar la serie completa como una sola hoja de contactos.

---

## Idea

El proyecto entiende el paisaje como una superficie de inscripción: una nube puede pensar, una raíz puede funcionar como cable, un fósil puede titubear, un circuito puede crecer como alga. La composición no ilustra una teoría de la conciencia; ensaya un sistema donde materia, lenguaje, cálculo y vida mínima comparten el mismo plano de signos.

---

## Créditos

Concepto y dirección artística: **Canek Zapata**  
Boceto generativo: HTML Canvas + JavaScript
