const clockNode = document.getElementById("clock");
const counterNodes = document.querySelectorAll("[data-counter]");
const periodButtons = document.querySelectorAll(".seg-btn");
const chart = document.getElementById("chart");

const weekData = [
  [56, 48],
  [61, 53],
  [70, 62],
  [66, 61],
  [80, 71],
  [72, 67],
  [69, 64],
];

const monthData = [
  [62, 54],
  [67, 58],
  [73, 66],
  [70, 63],
  [84, 74],
  [77, 69],
  [74, 68],
];

function updateClock() {
  if (!clockNode) return;
  clockNode.textContent = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function animateCounter(node, to) {
  let current = 0;
  const steps = 34;
  const increment = to / steps;
  const timer = setInterval(() => {
    current += increment;
    if (current >= to) {
      node.textContent = Number(to).toLocaleString("ru-RU");
      clearInterval(timer);
      return;
    }
    node.textContent = Math.round(current).toLocaleString("ru-RU");
  }, 20);
}

function initCounters() {
  counterNodes.forEach((node) => {
    const target = Number(node.getAttribute("data-counter"));
    if (!Number.isNaN(target)) animateCounter(node, target);
  });
}

function setChartData(data) {
  if (!chart) return;
  const columns = chart.querySelectorAll(".col");
  columns.forEach((col, index) => {
    const moodBar = col.querySelector(".bar.mood");
    const energyBar = col.querySelector(".bar.energy");
    if (!moodBar || !energyBar || !data[index]) return;
    moodBar.style.height = `${data[index][0]}%`;
    energyBar.style.height = `${data[index][1]}%`;
  });
}

periodButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const period = btn.getAttribute("data-period");
    periodButtons.forEach((item) => item.classList.remove("active"));
    btn.classList.add("active");
    setChartData(period === "month" ? monthData : weekData);
  });
});

updateClock();
setInterval(updateClock, 1000);
initCounters();
