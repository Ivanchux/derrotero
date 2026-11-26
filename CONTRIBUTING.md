# Contribuir

Derrotero es una página estática sin dependencias de ejecución: HTML, CSS y JavaScript.
No hay paso de compilación para trabajar en local.

## Trabajar en local

```bash
git clone <url-del-repositorio>
cd derrotero
python3 -m http.server 8080
```

Abre `http://localhost:8080`. También funciona abriendo `index.html` directamente, pero el buscador de direcciones responde mejor sirviéndolo por HTTP.

## Antes de enviar un cambio

1. Si tocas algo de `js/` o `css/`, regenera el visor de la exportación: `node tools/build-viewer-template.js`. Sin esto, el HTML incrustable seguiría usando el código antiguo.
2. Comprueba la consola del navegador: no debe haber errores.
3. Prueba en pantalla ancha y en móvil.
4. Si añades una función, apúntala en `CHANGELOG.md`.

## Criterios

- Sin frameworks ni gestores de paquetes en tiempo de ejecución. Lo que se incluya va en `vendor/` con su licencia.
- Sin claves de API ni servicios de pago. Los proveedores de mapas deben poder usarse sin clave.
- Textos de la interfaz en castellano.
- Los datos del usuario no salen del navegador salvo que él los exporte.

## Cambios grandes

Abre primero una incidencia con la idea. Así se evita trabajo repetido.
