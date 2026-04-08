"""
Worker placeholder per alerts e analisi automatica.
Non attivo in v1 — struttura pronta per v2.
"""
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    enabled = os.getenv("WORKER_ENABLED", "false").lower() == "true"
    if not enabled:
        logger.info("Worker disabilitato (WORKER_ENABLED=false). Struttura pronta per v2.")
        return

    logger.info("Worker attivo — caricamento checks...")


if __name__ == "__main__":
    main()
