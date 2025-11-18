"""
EISy - Electrochemical Impedance Spectroscopy fitting library
"""

import argparse


def run_web_app(host="127.0.0.1", port=5000, debug=False):
    """
    Launch the EISy web interface.

    Args:
        host: Host address to bind to (default: 127.0.0.1)
        port: Port number to run on (default: 5000)
        debug: Enable debug mode (default: False)
    """
    from .app import app

    app.run(host=host, port=port, debug=debug)


def cli():
    """Command line interface."""
    parser = argparse.ArgumentParser(
        description="EISy - Electrochemical Impedance Spectroscopy fitting library"
    )
    parser.add_argument("--web", action="store_true", help="Run the EISy web interface")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host address to bind the web interface (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port number for the web interface (default: 5000)",
    )
    parser.add_argument(
        "--debug", action="store_true", help="Enable debug mode for the web interface"
    )
    args = parser.parse_args()

    if args.web:
        host = args.host
        port = args.port
        debug = args.debug

        if debug:
            print("Debug mode is enabled")

        run_web_app(host=host, port=port, debug=debug)
    else:
        pass # Future CLI functionalities
