"""Request logging helpers.

The current deploy path relies on container stdout logs from FastAPI, Kong, and
OPA. Keep this module as the future home for structured JSON logging and
correlation-id propagation instead of leaving an unexplained empty file.
"""
