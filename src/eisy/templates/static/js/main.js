// Global variables
let currentData = null;
let selectedModels = [];
let usingSyntheticData = false;
let modelCounter = 0;
let customModelCounter = 0;
let selectedPointIndices = null;

// Helper function to get default parameter value
function getDefaultParamValue(param) {
    if (param.endsWith('_n')) return 0.9;
    if (param.endsWith('_B')) return 1;
    if (param.startsWith('Q') || param.startsWith('C')) return 1e-6;
    return 1000;
}

// Helper function to get parameter with unit for display
function paramPlusUnit(param) {
    if (param.endsWith('_n')) return `${param} (unitless)`;
    if (param.endsWith('_B')) return `${param} (sqrt(s))`;
    const units = {
        'R': 'Ω', 'L': 'H', 'W': 'Ω/sqrt(s)', 'C': 'F', 'Q': 'F', 'S': 'Ω/sqrt(s)', 'O': 'Ω/sqrt(s)'
    };
    return `${param} (${units[param.charAt(0)] || ''})`;
}

// Helper function to calculate impedance magnitude
function calculateMagnitude(real, imag) {
    if (Array.isArray(real) && Array.isArray(imag)) {
        return real.map((r, i) => Math.sqrt(r ** 2 + imag[i] ** 2));
    }
    return Math.sqrt(real ** 2 + imag ** 2);
}

// Helper function to calculate phase angle (in degrees)
function calculatePhase(real, imag) {
    if (Array.isArray(real) && Array.isArray(imag)) {
        return real.map((r, i) => Math.atan2(imag[i], r) * 180 / Math.PI);
    }
    return Math.atan2(imag, real) * 180 / Math.PI;
}

// Helper function to set circuit input styling
function setCircuitInputStyling(inputElement, hasError) {
    inputElement.classList.toggle('input-error', hasError);
}

// Generic circuit preview update function
function updateCircuitPreviewGeneric(circuitInputId, previewContainerId, previewDivId, onSuccess = null) {
    const circuitInput = document.getElementById(circuitInputId);
    const previewContainer = document.getElementById(previewContainerId);
    const previewDiv = document.getElementById(previewDivId);
    const circuit = circuitInput.value.trim();

    if (!circuit) {
        previewContainer.classList.remove('show-block');
        return;
    }

    try {
        const diagramHTML = generateCircuitDiagram(circuit, true);
        previewDiv.innerHTML = diagramHTML;
        previewContainer.classList.add('show-block');
        setCircuitInputStyling(circuitInput, false);
        if (onSuccess) onSuccess(circuit);
    } catch (error) {
        previewDiv.innerHTML = 'Error generating diagram.';
        previewContainer.classList.add('show-block');
        setCircuitInputStyling(circuitInput, true);
    }
}

// Update circuit preview functions
function updateCircuitPreview() {
    updateCircuitPreviewGeneric('custom-circuit', 'circuit-preview-container', 'circuit-preview');
}

function updateSyntheticCircuitPreview() {
    updateCircuitPreviewGeneric('synth-custom-circuit', 'synth-circuit-preview-container', 'synth-circuit-preview', updateSyntheticCustomParams);
}

// Tab switching function
function switchTab(tabName) {
    const tabButton = document.getElementById(`${tabName}-tab`);
    if (tabButton?.disabled) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    document.querySelector(`.tab[onclick*="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab${tabName === 'data' ? '' : '-content'}`).classList.add('active');
}

// Toggle collapse function
function toggleCollapse(contentId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(contentId.replace('-content', '-icon'));
    content.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
}

// Add preset model
function addPresetModel() {
    const select = document.getElementById('preset-model-select');
    const modelKey = select.value;
    const model = window.circuitModels[modelKey];

    if (selectedModels.some(m => m.name === modelKey)) {
        showMessage('Model already added!', 'error');
        return;
    }

    selectedModels.push({
        id: modelCounter++,
        name: modelKey,
        circuit: model.circuit,
        params: model.params,
        initial_guess: { ...model.initial_guess },
        description: model.description,
        isCustom: false
    });

    updateModelList();
    showMessage(`Added model: ${modelKey}`, 'success');
}

// Customize preset model
async function customizePresetModel() {
    const select = document.getElementById('preset-model-select');
    const model = window.circuitModels[select.value];
    document.getElementById('custom-circuit').value = model.circuit;
    document.getElementById('custom-model-name').value = `${select.value} (Custom)`;
    updateCircuitPreview();
}

