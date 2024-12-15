// popup.ts
declare const Chart: any; // Declare Chart as a global variable

// Store current chart instance
let currentChart: any = null;

// Initialize when document loads
document.addEventListener('DOMContentLoaded', async () => {
    // Set up time display
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Initialize chart controls
    const chartTypeSelect = document.getElementById('chartType') as HTMLSelectElement;
    const timeRangeSelect = document.getElementById('timeRange') as HTMLSelectElement;

    // Add event listeners for chart controls
    if (chartTypeSelect && timeRangeSelect) {
        chartTypeSelect.addEventListener('change', updateChart);
        timeRangeSelect.addEventListener('change', updateChart);
    }

    // Initial chart render
    await updateChart();
});

// Update date and time display
function updateDateTime(): void {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TIME' }, (response: any) => {
        if (response) {
            const timeDisplay = document.getElementById('timeDisplay');
            const userInfo = document.getElementById('userInfo');
            
            if (timeDisplay) {
                const now = new Date(response.currentTime);
                timeDisplay.textContent = `Current Date and Time (UTC): ${now.toISOString().replace('T', ' ').slice(0, 19)}`;
            }
            
            if (userInfo) {
                userInfo.textContent = `Current User's Login: ${response.username}`;
            }
        }
    });
}

// Update chart display
// Update chart display
async function updateChart(): Promise<void> {
    try {
        const data = await chrome.storage.local.get(null);
        const chartType = (document.getElementById('chartType') as HTMLSelectElement).value;
        const timeRange = (document.getElementById('timeRange') as HTMLSelectElement).value;

        // Filter and prepare data
        const filteredData = Object.entries(data).filter(([key, value]) => 
            typeof value === 'number' && 
            !key.includes('notification') && 
            !key.includes('Notification') && 
            key !== 'timeLimits' && 
            !key.startsWith('last_') && 
            key !== 'undefined' && 
            value > 0
        );

        const domains = filteredData.map(([domain]) => domain);
        let times = filteredData.map(([, time]) => timeRange === 'hours' 
            ? Number((time / (1000 * 60 * 60)).toFixed(2))
            : Math.round(time / 60000)
        );

        // Get canvas context
        const canvas = document.getElementById('timeChart') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Destroy existing chart
            if (currentChart) {
                currentChart.destroy();
            }

            // Create new chart
            currentChart = new Chart(ctx, {
                type: chartType,
                data: {
                    labels: domains,
                    datasets: [{
                        label: `Time (${timeRange})`,
                        data: times,
                        backgroundColor: domains.map(() => 
                            `hsl(${Math.random() * 360}, 70%, 50%)`
                        )
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Website Time (${timeRange})`
                        },
                        legend: {
                            display: chartType === 'pie',
                            position: 'bottom'
                        }
                    },
                    scales: chartType === 'bar' ? {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: timeRange === 'hours' ? 'Hours' : 'Minutes'
                            }
                        }
                    } : undefined
                }
            });
        }
    } catch (error) {
        console.error('Error updating chart:', error);
    }
}