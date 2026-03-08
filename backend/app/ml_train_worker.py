"""
Standalone entrypoint for ML training in a separate process.
Survives uvicorn --reload; progress is written to ML_TRAIN_PROGRESS_FILE.
Run: python -m app.ml_train_worker (with ML_TRAIN_PROGRESS_FILE set in env).
"""
import asyncio
import os
import sys


def main() -> None:
    if not os.environ.get("ML_TRAIN_PROGRESS_FILE"):
        sys.exit("ML_TRAIN_PROGRESS_FILE not set")
    from app.api.ml import _run_training_background
    asyncio.run(_run_training_background())


if __name__ == "__main__":
    main()
