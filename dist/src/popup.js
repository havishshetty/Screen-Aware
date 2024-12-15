"use strict";
// Import Chart.js types
// Store current chart instance
let currentChart = null;
// Initialize when document loads
document.addEventListener('DOMContentLoaded', async () => {
    // Set up time display
    updateDateTime();
    setInterval(updateDateTime, 1000);
    // Initialize chart controls
    const chartTypeSelect = document.getElementById('chartType');
    const timeRangeSelect = document.getElementById('timeRange');
    // Add event listeners for chart controls
    if (chartTypeSelect && timeRangeSelect) {
        chartTypeSelect.addEventListener('change', updateChart);
        timeRangeSelect.addEventListener('change', updateChart);
    }
    // Initial chart render
    await updateChart();
});
// Update date and time display
function updateDateTime() {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TIME' }, (response) => {
        if (response) {
            const now = new Date(response.currentTime);
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'UTC'
            };
            const formattedDateTime = new Intl.DateTimeFormat('en-US', options)
                .format(now)
                .replace(',', '')
                .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
            // Update time display
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = `Current Date and Time (UTC): ${formattedDateTime}`;
            }
            // Update user info
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.textContent = `Current User's Login: ${response.username}`;
            }
        }
    });
}
// Generate random color for chart
function generateRandomColor() {
    return `hsl(${Math.random() * 360}, 70%, 50%)`;
}
// Update chart display
async function updateChart() {
    try {
        // Get storage data
        const data = await chrome.storage.local.get(null);
        const chartType = document.getElementById('chartType').value;
        const timeRange = document.getElementById('timeRange').value;
        // Filter data to remove system entries
        const filteredData = Object.fromEntries(Object.entries(data).filter(([key, value]) => {
            return typeof value === 'number' &&
                !key.includes('notification') &&
                !key.includes('Notification') &&
                key !== 'timeLimits' &&
                !key.startsWith('last_') &&
                key !== 'undefined' &&
                value > 0;
        }));
        // Prepare chart data
        const domains = Object.keys(filteredData);
        let times = domains.map(domain => filteredData[domain]);
        // Convert times based on selected range
        times = timeRange === 'hours'
            ? times.map(time => Number((time / (1000 * 60 * 60)).toFixed(2)))
            : times.map(time => Math.round(time / 60000));
        // Create dataset
        const dataset = {
            label: `Time (${timeRange})`,
            data: times,
            backgroundColor: domains.map(() => generateRandomColor())
        };
        // Configure chart
        const chartConfig = {
            type: chartType,
            data: {
                labels: domains,
                datasets: [dataset]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Website Time (${timeRange})`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: chartType === 'pie',
                        position: 'bottom'
                    }
                },
                scales: chartType === 'bar' ? {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: timeRange === 'hours' ? 'Hours' : 'Minutes'
                        }
                    }
                } : undefined
            }
        };
        // Get canvas and context
        const canvas = document.getElementById('timeChart');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Destroy existing chart if it exists
            if (currentChart) {
                currentChart.destroy();
            }
            // Create new chart
            currentChart = new Chart(ctx, chartConfig);
        }
    }
    catch (error) {
        console.error('Error updating chart:', error);
        // Show error message to user
        const canvas = document.getElementById('timeChart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ff0000';
                ctx.font = '14px Arial';
                ctx.fillText('Error loading chart data', 10, 50);
            }
        }
    }
}
// Add error handling for storage changes
chrome.storage.onChanged.addListener(() => {
    updateChart().catch(error => {
        console.error('Error updating chart after storage change:', error);
    });
});
