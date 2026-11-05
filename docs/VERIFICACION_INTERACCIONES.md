# Carrito, filtros y carrusel — 4 de noviembre de 2026

## Alcance implementado

- Selector de cantidad sin selección automática del numeral; foco verde en el control y foco de teclado visible en los botones. Una sola selección desplegada a la vez.
- Aviso de agregado durante 10 segundos activos, con cierre, Revisar y pagar y Seguir comprando. Pausa al pasar el puntero, enfocar sus controles o esconder la pestaña; un nuevo agregado reemplaza el aviso anterior.
- Sugerencias del carrito: hasta cuatro productos disponibles y fuera de la lista. Prioridad para otras categorías y luego menor precio. Permiten elegir cantidad y agregar sin salir del carrito.
- Actualización parcial de filtros, búsqueda y ordenamiento. Banner y selección económica conservan su lugar. Los indicadores activos reservan espacio para evitar el salto al añadir una categoría.
- Tres escenas comerciales con datos de ejemplo: economía, frutas y despensa/panadería. Intervalo 6,5 segundos, flechas, indicadores y pausa. Tamaño estable; escenas inactivas fuera del teclado y árbol accesible.
- Reducción de movimiento: sin transiciones y reproducción automática detenida inicialmente. Reproducir permite optar expresamente por el avance. Pausa al pasar el puntero, enfocar el carrusel o esconder la página.

## Pruebas automatizadas

`node verify-interactions.cjs` comprueba cantidades enteras y límites, ausencia de selección automática, duración/pausa/reemplazo/cierre del aviso, selección de sugerencias según stock y carrito, avance circular del carrusel y sus condiciones de pausa. Utiliza reloj controlado para comprobar intervalos completos sin esperas reales.

`node verify-catalog.cjs` comprueba combinaciones de filtros, orden, economía, unidad de precio, cantidades acumuladas y carga de imágenes. `node verify-fusion.cjs` conserva la comprobación de compra simulada, persistencia, reportes, permisos e historial.

## Pruebas de navegador

Se prueban en la vista local del mismo directorio `dist/`, con datos ficticios y sesión independiente del sitio anterior. La preferencia de reducir movimiento del navegador de pruebas está activada.

| Flujo | Resultado |
| --- | --- |
| Cantidad inicial y cantidad cero | Numeral sin selección azul; cero rechazado con error junto al campo. |
| Agregar varias unidades | Aviso, suma de cantidades y total correctos. |
| Aviso con teclado | Permanece abierto durante el foco; Revisar y pagar abre el carrito. |
| Aviso con puntero | Permanece abierto al interactuar; Seguir comprando lo cierra. |
| Sugerencia desde carrito | Dos unidades de arroz se añaden a las líneas; arroz sale de las sugerencias y el total se actualiza. |
| Lácteos y Todos | Productos correctos; banner conserva posición, tamaño e imagen. |
| Carrusel manual y automático | Flechas e indicadores cambian la escena; Reproducir activa el avance, observado hasta la escena 3; Pausar lo detiene. |
| Filtros móviles | Selección de Lácteos muestra dos productos; quitar el filtro devuelve ocho y conserva la escena del banner. |
| Tamaños adaptables | Medidas emuladas de 320, 390, 768 y 1280 px sin desbordamiento horizontal; no se prueba un teléfono físico. |

Evidencia: `banner-carrusel.jpg`, `carrito-sugerencias.jpg` y `aviso-carrito.jpg` muestran la revisión de escritorio. Las capturas anteriores de catálogo/detalle corresponden a la primera revisión y se conservan como referencia.

## Publicación

Versión comprobada en `https://fancy-fairy-9b4985.netlify.app/`, conservando el acceso privado de Netlify. La revisión móvil de producción detectó que la barra de herramientas del propietario cubría las acciones del aviso. El aviso se eleva cuando esa barra está presente; la posición normal se conserva en el resto de los alojamientos.

## Segunda revisión: categorías y sugerencias opcionales

- La navegación comercial lleva al encabezado y a los productos filtrados; también se comprueba al entrar desde el carrito. Todos los productos es un botón verde y la categoría activa tiene fondo verde y check, además de `aria-pressed`.
- Las sugerencias pasan a un diálogo nativo sobre el carrito. Se abre una vez por sesión en la primera visita con productos y candidatos disponibles. Una visita con carrito vacío no consume esa aparición. El indicador se conserva al recargar.
- No agregar nada, X y Escape permiten volver al carrito sin cambios. Ver sugerencias vuelve a abrir el diálogo a petición. El fondo queda fuera de la navegación de teclado mientras está abierto.
- Agregar dos unidades de arroz actualiza las líneas del carrito y el total detrás del diálogo, conserva las tres tarjetas en su lugar y cambia el cierre a Continuar al carrito. No aparece un segundo aviso encima.
- Cantidad cero se rechaza junto al campo. Al alcanzar todo el stock, el botón queda deshabilitado y el foco permanece en el diálogo, sobre Continuar al carrito.
- Escape cierra primero la selección de cantidad si está desplegada; una segunda pulsación cierra las sugerencias. El foco regresa al encabezado del carrito o al botón que las abrió.
- En móvil, el contenido de las sugerencias se desplaza dentro de la ventana y el cierre permanece visible. Se verifica con ancho emulado; no se utiliza un dispositivo físico.

`verify-interactions.cjs` añade comprobaciones para la primera visita, roles, carrito vacío, ausencia de candidatos, otro diálogo abierto, persistencia del indicador y desplazamiento por categoría. `sugerencias-ventana.jpg` muestra esta revisión; la sección grande de sugerencias de las capturas anteriores fue reemplazada por un acceso compacto para volver a abrirla.

Las capturas de esta revisión se guardan en `docs/capturas/`. El mockup conserva autenticación y pago simulados; las sugerencias no usan historial real ni un servicio externo.
