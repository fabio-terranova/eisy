import numpy as np
from scipy.optimize import curve_fit

from .elements import CPE, Capacitor, CircuitElement, Inductor, Resistor, Warburg


class CircuitNode:
    def impedance(self, frequency: float, params) -> complex:
        raise NotImplementedError("Subclasses should implement this method.")

    def fit(self, freq, Z_exp, params, eps=1e-12) -> tuple:
        # Prepare a flattened initial guess p0 and a structure map to reconstruct nested params
        keys = sorted(params.keys())
        p0 = []
        lower_bounds = []
        upper_bounds = []
        structure = []  # list of tuples (key, length)
        for key in keys:
            val = params[key]
            if isinstance(val, (list, tuple, np.ndarray)):
                length = len(val)
                p0.extend(list(val))
                if key.startswith("Q"):  # CPE parameter
                    lower_bounds.extend([eps, eps])  # C_n: C > 0, n > 0
                    upper_bounds.extend([np.inf, 1.0])  # n <= 1
                else:
                    lower_bounds.extend([eps] * length)  # all other params > 0
                    upper_bounds.extend([np.inf] * length)
                structure.append((key, length))
            else:
                p0.append(val)
                lower_bounds.append(eps)  # all other params > 0
                upper_bounds.append(np.inf)
                structure.append((key, 1))

        def model_wrapper(frequency, *param_values):
            # Rebuild param dict according to the original nested structure
            param_values = list(param_values)
            param_dict = {}
            idx = 0
            for key, length in structure:
                if length == 1:
                    param_dict[key] = param_values[idx]
                    idx += 1
                else:
                    param_dict[key] = tuple(param_values[idx : idx + length])
                    idx += length
            Z_model = self.impedance(frequency, param_dict)
            return np.concatenate((np.real(Z_model), np.imag(Z_model)))

        Z_real = np.real(Z_exp)
        Z_imag = np.imag(Z_exp)
        Z_combined = np.concatenate((Z_real, Z_imag))

        # enforce positivity: set lower bounds to small positive epsilon, upper to +inf
        popt, _ = curve_fit(
            model_wrapper, freq, Z_combined, p0=p0, bounds=(lower_bounds, upper_bounds)
        )
        # Calculate R^2
        Z_fit_combined = model_wrapper(freq, *popt)
        residuals = Z_combined - Z_fit_combined
        ss_res = np.sum(residuals**2)
        ss_tot = np.sum((Z_combined - np.mean(Z_combined)) ** 2)
        r_squared = 1 - (ss_res / ss_tot)

        # Update params with fitted values, reconstructing nested structures
        idx = 0
        for key, length in structure:
            if length == 1:
                params[key] = popt[idx]
                idx += 1
            else:
                params[key] = tuple(popt[idx : idx + length])
                idx += length

        return params, r_squared


class ElementNode(CircuitNode):
    def __init__(self, element: CircuitElement):
        self.element = element

    def impedance(self, frequency: float, params) -> complex:
        return self.element.impedance(frequency, params[self.element.__str__()])

    def __str__(self):
        return str(self.element)

    def to_dict(self) -> dict:
        return {"type": "element", "element": str(self.element)}


class SeriesNode(CircuitNode):
    def __init__(self, children):
        self.children = children

    def impedance(self, frequency: float, params) -> complex:
        total_impedance = sum(
            child.impedance(frequency, params) for child in self.children
        )
        return total_impedance

    def __str__(self):
        return "-".join(str(child) for child in self.children)

    def to_dict(self) -> dict:
        return {"type": "series", "children": [c.to_dict() for c in self.children]}


class ParallelNode(CircuitNode):
    def __init__(self, children):
        self.children = children

    def impedance(self, frequency: float, params) -> complex:
        total_admittance = sum(
            1 / child.impedance(frequency, params) for child in self.children
        )
        return 1 / total_admittance

    def __str__(self):
        children_strs = []
        for child in self.children:
            if isinstance(child, SeriesNode):
                children_strs.append(f"({str(child)})")
            else:
                children_strs.append(str(child))
        return "|".join(children_strs)

    def to_dict(self) -> dict:
        return {"type": "parallel", "children": [c.to_dict() for c in self.children]}


