const canvas = document.querySelector("#sample-canvas");
const context = canvas.getContext("2d");
context.fillStyle = "#315d49";
context.fillRect(24, 24, 180, 72);
context.fillStyle = "#20241f";
context.font = "18px Georgia";
context.fillText("Canvas pixels are not DOM targets", 225, 68);

const shadowHost = document.querySelector("#shadow-example");
const shadow = shadowHost.attachShadow({ mode: "open" });
shadow.innerHTML = `<style>p{padding:18px;background:#fff;border:1px dashed #20241f}</style><p>Content inside a page-owned shadow root</p>`;

document.querySelector("#change-target").addEventListener("click", () => {
  document.querySelector("#dynamic-copy").textContent = "The target text changed after annotation.";
});

document.querySelector("#remove-target").addEventListener("click", () => {
  document.querySelector("#dynamic-copy")?.remove();
});
