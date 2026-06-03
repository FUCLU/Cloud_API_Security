"""Order service helpers.

Security-sensitive order ownership checks currently live in
`app.security.bola_guard` and are called by `api.v1.orders`. This file is kept
as the future boundary for order business logic once API handlers are thinned.
"""