class RandlesNode(SeriesNode):
    def __init__(self):
        super().__init__(
            [
                ElementNode(Resistor()),
                ParallelNode(
                    [
                        SeriesNode([ElementNode(Resistor()), ElementNode(Warburg())]),
                        ElementNode(CPE()),
                    ]
                ),
            ]
        )


def parse_circuit(string: str) -> CircuitNode:
    """
    Parses a circuit string into a CircuitNode tree.
    Each element is represented by its type and an index (e.g., R1, C2, Q1).
    Capacitor (C), Resistor (R), Warburg (W), and CPE (Q) elements are supported.
    Example strings:
    - "R1-C1" (series)
    - "R1|C1" (parallel)
    - "R1-Q1|(R2-W1)" (R1 in series with parallel of Q1 and (R2-W1))
    """
    string = string.strip()

    if "(" in string:
        return _parse_with_parentheses(string)

    if "-" in string:
        parts = _split_by_operator(string, "-")
        children = [parse_circuit(part) for part in parts]
        return SeriesNode(children)

    if "|" in string:
        parts = _split_by_operator(string, "|")
        children = [parse_circuit(part) for part in parts]
        return ParallelNode(children)

    # Base case: single element
    return _create_element_node(string)


def _split_by_operator(string: str, operator: str) -> list:
    """
    Splits a string by the given operator, respecting parentheses.

    Args:
        string (str): The circuit string to split.
        operator (str): The operator character to split by ('|' or '-').
    Returns:
        list: List of substrings split by the operator.
    """
    parts = []
    current = []
    depth = 0

    for char in string:
        if char == "(":
            depth += 1
            current.append(char)
        elif char == ")":
            depth -= 1
            current.append(char)
        elif char == operator and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)

    if current:
        parts.append("".join(current).strip())

    return parts


def _parse_with_parentheses(string: str) -> CircuitNode:
    """
    Handles parsing when parentheses are present.

    Args:
        string (str): The circuit string containing parentheses.
        params (dict): Dictionary containing parameter values for elements.
    Returns:
        CircuitNode: The parsed CircuitNode tree.
    """
    # Find the main operator outside parentheses
    depth = 0
    parallel_pos = -1
    series_pos = -1

    for i, char in enumerate(string):
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif depth == 0:
            if char == "|" and parallel_pos == -1:
                parallel_pos = i
            elif char == "-" and series_pos == -1:
                series_pos = i

    if series_pos != -1:
        parts = _split_by_operator(string, "-")
        children = [parse_circuit(part) for part in parts]
        return SeriesNode(children)
    elif parallel_pos != -1:
        parts = _split_by_operator(string, "|")
        children = [parse_circuit(part) for part in parts]
        return ParallelNode(children)
    else:
        # The whole string is wrapped in parentheses
        if string.startswith("(") and string.endswith(")"):
            return parse_circuit(string[1:-1])
        else:
            return _create_element_node(string)


def _create_element_node(element_str: str) -> ElementNode:
    """
    Creates an ElementNode from an element string like 'R1', 'C2', etc.

    Args:
        element_str (str): The string representing the circuit element.
        params (dict): Dictionary containing parameter values for elements.

    Returns:
        ElementNode: The created ElementNode instance.
    """
    element_str = element_str.strip()

    # Parse element type
    element_type = element_str[0]
    element_id = element_str[1:]

    # Get parameter value(s) from params dict
    if element_type == "R":
        element = Resistor(name=element_id)
    elif element_type == "C":
        element = Capacitor(name=element_id)
    elif element_type == "L":
        element = Inductor(name=element_id)
    elif element_type == "W":
        element = Warburg(name=element_id)
    elif element_type == "Q":
        element = CPE(name=element_id)
    else:
        raise ValueError(f"Unknown element type: {element_type}")

    return ElementNode(element)
