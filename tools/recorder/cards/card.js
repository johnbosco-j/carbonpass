// Card runtime: duration comes from the URL hash (#d=7); the recorder calls play() once fonts are loaded.
// Opened directly in a browser (no hash), a card plays on load and loops every few seconds for previewing.
const params = new URLSearchParams(location.hash.slice(1));
const dur = Number(params.get("d")) || 7;
document.documentElement.style.setProperty("--dur", `${dur}s`);
window.play = () => document.body.classList.add("play");
window.cardReady = document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 200)));
if (!location.hash) {
  window.cardReady.then(() => {
    play();
    setInterval(() => {
      document.body.classList.remove("play");
      void document.body.offsetWidth;
      play();
    }, dur * 1000 + 600);
  });
}
