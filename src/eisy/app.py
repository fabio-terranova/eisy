"""
Flask web application for EIS fitting.
"""

import logging

from flask import Flask, render_template

from eisy.data.models import CIRCUIT_MODELS
from eisy.web.routes import register_routes


def create_app(debug: bool = False):
    """Create and configure the Flask application."""
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="templates/static",
        static_url_path="/static",
    )

    # Configure logging
    if debug:
        app.logger.setLevel(logging.DEBUG)
    else:
        app.logger.setLevel(logging.INFO)

    # Register API routes
    register_routes(app)

    @app.route("/")
    def index():
        """Main page."""
        return render_template("index.html", circuit_models=CIRCUIT_MODELS)

    return app


# Create the app instance
app = create_app(debug=True)


if __name__ == "__main__":
    app.run(debug=True, port=5000)

