export function drawLineChart(canvas, points, options = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const pad = { top: 18, right: 14, bottom: 22, left: 34 };

  ctx.clearRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#71717A";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No data", width / 2, height / 2);
    return;
  }

  const values = points.map((p) => Number(p.value)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  ctx.strokeStyle = "#E4E4E7";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  const xFor = (index) => {
    if (points.length === 1) return width / 2;
    return pad.left + ((width - pad.left - pad.right) * index) / (points.length - 1);
  };
  const yFor = (value) => {
    return pad.top + (1 - ((value - min) / range)) * (height - pad.top - pad.bottom);
  };

  ctx.strokeStyle = "#E11D48";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(Number(point.value));
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#E11D48";
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(Number(point.value));
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#71717A";
  ctx.font = "10px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`${max.toFixed(1)}`, 2, pad.top + 3);
  ctx.fillText(`${min.toFixed(1)}`, 2, height - pad.bottom);

  ctx.textAlign = "center";
  points.forEach((point, index) => {
    if (points.length > 5 && index % Math.ceil(points.length / 5) !== 0 && index !== points.length - 1) return;
    ctx.fillText(point.label, xFor(index), height - 5);
  });
}
