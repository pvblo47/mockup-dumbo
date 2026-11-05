# Mockup de Dumbo Supermercados

Prototipo académico navegable para el Hito 2 del Proyecto Integrador de Plataformas. Contiene catálogo, carrito, compra simulada, inventario, clientes, trabajadores y reportes ilustrativos.

Está construido con HTML, CSS y JavaScript. Los archivos publicados están en `dist/`. No requiere instalación de paquetes ni compilación.

## Publicar en Netlify

1. Importar este repositorio desde la cuenta de Netlify.
2. Seleccionar la rama `main`.
3. Dejar vacío el comando de construcción y usar `dist` como directorio de publicación. `netlify.toml` ya declara ese directorio.
4. Desplegar y comprobar el enlace publicado. Para acceso sin cuentas de los compañeros, revisar la visibilidad pública del proyecto.

Una vez conectado el repositorio, las siguientes actualizaciones de la rama de publicación pueden desplegarse automáticamente. La configuración de Netlify debe conservarse en la cuenta del equipo.

## Probar localmente

Servir `dist/` con un servidor HTTP estático y abrir su dirección en el navegador. La navegación utiliza fragmentos, por ejemplo `/#catalogo` y `/#reportes`.

Para ejecutar la comprobación de las simulaciones, con Node.js instalado:

```sh
node verify-fusion.cjs
node verify-catalog.cjs
node verify-interactions.cjs
```

## Catálogo y detalle del Hito 2

El catálogo comercial incluye selección económica calculada desde los precios y stock, filtros combinables, ordenamiento y una ficha navegable en `/#producto/1`. Al volver del detalle se conservan los filtros. La cantidad aparece después de pulsar Agregar y se confirma mediante Agregar al carrito.

`dist/storefront.js` contiene las vistas y controles del catálogo, el detalle y la carga de imágenes. `dist/storefront.css` reúne sus estilos, transiciones y tamaños adaptables. Se cargan después de las funciones base y de gestión; la inicialización de la interfaz se realiza una sola vez al final de `storefront.js`.

La carga normal espera las imágenes sin añadir retrasos a filtros o cantidades. Para demostrar los esqueletos, abrir `/?carga=lenta#catalogo` o `/?carga=lenta#producto/1`. Este modo añade 650 ms una vez por vista durante la carga; es opcional y no se activa en el enlace normal. Un fallo de imagen termina la carga y ofrece reintento. La selección y el precio del producto permanecen disponibles.

Los precios por kilo, litro o unidad se muestran solo para presentaciones simples que permiten calcularlos. No se calculan a partir de textos ambiguos como “Pack 2 x 500 g”.

Las [verificaciones](docs/VERIFICACION_CATALOGO.md) distinguen pruebas de navegador, comprobaciones de Node y límites pendientes. Las capturas están en `docs/capturas/`.

### Carrito, filtros y carrusel

El banner reúne tres selecciones con fotografías y precios del catálogo. Cambia cada 6,5 segundos, ofrece flechas, indicadores y pausa, y se detiene al interactuar con él o cambiar de pestaña. Con “reducir movimiento” inicia detenido; Reproducir permite activarlo expresamente, conservando los cambios sin animación.

Los filtros actualizan únicamente los resultados: el banner conserva su tamaño, imagen y temporizador. La navegación comercial empieza con un botón verde Categorías; las opciones se despliegan hacia la derecha al pulsarlo y permanecen fuera del teclado mientras están ocultas. Elegir una categoría cierra el menú y lleva directamente a sus resultados, incluso desde otra pantalla. Todos los productos está dentro del desplegable y la selección se distingue por el color, sin checks. El menú también se cierra con Escape o al pulsar fuera. En móvil las opciones se desplazan horizontalmente dentro de su fila, con una indicación visible cuando no caben. El banner dispone de flechas visibles a ambos lados, además de indicadores y pausa.

El aviso de producto agregado dura 10 segundos de tiempo activo, pausa su cierre al pasar el puntero o usar sus controles con teclado, y permite revisar/pagar el carrito o seguir comprando. La primera visita al carrito con productos muestra una ventana opcional con todas las sugerencias disponibles y fuera de la lista, en un carrusel horizontal. Muestra tres tarjetas en escritorio y una con indicio de la siguiente en móvil; se recorre con flechas, desplazamiento táctil o teclado. Agregar conserva la posición. Volver al catálogo mantiene el carrito y lleva a todos los productos. También permite continuar sin agregar, cerrar con X o Escape. No vuelve a aparecer automáticamente durante esa sesión, incluso al recargar; Ver sugerencias permite abrirla voluntariamente. Visitar el carrito vacío no consume la primera aparición. Se priorizan otras categorías y después el precio, sin historial real ni servicios externos.

`dist/interaction.css` contiene los estilos de estas mejoras. Los recursos CSS/JS de `index.html` incluyen una versión de URL; actualizarla al publicar cambios evita mezclar archivos nuevos con copias antiguas del navegador. Las [pruebas de interacción](docs/VERIFICACION_INTERACCIONES.md) amplían la evidencia del catálogo.

## Datos y simulaciones

Los datos de ejemplo se guardan en `sessionStorage`: cada navegador/pestaña mantiene su propia sesión. Las modificaciones de un compañero no se sincronizan con los demás. El selector de vista permite demostrar Cliente, Trabajador y Administrador.

El acceso, pago, correo, carga de archivos y controles por rol son simulaciones. No existe backend ni conexión real con Webpay, Resend o PostgreSQL. Usar datos ficticios durante las pruebas.

La eliminación de cuenta es lógica y reversible en el prototipo: conserva historial y la restauración deja la cuenta deshabilitada. Los permisos definitivos y el bloqueo por pagos pendientes deben alinearse con la revisión del ERS antes de considerar terminada la tarea del mockup.

## Trabajar en equipo

- Mantener las pantallas y recursos en `dist/`.
- Crear una rama por cambio y revisarlo mediante pull request.
- Probar el flujo afectado, ejecutar la comprobación anterior y adjuntar evidencia en Trello.
- Distinguir una mejora del prototipo de una funcionalidad implementada en Angular/API.
- Guardar secretos y credenciales fuera del repositorio.

Esta copia para GitHub no incluye identificadores ni configuración privada del alojamiento anterior de Sites. Actualización de publicación: 4 de noviembre de 2026.
