/* Best Legal Net small-screen menu. Opens and closes with no animation. */
(function () {
  var buttons = document.querySelectorAll(".menu-btn");
  for (var i = 0; i < buttons.length; i++) (function (btn) {
    var head = btn.closest("header");
    if (!head) return;
    function setOpen(open) {
      head.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function () { setOpen(!head.classList.contains("nav-open")); });
    var links = head.querySelectorAll("nav a");
    for (var j = 0; j < links.length; j++) links[j].addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && head.classList.contains("nav-open")) { setOpen(false); btn.focus(); }
    });
  })(buttons[i]);
})();
