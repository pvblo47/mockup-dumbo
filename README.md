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
```

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
