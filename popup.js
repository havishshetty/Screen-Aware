let currentChart = null;

// Initialize when document loads
document.addEventListener('DOMContentLoaded', async () => {
    updateDateTime();

    setInterval(updateDateTime, 1000);
    // Initialize chart controls
    const chartTypeSelect = document.getElementById('chartType');
    const timeRangeSelect = document.getElementById('timeRange');
    
    // Add event listeners for chart controls
    chartTypeSelect.addEventListener('change', updateChart);
    timeRangeSelect.addEventListener('change', updateChart);
    
    // Add limit setting functionality
    const setLimitButton = document.getElementById('setLimit');
    setLimitButton.addEventListener('click', setTimeLimit);

    
    // Display current limits
    await displayCurrentLimits();
    
    // Initial chart render
    await updateChart();
});

function updateDateTime() {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TIME' }, response => {
        if (response) {
            const now = new Date(response.currentTime);
            
            // Format date and time
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
            
            // Update the display
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




// Chart update function
async function updateChart() {
    try {
        const data = await chrome.storage.local.get(null);
        const chartType = document.getElementById('chartType').value;
        const timeRange = document.getElementById('timeRange').value;

        // Filter out everything except actual website time tracking data
        const filteredData = Object.fromEntries(
            Object.entries(data).filter(([key, value]) => {
                return typeof value === 'number' && 
                       !key.includes('notification') && 
                       !key.includes('Notification') && 
                       key !== 'timeLimits' && 
                       !key.startsWith('last_') && 
                       key !== 'undefined' && 
                       value > 0;
            })
        );

        // Debug log to check filtered data
        console.log('Original filtered data:', filteredData);

        // Prepare data for chart
        let domains = Object.keys(filteredData);
        let times = domains.map(domain => filteredData[domain]);

        // Convert times based on selected range
        if (timeRange === 'hours') {
            times = times.map(time => Number((time / (1000 * 60 * 60)).toFixed(2)));
        } else {
            times = times.map(time => Math.round(time / 60000));
        }

        if (domains.length === 0) {
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }
            const ctx = document.getElementById('timeChart');
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
            return;
        }

        // Sort data by time spent (descending) and take top 5
        const sortedIndices = times.map((_, i) => i)
            .sort((a, b) => times[b] - times[a])
            .slice(0, 5); // Only take top 5
        
        domains = sortedIndices.map(i => domains[i]);
        times = sortedIndices.map(i => times[i]);

        console.log('Top 5 domains:', domains);
        console.log('Top 5 times:', times);

        // Create or update chart
        if (currentChart) {
            currentChart.destroy();
        }

        const ctx = document.getElementById('timeChart').getContext('2d');
        currentChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: domains,
                datasets: [{
                    label: `Time Spent (${timeRange})`,
                    data: times,
                    backgroundColor: domains.map(() => 
                        `hsl(${Math.random() * 360}, 70%, 50%)`
                    ),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: chartType === 'bar' ? 'top' : 'right',
                        display: chartType !== 'bar'
                    },
                    title: {
                        display: true,
                        text: 'Top 5 Websites - Screen Time'
                    }
                },
                scales: {
                    y: {
                        display: chartType === 'bar',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: timeRange === 'hours' ? 'Hours' : 'Minutes'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating chart:', error);
    }
}


// Time limit functions
async function setTimeLimit() {
    const domain = document.getElementById('domainInput').value;
    const limitMinutes = parseInt(document.getElementById('limitInput').value);
    
    if (!domain || !limitMinutes) {
        alert('Please enter both domain and time limit');
        return;
    }
    
    const limits = await chrome.storage.local.get('timeLimits') || {};
    const timeLimits = limits.timeLimits || {};
    
    timeLimits[domain] = limitMinutes * 60000; // Convert to milliseconds
    
    await chrome.storage.local.set({ timeLimits });
    await displayCurrentLimits();
    
    // Clear input fields after setting limit
    document.getElementById('domainInput').value = '';
    document.getElementById('limitInput').value = '';
}

// Make removeLimit available in window scope
window.removeLimit = async function(domain) {
    const limits = await chrome.storage.local.get('timeLimits') || {};
    const timeLimits = limits.timeLimits || {};
    
    delete timeLimits[domain];
    await chrome.storage.local.set({ timeLimits });
    await displayCurrentLimits();
}

async function displayCurrentLimits() {
    try {
        const limits = await chrome.storage.local.get('timeLimits') || {};
        const timeLimits = limits.timeLimits || {};
        
        const limitsDiv = document.getElementById('currentLimits');
        limitsDiv.innerHTML = '<h4>Current Limits:</h4>';
        
        if (Object.keys(timeLimits).length === 0) {
            const noLimitsP = document.createElement('p');
            noLimitsP.textContent = 'No limits set';
            limitsDiv.appendChild(noLimitsP);
            return;
        }
        
        Object.entries(timeLimits).forEach(([domain, limit]) => {
            const minutes = Math.round(limit / 60000);
            
            // Create container
            const limitContainer = document.createElement('div');
            limitContainer.style.margin = '5px 0';
            limitContainer.style.display = 'flex';
            limitContainer.style.justifyContent = 'space-between';
            limitContainer.style.alignItems = 'center';
            
            // Create text span
            const textSpan = document.createElement('span');
            textSpan.textContent = `${domain}: ${minutes} minutes`;
            textSpan.style.marginRight = '10px';
            
            // Create remove button
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'remove-limit-btn';
            removeButton.style.padding = '2px 8px';
            removeButton.style.backgroundColor = '#ff4444';
            removeButton.style.color = 'white';
            removeButton.style.border = 'none';
            removeButton.style.borderRadius = '3px';
            removeButton.style.cursor = 'pointer';
            
            // Add event listener
            removeButton.addEventListener('click', () => removeLimit(domain));
            
            // Assemble elements
            limitContainer.appendChild(textSpan);
            limitContainer.appendChild(removeButton);
            limitsDiv.appendChild(limitContainer);
        });
    } catch (error) {
        console.error('Error displaying limits:', error);
    }
}

// Function to format time for display
function formatTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
}

// Update data display periodically
setInterval(async () => {
    await updateChart();
    await displayCurrentLimits();
}, 60000); // Update every minute