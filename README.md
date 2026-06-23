# Estratos que piensan

**Generador poético-pixelado de paisajes, sistemas vivos y conciencia mineral.**

`Estratos que piensan` es un boceto generativo en JavaScript que produce láminas verticales donde paisaje, diagrama, poema e interfaz aparecen como el mismo sistema. Cada composición mezcla nubes, montañas, árboles, costa, mar, fósiles, cables, raíces, circuitos, grietas y vacíos abisales con fragmentos textuales en español.

El texto no funciona como pie de foto: se comporta como otra especie del dibujo. Se incrusta entre símbolos, raíces, olas, organismos y estructuras técnicas.

---

## Archivo principal

- `estratos_que_piensan_boceto_v2.html`

No requiere instalación, servidor ni dependencias externas. Abre el archivo directamente en Chrome, Firefox, Edge o cualquier navegador moderno.

---

## Cómo usarlo

1. Abre `estratos_que_piensan_boceto_v2.html` en un navegador.
2. Escribe una palabra o frase en el campo **semilla**.
3. Presiona **Enter** o **reordenar mundo**.
4. Explora los modos de territorio.
5. Exporta la imagen resultante como PNG.

Una misma semilla y un mismo modo producen la misma composición. Cambiar cualquiera de los dos genera otro mundo.

---

## Controles

| Acción | Control |
|---|---|
| Generar una nueva semilla | `R` |
| Mostrar / ocultar texto | `T` |
| Exportar PNG | `S` |
| Mutar una semilla con un clic | clic sobre el mapa |
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

## Sistema visual

La versión actual trabaja con:

- Lienzo vertical de **720 × 1000 px**.
- Exportación PNG a **1440 × 2000 px**.
- Colores planos: azul, rojo, verde, amarillo, negro y blanco.
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

Las frases están organizadas por zonas del mundo:

- `sky`
- `mountain`
- `forest`
- `shore`
- `sea`
- `abyss`
- `tectonic`

Ejemplos:

> nube que deriva  
> la montaña emerge  
> el árbol escucha  
> la corriente piensa  
> memoria abisal  
> cables como algas  
> conciencia mineral  
> el sistema sueña sin centro

Para agregar nuevos textos, edita el objeto `lexicon` dentro del `<script>`.

---

## Personalización rápida

Dentro de `estratos_que_piensan_boceto_v2.html`, busca el objeto `CFG`:

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

También puedes cambiar el tamaño físico del lienzo aquí:

```html
<canvas id="world" width="720" height="1000"></canvas>
```

---

## Próximas posibilidades

- Sliders para densidad, escala de texto, cantidad de frases y caos.
- Paletas cromáticas intercambiables.
- Capas exportables por territorio.
- Animación lenta de corrientes, nubes y signos.
- Registro de semillas favoritas como archivo JSON.
- Modo impresión: formato A4, póster o tira vertical.
- Generación de series: múltiples láminas que compartan una misma ecología pero muten de semilla en semilla.

---

## Idea

El proyecto entiende el paisaje como una superficie de inscripción: una nube puede pensar, una raíz puede funcionar como cable, un fósil puede titubear, un circuito puede crecer como alga. La composición no ilustra una teoría de la conciencia; ensaya un sistema donde materia, lenguaje, cálculo y vida mínima comparten el mismo plano de signos.

---

## Créditos

Concepto y dirección artística: **Canek Zapata**  
Boceto generativo: HTML Canvas + JavaScript
