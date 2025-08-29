// Render a small demo chart to emulate Black Dashboard widgets
(function(){
  const el = document.getElementById('devicesActivityChart');
  if (!el) return;
  const ctx = el.getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,200);
  gradient.addColorStop(0, 'rgba(30,136,229,0.45)');
  gradient.addColorStop(1, 'rgba(30,136,229,0.05)');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{
        label: 'Online Devices',
        data: [5,7,6,8,9,10,9],
        fill: true,
        backgroundColor: gradient,
        borderColor: '#1e88e5',
        tension: 0.35,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa5b1' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9aa5b1' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
})();

