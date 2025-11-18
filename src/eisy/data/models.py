"""
Predefined circuit models for EIS fitting.
"""

# Predefined circuit models
CIRCUIT_MODELS = {
    "Randles": {
        "circuit": "R1-(R2-W1)|C1",
        "description": "Randles circuit",
        "params": ["R1", "R2", "W1", "C1"],
        "initial_guess": {"R1": 100, "R2": 1000, "W1": 500, "C1": 1e-6},
    },
    "Randles w/ CPE": {
        "circuit": "R1-(R2-W1)|Q1",
        "description": "Randles circuit with CPE as the capacitive element",
        "params": ["R1", "R2", "W1", "Q1", "Q1_n"],
        "initial_guess": {"R1": 100, "R2": 1000, "W1": 500, "Q1": 1e-6, "Q1_n": 0.9},
    },
    "RC series": {
        "circuit": "R1-C1",
        "description": "Resistor and capacitor in series",
        "params": ["R1", "C1"],
        "initial_guess": {"R1": 1000, "C1": 1e-6},
    },
    "RC parallel": {
        "circuit": "R1|C1",
        "description": "Resistor and capacitor in parallel",
        "params": ["R1", "C1"],
        "initial_guess": {"R1": 1000, "C1": 1e-6},
    },
    "Double RC": {
        "circuit": "R1-(R2|C1)-(R3|C2)",
        "description": "Two RC parallel elements in series with a resistance",
        "params": ["R1", "R2", "C1", "R3", "C2"],
        "initial_guess": {"R1": 100, "R2": 500, "C1": 1e-6, "R3": 1000, "C2": 1e-7},
    },
    "Simple Randles": {
        "circuit": "R1-(R2|C1)",
        "description": "Simplified Randles circuit without Warburg element",
        "params": ["R1", "R2", "C1"],
        "initial_guess": {"R1": 100, "R2": 1000, "C1": 1e-6},
    },
}
