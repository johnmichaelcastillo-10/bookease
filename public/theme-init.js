// Applies the saved theme before first paint so there is no light/dark flash.
// External file (not inline) so the Content-Security-Policy can stay script-src 'self'.
// Reads the same localStorage key the Zustand UI store persists to.
;(function () {
  var theme = 'system'
  try {
    var raw = localStorage.getItem('bookease-ui')
    if (raw) theme = (JSON.parse(raw).state || {}).theme || 'system'
  } catch (e) {}
  var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
