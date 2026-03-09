let currentDataset = 'aus_native_phenology_complete.csv'; // Default dataset

// Global variables
let speciesData = [];
let filteredData = [];
let flowerChart, seedChart;

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

function loadData() {
    const dataFile = 'data/' + currentDataset;
    
    // Show loading state
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="6">Loading data...</td></tr>';
    
    Papa.parse(dataFile, {
        header: true,
        dynamicTyping: true,
        download: true,
        complete: function(results) {
            speciesData = results.data.filter(row => row.scientific_name);
            
            // Add flags for species that have flower and seed data
            speciesData = speciesData.map(row => {
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                
                // Check if any flower month is 1
                row.hasFlower = months.some(month => row['flower_' + month] === 1);
                
                // Check if any seed month is 1
                row.hasSeed = months.some(month => row['seed_' + month] === 1);
                
                return row;
            });
            
            filteredData = [...speciesData];
            
            // Populate family filter now that we have data
            populateFamilyFilter();
            
            // Debug - log counts to verify
            const withFlower = speciesData.filter(r => r.hasFlower).length;
            const withSeed = speciesData.filter(r => r.hasSeed).length;
            const withBoth = speciesData.filter(r => r.hasFlower && r.hasSeed).length;
            console.log(`Dataset: ${currentDataset}`);
            console.log(`Total species: ${speciesData.length}`);
            console.log(`Species with flower data: ${withFlower}, seed data: ${withSeed}, both: ${withBoth}`);
            
            updateUI();
        },
        error: function(error) {
            console.error('Error loading data:', error);
            document.getElementById('tableBody').innerHTML = '<tr><td colspan="6">Error loading data. Please check the file exists.</td></tr>';
        }
    });
}

function changeDataset() {
    currentDataset = document.getElementById('datasetSelect').value;
    loadData();
}

function populateFamilyFilter() {
    // Get unique families from the data, filter out empty/null values, and sort them
    const families = [...new Set(speciesData.map(row => row.family).filter(f => f && f.trim() !== ''))].sort();
    
    const familySelect = document.getElementById('familyFilter');
    
    // Clear existing options except the first one
    while (familySelect.options.length > 1) {
        familySelect.remove(1);
    }
    
    // Add family options
    families.forEach(family => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = family;
        familySelect.appendChild(option);
    });
    
    console.log(`Populated ${families.length} families`);
}

function applyFilters() {
    const state = document.getElementById('stateFilter').value;
    const flowerMonth = document.getElementById('flowerMonth').value;
    const seedMonth = document.getElementById('seedMonth').value;
    const family = document.getElementById('familyFilter').value;
    const showBothOnly = document.getElementById('bothDataFilter').checked;
    
    filteredData = speciesData.filter(row => {
        // State filter
        if (state && row.state !== state) return false;
        
        // Flower month filter
        if (flowerMonth && row['flower_' + flowerMonth] !== 1) return false;
        
        // Seed month filter
        if (seedMonth && row['seed_' + seedMonth] !== 1) return false;
        
        // Family filter
        if (family && row.family !== family) return false;
        
        // Both data filter - must have at least one flower AND one seed month
        if (showBothOnly && (!row.hasFlower || !row.hasSeed)) return false;
        
        return true;
    });
    
    updateUI();
}

function resetFilters() {
    document.getElementById('stateFilter').value = '';
    document.getElementById('flowerMonth').value = '';
    document.getElementById('seedMonth').value = '';
    document.getElementById('familyFilter').value = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('bothDataFilter').checked = false;
    filteredData = [...speciesData];
    updateUI();
}

function updateUI() {
    updateTable();
    updateCharts();
    updateStats();
}

function updateTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const tableBody = document.getElementById('tableBody');
    
    let displayData = filteredData;
    if (searchTerm) {
        displayData = filteredData.filter(row => 
            (row.scientific_name && row.scientific_name.toLowerCase().includes(searchTerm)) ||
            (row.common_name && row.common_name.toLowerCase().includes(searchTerm))
        );
    }
    
    tableBody.innerHTML = '';
    displayData.slice(0, 100).forEach(row => {
        const tr = document.createElement('tr');
        
        // Format months as abbreviated lists
        const flowerMonths = getActiveMonths(row, 'flower');
        const seedMonths = getActiveMonths(row, 'seed');
        
        tr.innerHTML = `
            <td><i>${row.scientific_name || ''}</i></td>
            <td>${row.common_name || '-'}</td>
            <td>${row.family || '-'}</td>
            <td>${row.state || 'Australia'}</td>
            <td class="month-cell">${formatMonths(flowerMonths)}</td>
            <td class="month-cell">${formatMonths(seedMonths)}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    if (displayData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No species match your filters</td></tr>';
    }
    
    document.getElementById('resultCount').textContent = 
        `${displayData.length} species (showing first 100)`;
}

function getActiveMonths(row, prefix) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months.filter((m, i) => row[prefix + '_' + m] === 1);
}

function formatMonths(monthArray) {
    if (monthArray.length === 0) return '—';
    if (monthArray.length === 12) return 'All year';
    
    // Try to group consecutive months
    const monthNums = monthArray.map(m => {
        const map = {'Jan':0,'Feb':1,'Mar':2,'Apr':3,'May':4,'Jun':5,
                     'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11};
        return map[m];
    }).sort((a,b) => a-b);
    
    // Find ranges
    let ranges = [];
    let start = monthNums[0];
    let prev = monthNums[0];
    
    for (let i = 1; i <= monthNums.length; i++) {
        if (i === monthNums.length || monthNums[i] !== prev + 1) {
            if (start === prev) {
                ranges.push(monthNumberToName(start));
            } else {
                ranges.push(monthNumberToName(start) + '–' + monthNumberToName(prev));
            }
            if (i < monthNums.length) {
                start = monthNums[i];
                prev = monthNums[i];
            }
        } else {
            prev = monthNums[i];
        }
    }
    
    return ranges.join(', ');
}

function monthNumberToName(num) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[num];
}

function updateCharts() {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    // Count species for each month
    const flowerCounts = months.map(m => 
        filteredData.filter(row => row['flower_' + m] === 1).length
    );
    
    const seedCounts = months.map(m => 
        filteredData.filter(row => row['seed_' + m] === 1).length
    );
    
    // Destroy existing charts if they exist
    if (flowerChart) flowerChart.destroy();
    if (seedChart) seedChart.destroy();
    
    // Create new charts
    const ctx1 = document.getElementById('flowerChart').getContext('2d');
    flowerChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Flowering species',
                data: flowerCounts,
                backgroundColor: 'rgba(76, 175, 80, 0.7)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of species' } }
            }
        }
    });
    
    const ctx2 = document.getElementById('seedChart').getContext('2d');
    seedChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Seed collection ready',
                data: seedCounts,
                backgroundColor: 'rgba(33, 150, 243, 0.7)',
                borderColor: 'rgba(33, 150, 243, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Number of species' } }
            }
        }
    });
}

function updateStats() {
    document.getElementById('speciesCount').textContent = filteredData.length;
}

function filterTable() {
    updateTable();
}

function sortTable(columnIndex) {
    // Simple sorting implementation
    const table = document.getElementById('results');
    const tbody = document.getElementById('tableBody');
    const rows = Array.from(tbody.rows);
    
    const isAscending = table.getAttribute('data-sort-dir') !== 'asc';
    table.setAttribute('data-sort-dir', isAscending ? 'asc' : 'desc');
    
    rows.sort((a, b) => {
        let aVal = a.cells[columnIndex].textContent.trim();
        let bVal = b.cells[columnIndex].textContent.trim();
        
        if (columnIndex === 0) { // Scientific name - ignore italics tags
            aVal = aVal.replace(/<\/?i>/g, '');
            bVal = bVal.replace(/<\/?i>/g, '');
        }
        
        if (isAscending) {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}