"""
API routes
"""

import io
import traceback

import numpy as np
from flask import jsonify, request, send_file

from ..core.parsing import parse_circuit
from ..data.synthetic import generate_synthetic_data
from ..data.utils import parse_data_file
from .validation import validate_circuit_string
from .web_utils import internal_to_web_params, web_to_internal_params


def register_routes(app):
    """Register all API routes with the Flask app."""
    
    @app.route("/api/generate_data", methods=["POST"])
    def generate_data():
        """Generate synthetic impedance data."""
        try:
            data = request.json
            
            # Validate inputs
            circuit_string = data.get("circuit")
            params = data.get("params")
            freq_min = float(data.get("freq_min", 1))
            freq_max = float(data.get("freq_max", 1e5))
            num_points = int(data.get("num_points", 50))
            noise_level = float(data.get("noise_level", 0.05))
            
            # Validation
            if not circuit_string:
                return jsonify({"success": False, "error": "Circuit string is required"}), 400
            
            if freq_min <= 0 or freq_max <= freq_min:
                return jsonify({
                    "success": False, 
                    "error": "Invalid frequency range. freq_max must be > freq_min > 0"
                }), 400
            
            if num_points < 2:
                return jsonify({
                    "success": False, 
                    "error": "num_points must be at least 2"
                }), 400
            
            if not 0 <= noise_level <= 1:
                return jsonify({
                    "success": False, 
                    "error": "noise_level must be between 0 and 1"
                }), 400
            
            # Convert web format params to circuit format
            param_names = list(params.keys())
            params = web_to_internal_params(params, param_names)

            freq, Z_noisy, Z_true = generate_synthetic_data(
                circuit_string, params, freq_min, freq_max, num_points, noise_level
            )

            return jsonify(
                {
                    "success": True,
                    "frequency": freq.tolist(),
                    "impedance_real": np.real(Z_noisy).tolist(),
                    "impedance_imag": np.imag(Z_noisy).tolist(),
                    "true_real": np.real(Z_true).tolist(),
                    "true_imag": np.imag(Z_true).tolist(),
                }
            )
        except ValueError as e:
            return jsonify({"success": False, "error": f"Invalid input: {str(e)}"}), 400
        except Exception as e:
            app.logger.error(f"Error generating data: {e}", exc_info=True)
            return jsonify({
                "success": False, 
                "error": "An error occurred while generating data"
            }), 500

    @app.route("/api/fit_models", methods=["POST"])
    def fit_models_api():
        """Fit multiple circuit models to impedance data and find the best one."""
        try:
            data = request.json
            freq = np.array(data["frequency"])
            Z_exp_real = np.array(data["impedance_real"])
            Z_exp_imag = np.array(data["impedance_imag"])
            Z_exp = Z_exp_real + 1j * Z_exp_imag

            models_to_fit = data["models"]  # List of model configurations

            results = []
            best_r2 = -np.inf
            best_model_idx = 0

            for idx, model_config in enumerate(models_to_fit):
                try:
                    circuit_string = model_config["circuit"]
                    param_names = model_config["param_names"]

                    # Convert parameters from web format to circuit format
                    initial_params = web_to_internal_params(
                        model_config["initial_guess"], param_names
                    )

                    # Parse circuit and fit
                    circuit = parse_circuit(circuit_string)
                    fitted_params, r_squared = circuit.fit(freq, Z_exp, initial_params)

                    # Generate fitted impedance
                    Z_fit = np.array(
                        [circuit.impedance(f, fitted_params) for f in freq]
                    )

                    # Convert fitted params back to web format
                    fitted_params_web = internal_to_web_params(fitted_params)

                    # Track best model
                    if r_squared > best_r2:
                        best_r2 = r_squared
                        best_model_idx = idx

                    results.append(
                        {
                            "success": True,
                            "model_name": model_config.get("name", f"Model {idx + 1}"),
                            "circuit": circuit_string,
                            "fitted_params": fitted_params_web,
                            "r_squared": float(r_squared),
                            "frequency": freq.tolist(),
                            "fitted_real": np.real(Z_fit).tolist(),
                            "fitted_imag": np.imag(Z_fit).tolist(),
                        }
                    )

                except Exception as e:
                    results.append(
                        {
                            "success": False,
                            "model_name": model_config.get("name", f"Model {idx + 1}"),
                            "circuit": model_config["circuit"],
                            "error": str(e),
                            "traceback": traceback.format_exc(),
                        }
                    )

            return jsonify(
                {
                    "success": True,
                    "results": results,
                    "best_model_index": best_model_idx,
                    "best_r_squared": best_r2,
                }
            )

        except Exception as e:
            return jsonify(
                {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            ), 400

    @app.route("/api/fit_single", methods=["POST"])
    def fit_single_api():
        """Fit a single circuit model to impedance data."""
        try:
            data = request.json
            circuit_string = data["circuit"]
            freq = np.array(data["frequency"])
            Z_exp_real = np.array(data["impedance_real"])
            Z_exp_imag = np.array(data["impedance_imag"])
            Z_exp = Z_exp_real + 1j * Z_exp_imag

            # Convert parameters from web format to circuit format
            param_names = data["param_names"]
            initial_params = web_to_internal_params(data["initial_guess"], param_names)

            # Parse circuit and fit
            circuit = parse_circuit(circuit_string)
            fitted_params, r_squared = circuit.fit(freq, Z_exp, initial_params)

            # Generate fitted impedance
            Z_fit = np.array([circuit.impedance(f, fitted_params) for f in freq])

            # Convert fitted params back to web format
            fitted_params_web = internal_to_web_params(fitted_params)

            # Create param errors dict (all zeros for now, would need pcov for real errors)
            param_errors = {key: 0.0 for key in fitted_params_web.keys()}

            return jsonify(
                {
                    "success": True,
                    "fitted_params": fitted_params_web,
                    "param_errors": param_errors,
                    "r_squared": float(r_squared),
                    "frequency": freq.tolist(),
                    "fitted_real": np.real(Z_fit).tolist(),
                    "fitted_imag": np.imag(Z_fit).tolist(),
                }
            )
        except Exception as e:
            return jsonify(
                {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            ), 400

    @app.route("/api/validate_circuit", methods=["POST"])
    def validate_circuit():
        """Validate a circuit string."""
        try:
            data = request.json
            circuit_string = data["circuit"]
            result = validate_circuit_string(circuit_string)

            if result["valid"]:
                return jsonify(result)
            else:
                return jsonify(result), 400
        except Exception as e:
            return jsonify({"valid": False, "error": str(e)}), 400

    @app.route("/api/parse_data_file", methods=["POST"])
    def parse_data_file_api():
        """Parse uploaded data file and return frequency and impedance data."""
        try:
            data = request.json
            file_content = data["content"]
            filename = data.get("filename", "")

            freq, Z_real, Z_imag = parse_data_file(file_content, filename)

            return jsonify(
                {
                    "success": True,
                    "frequency": freq.tolist(),
                    "impedance_real": Z_real.tolist(),
                    "impedance_imag": Z_imag.tolist(),
                    "num_points": len(freq),
                }
            )
        except Exception as e:
            return jsonify(
                {"success": False, "error": str(e), "traceback": traceback.format_exc()}
            ), 400

    @app.route("/api/export_synthetic_csv", methods=["POST"])
    def export_synthetic_csv():
        """Generate synthetic data and return as CSV file for download."""
        try:
            data = request.json
            circuit_string = data["circuit"]
            params_web = data["params"]
            freq_min = float(data.get("freq_min", 1))
            freq_max = float(data.get("freq_max", 1e5))
            num_points = int(data.get("num_points", 50))
            noise_level = float(data.get("noise_level", 0.05))

            # Convert web format params to circuit format
            param_names = list(params_web.keys())
            params = web_to_internal_params(params_web, param_names)

            freq, Z_noisy, Z_true = generate_synthetic_data(
                circuit_string, params, freq_min, freq_max, num_points, noise_level
            )

            # Create CSV content in memory
            output = io.StringIO()

            # Add metadata as comments
            output.write("# Synthetic EIS Data\n")
            output.write(f"# Circuit: {circuit_string}\n")
            output.write(f"# Parameters: {params_web}\n")
            output.write(f"# Frequency range: {freq_min} - {freq_max} Hz\n")
            output.write(f"# Number of points: {num_points}\n")
            output.write(f"# Noise level: {noise_level}\n")
            output.write("#\n")
            output.write("Frequency (Hz),Z_real (Ohm),Z_imag (Ohm)\n")
            for i in range(len(freq)):
                output.write(
                    f"{freq[i]:.6e},{np.real(Z_noisy[i]):.6e},{np.imag(Z_noisy[i]):.6e}\n"
                )

            # Create BytesIO object from string
            csv_data = io.BytesIO(output.getvalue().encode("utf-8"))
            output.close()

            # Send file
            return send_file(
                csv_data,
                mimetype="text/csv",
                as_attachment=True,
                download_name="synthetic_eis_data.csv",
            )
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400
