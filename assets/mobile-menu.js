// Menú hamburguesa móvil: cierra el desplegable al pulsar un enlace,
// al hacer clic fuera, o con la tecla Escape. Sin dependencias.
document.addEventListener('DOMContentLoaded', function () {
  var menu = document.querySelector('.mobile-menu');
  if (!menu) return;
  var toggle = menu.querySelector('.mobile-menu__toggle');

  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      menu.open = false;
    }
  });

  document.addEventListener('click', function (event) {
    if (menu.open && !menu.contains(event.target)) {
      menu.open = false;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      if (toggle) toggle.focus();
    }
  });
});