// Add custom model
async function addCustomModel() {
    const circuit = document.getElementById('custom-circuit').value.trim();
    let name = document.getElementById('custom-model-name').value.trim();

    if (!circuit) {
        showMessage('Please enter a circuit string!', 'error');
        return;
    }

    if (!name) {
        name = `Custom ${++customModelCounter}`;
    }

    try {
        const result = await validateCircuit(circuit);

        if (!result.valid) {
            showMessage('Invalid circuit: ' + result.error, 'error');
            return;
        }

        if (selectedModels.some(m => m.name === name)) {
            showMessage('Model with this name already added!', 'error');
            return;
        }

        selectedModels.push({
            id: modelCounter++,
            name: name,
            circuit: circuit,
            params: result.params,
            initial_guess: createInitialGuess(result.params),
            description: 'Custom model',
            isCustom: true
        });

        updateModelList();
        showMessage(`Added custom model: ${name}`, 'success');

        document.getElementById('custom-circuit').value = '';
        document.getElementById('custom-model-name').value = '';
        document.getElementById('circuit-preview-container').classList.remove('show-block');
        setCircuitInputStyling(document.getElementById('custom-circuit'), false);

    } catch (error) {
        showMessage('Error validating circuit: ' + error.message, 'error');
    }
}

// Helper function to validate circuit
async function validateCircuit(circuit) {
    const response = await fetch('/api/validate_circuit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuit: circuit })
    });
    return await response.json();
}

// Helper function to create initial guess from parameters
function createInitialGuess(params) {
    const initial_guess = {};
    params.forEach(param => {
        initial_guess[param] = getDefaultParamValue(param);
    });
    return initial_guess;
}

// Remove model
function removeModel(modelId) {
    selectedModels = selectedModels.filter(m => m.id !== modelId);
    updateModelList();
}

// Update model list display
function updateModelList() {
    const listDiv = document.getElementById('model-list');

    if (selectedModels.length === 0) {
        const template = document.getElementById('no-models-template');
        listDiv.innerHTML = '';
        listDiv.appendChild(template.content.cloneNode(true));
        document.getElementById('fit-button').disabled = true;
        return;
    }

    listDiv.innerHTML = '';
    selectedModels.forEach(model => {
        const template = document.getElementById('model-item-template');
        const clone = template.content.cloneNode(true);
        const modelItem = clone.querySelector('.model-item');
        modelItem.id = `model-${model.id}`;

        clone.querySelector('.model-name').textContent = model.name;
        clone.querySelector('.model-circuit-text').textContent = model.circuit;
        clone.querySelector('.model-circuit-diagram').innerHTML = generateCircuitDiagram(model.circuit);

        const header = clone.querySelector('.model-item-header');
        header.addEventListener('click', () => toggleModelCollapse(model.id));

        const actions = clone.querySelector('.model-item-actions');
        actions.addEventListener('click', (e) => e.stopPropagation());

        clone.querySelector('.modify-circuit-button').addEventListener('click', () => modifyCircuitString(model.circuit, model.name));
        clone.querySelector('.remove-model-button').addEventListener('click', () => removeModel(model.id));

        const paramGrid = clone.querySelector('.param-grid');
        const noParamsMsg = clone.querySelector('.no-params-message');

        if (model.params?.length > 0) {
            noParamsMsg.classList.add('hidden-default');
            model.params.forEach(param => {
                const paramTemplate = document.getElementById('param-input-template');
                const paramClone = paramTemplate.content.cloneNode(true);
                const label = paramClone.querySelector('label');
                const input = paramClone.querySelector('input');

                const value = model.initial_guess[param] || getDefaultParamValue(param);
                label.textContent = `${paramPlusUnit(param)}:`;
                label.setAttribute('for', `param-${model.id}-${param}`);
                input.id = `param-${model.id}-${param}`;
                input.value = value;
                input.addEventListener('change', (e) => updateModelParam(model.id, param, e.target.value));

                paramGrid.appendChild(paramClone);
            });
        } else {
            noParamsMsg.classList.remove('hidden-default');
        }

        listDiv.appendChild(clone);
    });

    document.getElementById('fit-button').disabled = false;
}

