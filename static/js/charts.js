// static/js/charts.js
let pieChart;
let barChart;
console.log("charts.js loaded!");

function updateCharts(results) {
    const pieCtx = document.getElementById('sentimentPieChart').getContext('2d');
    const barCtx = document.getElementById('sentimentBarChart').getContext('2d');

    // Calculate the sentiment counts
    const sentimentData = [0, 0, 0]; // [positive, neutral, negative]

    if (results.details && Array.isArray(results.details)) {
        results.details.forEach(r => {
            if (r.sentiment === 'positive') sentimentData[0]++;
            else if (r.sentiment === 'neutral') sentimentData[1]++;
            else if (r.sentiment === 'negative') sentimentData[2]++;
        });
    } else {
        if (results.sentiment === 'positive') sentimentData[0] = 1;
        if (results.sentiment === 'neutral') sentimentData[1] = 1;
        if (results.sentiment === 'negative') sentimentData[2] = 1;
    }

    // Prepare chart data
    const chartData = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
            label: 'Sentiment Distribution',
            data: sentimentData,
            backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
        }]
    };

    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();

    pieChart = new Chart(pieCtx, {
        type: 'pie',
        data: chartData
    });

    barChart = new Chart(barCtx, {
        type: 'bar',
        data: chartData,
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateChartColorsWithTheme() {
  console.log("updateChartColorsWithTheme called (still a placeholder). You can add dark mode support here!");
}

function clearChart(canvasId) {
    let chartInstance = Chart.getChart(canvasId);
    if (chartInstance) {
        chartInstance.destroy();
        console.log(`Cleared chart: ${canvasId}`);
    }
}
