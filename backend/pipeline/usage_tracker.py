from typing import Any, Dict, List, Optional, Tuple

# Default pricing in USD per 1M tokens (input, output)
DEFAULT_PRICING: Dict[str, Tuple[float, float]] = {
    "gemini-3.5-flash":       (1.50, 9.00),
    "gemini-3.7-flash":       (1.50, 9.00),
    "gemini-3.8-flash":       (1.50, 9.00),
    "gemini-3.5-flash-lite":  (0.25, 1.50),
    "gemini-3.1-flash-lite":  (0.25, 1.50),
    "gemini-2.5-flash":       (0.50, 3.00),
    "gemini-2.5-flash-lite":  (0.20, 1.00),
    "gemini-2.5-pro":         (1.25, 10.00),
    "gemini-3.1-pro":         (2.00, 12.00),
}


class UsageTracker:
    def __init__(self, usd_to_inr: float = 88.0, pricing: Optional[Dict[str, Tuple[float, float]]] = None):
        self.usd_to_inr = usd_to_inr
        self.pricing = pricing or DEFAULT_PRICING
        self.calls: List[Dict[str, Any]] = []

    def log_call(self, label: str, model_name: str, input_tokens: int, output_tokens: int, reasoning_tokens: int = 0):
        cost_usd = self.calculate_cost(model_name, input_tokens, output_tokens)
        cost_inr = cost_usd * self.usd_to_inr
        record = {
            "label": label,
            "model": model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "cost_usd": round(cost_usd, 6),
            "cost_inr": round(cost_inr, 4),
        }
        self.calls.append(record)

    def calculate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        # Match prefix
        for key, (in_price, out_price) in self.pricing.items():
            if model_name.startswith(key) or key in model_name:
                return (input_tokens / 1_000_000.0 * in_price) + (output_tokens / 1_000_000.0 * out_price)
        # Default fallback: 0.50 / 3.00
        return (input_tokens / 1_000_000.0 * 0.50) + (output_tokens / 1_000_000.0 * 3.00)

    @property
    def total_tokens(self) -> Tuple[int, int]:
        total_in = sum(c["input_tokens"] for c in self.calls)
        total_out = sum(c["output_tokens"] for c in self.calls)
        return total_in, total_out

    @property
    def total_cost_usd(self) -> float:
        return sum(c["cost_usd"] for c in self.calls)

    @property
    def total_cost_inr(self) -> float:
        return sum(c["cost_inr"] for c in self.calls)

    def summary(self) -> Dict[str, Any]:
        total_in, total_out = self.total_tokens
        return {
            "calls": self.calls,
            "total_input_tokens": total_in,
            "total_output_tokens": total_out,
            "total_tokens": total_in + total_out,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "total_cost_inr": round(self.total_cost_inr, 2),
        }
