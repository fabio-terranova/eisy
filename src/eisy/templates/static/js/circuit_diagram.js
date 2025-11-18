// Cache for parsed circuits
const circuitCache = new Map();

// Map element types to SVG file paths
const ELEMENT_SVG_PATHS = {
    'R': '/static/svg/resistor.svg',
    'C': '/static/svg/capacitor.svg',
    'L': '/static/svg/inductor.svg',
    'W': '/static/svg/warburg.svg',
    'S': '/static/svg/warburg.svg', // To be replaced
    'O': '/static/svg/warburg.svg', // To be replaced
    'Q': '/static/svg/cpe.svg'
};

// Parse circuit string to AST (client-side parser)
function parseCircuitToAST(circuit) {
    // Check cache first
    if (circuitCache.has(circuit)) {
        return circuitCache.get(circuit);
    }

    circuit = circuit.trim();

    if (!circuit) {
        throw new Error('Empty circuit string');
    }

    try {
        const ast = parseCircuitInternal(circuit);
        circuitCache.set(circuit, ast);
        return ast;
    } catch (error) {
        throw new Error(`Circuit parsing failed: ${error.message}`);
    }
}

function parseCircuitInternal(circuit) {
    // Handle parentheses
    if (circuit.includes('(')) {
        return parseWithParentheses(circuit);
    }

    // Check for series operator
    if (circuit.includes('-')) {
        const parts = splitByOperator(circuit, '-');
        return {
            type: 'series',
            children: parts.map(p => parseCircuitInternal(p))
        };
    }

    // Check for parallel operator
    if (circuit.includes('|')) {
        const parts = splitByOperator(circuit, '|');
        return {
            type: 'parallel',
            children: parts.map(p => parseCircuitInternal(p))
        };
    }

    // Base case: single element
    const match = circuit.match(/^([RCLWQSO])(\d+)$/);
    if (match) {
        return {
            type: 'element',
            kind: match[1],
            number: match[2],
            name: circuit
        };
    }

    throw new Error(`Invalid element: "${circuit}". Expected format: R1, C2, Q3, S4, O5, etc.`);
}

function splitByOperator(str, operator) {
    const parts = [];
    let current = [];
    let depth = 0;

    for (const char of str) {
        if (char === '(') {
            depth++;
            current.push(char);
        } else if (char === ')') {
            depth--;
            current.push(char);
        } else if (char === operator && depth === 0) {
            parts.push(current.join('').trim());
            current = [];
        } else {
            current.push(char);
        }
    }

    if (current.length > 0) {
        parts.push(current.join('').trim());
    }

    return parts;
}

function parseWithParentheses(str) {
    // Find main operator outside parentheses
    let depth = 0;
    let hasSeriesOutside = false;
    let hasParallelOutside = false;

    for (const char of str) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (depth === 0) {
            if (char === '-') hasSeriesOutside = true;
            if (char === '|') hasParallelOutside = true;
        }
    }

    if (hasSeriesOutside) {
        const parts = splitByOperator(str, '-');
        return {
            type: 'series',
            children: parts.map(p => parseCircuitToAST(p))
        };
    }

    if (hasParallelOutside) {
        const parts = splitByOperator(str, '|');
        return {
            type: 'parallel',
            children: parts.map(p => parseCircuitToAST(p))
        };
    }

    // Entire string wrapped in parentheses
    if (str.startsWith('(') && str.endsWith(')')) {
        return parseCircuitToAST(str.slice(1, -1));
    }

    // Single element
    return parseCircuitToAST(str);
}

