import numpy as np


def coth(x):
    """Compute the hyperbolic cotangent of x."""
    return 1 / np.tanh(x)


class CircuitElement:
    def __init__(self, name=None):
        self.name = name

    def impedance(self, frequency: float) -> complex:
        raise NotImplementedError("Subclasses must implement this method.")


class Resistor(CircuitElement):
    def __str__(self):
        return f"R{self.name}"

    def impedance(self, frequency: float, R: float) -> complex:
        if isinstance(frequency, np.ndarray):
            return np.full_like(frequency, R, dtype=complex)
        else:
            return R + 0j


class Capacitor(CircuitElement):
    def __str__(self):
        return f"C{self.name}"

    def impedance(self, frequency: float, C: float) -> complex:
        omega = 2 * np.pi * frequency
        return 1 / (1j * omega * C)


class Inductor(CircuitElement):
    def __str__(self):
        return f"L{self.name}"

    def impedance(self, frequency: float, L: float) -> complex:
        omega = 2 * np.pi * frequency
        return 1j * omega * L


class Warburg(CircuitElement):
    def __str__(self):
        return f"W{self.name}"

    def impedance(self, frequency: float, Aw: float) -> complex:
        real_part = Aw / np.sqrt(2 * np.pi * frequency)
        imag_part = Aw / (1j * np.sqrt(2 * np.pi * frequency))
        return real_part + imag_part


class WarburgShort(CircuitElement):
    def __str__(self):
        return f"S{self.name}"

    def impedance(self, frequency: float, params: tuple) -> complex:
        Aw, B = params
        omega = 2 * np.pi * frequency
        return Aw * np.tanh(B * np.sqrt(1j * omega)) / np.sqrt(1j * omega)


class WarburgOpen(CircuitElement):
    def __str__(self):
        return f"O{self.name}"

    def impedance(self, frequency: float, params: tuple) -> complex:
        Aw, B = params
        omega = 2 * np.pi * frequency
        return Aw * coth(B * np.sqrt(1j * omega)) / np.sqrt(1j * omega)


class CPE(CircuitElement):
    def __str__(self):
        return f"Q{self.name}"

    def impedance(self, frequency: float, C_n: tuple) -> complex:
        C, n = C_n
        if n <= 0 or n > 1:
            raise ValueError("CPE exponent n must be in the range (0, 1].")
        return 1 / (C * (1j * 2 * np.pi * frequency) ** n)
