import numpy as np

from .parsing import parse_circuit

import logging
import warnings

logger = logging.getLogger(__name__)


def best_model(models: list, freq: np.ndarray, Z_exp: np.ndarray) -> tuple:
    """Select the best fitting model based on R^2 value.

    Args:
        models (list): List of CircuitNode models to evaluate.
        freq (array): Array of frequency values.
        Z_exp (array): Array of experimental impedance values (complex numbers).

    Returns:
        tuple: A tuple containing the best model and its fitted parameters.
    """
    best_r_squared = -np.inf
    best_model = None
    best_params = None

    failed_models = []

    for model, params in models:
        try:
            circuit = parse_circuit(model)
            fitted_params, r_squared = circuit.fit(freq, Z_exp, params)

            if r_squared > best_r_squared:
                best_r_squared = r_squared
                best_model = (model, r_squared)
                best_params = fitted_params

            logger.info(f"Model {model}: R² = {r_squared:.6f}")
        except Exception as e:
            logger.warning(f"Model {model} fitting failed: {e}")
            failed_models.append((model, str(e)))
            continue

    if best_model is None:
        error_summary = "\n".join([f"  - {m}: {e}" for m, e in failed_models])
        warnings.warn(
            f"All models failed to fit. Errors:\n{error_summary}", RuntimeWarning
        )

    return best_model, best_params