// Helper function to copy text to clipboard
async function copyToClipboard(text, successMessage) {
    try {
        await navigator.clipboard.writeText(text);
        showMessage(successMessage, 'success');
        return true;
    } catch (error) {
        showMessage('Failed to copy to clipboard', 'error');
        return false;
    }
}

// Modify circuit string
async function modifyCircuitString(circuit, modelName) {
    document.getElementById('custom-circuit').value = circuit;
    document.getElementById('custom-model-name').value = `${modelName} (Modified)`;
    updateCircuitPreview();
    switchTab('fitting');

    const customModelSection = document.getElementById('custom-circuit');
    if (customModelSection) {
        customModelSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => customModelSection.focus(), 500);
    }

    showMessage('Circuit transferred to custom model editor', 'info');
}

// Toggle model collapse
function toggleModelCollapse(modelId) {
    document.getElementById(`model-${modelId}`).classList.toggle('collapsed');
}

// Update model parameter
function updateModelParam(modelId, paramName, value) {
    const model = selectedModels.find(m => m.id === modelId);
    if (model) {
        model.initial_guess[paramName] = parseFloat(value);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    updateSyntheticParams();
    updateModelList();
});

function showMessage(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const template = document.getElementById('toast-template');
    const clone = template.content.cloneNode(true);
    const toast = clone.querySelector('.toast');
    toast.classList.add(`toast-${type}`);

    const icons = { success: '✓', error: 'X', info: 'i' };
    clone.querySelector('.toast-icon').textContent = icons[type] || icons.info;
    clone.querySelector('.toast-content').textContent = message;

    const closeButton = clone.querySelector('.toast-close');
    closeButton.addEventListener('click', function () {
        this.parentElement.remove();
    });

    container.appendChild(clone);
    setTimeout(() => toast.remove(), 5000);
}

function switchDataTab(tab) {
    const uploadSection = document.getElementById('file-upload-section');
    const synthSection = document.getElementById('synthetic-section');
    const tabs = document.querySelectorAll('.sub-tab');

    if (tab === 'upload') {
        uploadSection.classList.add('active');
        synthSection.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
        usingSyntheticData = false;
    } else if (tab === 'synthetic') {
        uploadSection.classList.remove('active');
        synthSection.classList.add('active');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        usingSyntheticData = true;
    }
}