// Render circuit diagram from AST using SVG symbols
function renderCircuitFromAST(ast, options = {}) {
    const cfg = {
        symbolUrlMap: options.symbolUrlMap || ELEMENT_SVG_PATHS,
        w: options.symbolWidth || 56,
        h: options.symbolHeight || 56,
        seriesSpacing: options.seriesSpacing || 28,
        parallelSpacing: options.parallelSpacing || 20,
        wireColor: options.wireColor || '#667eea',
        wireWidth: options.wireWidth || 2,
        showLabels: options.showLabels !== false
    };

    const NS = "http://www.w3.org/2000/svg";

    function measure(node) {
        if (node.type === "element") {
            return { w: cfg.w, h: cfg.h, node };
        }
        if (node.type === "series") {
            const kids = node.children.map(measure);
            return {
                node,
                children: kids,
                w: kids.reduce((s, k) => s + k.w, 0) + (kids.length - 1) * cfg.seriesSpacing,
                h: Math.max(...kids.map(k => k.h))
            };
        }
        if (node.type === "parallel") {
            const kids = node.children.map(measure);
            return {
                node,
                children: kids,
                w: Math.max(...kids.map(k => k.w)),
                h: kids.reduce((s, k) => s + k.h, 0) + (kids.length - 1) * cfg.parallelSpacing
            };
        }
    }

    function place(meas) {
        if (meas.node.type === "element") {
            const g = document.createElementNS(NS, "g");
            const img = document.createElementNS(NS, "image");
            const url = cfg.symbolUrlMap[meas.node.kind];
            img.setAttribute("href", url);
            img.setAttribute("width", cfg.w);
            img.setAttribute("height", cfg.h);
            img.setAttribute("x", 0);
            img.setAttribute("y", 0);
            g.appendChild(img);

            // Add label if enabled
            if (cfg.showLabels) {
                const text = document.createElementNS(NS, "text");
                text.setAttribute("x", cfg.w / 2);
                text.setAttribute("y", cfg.h + 12);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("font-size", "10");
                text.setAttribute("fill", "#495057");
                text.textContent = meas.node.name;
                g.appendChild(text);
            }

            return { ...meas, g, cx: cfg.w / 2, cy: cfg.h / 2 };
        }

        const g = document.createElementNS(NS, "g");

        if (meas.node.type === "series") {
            let x = 0;
            const placed = meas.children.map(ch => {
                const p = place(ch);
                const y = (meas.h - p.h) / 2;

                const wrapper = document.createElementNS(NS, "g");
                wrapper.setAttribute("transform", `translate(${x},${y})`);
                wrapper.appendChild(p.g);
                g.appendChild(wrapper);

                const cx = x + p.cx;
                const cy = y + p.cy;
                const result = { p, cx, cy, right: x + p.w };
                x += p.w + cfg.seriesSpacing;
                return result;
            });

            // Draw wires between series elements
            for (let i = 0; i < placed.length - 1; i++) {
                const a = placed[i], b = placed[i + 1];
                const line = document.createElementNS(NS, "line");
                line.setAttribute("x1", a.right);
                line.setAttribute("y1", a.cy);
                line.setAttribute("x2", b.cx - b.p.w / 2);
                line.setAttribute("y2", b.cy);
                line.setAttribute("stroke", cfg.wireColor);
                line.setAttribute("stroke-width", cfg.wireWidth);
                g.appendChild(line);
            }

            return { ...meas, g, cx: meas.w / 2, cy: meas.h / 2 };
        }

        if (meas.node.type === "parallel") {
            let y = 0;
            const placed = meas.children.map(ch => {
                const p = place(ch);
                const x = (meas.w - p.w) / 2;
                const grp = document.createElementNS(NS, "g");
                grp.setAttribute("transform", `translate(${x},${y})`);
                grp.appendChild(p.g);
                g.appendChild(grp);

                const cx = x + p.cx;
                const cy = y + p.cy;
                const result = { p, cx, cy };
                y += p.h + cfg.parallelSpacing;
                return result;
            });

            // Draw bus lines
            const leftX = 0;
            const rightX = meas.w;
            const topY = placed[0].cy;
            const bottomY = placed[placed.length - 1].cy;

            // Vertical bus lines at left and right
            const leftBus = document.createElementNS(NS, "line");
            leftBus.setAttribute("x1", leftX);
            leftBus.setAttribute("x2", leftX);
            leftBus.setAttribute("y1", topY);
            leftBus.setAttribute("y2", bottomY);
            leftBus.setAttribute("stroke", cfg.wireColor);
            leftBus.setAttribute("stroke-width", cfg.wireWidth);
            g.appendChild(leftBus);

            const rightBus = document.createElementNS(NS, "line");
            rightBus.setAttribute("x1", rightX);
            rightBus.setAttribute("x2", rightX);
            rightBus.setAttribute("y1", topY);
            rightBus.setAttribute("y2", bottomY);
            rightBus.setAttribute("stroke", cfg.wireColor);
            rightBus.setAttribute("stroke-width", cfg.wireWidth);
            g.appendChild(rightBus);

            // Connect each branch to buses
            placed.forEach(b => {
                // Left connection
                const leftLine = document.createElementNS(NS, "line");
                leftLine.setAttribute("x1", leftX);
                leftLine.setAttribute("x2", b.cx - b.p.w / 2);
                leftLine.setAttribute("y1", b.cy);
                leftLine.setAttribute("y2", b.cy);
                leftLine.setAttribute("stroke", cfg.wireColor);
                leftLine.setAttribute("stroke-width", cfg.wireWidth);
                g.appendChild(leftLine);

                // Right connection
                const rightLine = document.createElementNS(NS, "line");
                rightLine.setAttribute("x1", b.cx + b.p.w / 2);
                rightLine.setAttribute("x2", rightX);
                rightLine.setAttribute("y1", b.cy);
                rightLine.setAttribute("y2", b.cy);
                rightLine.setAttribute("stroke", cfg.wireColor);
                rightLine.setAttribute("stroke-width", cfg.wireWidth);
                g.appendChild(rightLine);
            });

            return { ...meas, g, cx: meas.w / 2, cy: meas.h / 2 };
        }
    }

    const meas = measure(ast);
    const placed = place(meas);

    // Account for labels height if shown
    const labelHeight = cfg.showLabels ? 14 : 0;
    const totalHeight = meas.h + labelHeight + 16;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", meas.w + 16);
    svg.setAttribute("height", totalHeight);
    svg.setAttribute("viewBox", `0 0 ${meas.w + 16} ${totalHeight}`);

    const root = document.createElementNS(NS, "g");
    root.setAttribute("transform", "translate(8,8)");
    root.appendChild(placed.g);

    svg.appendChild(root);
    return svg;
}

