from __future__ import annotations
import os, re
from functools import lru_cache
from pathlib import Path
from typing import Any
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
MODEL_DIR = DATA / "models"
RANKING_DIR = DATA / "rankings"
RADIATION_DIR = DATA / "radiation"

app = FastAPI(title="ML Antenna Intelligence API", version="1.0.0",
              description="API for saved ML antenna models and project evidence.")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])

CONFIGS = ["Conventional", "S1_OFF", "S1_ON", "S2_OFF", "S2_ON", "S3_OFF", "S3_ON",
           "S4_OFF", "S4_ON", "S5_OFF", "S5_ON", "Slot", "Split"]
MODEL_FILES = {"S11": "s11_config_aware_model.joblib",
               "Gain": "gain_config_aware_model.joblib",
               "VSWR": "vswr_config_aware_model.joblib"}

def load_csv(filename: str):
    path = RANKING_DIR / filename
    if not path.exists():
        return None
    try:
        return pd.read_csv(path)
    except Exception:
        return None

@lru_cache(maxsize=1)
def load_models():
    result = {}
    for key, filename in MODEL_FILES.items():
        path = MODEL_DIR / filename
        if path.exists():
            try:
                result[key] = joblib.load(path)
            except Exception:
                pass
    return result

def switch_features(configuration: str):
    match = re.search(r"S([1-5])", configuration.upper())
    number = int(match.group(1)) if match else 0
    state = 1 if "_ON" in configuration.upper() else 0
    return number, state

def records(df):
    if df is None:
        return []
    return df.astype(object).where(pd.notna(df), None).to_dict(orient="records")

def image_path(name):
    path = RADIATION_DIR / name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Saved radiation plot not found: {name}")
    return path

class PredictionInput(BaseModel):
    configuration: str
    frequency_GHz: float = Field(ge=1.0, le=20.0)

@app.get("/")
def root():
    return {"name": "ML Antenna Intelligence API", "docs": "/docs"}

@app.get("/api/health")
def health():
    models = load_models()
    ml = load_csv("ml_predicted_candidate_ranking.csv")
    evidence = load_csv("radiation_supported_evidence_ranking.csv")
    radiation = all((RADIATION_DIR / x).exists() for x in ["radiation_comparison_phi_0.png", "radiation_comparison_phi_90.png"])
    return {"status": "ok", "models_loaded": len(models) == 3,
            "models_available": sorted(models.keys()), "rankings_loaded": ml is not None and evidence is not None,
            "ml_ranking_rows": 0 if ml is None else len(ml), "evidence_ranking_rows": 0 if evidence is None else len(evidence),
            "radiation_plots_loaded": radiation}

@app.get("/api/rankings")
def rankings(kind: str = "evidence"):
    if kind not in {"ml", "evidence"}:
        raise HTTPException(status_code=400, detail="kind must be 'ml' or 'evidence'")
    filename = "ml_predicted_candidate_ranking.csv" if kind == "ml" else "radiation_supported_evidence_ranking.csv"
    df = load_csv(filename)
    if df is None:
        return {"kind": kind, "rows": [], "available": False,
                "message": f"Ranking file not found. Expected backend/data/rankings/{filename}"}
    return {"kind": kind, "rows": records(df), "available": True, "source_file": filename}

@app.post("/api/predict")
def predict(body: PredictionInput):
    if body.configuration not in CONFIGS:
        raise HTTPException(status_code=400, detail=f"Choose one of the supported configurations: {', '.join(CONFIGS)}")
    models = load_models()
    missing = [name for name in MODEL_FILES if name not in models]
    if missing:
        raise HTTPException(status_code=503, detail="Saved model file(s) unavailable: " + ", ".join(MODEL_FILES[n] for n in missing))
    number, state = switch_features(body.configuration)
    X = pd.DataFrame([{"frequency_GHz": float(body.frequency_GHz), "switch_number": number,
                       "switch_state": state, "configuration": body.configuration}])
    try:
        values = {name: float(model.predict(X)[0]) for name, model in models.items()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model prediction failed. Check model compatibility and feature schema. Details: {exc}")
    return {"configuration": body.configuration, "frequency_GHz": body.frequency_GHz,
            "S11": values["S11"], "Gain": values["Gain"], "VSWR": values["VSWR"],
            "gain_unit": "unit not confirmed from source export",
            "matching_pass": values["S11"] <= -10 and values["VSWR"] <= 2,
            "result_type": "ML prediction", "not_hfss_result": True,
            "validation_warning": "Held-out 18–19 GHz S11 generalization was weak; corroborate with HFSS."}

@app.get("/api/radiation")
def radiation():
    names = [("phi-0", "radiation_comparison_phi_0.png"), ("phi-90", "radiation_comparison_phi_90.png")]
    return {"images": [{"id": key, "filename": filename, "available": (RADIATION_DIR / filename).exists()} for key, filename in names]}

@app.get("/api/radiation/phi-0")
def radiation_phi0():
    return FileResponse(image_path("radiation_comparison_phi_0.png"), media_type="image/png")

@app.get("/api/radiation/phi-90")
def radiation_phi90():
    return FileResponse(image_path("radiation_comparison_phi_90.png"), media_type="image/png")

@app.get("/api/validation")
def validation():
    # Recorded project metrics from the existing held-out 18–19 GHz evaluation.
    return {"band": "18–19 GHz", "metrics": [
        {"target": "S11", "mae": "4.6877 dB", "rmse": "6.9497 dB", "r2": "-0.7531"},
        {"target": "Gain", "mae": "0.3996", "rmse": "0.7354", "r2": "0.7648"},
        {"target": "VSWR", "mae": "0.1054", "rmse": "0.1275", "r2": "0.6062"},
    ], "note": "Saved held-out evaluation metrics from existing project work; not a fresh training run."}
