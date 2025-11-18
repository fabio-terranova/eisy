"""
Synthetic data generation utilities
"""

import numpy as np

from ..core.parsing import parse_circuit


def generate_synthetic_data(
    circuit_string, params, freq_min=1, freq_max=1e5, num_points=50, noise_level=0.05
):
    """Generate synthetic impedance data for a given circuit.

    Args:
        circuit_string (str): Circuit definition string
        params (dict): Dictionary with parameters (CPE params should be tuples)
        freq_min (float): Minimum frequency
        freq_max (float): Maximum frequency
        num_points (int): Number of frequency points
        noise_level (float): Relative noise level

    Returns:
        tuple: (frequency array, noisy impedance, true impedance)
    """
    freq = np.logspace(np.log10(freq_min), np.log10(freq_max), num=num_points)

    # Parse circuit and compute impedance
    circuit = parse_circuit(circuit_string)
    Z = np.array([circuit.impedance(f, params) for f in freq])

    # Add noise
    if noise_level > 0:
        noise = (
            noise_level
            * np.abs(Z)
            * (np.random.rand(len(freq)) + 1j * np.random.rand(len(freq)))
        )
        Z_noisy = Z + noise
    else:
        Z_noisy = Z

    return freq, Z_noisy, Z