function loadDataFile() {
    const fileInput = document.getElementById('data-file');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            showMessage('Parsing file...', 'info');

            const response = await fetch('/api/parse_data_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: e.target.result,
                    filename: file.name
                })
            });

            const result = await response.json();

            if (result.success) {
                currentData = {
                    frequency: result.frequency,
                    impedance_real: result.impedance_real,
                    impedance_imag: result.impedance_imag
                };
                selectedPointIndices = null;
                plotData(currentData);
                showMessage(`Loaded ${result.num_points} data points`, 'success');

                document.getElementById('data-preview-section').classList.add('show-block');
                document.getElementById('fitting-tab').disabled = false;
                collapseSection('load-data');
            } else {
                showMessage('Error parsing file: ' + result.error, 'error');
            }
        } catch (error) {
            showMessage('Error loading file: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

function updateSyntheticParams() {
    const modelKey = document.getElementById('synth-circuit').value;
    const customCircuitContainer = document.getElementById('synth-custom-circuit-container');
    const previewContainer = document.getElementById('synth-circuit-preview-container');

    if (modelKey === 'custom') {
        customCircuitContainer.classList.add('show-block');
        document.getElementById('synth-params').innerHTML = '';
        previewContainer.classList.remove('show-block');
        return;
    }

    customCircuitContainer.classList.remove('show-block');
    const model = window.circuitModels[modelKey];

    try {
        const diagramHTML = generateCircuitDiagram(model.circuit, true);
        document.getElementById('synth-circuit-preview').innerHTML = diagramHTML;
        previewContainer.classList.add('show-block');
    } catch (error) {
        previewContainer.classList.remove('show-block');
    }

    renderParamInputs('synth-params', model.initial_guess);
}

// Update parameters for custom synthetic circuit
async function updateSyntheticCustomParams(circuit) {
    try {
        const result = await validateCircuit(circuit);
        if (result.valid) {
            renderParamInputs('synth-params', createInitialGuess(result.params));
        }
    } catch (error) {
        console.error('Error validating circuit:', error);
    }
}

// Helper function to render parameter inputs
function renderParamInputs(containerId, params) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const label = document.createElement('label');
    label.textContent = 'Parameters:';
    container.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'param-grid';

    for (const [param, value] of Object.entries(params)) {
        const template = document.getElementById('param-input-template');
        const clone = template.content.cloneNode(true);

        clone.querySelector('label').textContent = `${paramPlusUnit(param)}:`;
        const input = clone.querySelector('input');
        input.id = `synth-${param}`;
        input.value = value;

        grid.appendChild(clone);
    }

    container.appendChild(grid);
}

async function generateData() {
    const modelKey = document.getElementById('synth-circuit').value;
    let circuit, params;

    if (modelKey === 'custom') {
        circuit = document.getElementById('synth-custom-circuit').value.trim();
        if (!circuit) {
            showMessage('Please enter a custom circuit string!', 'error');
            return;
        }

        try {
            const validateResult = await validateCircuit(circuit);
            if (!validateResult.valid) {
                showMessage('Invalid circuit: ' + validateResult.error, 'error');
                return;
            }

            params = {};
            for (const param of validateResult.params) {
                const elem = document.getElementById(`synth-${param}`);
                if (elem) params[param] = parseFloat(elem.value);
            }
        } catch (error) {
            showMessage('Error validating circuit: ' + error.message, 'error');
            return;
        }
    } else {
        const model = window.circuitModels[modelKey];
        circuit = model.circuit;
        params = {};
        for (const param of Object.keys(model.initial_guess)) {
            const elem = document.getElementById(`synth-${param}`);
            if (elem) params[param] = parseFloat(elem.value);
        }
    }

    const freqMin = parseFloat(document.getElementById('freq-min').value);
    const freqMax = parseFloat(document.getElementById('freq-max').value);
    const numPoints = parseInt(document.getElementById('num-points').value);
    const noiseLevel = parseFloat(document.getElementById('noise-level').value);

    try {
        showMessage('Generating synthetic data...', 'info');

        const response = await fetch('/api/generate_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                circuit: circuit,
                params: params,
                freq_min: freqMin,
                freq_max: freqMax,
                num_points: numPoints,
                noise_level: noiseLevel
            })
        });

        const result = await response.json();

        if (result.success) {
            currentData = result;
            selectedPointIndices = null;
            plotData(result);
            showMessage('Data generated successfully!', 'success');

            document.getElementById('data-preview-section').classList.add('show-block');
            document.getElementById('fitting-tab').disabled = false;
            collapseSection('load-data');
        } else {
            showMessage('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('Error generating data: ' + error.message, 'error');
    }
}

