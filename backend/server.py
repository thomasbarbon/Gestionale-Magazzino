from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

ALLOWED_BRANDS = {
    "Michelin", "Pirelli", "Continental", "Bridgestone", "Goodyear",
    "Dunlop", "Hankook", "Firestone", "Yokohama", "Falken",
    "Kleber", "BFGoodrich", "Vredestein", "Nokian", "Kumho",
    "Toyo", "Nexen", "Uniroyal", "Fulda", "Barum",
}
Season = Literal["All Season", "Invernali", "Estive"]

SIZE_RE = re.compile(r"R(\d{2})", re.IGNORECASE)


def extract_rim(size: str) -> Optional[int]:
    m = SIZE_RE.search(size or "")
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def utcnow_iso() -> str:
    # Explicit UTC with 'Z' suffix so clients parse it correctly regardless of
    # their local timezone.
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class Tire(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    size: str
    brand: str
    season: Season
    rim: int
    quantity: int = 0
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


class TireCreate(BaseModel):
    size: str
    brand: str
    season: Season
    quantity: int = Field(ge=1)
    operator: Optional[str] = None

    @field_validator("size")
    @classmethod
    def _size_ok(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or extract_rim(v) is None:
            raise ValueError("Sigla/misura non valida (es. 185/60 R15 91V)")
        return v

    @field_validator("brand")
    @classmethod
    def _brand_ok(cls, v: str) -> str:
        if v not in ALLOWED_BRANDS:
            raise ValueError("Marchio non consentito")
        return v


class QuantityUpdate(BaseModel):
    delta: int
    operator: Optional[str] = None
    reason: Optional[str] = None


class Movement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tire_id: str
    size: str
    brand: str
    season: Season
    rim: int
    type: Literal["create", "add", "remove", "delete"]
    delta: int
    quantity_after: int
    operator: Optional[str] = None
    timestamp: str = Field(default_factory=utcnow_iso)


async def log_movement(tire: dict, mtype: str, delta: int, qty_after: int, operator: Optional[str]):
    mv = Movement(
        tire_id=tire["id"],
        size=tire["size"],
        brand=tire["brand"],
        season=tire["season"],
        rim=tire["rim"],
        type=mtype,  # type: ignore
        delta=delta,
        quantity_after=qty_after,
        operator=(operator or None),
    )
    await db.movements.insert_one(mv.model_dump())


@api_router.get("/")
async def root():
    return {"message": "GommaGest API"}


@api_router.get("/brands")
async def get_brands():
    return {"brands": sorted(ALLOWED_BRANDS), "seasons": ["All Season", "Invernali", "Estive"]}


@api_router.get("/tires", response_model=List[Tire])
async def list_tires():
    docs = await db.tires.find({}, {"_id": 0}).sort("rim", 1).to_list(5000)
    return [Tire(**d) for d in docs]


@api_router.post("/tires", response_model=Tire)
async def create_tire(payload: TireCreate):
    rim = extract_rim(payload.size)
    assert rim is not None
    existing = await db.tires.find_one(
        {"size": payload.size, "brand": payload.brand, "season": payload.season},
        {"_id": 0},
    )
    if existing:
        new_qty = int(existing["quantity"]) + payload.quantity
        now = utcnow_iso()
        await db.tires.update_one(
            {"id": existing["id"]},
            {"$set": {"quantity": new_qty, "updated_at": now}},
        )
        existing["quantity"] = new_qty
        existing["updated_at"] = now
        await log_movement(existing, "add", payload.quantity, new_qty, payload.operator)
        return Tire(**existing)

    tire = Tire(
        size=payload.size,
        brand=payload.brand,
        season=payload.season,
        rim=rim,
        quantity=payload.quantity,
    )
    await db.tires.insert_one(tire.model_dump())
    await log_movement(tire.model_dump(), "create", payload.quantity, payload.quantity, payload.operator)
    return tire


@api_router.patch("/tires/{tire_id}/quantity", response_model=Tire)
async def update_quantity(tire_id: str, payload: QuantityUpdate):
    tire = await db.tires.find_one({"id": tire_id}, {"_id": 0})
    if not tire:
        raise HTTPException(status_code=404, detail="Pneumatico non trovato")
    new_qty = int(tire["quantity"]) + payload.delta
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Quantità non può essere negativa")
    now = utcnow_iso()
    await db.tires.update_one(
        {"id": tire_id},
        {"$set": {"quantity": new_qty, "updated_at": now}},
    )
    tire["quantity"] = new_qty
    tire["updated_at"] = now
    mtype = "add" if payload.delta > 0 else "remove"
    await log_movement(tire, mtype, payload.delta, new_qty, payload.operator)
    return Tire(**tire)


@api_router.delete("/tires/{tire_id}")
async def delete_tire(tire_id: str, operator: Optional[str] = None):
    tire = await db.tires.find_one({"id": tire_id}, {"_id": 0})
    if not tire:
        raise HTTPException(status_code=404, detail="Pneumatico non trovato")
    await db.tires.delete_one({"id": tire_id})
    await log_movement(tire, "delete", -int(tire["quantity"]), 0, operator)
    return {"ok": True}


@api_router.get("/movements", response_model=List[Movement])
async def list_movements(limit: int = 50):
    docs = (
        await db.movements.find({}, {"_id": 0})
        .sort("timestamp", -1)
        .to_list(max(1, min(limit, 500)))
    )
    return [Movement(**d) for d in docs]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
