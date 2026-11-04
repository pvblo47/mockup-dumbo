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
```

## Catálogo y detalle del Hito 2

El catálogo comercial incluye selección económica calculada desde los precios y stock, filtros combinables, ordenamiento y una ficha navegable en `/#producto/1`. Al volver del detalle se conservan los filtros. La cantidad aparece después de pulsar Agregar y se confirma mediante Agregar al carrito.

`dist/storefront.js` contiene las vistas y controles del catálogo, el detalle y la carga de imágenes. `dist/storefront.css` reúne sus estilos, transiciones y tamaños adaptables. Se cargan después de las funciones base y de gestión; la inicialización de la interfaz se realiza una sola vez al final de `storefront.js`.

La carga normal espera las imágenes sin añadir retrasos a filtros o cantidades. Para demostrar los esqueletos, abrir `/?carga=lenta#catalogo` o `/?carga=lenta#producto/1`. Este modo añade 650 ms una vez por vista durante la carga; es opcional y no se activa en el enlace normal. Un fallo de imagen termina la carga y ofrece reintento. La selección y el precio del producto permanecen disponibles.

Los precios por kilo, litro o unidad se muestran solo para presentaciones simples que permiten calcularlos. No se calculan a partir de textos ambiguos como “Pack 2 x 500 g”.

Las [verificaciones](docs/VERIFICACION_CATALOGO.md) distinguen pruebas de navegador, comprobaciones de Node y límites pendientes. Las capturas están en `docs/capturas/`.

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