async function downloadSyntheticCSV() {
    const modelKey = document.getElementById('synth-circuit').value;
    let circuit, params;

    if (modelKey === 'custom') {
        circuit = document.getElementById('synth-custom-circuit').value.trim();
        if (!circuit) {
            showMessage('Please enter a custom circuit string!', 'error');
            return;
        }

        try {
            const validateResult = await validateCircuit(circuit);
            if (!validateResult.valid) {
                showMessage('Invalid circuit: ' + validateResult.error, 'error');
                return;
            }

            params = {};
            for (const param of validateResult.params) {
                const elem = document.getElementById(`synth-${param}`);
                if (elem) params[param] = parseFloat(elem.value);
            }
        } catch (error) {
            showMessage('Error validating circuit: ' + error.message, 'error');
            return;
        }
    } else {
        const model = window.circuitModels[modelKey];
        circuit = model.circuit;
        params = {};
        for (const param of Object.keys(model.initial_guess)) {
            const elem = document.getElementById(`synth-${param}`);
            if (elem) params[param] = parseFloat(elem.value);
        }
    }

    const freqMin = parseFloat(document.getElementById('freq-min').value);
    const freqMax = parseFloat(document.getElementById('freq-max').value);
    const numPoints = parseInt(document.getElementById('num-points').value);
    const noiseLevel = parseFloat(document.getElementById('noise-level').value);

    try {
        showMessage('Preparing CSV download...', 'info');

        const response = await fetch('/api/export_synthetic_csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                circuit: circuit,
                params: params,
                freq_min: freqMin,
                freq_max: freqMax,
                num_points: numPoints,
                noise_level: noiseLevel
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.classList.add('hidden-default');
            a.href = url;
            a.download = 'synthetic_eis_data.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showMessage('CSV file downloaded successfully!', 'success');
        } else {
            const result = await response.json();
            showMessage('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('Error downloading CSV: ' + error.message, 'error');
    }
}

// Helper function to collapse a section
function collapseSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-icon`);
    if (content && icon && !content.classList.contains('collapsed')) {
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
    }
}

// Update selection info display
function updateSelectionInfo(selectedCount, totalCount) {
    const infoDiv = document.getElementById('selection-info');
    if (!infoDiv) return;

    infoDiv.innerHTML = '';
    const strong = document.createElement('strong');

    if (selectedCount > 0) {
        strong.textContent = 'Selected points:';
        const info = document.createTextNode(` ${selectedCount} of ${totalCount} (${(selectedCount / totalCount * 100).toFixed(1)}%)`);
        infoDiv.appendChild(strong);
        infoDiv.appendChild(info);
        infoDiv.className = 'text-success show-block';
    } else {
        strong.textContent = 'Selection:';
        const info = document.createTextNode(` Using all ${totalCount} points`);
        infoDiv.appendChild(strong);
        infoDiv.appendChild(info);
        infoDiv.className = 'text-muted-secondary show-block';
    }
}

// Clear point selection
function clearSelection() {
    selectedPointIndices = null;
    const nyquistPlot = document.getElementById('nyquist-plot');
    if (nyquistPlot?.data) {
        Plotly.restyle('nyquist-plot', { 'selectedpoints': [null] });
    }
    if (currentData) {
        updateSelectionInfo(0, currentData.frequency.length);
    }
    showMessage('Selection cleared, using all points', 'info');
}

async function fitAllModels() {
    if (!currentData) {
        showMessage('Please load or generate data first!', 'error');
        return;
    }

    if (selectedModels.length === 0) {
        showMessage('Please add at least one model!', 'error');
        return;
    }

    let dataToFit = { ...currentData };

    if (selectedPointIndices?.length > 0) {
        dataToFit = {
            frequency: selectedPointIndices.map(i => currentData.frequency[i]),
            impedance_real: selectedPointIndices.map(i => currentData.impedance_real[i]),
            impedance_imag: selectedPointIndices.map(i => currentData.impedance_imag[i])
        };
    }

    const modelsToFit = selectedModels.map(model => ({
        name: model.name,
        circuit: model.circuit,
        param_names: model.params,
        initial_guess: { ...model.initial_guess }
    }));

    try {
        const pointsMsg = selectedPointIndices ? `${selectedPointIndices.length} selected points` : 'all points';
        showMessage(`Fitting models using ${pointsMsg}... This may take a few seconds.`, 'info');
        document.getElementById('fit-button').disabled = true;

        const response = await fetch('/api/fit_models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                frequency: dataToFit.frequency,
                impedance_real: dataToFit.impedance_real,
                impedance_imag: dataToFit.impedance_imag,
                models: modelsToFit
            })
        });

        const result = await response.json();

        if (result.success) {
            showMessage(`Fitting complete! Best model: ${modelsToFit[result.best_model_index].name} (R² = ${result.best_r_squared.toFixed(6)})`, 'success');
            displayMultipleResults(result);
            plotAllFits(result);

            document.getElementById('results-tab').disabled = false;
            switchTab('results');
        } else {
            showMessage('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('Error fitting models: ' + error.message, 'error');
    } finally {
        document.getElementById('fit-button').disabled = false;
    }
}

function displayMultipleResults(result) {
    const resultsContent = document.getElementById('results-content');

    const resultsWithIndices = result.results.map((res, idx) => ({
        ...res,
        originalIndex: idx
    }));

    resultsWithIndices.sort((a, b) => {
        if (!a.success && !b.success) return 0;
        if (!a.success) return 1;
        if (!b.success) return -1;
        return b.r_squared - a.r_squared;
    });

    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';

    resultsWithIndices.forEach((modelResult) => {
        const isBest = modelResult.originalIndex === result.best_model_index && modelResult.success;

        const template = document.getElementById('result-card-template');
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.result-card-compact');

        if (modelResult.success) {
            if (isBest) card.classList.add('best');
        } else {
            card.classList.add('failed');
        }

        clone.querySelector('.result-model-name').textContent = modelResult.model_name;

        if (isBest) clone.querySelector('.badge-best').classList.add('show-inline');
        if (!modelResult.success) clone.querySelector('.badge-failed').classList.add('show-inline');

        clone.querySelector('.result-circuit-text').textContent = modelResult.circuit;
        clone.querySelector('.result-circuit-diagram').innerHTML = generateCircuitDiagram(modelResult.circuit);

        if (modelResult.success) {
            clone.querySelector('.r-squared').textContent = `R² = ${modelResult.r_squared.toFixed(6)}`;

            const paramTable = clone.querySelector('.param-table');
            for (const [param, value] of Object.entries(modelResult.fitted_params)) {
                const rowTemplate = document.getElementById('result-param-row-template');
                const rowClone = rowTemplate.content.cloneNode(true);
                rowClone.querySelector('.param-name').textContent = `${paramPlusUnit(param)}:`;
                rowClone.querySelector('.param-value').textContent = value.toExponential(3);
                paramTable.appendChild(rowClone);
            }

            clone.querySelector('.copy-results-button').addEventListener('click', () => {
                copyFittedParameters(modelResult.fitted_params, modelResult.model_name, modelResult.r_squared);
            });

            clone.querySelector('.result-error').classList.add('hidden-default');
        } else {
            clone.querySelector('.r-squared').classList.add('hidden-default');
            clone.querySelector('.param-table').classList.add('hidden-default');
            clone.querySelector('.copy-results-button').classList.add('hidden-default');

            const errorElem = clone.querySelector('.result-error');
            errorElem.textContent = `Error: ${modelResult.error}`;
            errorElem.classList.add('show-block');
        }

        resultsGrid.appendChild(clone);
    });

    resultsContent.innerHTML = '';
    resultsContent.appendChild(resultsGrid);
}

// Copy fitted parameters to clipboard
async function copyFittedParameters(fittedParams, modelName, rSquared) {
    try {
        let copyText = `Model: ${modelName}\nR² = ${rSquared.toFixed(6)}\n\nFitted Parameters:\n`;
        for (const [param, value] of Object.entries(fittedParams)) {
            copyText += `${paramPlusUnit(param)}: ${value.toExponential(6)}\n`;
        }
        await copyToClipboard(copyText, `${modelName}'s parameters copied to clipboard`);
    } catch (error) {
        showMessage('Failed to copy parameters', 'error');
    }
}

