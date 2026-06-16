/* Docs sidebar — fetch sidebar.html fragment + highlight current page */
(function () {
  const container = document.getElementById('docsSidebar');
  if (!container) return;

  const basePath = container.dataset.base || '../';

  fetch(basePath + 'sidebar.html')
    .then(r => r.text())
    .then(html => {
      container.innerHTML = html;

      // Highlight current page — sidebar uses absolute paths
      const currentPath = location.pathname;
      container.querySelectorAll('.sidebar-nav a').forEach(a => {
        if (currentPath.endsWith(a.getAttribute('href'))) {
          a.classList.add('active');
          const details = a.closest('details');
          if (details) details.open = true;
        }
      });
    })
    .catch(() => {
      container.innerHTML = '<p style="color:var(--text-dim)">Sidebar failed to load.</p>';
    });

  window.toggleDocsSidebar = function () {
    container.classList.toggle('docs-sidebar-open');
  };
})();
