"""
HMM wrapper for market regime classification.

The model is trained once (scripts/train_regime_model.py) on BTC daily history
as the market-wide anchor. Inference works on any token's feature vector because
the feature schema (return, realized_vol, funding_rate) is token-agnostic.

Regime labels map HMM hidden states → human-readable market context:
  0: low_vol_bull   — low volatility uptrend
  1: high_vol_bull  — volatile uptrend (momentum / euphoria)
  2: choppy         — directionless / ranging
  3: bear           — sustained downtrend
  4: high_vol_bear  — panic selling
  5: crisis         — extreme dislocation
"""
from __future__ import annotations

import pickle
import numpy as np
from pathlib import Path
from hmmlearn.hmm import GaussianHMM

MODEL_PATH = Path("models/regime_hmm.pkl")

REGIME_LABELS: dict[int, str] = {
    0: "low_vol_bull",
    1: "high_vol_bull",
    2: "choppy",
    3: "bear",
    4: "high_vol_bear",
    5: "crisis",
}

# Inverse map for external lookups
LABEL_TO_STATE: dict[str, int] = {v: k for k, v in REGIME_LABELS.items()}


class RegimeHMM:
    def __init__(self) -> None:
        self.model: GaussianHMM | None = None
        self._load()

    def _load(self) -> None:
        if MODEL_PATH.exists():
            with open(MODEL_PATH, "rb") as f:
                self.model = pickle.load(f)

    def is_trained(self) -> bool:
        return self.model is not None

    def predict(self, features: np.ndarray) -> tuple[str, float]:
        """
        Classify the market regime from a (N, 3) feature matrix.

        Returns (regime_label, confidence) where confidence is in [0, 1].
        Falls back to ("choppy", 0.50) when the model has not been trained yet.
        """
        if self.model is None:
            return "choppy", 0.50

        states = self.model.predict(features)
        label = REGIME_LABELS.get(int(states[-1]), "choppy")

        # Log-likelihood normalized to [0, 1] — rough but consistent heuristic
        log_prob = self.model.score(features)
        confidence = min(1.0, max(0.0, (log_prob + 10) / 10))
        return label, round(confidence, 3)

    def train(self, features: np.ndarray) -> None:
        """Fit a 6-state full-covariance HMM and persist to disk."""
        model = GaussianHMM(
            n_components=6,
            covariance_type="full",
            n_iter=200,
            random_state=42,
        )
        model.fit(features)
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
        self.model = model


# Module-level singleton — imported by agent4 and the training script
regime_hmm = RegimeHMM()