function plotData(data) {
    const nyquistTrace = {
        x: data.impedance_real,
        y: data.impedance_imag.map(v => -v),
        mode: 'markers',
        name: 'Experimental',
        marker: { size: 8, color: 'rgb(102, 126, 234)' },
        selected: { marker: { color: 'rgb(239, 85, 59)', size: 10 } },
        unselected: { marker: { opacity: 0.4 } }
    };

    const nyquistLayout = {
        title: 'Nyquist plot',
        xaxis: { title: 'Z\' (Ω)', scaleanchor: 'y', scaleratio: 1 },
        yaxis: { title: '-Z\'\' (Ω)' },
        hovermode: 'closest',
        height: 500,
        dragmode: 'select'
    };

    Plotly.newPlot('nyquist-plot', [nyquistTrace], nyquistLayout);

    const nyquistPlot = document.getElementById('nyquist-plot');
    nyquistPlot.on('plotly_selected', function (eventData) {
        if (eventData?.points?.length > 0) {
            selectedPointIndices = eventData.points.map(pt => pt.pointIndex).sort((a, b) => a - b);
            updateSelectionInfo(selectedPointIndices.length, data.frequency.length);
            showMessage(`Selected ${selectedPointIndices.length} points for fitting`, 'info');
        }
    });

    nyquistPlot.on('plotly_deselect', function () {
        selectedPointIndices = null;
        updateSelectionInfo(0, data.frequency.length);
    });

    const impedance = calculateMagnitude(data.impedance_real, data.impedance_imag);
    const phase = calculatePhase(data.impedance_real, data.impedance_imag);

    const magnitudeTrace = {
        x: data.frequency,
        y: impedance,
        mode: 'markers',
        name: '|Z|',
        marker: { size: 8, color: 'rgb(102, 126, 234)' },
        xaxis: 'x',
        yaxis: 'y'
    };

    const phaseTrace = {
        x: data.frequency,
        y: phase,
        mode: 'markers',
        name: 'Phase',
        marker: { size: 8, color: 'rgb(118, 75, 162)' },
        xaxis: 'x2',
        yaxis: 'y2'
    };

    const bodeLayout = {
        title: 'Bode plot',
        grid: { rows: 2, columns: 1, pattern: 'independent' },
        xaxis: { type: 'log', anchor: 'y' },
        yaxis: { title: '|Z| (Ω)', type: 'log' },
        xaxis2: { title: 'Frequency (Hz)', type: 'log', anchor: 'y2' },
        yaxis2: { title: 'Phase (°)' },
        hovermode: 'closest',
        height: 550,
        showlegend: true
    };

    Plotly.newPlot('magnitude-plot', [magnitudeTrace, phaseTrace], bodeLayout);
    updateSelectionInfo(0, data.frequency.length);
}

