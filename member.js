const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350;
const QUALITY = 0.8;

export function createImageCropper({ file, canvas, zoomInput, onReady }) {
  const ctx = canvas.getContext("2d");
  const image = new Image();
  const state = {
    image,
    zoom: 1,
    x: 0,
    y: 0,
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    baseScale: 1
  };

  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    state.baseScale = Math.max(canvas.width / image.width, canvas.height / image.height);
    state.x = 0;
    state.y = 0;
    draw();
    onReady?.();
  };
  image.src = objectUrl;

  function scaledSize() {
    const scale = state.baseScale * state.zoom;
    return { width: image.width * scale, height: image.height * scale };
  }

  function clamp() {
    const size = scaledSize();
    const maxX = Math.max(0, (size.width - canvas.width) / 2);
    const maxY = Math.max(0, (size.height - canvas.height) / 2);
    state.x = Math.max(-maxX, Math.min(maxX, state.x));
    state.y = Math.max(-maxY, Math.min(maxY, state.y));
  }

  function draw() {
    if (!image.complete) return;
    clamp();
    const size = scaledSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      (canvas.width - size.width) / 2 + state.x,
      (canvas.height - size.height) / 2 + state.y,
      size.width,
      size.height
    );
  }

  zoomInput.addEventListener("input", () => {
    state.zoom = Number(zoomInput.value);
    draw();
  });

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const ratioX = canvas.width / rect.width;
    const ratioY = canvas.height / rect.height;
    state.x += (event.clientX - state.pointerX) * ratioX;
    state.y += (event.clientY - state.pointerY) * ratioY;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    draw();
  });

  const stopDrag = () => { state.dragging = false; };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

  return {
    async toWebP() {
      const output = document.createElement("canvas");
      output.width = OUTPUT_WIDTH;
      output.height = OUTPUT_HEIGHT;
      const outputCtx = output.getContext("2d");
      outputCtx.drawImage(canvas, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

      const blob = await new Promise((resolve) => {
        output.toBlob(resolve, "image/webp", QUALITY);
      });

      if (!blob) throw new Error("Could not process image.");
      return {
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT
      };
    },
    destroy() {
      URL.revokeObjectURL(objectUrl);
    }
  };
}
