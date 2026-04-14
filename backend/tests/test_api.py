from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_endpoint_returns_expected_sections() -> None:
    payload = {
        "spot_price": 100,
        "strike_price": 100,
        "time_to_expiry": 1,
        "volatility": 0.2,
        "risk_free_rate": 0.05,
        "option_type": "call",
    }

    response = client.post("/api/analyze", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["price"]["option_price"] > 0
    assert set(body) == {
        "inputs",
        "price",
        "greeks",
        "payoff",
        "volatility_sensitivity",
        "time_sensitivity",
    }


def test_simulate_endpoint_returns_monte_carlo_summary() -> None:
    payload = {
        "spot_price": 100,
        "strike_price": 105,
        "time_to_expiry": 0.75,
        "volatility": 0.25,
        "risk_free_rate": 0.03,
        "option_type": "put",
        "num_simulations": 500,
        "num_steps": 10,
        "random_seed": 21,
    }

    response = client.post("/api/simulate", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["percentile_95"] >= body["percentile_50"] >= body["percentile_5"]
    assert len(body["sample_paths"]) <= 30
