# Verificación del catálogo y detalle de Dumbo

Fecha: 4 de noviembre de 2026. Prototipo estático HTML/CSS/JavaScript. Se trabajó sobre el repositorio existente y se mantuvo la publicación de `dist/` configurada en Netlify.

## Cambios

- Cabecera comercial con búsqueda y resumen accesible del carrito.
- Banner con productos, presentaciones y precios vigentes de la sesión; identidad verde de Dumbo y acento amarillo discreto.
- Selección económica de hasta cuatro productos disponibles, calculada por precio de la presentación completa.
- Filtros de categoría, rango de precio y disponibilidad, ordenamiento y filtros activos que se retiran individualmente.
- Detalle navegable por producto, imagen correspondiente, SKU, presentación, disponibilidad y relacionados de la misma categoría.
- Agregar primero abre la cantidad; solo la confirmación modifica el carrito. El selector reserva su espacio para no cambiar la altura de la tarjeta.
- Esqueletos durante carga de imágenes, caché, finalización ante error y modo opcional de carga lenta.
- Panel móvil de filtros y respeto por la preferencia de movimiento reducido.

No se agregaron librerías, backend, promociones ficticias, reseñas, políticas comerciales ni variantes de producto sin datos.

## Pruebas en navegador

Se utilizó el navegador integrado sobre un servidor HTTP local. El primer intento dentro del entorno restringido no fue accesible; la vista previa se comprobó después con el servidor local autorizado.

| Caso | Resultado observado |
|---|---|
| Primer clic en Agregar | Aparece la cantidad; el carrito permanece en cero. |
| Cantidad cero o decimal | Error junto al campo; carrito sin modificaciones. |
| Stock acumulado | Después de agregar dos manzanas, solicitar 23 adicionales se rechaza indicando un máximo de 22. |
| Confirmar dos unidades | Contador 2, total $3.780 y texto “2 unidades en tu carrito”. |
| Estabilidad de tarjeta | Altura medida de 437,8 px antes/después de confirmar; el selector no desplaza la grilla. |
| Escape en cantidad | Cierra el selector y devuelve el foco a Agregar. |
| Filtros combinados | Lácteos, precio $1.000–$2.000 y búsqueda LECHE muestran un producto. |
| Regreso del detalle | Conserva búsqueda, categoría, precios y orden seleccionado. |
| Producto inexistente / búsqueda vacía | Se muestra un estado claro para volver o limpiar filtros. |
| Precio mínimo mayor que máximo | Se informa el error y se conservan los valores ingresados. |
| Producto agotado | Huevos aparece sin stock y con Agotado deshabilitado. |
| Precio/stock desde inventario | Al cambiar leche a $9.000 y stock cero, desaparece de la selección económica y Arroz pasa al banner principal. Los datos de leche se restauraron después. |
| Filtros móviles | El panel aplica categoría, precio y stock; Escape cierra y devuelve el foco a Filtros. El foco permanece dentro del diálogo durante la prueba de teclado. |
| Detalle y carrito | Agregar dos leches desde la ficha mantiene la ruta, devuelve foco a Agregar y muestra $2.380 en el resumen del carrito. Quitar actualiza el total a cero. |
| Compra simulada | Acceso de ejemplo, rechazo con carrito conservado, aprobación, vaciado de carrito y confirmación conservada al recargar. |
| Esqueletos | En modo de carga lenta se observó aria-busy=true, contenido real inert y esqueleto presente; al completar, aria-busy=false y esqueleto retirado. |
| Gestión compartida | Inventario, edición con dos confirmaciones, listado de clientes y reportes continuaron disponibles. |
| Consola | Sin errores registrados en la revisión final. |

## Tamaños y movimiento

| Ancho de prueba | Resultado |
|---|---|
| 1280 px | Catálogo de cuatro columnas y filtros laterales; sin desbordamiento horizontal. |
| 768 px | Tres columnas y filtros en panel; sin desbordamiento horizontal. |
| 390 px | Dos columnas y detalle apilado; sin desbordamiento horizontal. |
| 320 px | Una columna y controles adaptados; sin desbordamiento horizontal. |

La preferencia real `prefers-reduced-motion` estaba activa en el navegador de prueba. Se comprobó transición de tarjeta en 0 s y animación de página en none. Las reglas de transiciones normales de 150–250 ms se revisaron en CSS; no se cambió la preferencia del usuario para forzar ese modo.

## Comprobaciones con Node

`node verify-fusion.cjs` y `node verify-catalog.cjs` completados correctamente.

La suite de catálogo comprueba normalización de búsqueda, SKU, filtros combinados, ordenamientos, selección económica dinámica, rangos inválidos, unidades ambiguas, texto escapado, stock acumulado, detalle inexistente y carga de imágenes con éxito, fallo y caché. El fallo de red se comprueba con una imagen de prueba en Node; no se indujo un fallo de red desde el navegador.

Las pruebas de fusión conservan compra y stock, persistencia de sesión, históricos, CSV, eliminación/restauración y controles de demostración existentes.

## Capturas

- [Catálogo en escritorio](capturas/catalogo-escritorio.jpg)
- [Detalle en escritorio](capturas/detalle-escritorio.jpg)
- [Catálogo en móvil](capturas/catalogo-movil.jpg)
- [Detalle en móvil](capturas/detalle-movil.jpg)

Las capturas usan datos ficticios de una sesión de prueba. La ficha de manzanas muestra 22 unidades después de una compra simulada de dos; una sesión nueva parte de los datos iniciales del prototipo.

## Límites

Este registro no acredita un backend ni integraciones reales con Webpay, correo o base de datos. Los roles son vistas de demostración y cada pestaña mantiene su sesión independiente.

No se modificaron las reglas de eliminación de cuentas fuera del alcance de catálogo. Sigue pendiente alinear el bloqueo por pagos en curso con la revisión del ERS. El despliegue y la URL de Netlify dependen de que la cuenta importe este repositorio; la comprobación visual de esta tarea se realizó localmente.
