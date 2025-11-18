"""
Circuit validation utilities.
"""

import re

from ..core.parsing import parse_circuit


def validate_circuit_string(circuit_string):
    """Validate a circuit string and extract parameter information.

    Args:
        circuit_string (str): Circuit definition string

    Returns:
        dict: Validation result with keys:
            - valid (bool): Whether the circuit is valid
            - params (list): List of parameter names (if valid)
            - message (str): Success or error message
            - error (str): Error message (if invalid)
    """
    try:
        # Try to parse to validate syntax
        parse_circuit(circuit_string)

        # Extract element names from circuit string
        elements = re.findall(r"[RCLWQSO]\d+", circuit_string)

        # Extract parameter names
        param_names = []
        for elem in sorted(set(elements)):
            if elem[0] == "Q":
                # CPE needs two UI parameters but one internal parameter
                param_names.append(elem)
                param_names.append(f"{elem}_n")
            elif elem[0] in ["S", "O"]:
                # Warburg Short/Open need two parameters
                param_names.append(elem)
                param_names.append(f"{elem}_B")
            else:
                param_names.append(elem)

        return {
            "valid": True,
            "params": param_names,
            "message": f"Valid circuit! Found parameters: {', '.join(param_names)}",
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Invalid circuit: {str(e)}",
        }


def validate_frequency_range(freq_min: float, freq_max: float, num_points: int) -> None:
    """Validate frequency range parameters."""
    if freq_min <= 0:
        raise ValueError("freq_min must be positive")
    if freq_max <= freq_min:
        raise ValueError("freq_max must be greater than freq_min")
    if num_points < 2:
        raise ValueError("num_points must be at least 2")