// Clear cache when needed
function clearCircuitCache() {
    circuitCache.clear();
}

// Main circuit diagram generator (wrapper for backwards compatibility)
function generateCircuitDiagram(circuit, useAST = true) {
    if (!circuit) return '';

    if (useAST) {
        try {
            const ast = parseCircuitToAST(circuit);
            const svg = renderCircuitFromAST(ast, {
                symbolWidth: 40,
                symbolHeight: 40,
                seriesSpacing: 20,
                parallelSpacing: 16,
                showLabels: true
            });
            return svg.outerHTML;
        } catch (error) {
            console.error('Error rendering circuit diagram:', error);
            // Fallback to simple rendering
        }
    }

    // Simple fallback: just show elements in a row
    const elementRegex = /([RCLWQSO])(\d+)/g;
    const elements = [];
    let match;
    while ((match = elementRegex.exec(circuit)) !== null) {
        elements.push({ type: match[1], number: match[2] });
    }

    if (elements.length === 0) return '';

    let html = `<div style="display: flex; gap: 10px; margin-top: 5px; align-items: center;">`;
    elements.forEach((el) => {
        const svgPath = ELEMENT_SVG_PATHS[el.type];
        html += `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <img src="${svgPath}" alt="${el.type}" style="width: 40px; height: 40px;" />
                <span style="font-size: 9px; color: #495057; margin-top: 2px;">${el.type}${el.number}</span>
            </div>
        `;
    });
    html += '</div>';
    return html;
}
