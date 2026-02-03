# EISy - Electrochemical Impedance Spectroscopy made easy

A Python library and web application for analyzing Electrochemical Impedance Spectroscopy (EIS) data.

<img width="2766" height="2327" alt="image" src="https://github.com/user-attachments/assets/1b99fbf2-b8bf-4d9e-9a51-76f2b88dcbd3" />

## Installation

Install EISy using pip:

```bash
git clone https://github.com/fabio-terranova/eisy.git
cd eisy
pip install .
```

For development installation:

```bash
git clone https://github.com/fabio-terranova/eisy.git
cd eisy
pip install -e .
```

## Quick start

### Using the Python library

```python
import numpy as np

from eisy.core.parsing import parse_circuit
from eisy.data.utils import nyquist_plot

# Parse a circuit
circuit = parse_circuit("R1-(R2-W1)|Q1")
# Define parameters
params = {
    "R1": 100,
    "R2": 200,
    "W1": 150,
    "Q1": (1e-6, 0.9),
}

# Generate synthetic data
freq = np.logspace(1, 5, num=50)
Z = np.array([circuit.impedance(f, params) for f in freq])

# Fit the circuit to data
fitted_params, r_squared = circuit.fit(freq, Z, initial_guess=params)
print(f"R² = {r_squared}")
print(f"Fitted parameters: {fitted_params}")

# Plot results
nyquist_plot(Z, label="Experimental")
```

### Using the web interface

Launch the web application:

```bash
eisy-web
```

This will start a local server at `http://127.0.0.1:5000`. Open this URL in your browser to access the interactive interface.

#### Web interface options

```bash
# Run on a different port
eisy-web --port=8080

# Make accessible from other machines
eisy-web --host=0.0.0.0

# Enable debug mode
eisy-web --debug
```

Alternatively, you can run the web interface programmatically:

```python
import eisy

# Start web server
eisy.run_web_app(host='127.0.0.1', port=5000, debug=False)
```

## Circuit notation

EISy uses an intuitive string notation for defining equivalent circuits:

- **Series**: Use `-` to connect elements in series
  - Example: `R1-R2-C1` (resistors and capacitor in series)

- **Parallel**: Use `|` to connect elements in parallel
  - Example: `R1|C1` (resistor and capacitor in parallel)

- **Grouping**: Use parentheses to group elements
  - Example: `R1|(R2-C1)` (R1 in parallel with series R2-C1)

### Supported circuit elements

- **R** - Resistor: `R1`, `R2`, etc.
- **C** - Capacitor: `C1`, `C2`, etc.
- **L** - Inductor: `L1`, `L2`, etc.
- **W** - Warburg (semi-infinite diffusion): `W1`, `W2`, etc.
- **S** - Warburg Short (transmissive boundary): `S1`, `S2`, etc.
  - Short Warburg requires tuple parameters: `(Aw, B)` where Aw > 0 and B > 0
- **O** - Warburg Open (reflective boundary): `O1`, `O2`, etc.
  - Open Warburg requires tuple parameters: `(Aw, B)` where Aw > 0 and B > 0
- **Q** - Constant Phase Element (CPE): `Q1`, `Q2`, etc.
  - CPE requires tuple parameters: `(Q, n)` where 0 < n ≤ 1

### Example circuits

```python
# Simple Randles circuit
circuit = "R1-R2|Q1"

# Randles with Warburg diffusion
circuit = "R1-(R2-W1)|Q1"

# Randles with Warburg with transmissive boundary
circuit = "R1-(R2-S1)|Q1"

# Multiple time constants
circuit = "R1-R2|C1-R3|C2"
```

## Examples

See the `examples/` directory for Jupyter notebooks demonstrating various features of EISy.