function plotAllFits(result) {
    const colors = ['rgb(239, 85, 59)', 'rgb(46, 204, 113)', 'rgb(52, 152, 219)', 'rgb(155, 89, 182)', 'rgb(241, 196, 15)', 'rgb(230, 126, 34)'];

    const nyquistTraces = [{
        x: currentData.impedance_real,
        y: currentData.impedance_imag.map(v => -v),
        mode: 'markers',
        name: 'Experimental',
        marker: { size: 8, color: 'rgb(102, 126, 234)' }
    }];

    result.results.forEach((modelResult, idx) => {
        if (modelResult.success) {
            const isBest = idx === result.best_model_index;
            nyquistTraces.push({
                x: modelResult.fitted_real,
                y: modelResult.fitted_imag.map(v => -v),
                mode: 'lines',
                name: modelResult.model_name + (isBest ? ' ★' : ''),
                line: {
                    color: colors[idx % colors.length],
                    width: isBest ? 3 : 2,
                    dash: isBest ? 'solid' : 'dot'
                }
            });
        }
    });

    const nyquistLayout = {
        title: 'Nyquist plot',
        xaxis: { title: 'Z\' (Ω)', scaleanchor: 'y', scaleratio: 1 },
        yaxis: { title: '-Z\'\' (Ω)' },
        hovermode: 'closest',
        height: 500
    };

    Plotly.newPlot('fitted-nyquist-plot', nyquistTraces, nyquistLayout);

    const impedanceExp = calculateMagnitude(currentData.impedance_real, currentData.impedance_imag);
    const phaseExp = calculatePhase(currentData.impedance_real, currentData.impedance_imag);

    const magnitudeTraces = [{
        x: currentData.frequency,
        y: impedanceExp,
        mode: 'markers',
        name: '|Z| exp',
        marker: { size: 8, color: 'rgb(102, 126, 234)' },
        xaxis: 'x',
        yaxis: 'y'
    }];

    const phaseTraces = [{
        x: currentData.frequency,
        y: phaseExp,
        mode: 'markers',
        name: 'Phase exp',
        marker: { size: 8, color: 'rgb(118, 75, 162)' },
        xaxis: 'x2',
        yaxis: 'y2'
    }];

    result.results.forEach((modelResult, idx) => {
        if (modelResult.success) {
            const isBest = idx === result.best_model_index;
            const color = colors[idx % colors.length];
            const impedanceFit = calculateMagnitude(modelResult.fitted_real, modelResult.fitted_imag);
            const phaseFit = calculatePhase(modelResult.fitted_real, modelResult.fitted_imag);

            phaseTraces.push({
                x: modelResult.frequency,
                y: phaseFit,
                mode: 'lines',
                name: modelResult.model_name + (isBest ? ' ★' : ''),
                line: { color: color, width: isBest ? 3 : 2, dash: 'dot' },
                xaxis: 'x2',
                yaxis: 'y2',
                showlegend: true
            });

            magnitudeTraces.push({
                x: modelResult.frequency,
                y: impedanceFit,
                mode: 'lines',
                name: modelResult.model_name + (isBest ? ' ★' : ''),
                line: { color: color, width: isBest ? 3 : 2 },
                xaxis: 'x',
                yaxis: 'y',
                showlegend: true
            });
        }
    });

    const allBodeTraces = [...magnitudeTraces, ...phaseTraces];

    const bodeLayout = {
        title: 'Bode plot',
        grid: { rows: 2, columns: 1, pattern: 'independent' },
        xaxis: { type: 'log', anchor: 'y' },
        yaxis: { title: '|Z| (Ω)', type: 'log' },
        xaxis2: { title: 'Frequency (Hz)', type: 'log', anchor: 'y2' },
        yaxis2: { title: 'Phase (°)' },
        hovermode: 'closest',
        height: 550,
        showlegend: true
    };

    Plotly.newPlot('fitted-bode-plot', allBodeTraces, bodeLayout);
}
